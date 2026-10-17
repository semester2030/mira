import assert from 'node:assert/strict';
import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MceFactEntry } from './contracts/mce-context-snapshot.v1';
import { ConsultationOrchestratorService } from './services/consultation-orchestrator.service';
import {
  ANSWER_CACHE_KEY_VERSION,
  buildAnswerCacheKey,
} from './services/mce-cost-guard.service';
import { MceFactExtractorService } from './services/mce-fact-extractor.service';
import { MceLlmService, MCE_LLM_TIMEOUT_DEFAULT_MS, readLlmTimeoutMs } from './services/mce-llm.service';
import { MceModerationService } from './services/mce-moderation.service';
import { McePromptAssemblerService, MceResponseValidatorService } from './services/mce-prompt-assembler.service';
import { OVERALL_COMPARISON_UNAVAILABLE_AR, buildProgressForecast } from '../intelligence/pipeline/progress-engine';
import { MiraBeautyReport } from '../intelligence/contracts/mira-beauty-report.interface';

const validator = new MceResponseValidatorService(new MceModerationService());
const TIMEOUT_MS = 80;
const TIMEOUT_MARGIN_MS = 700;

function payload(answerAr: string) {
  return {
    answerAr,
    confidence: 'high' as const,
    intent: 'general',
    citedFactIds: [] as string[],
    suggestedQuestionsAr: [] as string[],
    blocked: false,
    disclaimerAr: '',
  };
}

function codeOf(error: unknown): string | undefined {
  if (error instanceof ServiceUnavailableException || error instanceof BadGatewayException) {
    const body = error.getResponse();
    if (body && typeof body === 'object' && 'code' in body) return String((body as { code?: string }).code);
  }
  return undefined;
}

function config(values: Record<string, unknown>): ConfigService {
  return { get: (key: string, fallback?: unknown) => (key in values ? values[key] : fallback) } as unknown as ConfigService;
}

async function withFetch(impl: typeof fetch, run: () => Promise<void>): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
}

function hangUntilAbort(init: RequestInit | undefined, mark: () => void): Promise<Response> {
  const signal = init?.signal;
  return new Promise((_resolve, reject) => {
    signal?.addEventListener('abort', () => {
      mark();
      reject(signal.reason ?? new DOMException('The operation was aborted', 'AbortError'));
    }, { once: true });
  });
}

function testTimeoutContract(): void {
  assert.equal(readLlmTimeoutMs(undefined), MCE_LLM_TIMEOUT_DEFAULT_MS);
  assert.equal(readLlmTimeoutMs(''), MCE_LLM_TIMEOUT_DEFAULT_MS);
  assert.equal(readLlmTimeoutMs('nope'), MCE_LLM_TIMEOUT_DEFAULT_MS);
  assert.equal(readLlmTimeoutMs(0), MCE_LLM_TIMEOUT_DEFAULT_MS);
  assert.equal(readLlmTimeoutMs(-5), MCE_LLM_TIMEOUT_DEFAULT_MS);
  assert.equal(readLlmTimeoutMs('80'), 80);
  assert.equal(MCE_LLM_TIMEOUT_DEFAULT_MS, 30000);
}

async function keepAlive<T>(work: () => Promise<T>): Promise<T> {
  const timer = setInterval(() => undefined, 50);
  try {
    return await work();
  } finally {
    clearInterval(timer);
  }
}

async function testDeadlineReachesProvider(): Promise<void> {
  const llm = new MceLlmService(config({ LLM_API_KEY: 'test', MCE_LLM_TIMEOUT_MS: TIMEOUT_MS }));
  const messages = [{ role: 'user' as const, content: 'سؤال' }];

  await keepAlive(async () => {
  let headersAborted = false;
  const headersStarted = Date.now();
  await withFetch((_url, init) => hangUntilAbort(init, () => { headersAborted = true; }), async () => {
    await assert.rejects(() => llm.complete(messages), (error: unknown) => codeOf(error) === 'MCE_LLM_TIMEOUT');
  });
  const headersElapsed = Date.now() - headersStarted;
  assert.equal(headersAborted, true);
  assert.ok(headersElapsed < TIMEOUT_MS + TIMEOUT_MARGIN_MS, `headers hang ${headersElapsed}`);
  assert.ok(headersElapsed >= TIMEOUT_MS - 20, `headers hang returned too early ${headersElapsed}`);

  let bodyCancelled = false;
  const bodyStarted = Date.now();
  await withFetch(async (_url, init) => {
    let rejectPull: (error: unknown) => void = () => undefined;
    const stream = new ReadableStream({
      pull() {
        return new Promise((_resolve, reject) => { rejectPull = reject; });
      },
      cancel() { bodyCancelled = true; },
    });
    init?.signal?.addEventListener('abort', () => {
      bodyCancelled = true;
      rejectPull(init.signal?.reason ?? new DOMException('The operation was aborted', 'AbortError'));
    }, { once: true });
    return new Response(stream, { status: 200, headers: { 'content-type': 'application/json' } });
  }, async () => {
    await assert.rejects(() => llm.complete(messages), (error: unknown) => codeOf(error) === 'MCE_LLM_TIMEOUT');
  });
  assert.equal(bodyCancelled, true);
  assert.ok(Date.now() - bodyStarted < TIMEOUT_MS + TIMEOUT_MARGIN_MS);

  let streamCancelled = false;
  const encoder = new TextEncoder();
  const streamStarted = Date.now();
  await withFetch(async (_url, init) => {
    let controllerRef: ReadableStreamDefaultController<Uint8Array> | undefined;
    const stream = new ReadableStream({
      start(controller) {
        controllerRef = controller;
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"{"}}]}\n\n'));
      },
      cancel() { streamCancelled = true; },
    });
    init?.signal?.addEventListener('abort', () => {
      streamCancelled = true;
      try {
        controllerRef?.error(init.signal?.reason ?? new DOMException('The operation was aborted', 'AbortError'));
      } catch {
        // The reader may already be closing.
      }
    }, { once: true });
    return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  }, async () => {
    await assert.rejects(async () => {
      for await (const _chunk of llm.stream(messages)) { /* consume until abort */ }
    }, (error: unknown) => codeOf(error) === 'MCE_LLM_TIMEOUT');
  });
  assert.equal(streamCancelled, true);
  assert.ok(Date.now() - streamStarted < TIMEOUT_MS + TIMEOUT_MARGIN_MS);

  await withFetch(async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify(payload('رد سليم')) } }],
  }), { status: 200, headers: { 'content-type': 'application/json' } }), async () => {
    const result = await llm.complete(messages);
    assert.equal(result.payload.answerAr, 'رد سليم');
  });

  await withFetch(async () => new Response('bad gateway', { status: 502 }), async () => {
    await assert.rejects(() => llm.complete(messages), (error: unknown) => codeOf(error) === 'MCE_LLM_FAILED');
  });

  const abort = new AbortController();
  let clientAborted = false;
  await withFetch((_url, init) => hangUntilAbort(init, () => { clientAborted = true; }), async () => {
    const pending = llm.complete(messages, { signal: abort.signal });
    abort.abort();
    await assert.rejects(() => pending, (error: unknown) => codeOf(error) === 'MCE_CLIENT_CLOSED');
  });
  assert.equal(clientAborted, true);
  });
}

function createHarness(options: {
  enabled?: string | boolean | number;
  cached?: ReturnType<typeof payload> | null;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  snapshot?: Record<string, unknown>;
  summary?: string | null;
  userId?: string;
  useRealKey?: boolean;
  completeAnswer?: string;
}) {
  const calls = { complete: 0, stream: 0, persistUser: 0, persistAssistant: 0, quota: 0, cacheGet: 0 };
  const saved: string[] = [];
  const sent: unknown[] = [];
  const store = new Map<string, ReturnType<typeof payload>>();
  if (options.cached) store.set('preset', options.cached);
  const now = new Date();
  const session = {
    id: 's1', titleAr: null, status: 'active', activeSnapshotId: 'snap', occasionId: null,
    turnCount: 0, rollingSummaryAr: options.summary ?? null, createdAt: now, updatedAt: now,
  };
  const facts: MceFactEntry[] = [];
  const snapshot = options.snapshot ?? {
    schemaVersion: '1.0.0',
    user: { isMinor: false, locale: 'ar' },
    skin: {
      skinTypeAr: 'مختلطة',
      headlineAr: 'عنوان',
      summaryAdviceAr: 'ملخص',
      mainConcerns: [],
      routineMorningAr: [],
      routineEveningAr: [],
      overallScoreAvailable: true,
      beautyScore: 70,
    },
  };
  const history = options.history ?? [];
  const llm = {
    isConfigured: () => true,
    complete: async (messages: unknown) => {
      calls.complete += 1;
      sent.push(messages);
      return { payload: payload(`${options.completeAnswer ?? 'جواب جديد'} #${calls.complete}`), modelId: 'stub' };
    },
    stream: async function* (messages: unknown) {
      calls.stream += 1;
      sent.push(messages);
      yield JSON.stringify(payload(options.completeAnswer ?? 'جواب بث'));
    },
  };
  const orchestrator = new ConsultationOrchestratorService(
    config({ MCE_CONSULTATION_ENABLED: options.enabled ?? 'true' }),
    {
      findOrCreateFromFirebase: async () => ({ id: options.userId ?? 'u1' }),
      getPreferences: async () => ({ birthYear: 1990 }),
      writeAuditLog: async () => undefined,
    } as never,
    {
      subscription: { findUnique: async () => ({ plan: 'free' }) },
      consultationSession: { update: async () => session },
    } as never,
    { assertWithinLimit: async () => undefined } as never,
    {
      assertDailyQuota: async () => { calls.quota += 1; },
      answerCacheKey: (ctx: Parameters<typeof buildAnswerCacheKey>[0]) => (
        options.useRealKey === false ? 'preset' : buildAnswerCacheKey(ctx)
      ),
      getFaqCache: async (key: string) => {
        calls.cacheGet += 1;
        return store.get(key) ?? null;
      },
      setFaqCache: async (key: string, value: ReturnType<typeof payload>) => { store.set(key, value); },
    } as never,
    { shouldCompact: () => false } as never,
    { getForUser: async () => session, toDto: () => ({ id: 's1' }) } as never,
    {
      persistUser: async (_id: string, contentAr: string) => {
        calls.persistUser += 1;
        return { id: 'user-msg', role: 'user', contentAr, blocked: false, createdAt: now };
      },
      persistAssistant: async (_id: string, contentAr: string) => {
        calls.persistAssistant += 1;
        saved.push(contentAr);
        return { id: 'asst', role: 'assistant', contentAr, blocked: false, createdAt: now };
      },
      toDto: (row: { id: string; role: string; contentAr: string; blocked: boolean; createdAt: Date }) => ({
        id: row.id, role: row.role, contentAr: row.contentAr, blocked: row.blocked, createdAt: row.createdAt.toISOString(),
      }),
      recentPairs: async () => history,
    } as never,
    {
      loadForSession: async () => ({ id: 'snap', snapshot, factRegistry: facts }),
    } as never,
    { build: async () => ({ snapshot, factRegistry: facts }) } as never,
    { classify: () => 'general', intentHintAr: () => '' } as never,
    new MceModerationService(),
    new McePromptAssemblerService(new MceModerationService()),
    validator,
    llm as never,
  );
  return { orchestrator, calls, saved, sent, store, history, snapshot, session };
}

class FakeSse {
  chunks: string[] = [];
  ended = false;
  writableEnded = false;
  setHeader(): void {}
  flushHeaders(): void {}
  write(chunk: string): boolean { this.chunks.push(chunk); return true; }
  end(): void { this.ended = true; this.writableEnded = true; }
  text(): string { return this.chunks.join(''); }
}

async function testConsultationDisabled(): Promise<void> {
  for (const enabled of ['false', '0', false, 0] as const) {
    const harness = createHarness({ enabled, cached: payload('جواب مخزن'), useRealKey: false });
    await assert.rejects(
      () => harness.orchestrator.sendMessage({} as never, 's1', { message: 'ما الروتين؟' }),
      (error: unknown) => codeOf(error) === 'MCE_DISABLED',
    );
    const sse = new FakeSse();
    await assert.rejects(
      () => harness.orchestrator.sendMessageStream({} as never, 's1', { message: 'ما الروتين؟' }, sse as never),
      (error: unknown) => codeOf(error) === 'MCE_DISABLED',
    );
    await assert.rejects(
      () => harness.orchestrator.advisorBridge({} as never, 'ما الروتين؟'),
      (error: unknown) => codeOf(error) === 'MCE_DISABLED',
    );
    assert.equal(sse.chunks.length, 0);
    assert.equal(harness.calls.persistUser, 0);
    assert.equal(harness.calls.persistAssistant, 0);
    assert.equal(harness.calls.cacheGet, 0);
    assert.equal(harness.calls.quota, 0);
    assert.equal(harness.calls.complete, 0);
    assert.equal(harness.calls.stream, 0);
  }

  const restored = createHarness({ enabled: 'true', cached: payload('جواب مخزن'), useRealKey: false });
  const hit = await restored.orchestrator.sendMessage({} as never, 's1', { message: 'ما الروتين؟' });
  assert.equal(restored.calls.complete, 0);
  assert.equal(hit.assistantMessage.contentAr.includes('جواب مخزن'), true);
}

async function testCacheContext(): Promise<void> {
  const base = {
    userId: 'u1',
    sessionId: 's1',
    question: 'ما الروتين؟',
    snapshotId: 'snap',
    snapshot: { skin: { beautyScore: null, skinTypeAr: 'جافة' } },
    factRegistry: [],
    history: [{ role: 'user', content: 'بشرتي جافة' }],
    rollingSummary: 'ملخص أول',
  };
  const first = buildAnswerCacheKey(base);
  const again = buildAnswerCacheKey(base);
  assert.equal(first, again);
  assert.equal(first?.startsWith(`mce:faq:${ANSWER_CACHE_KEY_VERSION}:`), true);
  assert.equal(first?.includes('بشرتي'), false);
  assert.equal(first?.includes('جافة'), false);
  assert.notEqual(first, buildAnswerCacheKey({ ...base, history: [...base.history, { role: 'assistant', content: 'استخدمي مرطبًا' }] }));
  assert.notEqual(first, buildAnswerCacheKey({ ...base, rollingSummary: 'ملخص تغير' }));
  assert.notEqual(first, buildAnswerCacheKey({ ...base, snapshot: { skin: { beautyScore: null, skinTypeAr: 'دهنية' } } }));
  assert.notEqual(first, buildAnswerCacheKey({ ...base, userId: 'u2' }));
  assert.notEqual(first, buildAnswerCacheKey({ ...base, sessionId: 's2' }));
  assert.equal(buildAnswerCacheKey({ ...base, snapshot: null }), null);
  assert.equal(first?.startsWith('mce:faq:v2:'), true);
  assert.equal(first?.startsWith('mce:faq:') && !first?.includes(':v2:'), false);

  const harness = createHarness({
    history: [{ role: 'user', content: 'بشرتي جافة' }],
    snapshot: {
      schemaVersion: '1.0.0',
      user: { isMinor: false },
      skin: {
        skinTypeAr: 'جافة',
        headlineAr: 'عنوان',
        summaryAdviceAr: 'ملخص',
        mainConcerns: [],
        routineMorningAr: [],
        routineEveningAr: [],
      },
    },
    summary: 'ملخص أول',
    completeAnswer: 'جواب السياق الأول',
  });
  const firstTurn = await harness.orchestrator.sendMessage({} as never, 's1', { message: 'ما الروتين؟' });
  assert.equal(harness.calls.complete, 1);
  assert.equal(firstTurn.assistantMessage.contentAr.includes('جواب السياق الأول #1'), true);
  const second = await harness.orchestrator.sendMessage({} as never, 's1', { message: 'ما الروتين؟' });
  assert.equal(harness.calls.complete, 1);
  assert.equal(second.assistantMessage.contentAr.includes('جواب السياق الأول #1'), true);

  harness.history.push({ role: 'assistant', content: 'ظهرت حساسية جديدة' });
  const changed = await harness.orchestrator.sendMessage({} as never, 's1', { message: 'ما الروتين؟' });
  assert.equal(harness.calls.complete, 2);
  assert.equal(changed.assistantMessage.contentAr.includes('#2'), true);
  assert.equal(changed.assistantMessage.contentAr.includes('#1'), false);
  const messages = harness.sent.at(-1) as Array<{ role: string; content: string }>;
  const userMessages = messages.filter((row) => row.role === 'user' && row.content === 'ما الروتين؟');
  assert.equal(userMessages.length, 1);
  assert.equal(messages.some((row) => row.content.includes('ظهرت حساسية جديدة')), true);

  const oldKey = 'mce:faq:legacy';
  harness.store.set(oldKey, payload('جواب قديم ناقص'));
  assert.equal([...harness.store.keys()].includes(oldKey), true);
  assert.equal(harness.saved.some((row) => row.includes('جواب قديم ناقص')), false);
}

async function testCachePaths(): Promise<void> {
  const harness = createHarness({
    history: [],
    summary: null,
    completeAnswer: 'جواب البث',
  });
  const sse = new FakeSse();
  await harness.orchestrator.sendMessageStream({} as never, 's1', { message: 'ما الروتين؟' }, sse as never);
  assert.equal(harness.calls.stream, 1);
  const again = new FakeSse();
  await harness.orchestrator.sendMessageStream({} as never, 's1', { message: 'ما الروتين؟' }, again as never);
  assert.equal(harness.calls.stream, 1);
  assert.equal(again.text().includes('جواب البث'), true);
  harness.session.rollingSummaryAr = 'ملخص جديد';
  const third = new FakeSse();
  await harness.orchestrator.sendMessageStream({} as never, 's1', { message: 'ما الروتين؟' }, third as never);
  assert.equal(harness.calls.stream, 2);
  assert.equal(third.text().includes('event: done'), true);
}

function report(available: boolean | undefined): MiraBeautyReport {
  return {
    overallBeautyScore: 41,
    overallScoreAvailable: available,
    skinTypeAr: 'مختلطة',
    headlineAr: 'عنوان',
    summaryAdviceAr: 'ملخص',
    tipsAr: [],
    mainConcerns: [],
    dailyRoutine: { morning: [], evening: [] },
    confidenceLayer: { enabled: false },
    childSafety: { isMinor: false },
    faceHealthMap: { concernOverlays: [{ concernId: 'pore', labelAr: 'المسام', globalScore: 40, severity: 'mild' }], disclaimerAr: '' },
  } as never;
}

function testOverallFacts(): void {
  const extractor = new MceFactExtractorService();
  const missing = extractor.buildSkinSummary('a', report(undefined));
  const facts = extractor.buildFactRegistry({ schemaVersion: 1, skin: missing } as never);
  assert.equal(facts.some((fact) => fact.id === 'skin.beautyScore'), false);
  assert.equal(missing.beautyScore, null);
  const ready = extractor.buildSkinSummary('a', report(true));
  const readyFacts = extractor.buildFactRegistry({ schemaVersion: 1, skin: ready } as never);
  assert.equal(readyFacts.some((fact) => fact.id === 'skin.beautyScore'), true);
  const blocked = buildProgressForecast([
    { id: 'a', createdAt: new Date('2026-01-01'), miraReport: report(false) },
    { id: 'b', createdAt: new Date('2026-02-01'), miraReport: report(undefined) },
  ]);
  assert.equal(blocked.trends.some((row) => row.id === 'overall'), false);
  assert.equal(blocked.headlineAr, OVERALL_COMPARISON_UNAVAILABLE_AR);
  assert.equal(blocked.projectedOverallScore30Days, undefined);
  const pore = blocked.trends.find((row) => row.id === 'pore');
  assert.equal(pore?.previousScore, 40);
  assert.equal(pore?.currentScore, 40);
}

function testRegression(): void {
  assert.equal(readLlmTimeoutMs('nope'), MCE_LLM_TIMEOUT_DEFAULT_MS);
  assert.notEqual(buildAnswerCacheKey({
    userId: 'u1', sessionId: 's1', question: 'ما الروتين؟', snapshotId: 'snap',
    snapshot: { skin: { skinTypeAr: 'جافة' } }, factRegistry: [], history: [], rollingSummary: null,
  })?.startsWith('mce:faq:v1:'), true);
  const legacy = buildAnswerCacheKey({
    userId: 'u1', sessionId: 's1', question: 'ما الروتين؟', snapshotId: 'snap',
    snapshot: { skin: { skinTypeAr: 'جافة' } }, factRegistry: [], history: [], rollingSummary: null,
  });
  assert.equal(legacy?.startsWith('mce:faq:v2:'), true);
}

async function main(): Promise<void> {
  testTimeoutContract();
  await testDeadlineReachesProvider();
  await testConsultationDisabled();
  await testCacheContext();
  await testCachePaths();
  testOverallFacts();
  testRegression();
  console.log('risk-remediation-batch3: PASS');
  console.log('T-OVERALL-ABSENCE-B3 T-OVERALL-CONSUMERS-B3 T-OVERALL-VALID-B3 T-LLM-DEADLINE-B3 T-CONSULTATION-DISABLED-B3 T-CACHE-CONTEXT-B3 T-CACHE-PATHS-B3 T-REGRESSION-B3');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
