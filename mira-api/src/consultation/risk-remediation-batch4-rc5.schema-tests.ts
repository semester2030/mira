import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { MiraBeautyReport } from '../intelligence/contracts/mira-beauty-report.interface';
import { MceGroundingPipelineService } from './services/mce-grounding-pipeline.service';
import { MceFactExtractorService, trustedReportCreatedAt } from './services/mce-fact-extractor.service';
import { MceModerationService } from './services/mce-moderation.service';
import { McePromptAssemblerService } from './services/mce-prompt-assembler.service';
import {
  OLD_REPORT_BUILT_AT,
  USEFUL_ANSWER_AR,
  answerQuality,
  buildPlan,
  executeScenarios,
  providerTurnsFor,
  runAuthorizedLive,
  scenarios,
  type Scenario,
} from './run-live-consultation-b4';

const ALT_A = 'للعناية ببشرتك الجافة، اختاري غسولًا لطيفًا ومرطبًا مناسبًا.';
const ALT_B = 'البشرة الجافة تحتاج منظفًا غير قاسٍ ثم طبقة ترطيب.';
const CONTEXT_BUILT_AT = '2026-10-11T12:00:00.000Z';
const RECENT_REPORT_AT = '2026-10-10T09:00:00.000Z';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function jsonAnswer(answerAr: string): string {
  return JSON.stringify({
    answerAr,
    confidence: 'high',
    intent: 'general',
    citedFactIds: [],
    suggestedQuestionsAr: [],
    blocked: false,
    disclaimerAr: '',
  });
}

async function startServer() {
  const requests: Array<{ messages?: Array<{ role: string; content: string }> }> = [];
  const server = createServer(async (req, res: ServerResponse) => {
    const raw = await readBody(req);
    const body = JSON.parse(raw) as { messages?: Array<{ role: string; content: string }> };
    requests.push(body);
    const last = [...(body.messages ?? [])].reverse().find((row) => row.role === 'user')?.content ?? '';
    if (last.includes('رد فارغ')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: '' } }] }));
      return;
    }
    const answer = last.includes('ما العناية اليومية') ? ALT_B : ALT_A;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: jsonAnswer(answer) } }] }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  return { server, requests, port: address.port };
}

function reportFixture(score = 72): MiraBeautyReport {
  return {
    version: 1,
    spatialConfidence: 'none',
    overallBeautyScore: score,
    overallScoreAvailable: true,
    headlineAr: 'تقرير محفوظ',
    skinTypeAr: 'جافة',
    skinTypeEn: 'dry',
    ageComparison: { enabled: false },
    childSafety: { isMinor: false, ageThreshold: 18, restrictionsApplied: [] },
    mainConcerns: [],
    dailyRoutine: { morning: [], evening: [] },
    summaryAdviceAr: 'ترطيب.',
    tipsAr: [],
    faceMap: { enabled: false, zones: [] },
    faceHealthMap: {
      disclaimerAr: 'نصيحة عناية.',
      concernOverlays: [{ concernId: 'moisture', labelAr: 'الترطيب', globalScore: 40, severity: 'moderate' }],
    },
    concernZonesSection: { enabled: false, zones: [] },
    concernZonesNarrative: [],
    recommendedProducts: [],
    weeklyPlan: { enabled: false, headlineAr: '', summaryAr: '', days: [] },
    progressForecast: { enabled: false },
    beautyJourney: { enabled: false },
    confidenceLayer: { enabled: false, headlineAr: '' },
  } as unknown as MiraBeautyReport;
}

function storedRow(createdAt: Date | null, score = 72) {
  const report = reportFixture(score);
  return {
    id: 'analysis-rc5',
    userId: 'owner-rc5',
    createdAt,
    resultJson: { version: 2, miraReport: report },
  };
}

async function ground(row: ReturnType<typeof storedRow>) {
  const before = JSON.stringify(row.resultJson);
  const created = row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt;
  let writes = 0;
  const prisma = {
    skinAnalysis: {
      findFirst: async (query: { where: { id: string; userId: string } }) => (
        query.where.id === row.id && query.where.userId === row.userId ? row : null
      ),
      update: async () => { writes += 1; return row; },
      create: async () => { writes += 1; return row; },
    },
  };
  const intelligence = {
    enrichWithUserContext: (report: MiraBeautyReport) => report,
    attachProgressForecast: async (_userId: string, report: MiraBeautyReport) => report,
  };
  const pipeline = new MceGroundingPipelineService(prisma as never, intelligence as never, new MceFactExtractorService());
  const result = await pipeline.build({
    userId: row.userId,
    skinAnalysisId: row.id,
    locale: 'ar',
    subscriptionPlan: 'free',
  });
  return { result, before, created, writes, row };
}

function promptText(snapshot: Awaited<ReturnType<typeof ground>>['result']['snapshot'], facts: Awaited<ReturnType<typeof ground>>['result']['factRegistry'], history: Array<{ role: 'user' | 'assistant'; content: string }> = [], userMessage = 'تقريري قديم وقلتُ إنني أستخدم حمضًا') {
  const assembler = new McePromptAssemblerService(new MceModerationService());
  return assembler.buildMessages({ snapshot, factRegistry: facts, history, userMessage }).map((row) => row.content).join('\n');
}

async function main(): Promise<void> {
  assert.equal(providerTurnsFor(scenarios.filter((scenario) => !scenario.localFailure)), 14);
  assert.equal(buildPlan().plannedProviderCalls, 14);
  assert.equal(buildPlan().liveQuality, 'NOT_RUN');

  const localDelivery = await executeScenarios('local', scenarios.filter((scenario) => scenario.id === 'C01'));
  const localC01 = localDelivery.rows[0];
  assert.equal(localC01.met, 'LOCAL_MET');
  assert.equal((localC01.reply ?? '').includes(USEFUL_ANSWER_AR), true);
  assert.equal(localC01.quality, 'NOT_RUN');
  assert.equal(localC01.qualityReason, 'local-or-non-live-provider');
  assert.equal(localDelivery.counts.realModelCalls, 0);
  assert.equal(localDelivery.counts.liveModel, 0);

  const server = await startServer();
  const previous = process.env.MIRA_LIVE_CONSULTATION_AUTHORIZED;
  process.env.MIRA_LIVE_CONSULTATION_AUTHORIZED = '1';
  const wording: Scenario[] = [
    { ...scenarios.find((scenario) => scenario.id === 'C01')!, prompt: 'ماذا يناسب بشرتي الجافة؟' },
    { ...scenarios.find((scenario) => scenario.id === 'C02')!, id: 'C02', prompt: 'ما العناية اليومية لبشرتي الجافة؟' },
  ];
  try {
    const live = await runAuthorizedLive({
      LLM_BASE_URL: `http://127.0.0.1:${server.port}/v1`,
      LLM_API_KEY: 'local-intercept-not-a-secret',
      MCE_LLM_MODEL: 'local-intercept-model',
    }, wording, { requireLoopback: true });
    assert.equal(live.sent, true);
    if (!('rows' in live)) throw new Error('missing rows');
    assert.equal(live.counts.realModelCalls, 0);
    assert.equal(live.liveQuality, 'NOT_RUN');
    assert.equal(server.requests.length, 2);
    for (const row of live.rows) {
      assert.equal(row.met, 'LOCAL_MET');
      assert.equal((row.reply ?? '').includes(USEFUL_ANSWER_AR), false);
      assert.equal(row.quality, 'NOT_RUN');
      assert.notEqual(row.quality, 'MET');
      assert.notEqual(row.quality, 'NOT_MET');
      const review = answerQuality({
        mode: 'live',
        host: 'api.openai.com',
        source: 'live-model',
        reply: row.reply,
        scenarioId: row.id,
      });
      assert.equal(review.quality, 'NEEDS_REVIEW');
      assert.notEqual(review.quality, 'MET');
      assert.notEqual(review.quality, 'NOT_MET');
      assert.equal(review.qualityReason.includes('review'), true);
    }
    assert.equal((live.rows[0].reply ?? '').includes(ALT_A), true);
    assert.equal((live.rows[1].reply ?? '').includes(ALT_B), true);
    const recorded = answerQuality({
      mode: 'live',
      host: 'api.openai.com',
      source: 'live-model',
      reply: ALT_A,
      scenarioId: 'C01',
      reviewed: { result: 'MET', reviewer: 'owner-review', reason: 'الإجابة تناسب السؤال رغم اختلاف الصياغة' },
    });
    assert.equal(recorded.quality, 'MET');
    assert.equal(recorded.reviewer, 'owner-review');

    const empty = await runAuthorizedLive({
      LLM_BASE_URL: `http://127.0.0.1:${server.port}/v1`,
      LLM_API_KEY: 'local-intercept-not-a-secret',
    }, [{ ...wording[0], id: 'C01', prompt: 'رد فارغ' }], { requireLoopback: true });
    if (!('rows' in empty)) throw new Error('missing empty rows');
    assert.equal(empty.rows[0].met, 'FAILED_RECORDED');
    assert.equal(empty.rows[0].quality, 'NOT_RUN');
    assert.notEqual(empty.rows[0].quality, 'MET');
    assert.equal(empty.rows[0].reply, null);
    assert.equal(empty.counts.realModelCalls, 0);
    assert.equal(empty.liveQuality, 'NOT_RUN');
  } finally {
    if (previous === undefined) delete process.env.MIRA_LIVE_CONSULTATION_AUTHORIZED;
    else process.env.MIRA_LIVE_CONSULTATION_AUTHORIZED = previous;
    await new Promise<void>((resolve, reject) => server.server.close((error) => (error ? reject(error) : resolve())));
  }

  const guarded = await executeScenarios('local', scenarios.filter((scenario) => scenario.id === 'B4-SCORE' || scenario.id === 'B4-FAKE-R2'));
  for (const row of guarded.rows) {
    assert.equal(row.met, 'LOCAL_MET');
    assert.equal(/الترطيب\s*10/.test(`${row.reply ?? ''}\n${row.delta ?? ''}`), false);
    assert.equal(row.quality, 'NOT_RUN');
  }
  assert.equal(guarded.counts.realModelCalls, 0);
  assert.equal(guarded.counts.liveModel, 0);

  const c04 = await executeScenarios('local', scenarios.filter((scenario) => scenario.id === 'C04'));
  const c04Row = c04.rows[0];
  assert.equal(c04Row.met, 'LOCAL_MET');
  assert.equal(c04Row.requestHasReportDate, true);
  assert.equal(c04Row.requestHasContextBuiltAt, true);
  assert.equal(c04Row.quality, 'NOT_RUN');
  assert.equal(c04.counts.realModelCalls, 0);
  const c04Scenario = scenarios.find((scenario) => scenario.id === 'C04');
  assert.equal(c04Scenario?.reportCreatedAt, OLD_REPORT_BUILT_AT);
  assert.equal(c04Scenario?.builtAt, CONTEXT_BUILT_AT);
  assert.notEqual(c04Scenario?.reportCreatedAt, c04Scenario?.builtAt);

  const old = await ground(storedRow(new Date(OLD_REPORT_BUILT_AT), 72));
  const oldPrompt = promptText(old.result.snapshot, old.result.factRegistry, [
    { role: 'user', content: 'أستخدم حمضًا في المساء' },
    { role: 'assistant', content: 'سجّلت هذه المعلومة.' },
  ]);
  assert.equal(oldPrompt.includes(`تاريخ التقرير: ${OLD_REPORT_BUILT_AT}`), true);
  assert.equal(oldPrompt.includes('تاريخ بناء السياق:'), true);
  assert.equal(oldPrompt.includes(`تاريخ بناء السياق: ${OLD_REPORT_BUILT_AT}`), false);
  assert.notEqual(old.result.snapshot.builtAt, old.result.snapshot.skin?.reportCreatedAt);
  assert.equal(oldPrompt.includes('أستخدم حمضًا في المساء'), true);
  assert.equal(oldPrompt.includes(OLD_REPORT_BUILT_AT) && oldPrompt.includes('تقريري قديم وقلتُ'), true);
  const userOnly = oldPrompt.split('\n').filter((line) => line === 'تقريري قديم وقلتُ إنني أستخدم حمضًا');
  assert.equal(userOnly.length, 1);
  assert.equal(userOnly[0].includes(OLD_REPORT_BUILT_AT), false);
  assert.equal(old.before, JSON.stringify(old.row.resultJson));
  assert.equal(old.writes, 0);
  assert.equal(old.row.userId, 'owner-rc5');
  assert.equal((old.row.resultJson as { miraReport: { overallBeautyScore: number } }).miraReport.overallBeautyScore, 72);
  assert.equal(old.row.resultJson.miraReport.faceHealthMap.concernOverlays[0].globalScore, 40);

  const recent = await ground(storedRow(new Date(RECENT_REPORT_AT), 72));
  const recentPrompt = promptText(recent.result.snapshot, recent.result.factRegistry, [], 'ما الأنسب اليوم؟');
  assert.equal(recent.result.snapshot.skin?.reportCreatedAt, RECENT_REPORT_AT);
  assert.equal(recentPrompt.includes(`تاريخ التقرير: ${RECENT_REPORT_AT}`), true);
  assert.equal(recentPrompt.includes('قديم'), false);
  assert.notEqual(recent.result.snapshot.builtAt, RECENT_REPORT_AT);
  assert.equal(recent.before, JSON.stringify(recent.row.resultJson));

  const missing = await ground(storedRow(null, 72));
  const missingPrompt = promptText(missing.result.snapshot, missing.result.factRegistry, [], 'ما الأنسب اليوم؟');
  assert.equal(missing.result.snapshot.skin?.reportCreatedAt, undefined);
  assert.equal(missingPrompt.includes('تاريخ التقرير:'), false);
  assert.equal(missingPrompt.includes(`تاريخ بناء السياق: ${missing.result.snapshot.builtAt}`), true);
  assert.equal(trustedReportCreatedAt('not-a-date'), undefined);
  assert.equal(trustedReportCreatedAt(null), undefined);
  const absent = new MceFactExtractorService().buildSkinSummary('analysis-rc5', reportFixture(), 'not-a-date');
  assert.equal(absent.reportCreatedAt, undefined);
  assert.equal(JSON.stringify(reportFixture()).includes('reportCreatedAt'), false);

  console.log('BATCH4_RC5_PASS');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
