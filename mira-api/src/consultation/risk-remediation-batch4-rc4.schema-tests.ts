import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import {
  OLD_REPORT_BUILT_AT,
  USEFUL_ANSWER_AR,
  buildPlan,
  classifyTransportStatus,
  executeScenarios,
  providerPayloadForPrompt,
  providerTurnsFor,
  runAuthorizedLive,
  scenarios,
} from './run-live-consultation-b4';
import { MCE_LLM_MAX_COMPLETION_TOKENS } from './services/mce-llm.service';

type Recorded = { model?: string; max_tokens?: number; stream?: boolean; messages?: Array<{ role: string; content: string }>; authorization: boolean };

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function startServer() {
  const requests: Recorded[] = [];
  const server = createServer(async (req, res: ServerResponse) => {
    const raw = await readBody(req);
    const body = JSON.parse(raw) as Recorded;
    requests.push({
      model: body.model,
      max_tokens: body.max_tokens,
      stream: Boolean(body.stream),
      messages: body.messages,
      authorization: Boolean(req.headers.authorization),
    });
    const last = [...(body.messages ?? [])].reverse().find((row) => row.role === 'user')?.content ?? '';
    if (last.includes('PROVIDER_REJECT')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end('{"error":"rejected"}');
      return;
    }
    if (last.includes('PROVIDER_HANG')) return;
    const content = providerPayloadForPrompt(last, '');
    if (body.stream) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const mid = Math.ceil(content.length / 2);
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: content.slice(0, mid) } }] })}\n\n`);
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: content.slice(mid) } }] })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content } }], usage: { completion_tokens: 12 } }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  return { server, requests, port: address.port };
}

function lastUser(row: Recorded): string {
  return [...(row.messages ?? [])].reverse().find((item) => item.role === 'user')?.content ?? '';
}

function joined(row: Recorded): string {
  return (row.messages ?? []).map((item) => item.content).join('\n');
}

async function main(): Promise<void> {
  const planned = providerTurnsFor(scenarios.filter((scenario) => !scenario.localFailure));
  assert.equal(planned, buildPlan().plannedProviderCalls);
  assert.notEqual(planned, 16);
  assert.equal(classifyTransportStatus(401), 'rejected');
  const previous = process.env.MIRA_LIVE_CONSULTATION_AUTHORIZED;
  delete process.env.MIRA_LIVE_CONSULTATION_AUTHORIZED;
  const blocked = await runAuthorizedLive({ LLM_BASE_URL: 'http://127.0.0.1:9', LLM_API_KEY: 'local-intercept-not-a-secret' }, scenarios, { requireLoopback: true });
  assert.equal(blocked.sent, false);
  assert.equal(blocked.providerAttempts, 0);

  const { server, requests, port } = await startServer();
  const overrides = {
    LLM_BASE_URL: `http://127.0.0.1:${port}`,
    LLM_API_KEY: 'local-intercept-not-a-secret',
    MCE_LLM_MODEL: 'local-intercept-model',
    MCE_LLM_TIMEOUT_MS: '30000',
  };
  process.env.MIRA_LIVE_CONSULTATION_AUTHORIZED = '1';
  const rejectedApp = await runAuthorizedLive(overrides, scenarios, { requireLoopback: true, applicationStatus: 401 });
  assert.equal(rejectedApp.sent, false);
  assert.equal(rejectedApp.countedAsModel, false);
  assert.equal(requests.length, 0);

  const live = await runAuthorizedLive(overrides, scenarios, { requireLoopback: true });
  assert.equal(live.sent, true);
  if (!('rows' in live) || !live.rows || !live.counts) throw new Error('live execution missing rows');
  assert.equal(requests.length, planned);
  assert.equal(live.counts.providerAttempts, planned);
  assert.equal(live.counts.providerSuccess, planned);
  assert.equal(live.counts.providerFailed, 0);
  assert.equal(live.counts.liveModel, planned);
  assert.ok(requests.every((row) => row.model === 'local-intercept-model' && row.max_tokens === MCE_LLM_MAX_COMPLETION_TOKENS && row.authorization));
  assert.equal(requests.filter((row) => row.stream).length, 1);

  const row = (id: string, turn = 1) => live.rows.find((item) => item.id === id && item.turn === turn);
  const c03 = row('C03');
  const c04 = row('C04');
  const c10a = row('C10', 1);
  const c10b = row('C10', 2);
  const c11a = row('C11', 1);
  const c11b = row('C11', 2);
  const fake = row('B4-FAKE-R2');
  assert.equal(c03?.met, 'LOCAL_MET');
  assert.equal(c04?.met, 'LOCAL_MET');
  assert.equal(c10a?.met, 'LOCAL_MET');
  assert.equal(c10b?.met, 'LOCAL_MET');
  assert.equal(c10b?.source, 'live-model');
  assert.equal(c11a?.source, 'live-model');
  assert.equal(c11b?.source, 'live-model');
  assert.equal(row('CACHE-PROBE')?.source, 'cache');
  assert.equal(row('C05')?.source, 'server');
  assert.equal(row('C07')?.source, 'barrier');
  assert.equal(live.rows.find((item) => item.id === 'C15')?.met, 'NOT_RUN');
  assert.equal(live.rows.find((item) => item.id === 'C16')?.met, 'NOT_RUN');
  assert.equal(live.rows.find((item) => item.id === 'C13')?.met, 'NOT_RUN');
  assert.equal(fake?.met, 'LOCAL_MET');
  assert.equal(/الترطيب\s*10/.test(`${fake?.reply ?? ''}\n${fake?.delta ?? ''}`), false);
  assert.equal((row('C01')?.reply ?? '').includes(USEFUL_ANSWER_AR), true);
  assert.ok(live.rows.every((item) => item.quality === 'NOT_RUN'));

  const c04Request = requests.find((item) => lastUser(item).includes('أستخدم حمضًا') || lastUser(item).includes('تقريري قديم'));
  assert.ok(c04Request);
  assert.equal(joined(c04Request).includes(OLD_REPORT_BUILT_AT), true);
  assert.equal(joined(c04Request).includes('أستخدم حمضًا في المساء'), true);
  assert.equal(joined(c04Request).includes('الترطيب = 40'), true);
  const c03Request = requests.find((item) => lastUser(item) === 'تقريري غير موجود');
  assert.ok(c03Request);
  assert.equal(joined(c03Request).includes('[بشرة]'), false);
  assert.equal(joined(c03Request).includes('skin.moisture'), false);
  const firstAllergy = requests.find((item) => lastUser(item) === 'ماذا يناسب بشرتي؟');
  const secondAllergy = requests.find((item) => lastUser(item).includes('أضفت حساسية'));
  assert.ok(firstAllergy && secondAllergy);
  assert.equal(joined(firstAllergy).includes('حساسية = عطر'), false);
  assert.equal(joined(secondAllergy).includes('حساسية = عطر'), true);
  assert.equal(requests.filter((item) => (item.messages ?? []).filter((message) => message.role === 'user' && message.content === 'ماذا يناسب بشرتي الجافة؟').length >= 2).length, 1);

  const beforeReject = requests.length;
  const reject = await runAuthorizedLive(overrides, [{
    id: 'PROVIDER-REJECT', caseId: 'C01', prompt: 'PROVIDER_REJECT', facts: [], acceptance: 'رفض المزود محاولة فاشلة.',
  }], { requireLoopback: true });
  assert.equal(reject.sent, true);
  if (!('counts' in reject) || !reject.counts || !reject.rows) throw new Error('reject missing');
  assert.equal(requests.length, beforeReject + 1);
  assert.equal(reject.counts.providerAttempts, 1);
  assert.equal(reject.counts.providerSuccess, 0);
  assert.equal(reject.counts.providerFailed, 1);
  assert.equal(reject.rows[0]?.source, 'provider-failed');

  const hang = await runAuthorizedLive({ ...overrides, MCE_LLM_TIMEOUT_MS: '200' }, [{
    id: 'PROVIDER-HANG', caseId: 'C16', prompt: 'PROVIDER_HANG', facts: [], acceptance: 'المهلة على فرع الإرسال.',
  }], { requireLoopback: true });
  if (!('counts' in hang) || !hang.counts) throw new Error('hang missing');
  assert.equal(hang.counts.providerSuccess, 0);
  assert.equal(hang.counts.providerFailed, 1);

  const refused = await runAuthorizedLive({
    ...overrides,
    LLM_BASE_URL: 'http://127.0.0.1:9',
    MCE_LLM_TIMEOUT_MS: '1000',
  }, [{ id: 'PROVIDER-DOWN', caseId: 'C15', prompt: 'انقطع الاتصال', facts: [], acceptance: 'فشل الشبكة على فرع الإرسال.' }], { requireLoopback: true });
  if (!('counts' in refused) || !refused.counts) throw new Error('refused missing');
  assert.equal(refused.counts.providerSuccess, 0);
  assert.equal(refused.counts.providerFailed, 1);

  const local = await executeScenarios('local');
  assert.equal(local.counts.stubModel, planned);
  assert.equal(local.counts.liveModel, 0);
  assert.equal(local.counts.localFailures, 2);
  assert.equal(local.rows.find((item) => item.id === 'C15')?.source, 'local-failure');
  assert.equal(local.rows.find((item) => item.id === 'C03')?.met, 'LOCAL_MET');
  assert.equal(local.rows.find((item) => item.id === 'C04')?.met, 'LOCAL_MET');
  assert.equal(local.rows.filter((item) => item.id === 'C11').length, 2);
  assert.equal(local.rows.find((item) => item.id === 'B4-FAKE-R2')?.met, 'LOCAL_MET');

  server.close();
  if (previous === undefined) delete process.env.MIRA_LIVE_CONSULTATION_AUTHORIZED;
  else process.env.MIRA_LIVE_CONSULTATION_AUTHORIZED = previous;
  console.log('risk-remediation-batch4-rc4: PASS');
  console.log(`T-LIVE-SENDER-B4 planned ${planned} loopback posts ${planned} LIVE_MODEL_QUALITY NOT_RUN`);
}

void main();
