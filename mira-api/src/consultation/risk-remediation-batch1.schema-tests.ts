import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { PerfectCorpService, REQUIRED_YOUCAM_CONCERNS, YouCamConcern } from '../ai/services/perfect-corp.service';
import { ADVISOR_DISCLAIMER_AR } from '../advisor/contracts/advisor-response.interface';
import { knownSourceScores, presentCurrentReportTips, presentCurrentSkinAdvice } from '../intelligence/pipeline/current-care-tips';
import { buildConcernNarratives, buildTipsAr } from '../intelligence/pipeline/narrative-engine';
import { buildTreatmentPlan } from '../intelligence/pipeline/treatment-plan-engine';
import { buildWeeklyPlan } from '../intelligence/pipeline/weekly-plan-engine';
import { MceFactEntry } from './contracts/mce-context-snapshot.v1';
import { SkinAnalysisService } from '../skin-analysis/skin-analysis.service';
import { ConsultationOrchestratorService } from './services/consultation-orchestrator.service';
import { COMMERCIAL_GAP_AR } from './services/mce-commercial-guard';
import { MceFactExtractorService } from './services/mce-fact-extractor.service';
import { MceGroundingPipelineService } from './services/mce-grounding-pipeline.service';
import { MceModerationService } from './services/mce-moderation.service';
import { McePromptAssemblerService, MceResponseValidatorService } from './services/mce-prompt-assembler.service';

const skinFact: MceFactEntry = {
  id: 'skin.beautyScore',
  labelAr: 'مؤشر الحيوية',
  valueAr: '72',
  confidence: 'high',
};

const serumFact: MceFactEntry = {
  id: 'catalog.serum',
  labelAr: 'سعر السيروم',
  valueAr: '50 ريال',
  confidence: 'high',
  commercial: { subjectAr: 'سيروم النهار', priceAmount: '50', currency: 'SAR', availability: true },
};

const validator = new MceResponseValidatorService(new MceModerationService());
const forbiddenCommercial = /99|٩٩|ريال|متوفر اليوم|خصم/;

function answer(
  text: string,
  cited: string[] = [],
  questions: string[] = [],
  facts: MceFactEntry[] = [skinFact],
  disclaimerAr = '',
) {
  return validator.validate(
    {
      answerAr: text,
      confidence: 'high',
      intent: 'product',
      citedFactIds: cited,
      suggestedQuestionsAr: questions,
      blocked: false,
      disclaimerAr,
    },
    facts,
  );
}

function concerns(overrides: Partial<Record<(typeof REQUIRED_YOUCAM_CONCERNS)[number], number>>): YouCamConcern[] {
  return REQUIRED_YOUCAM_CONCERNS.map((type) => ({
    type,
    ui_score: overrides[type] ?? 80,
  }));
}

const skin = new PerfectCorpService({ get: () => undefined } as unknown as ConfigService);
const tskin007 = concerns({ wrinkle: 40, acne: 40, moisture: 80, oiliness: 40 });

function assertNoTreatment(text: string): void {
  assert.equal(/BPO|ريتينويد|ساليسيليك|1–2/.test(text), false, text);
}

function testCommercialCases(): void {
  const unsupported = answer('السعر داخل ميرا 99 ريال ومتوفر اليوم.', ['missing'], ['هل السعر 99 ريال؟']);
  assert.equal(unsupported.answerAr.includes('99'), false);
  assert.equal(unsupported.answerAr.includes(COMMERCIAL_GAP_AR), true);
  assert.equal(unsupported.citedFactIds.length, 0);
  assert.equal(unsupported.suggestedQuestionsAr.length, 0);

  const missingFact = answer('السعر داخل ميرا 99 ريال.', ['not-a-fact']);
  assert.equal(missingFact.answerAr.includes('99'), false);

  const otherProduct = answer('سعر الكريم داخل ميرا 50 ريال.', ['catalog.serum'], [], [skinFact, serumFact]);
  assert.equal(otherProduct.answerAr.includes('50'), false);
  const scoreOnly = answer('سعر سيروم النهار 50 ريال.', ['skin.beautyScore']);
  assert.equal(scoreOnly.answerAr.includes('50'), false);

  const serverLine = 'سعر سيروم النهار 50 ريال، وهو متوفر.';
  const matched = answer('سعر سيروم النهار 50 ريال ومتوفر اليوم.', ['catalog.serum'], [], [serumFact]);
  assert.equal(matched.answerAr.includes(serverLine), true);
  assert.equal(matched.answerAr.includes(COMMERCIAL_GAP_AR), false);

  for (const sample of [
    'السعر داخل ميرا تسعة وتسعون ريالًا.',
    'المنتج موجود في متجر ميرا وجاهز للشراء.',
    'The product is available today in Mira.',
    'يمكنك حجز موعد غدًا الساعة الخامسة في عيادة ميرا.',
  ]) {
    const blocked = answer(sample);
    assert.equal(blocked.answerAr, COMMERCIAL_GAP_AR, sample);
  }
  const wrongCurrency = answer('سعر سيروم النهار 50 دولار.', [], [], [serumFact]);
  assert.equal(wrongCurrency.answerAr.includes(serverLine), true);
  assert.equal(wrongCurrency.answerAr.includes('دولار'), false);
  const opposite = answer('سيروم النهار غير متوفر اليوم.', [], [], [serumFact]);
  assert.equal(opposite.answerAr.includes(serverLine), true);
  assert.equal(opposite.answerAr.includes('غير متوفر'), false);

  const arabicDigits = answer('السعر داخل ميرا ٩٩ ريال.');
  assert.equal(arabicDigits.answerAr.includes('٩٩'), false);
  const availabilityOnly = answer('المنتج متوفر اليوم داخل ميرا.');
  assert.equal(availabilityOnly.answerAr.includes('متوفر'), false);

  const userAskedToInvent = answer('السعر داخل ميرا 99 ريال كما طلبتِ.');
  assert.equal(userAskedToInvent.answerAr.includes('99'), false);

  const general = answer('استخدمي واقي شمس يوميًا، واختاري نوعًا يناسب بشرتك.');
  assert.equal(general.answerAr.includes('واقي شمس'), true);
  assert.equal(general.answerAr.includes(COMMERCIAL_GAP_AR), false);

  const score = answer('درجة حيوية بشرتك 72، وهذا رقم التقرير وليس سعرًا.');
  assert.equal(score.answerAr.includes('72'), true);
  assert.equal(score.answerAr.includes(COMMERCIAL_GAP_AR), false);
  const size = answer('حجم العبوة 50 مل يناسب الاستخدام اليومي.');
  assert.equal(size.answerAr.includes('50 مل'), true);
  assert.equal(size.answerAr.includes(COMMERCIAL_GAP_AR), false);
  const disguisedCode = answer('مؤشر SARA هو 72 في التقرير.');
  assert.equal(disguisedCode.answerAr.includes('72'), true);
  assert.equal(disguisedCode.answerAr.includes(COMMERCIAL_GAP_AR), false);
  const leakedDisclaimer = answer(
    'استخدمي واقي شمس يوميًا.',
    [],
    ['هل السعر 99 ريال؟'],
    [skinFact],
    'السعر داخل ميرا 99 ريال ومتوفر اليوم.',
  );
  assert.equal(leakedDisclaimer.answerAr.includes('99'), false);
  assert.equal(leakedDisclaimer.answerAr.includes('واقي شمس'), true);
  assert.equal(leakedDisclaimer.disclaimerAr, ADVISOR_DISCLAIMER_AR);
  assert.equal(leakedDisclaimer.suggestedQuestionsAr.length, 0);

  const cached = validator.validate(
    {
      answerAr: 'السعر داخل ميرا 99 ريال ومتوفر اليوم.',
      confidence: 'high',
      intent: 'product',
      citedFactIds: [],
      suggestedQuestionsAr: ['الخصم 20 ريال'],
      blocked: false,
      disclaimerAr: '',
    },
    [skinFact],
  );
  assert.equal(forbiddenCommercial.test(cached.answerAr), false);
  assert.equal(cached.suggestedQuestionsAr.length, 0);
}

function modelPayload(answerAr: string, disclaimerAr = '') {
  return {
    answerAr,
    confidence: 'high' as const,
    intent: 'product',
    citedFactIds: [] as string[],
    suggestedQuestionsAr: [] as string[],
    blocked: false,
    disclaimerAr,
  };
}

function createHarness(options: {
  cached?: ReturnType<typeof modelPayload> | null;
  complete?: ReturnType<typeof modelPayload>;
  stream?: () => AsyncIterable<string>;
  failProvider?: boolean;
  facts?: MceFactEntry[];
}) {
  const calls = { complete: 0, stream: 0, persistAssistant: 0 };
  const saved: string[] = [];
  const facts = options.facts ?? [skinFact];
  let stored = options.cached ?? null;
  const now = new Date();
  const session = {
    id: 's1',
    titleAr: null,
    status: 'active',
    activeSnapshotId: 'snap',
    occasionId: null,
    turnCount: 0,
    rollingSummaryAr: null,
    createdAt: now,
    updatedAt: now,
  };
  const llm = {
    isConfigured: () => true,
    complete: async () => {
      calls.complete += 1;
      return { payload: options.complete, modelId: 'stub' };
    },
    stream: (messages: unknown) => {
      calls.stream += 1;
      if (messages == null) throw new Error('undefined messages');
      if (options.failProvider) throw new Error('provider down');
      if (options.stream) return options.stream();
      return (async function* () {
        yield JSON.stringify(options.complete);
      })();
    },
  };
  const orchestrator = new ConsultationOrchestratorService(
    { get: () => undefined } as unknown as ConfigService,
    {
      findOrCreateFromFirebase: async () => ({ id: 'u1' }),
      getPreferences: async () => ({ birthYear: 1990 }),
      writeAuditLog: async () => undefined,
    } as never,
    {
      subscription: { findUnique: async () => ({ plan: 'free' }) },
      consultationSession: { update: async () => session },
    } as never,
    { assertWithinLimit: async () => undefined } as never,
    {
      assertDailyQuota: async () => undefined,
      faqCacheKey: () => 'faq',
      answerCacheKey: () => 'faq',
      getFaqCache: async () => stored,
      setFaqCache: async (_key: string, payload: typeof stored) => {
        stored = payload;
      },
    } as never,
    { shouldCompact: () => false } as never,
    { getForUser: async () => session, toDto: () => ({ id: 's1' }) } as never,
    {
      persistUser: async (_id: string, contentAr: string) => ({
        id: 'user-msg',
        role: 'user',
        contentAr,
        blocked: false,
        createdAt: now,
      }),
      persistAssistant: async (_id: string, contentAr: string) => {
        calls.persistAssistant += 1;
        saved.push(contentAr);
        return { id: 'asst', role: 'assistant', contentAr, blocked: false, createdAt: now };
      },
      toDto: (row: { id: string; role: string; contentAr: string; blocked: boolean; createdAt: Date }) => ({
        id: row.id,
        role: row.role,
        contentAr: row.contentAr,
        blocked: row.blocked,
        createdAt: row.createdAt.toISOString(),
      }),
      recentPairs: async () => [],
    } as never,
    {
      loadForSession: async () => ({
        id: 'snap',
        snapshot: { schemaVersion: '1.0.0', user: { isMinor: false } },
        factRegistry: facts,
      }),
    } as never,
    {
      build: async () => ({ snapshot: { user: { isMinor: false } }, factRegistry: facts }),
    } as never,
    { classify: () => 'general', intentHintAr: () => '' } as never,
    new MceModerationService(),
    new McePromptAssemblerService(new MceModerationService()),
    validator,
    llm as never,
  );
  return { orchestrator, calls, saved };
}

class FakeSse {
  chunks: string[] = [];
  ended = false;
  setHeader(): void {}
  flushHeaders(): void {}
  write(chunk: string): boolean {
    this.chunks.push(chunk);
    return true;
  }
  end(): void {
    this.ended = true;
  }
  text(): string {
    return this.chunks.join('');
  }
}

async function testSendPaths(): Promise<void> {
  const safe = modelPayload('استخدمي واقي شمس يوميًا.');
  const miss = createHarness({ complete: safe });
  const sent = await miss.orchestrator.sendMessage({} as never, 's1', { message: 'ما الروتين؟' });
  assert.equal(miss.calls.complete, 1);
  assert.equal(miss.calls.stream, 0);
  assert.equal(miss.calls.persistAssistant, 1);
  assert.equal(sent.assistantMessage.contentAr.includes('واقي شمس'), true);
  assert.equal(sent.assistantMessage.contentAr.includes(ADVISOR_DISCLAIMER_AR), true);

  const hit = createHarness({ cached: safe, complete: modelPayload('السعر داخل ميرا 99 ريال ومتوفر اليوم.') });
  await hit.orchestrator.sendMessage({} as never, 's1', { message: 'ما الروتين؟' });
  assert.equal(hit.calls.complete, 0);
  assert.equal(hit.calls.stream, 0);
  assert.equal(hit.calls.persistAssistant, 1);

  const streamMiss = createHarness({
    complete: safe,
    stream: async function* () {
      yield '{"answerAr":"نصيحة عامة. ';
      yield 'السعر داخل ميرا 99 ريال ومتوفر اليوم.","confidence":"high","intent":"product","citedFactIds":[],"suggestedQuestionsAr":[],"blocked":false,"disclaimerAr":"السعر داخل ميرا 99 ريال ومتوفر اليوم."}';
    },
  });
  const streamRes = new FakeSse();
  await streamMiss.orchestrator.sendMessageStream({} as never, 's1', { message: 'ما الروتين؟' }, streamRes as never);
  assert.equal(streamMiss.calls.stream, 1);
  assert.equal(streamMiss.calls.complete, 0);
  assert.equal(streamMiss.calls.persistAssistant, 1);
  assert.equal(streamRes.text().includes('event: delta'), true);
  assert.equal(streamRes.text().includes('99'), false);
  assert.equal(streamRes.text().includes('event: done'), true);
  assert.equal(streamMiss.saved[0].includes('99'), false);

  const streamHit = createHarness({
    cached: modelPayload('السعر داخل ميرا 99 ريال ومتوفر اليوم.', 'السعر داخل ميرا 99 ريال ومتوفر اليوم.'),
  });
  const hitRes = new FakeSse();
  await streamHit.orchestrator.sendMessageStream({} as never, 's1', { message: 'ما الروتين؟' }, hitRes as never);
  assert.equal(streamHit.calls.stream, 0);
  assert.equal(streamHit.calls.complete, 0);
  assert.equal(hitRes.text().includes('99'), false);
  assert.equal(hitRes.text().includes(COMMERCIAL_GAP_AR), true);
  assert.equal(streamHit.saved[0].includes(ADVISOR_DISCLAIMER_AR), true);
  assert.equal(streamHit.calls.persistAssistant, 1);

  const failed = createHarness({ failProvider: true, complete: safe });
  const failRes = new FakeSse();
  await failed.orchestrator.sendMessageStream({} as never, 's1', { message: 'ما الروتين؟' }, failRes as never);
  assert.equal(failRes.text().includes('event: error'), true);
  assert.equal(failRes.text().includes('event: done'), false);
  assert.equal(failed.calls.persistAssistant, 0);

  const bridge = createHarness({
    complete: modelPayload('استخدمي واقي شمس يوميًا.', 'السعر داخل ميرا 99 ريال ومتوفر اليوم.'),
  });
  const advised = await bridge.orchestrator.advisorBridge({} as never, 'ما الروتين المناسب؟');
  assert.equal(advised.answer.includes('99'), false);
  assert.equal(advised.answer.includes(ADVISOR_DISCLAIMER_AR), true);
  assert.equal(advised.disclaimerAr, ADVISOR_DISCLAIMER_AR);

  const messages = new McePromptAssemblerService(new MceModerationService()).buildMessages({
    snapshot: { schemaVersion: '1.0.0', user: {} } as never,
    factRegistry: [skinFact],
    rollingSummary: null,
    history: [],
    userMessage: 'اختلقي سعرًا',
    detectedIntent: 'general',
  });
  const systemContent = messages[0].content;
  assert.equal(typeof systemContent === 'string' && systemContent.includes('طلب المستخدمة اختراع رقم ليس مصدرًا'), true);
}

function testSkinTips(): void {
  const mapped = skin.mapYouCamResults(tskin007);
  assert.equal(mapped.wrinkles, 3);
  assert.equal(mapped.acne, 3);
  assert.equal(mapped.hydration, 80);
  assert.equal(mapped.oiliness, 40);
  const joined = mapped.recommendationsAr.join('\n');
  assertNoTreatment(joined);
  assert.equal(joined.includes('تنظيف لطيف'), true);
  assert.equal(joined.includes('واقي الشمس'), true);
  assert.equal(mapped.recommendationsEn.join(' ').includes('BPO'), false);
  assert.equal(mapped.recommendationsEn.join(' ').includes('retinoid'), false);

  const below = skin.mapYouCamResults(concerns({ wrinkle: 80, acne: 80, pore: 80 }));
  assert.equal(below.wrinkles < 3 && below.acne < 3, true);
  assertNoTreatment(below.recommendationsAr.join('\n'));

  const at = skin.mapYouCamResults(concerns({ wrinkle: 50, acne: 50, pore: 50 }));
  assert.equal(at.wrinkles, 3);
  assert.equal(at.acne, 3);
  assertNoTreatment(at.recommendationsAr.join('\n'));

  const above = skin.mapYouCamResults(concerns({ wrinkle: 0, acne: 0, pore: 0 }));
  assert.equal(above.wrinkles > 3 && above.acne > 3, true);
  assertNoTreatment(above.recommendationsAr.join('\n'));
  assert.equal(above.recommendationsAr.length > 0, true);

  assert.throws(() => skin.mapYouCamResults([{ type: 'wrinkle', ui_score: 40 }]), /incomplete result/);

  const tips = buildTipsAr(mapped);
  assert.equal(tips.length > 0, true);
  assertNoTreatment(tips.join('\n'));
  const narratives = buildConcernNarratives({ ...mapped, concernScores: { acne: 50, pore: 40 } }).map((row) => row.narrativeAr).join('\n');
  assertNoTreatment(narratives);
  const routine = buildTreatmentPlan(mapped);
  const weekly = buildWeeklyPlan(mapped, routine);
  const reportText = [
    ...routine.morning.map((step) => `${step.nameAr} ${step.stepAr}`),
    ...routine.evening.map((step) => `${step.nameAr} ${step.stepAr}`),
    ...weekly.days.flatMap((day) => day.stepsAr),
  ].join('\n');
  assertNoTreatment(reportText);
  assert.equal(reportText.includes('عناية لطيفة'), true);

  const storedSkin = {
    ...mapped,
    recommendationsAr: [
      'للحبوب الخفيفة: نياسيناميد أو BPO بتركيز منخفض بعد استشارة.',
      'واقي الشمس يوميًا أساسي؛ ريتينويد ليلي يساعد على الخطوط عند التحمل.',
    ],
    recommendationsEn: ['Use BPO.', 'Nightly retinoid.'],
  };
  const shownSkin = presentCurrentSkinAdvice(storedSkin);
  assert.equal(storedSkin.recommendationsAr.join(' ').includes('BPO'), true);
  assert.equal(storedSkin.wrinkles, shownSkin.wrinkles);
  assert.equal(storedSkin.acne, shownSkin.acne);
  assert.equal(storedSkin.hydration, shownSkin.hydration);
  assert.equal(storedSkin.oiliness, shownSkin.oiliness);
  assertNoTreatment(shownSkin.recommendationsAr.join('\n'));
  assert.equal(shownSkin.recommendationsEn.join(' ').toLowerCase().includes('retinoid'), false);
  assert.equal(shownSkin.recommendationsEn.join(' ').includes('BPO'), false);

  const storedReport = {
    overallBeautyScore: 70,
    tipsAr: ['BPO', 'ريتينويد ليلي'],
    mainConcerns: [{ id: 'acne', titleAr: 'الحبوب', narrativeAr: 'قديم', severity: 'moderate' as const }],
  };
  const shownReport = presentCurrentReportTips(storedReport as never);
  assert.equal(storedReport.tipsAr[0], 'BPO');
  assert.equal(shownReport.overallBeautyScore, 70);
  assertNoTreatment(shownReport.tipsAr.join('\n'));
  assert.equal(shownReport.tipsAr.length > 0, true);
  const sparse = presentCurrentReportTips({ overallBeautyScore: 61, tipsAr: [] } as never);
  assert.equal(sparse.tipsAr.length > 0, true);
  assert.equal(sparse.overallBeautyScore, 61);
}

const REVIEW_PHRASES = [
  'سعر المنتج داخل ميرا مئة ريال.',
  'The product costs $99 in Mira.',
  'يمكنك شراء المنتج من ميرا مقابل 99.',
];

function assertNoUnsupportedPrice(text: string, label: string): void {
  assert.equal(text.includes('مئة'), false, label);
  assert.equal(text.includes('$99'), false, label);
  assert.equal(text.includes('99'), false, label);
  assert.equal(text.includes('٩٩'), false, label);
}

async function expectCleanTurn(userMessage: string, modelAnswer: string, facts: MceFactEntry[] = [skinFact]): Promise<void> {
  const send = createHarness({ complete: modelPayload(modelAnswer), facts });
  const sent = await send.orchestrator.sendMessage({} as never, 's1', { message: userMessage });
  const text = sent.assistantMessage.contentAr;
  assertNoUnsupportedPrice(text, userMessage);
  assert.equal(text.includes(modelAnswer), false, userMessage);
  assert.equal(send.saved.length, 1);
  assert.equal(send.saved[0], text);
  assert.equal(send.calls.persistAssistant, 1);
  assert.equal(send.calls.complete, 1);
  assert.equal(send.calls.stream, 0);

  const streamed = createHarness({
    complete: modelPayload(modelAnswer),
    facts,
    stream: async function* () {
      yield JSON.stringify(modelPayload(modelAnswer, modelAnswer));
    },
  });
  const sse = new FakeSse();
  await streamed.orchestrator.sendMessageStream({} as never, 's1', { message: userMessage }, sse as never);
  assertNoUnsupportedPrice(sse.text(), `stream ${userMessage}`);
  assert.equal(sse.text().includes(modelAnswer), false, `stream ${userMessage}`);
  assert.equal(sse.text().includes('event: delta'), true);
  assert.equal(sse.text().includes('event: done'), true);
  assert.equal(streamed.calls.complete, 0);
  assert.equal(streamed.calls.stream, 1);
  assert.equal(streamed.calls.persistAssistant, 1);
  assert.equal(streamed.saved[0].includes('event:'), false);
  assertNoUnsupportedPrice(streamed.saved[0], `saved ${userMessage}`);

  const cached = createHarness({ cached: modelPayload(modelAnswer, modelAnswer), facts });
  const hit = await cached.orchestrator.sendMessage({} as never, 's1', { message: userMessage });
  assert.equal(cached.calls.complete, 0);
  assert.equal(cached.calls.stream, 0);
  assert.equal(cached.calls.persistAssistant, 1);
  assertNoUnsupportedPrice(hit.assistantMessage.contentAr, `cache ${userMessage}`);
  assert.equal(hit.assistantMessage.contentAr.includes(modelAnswer), false, `cache ${userMessage}`);
  assert.equal(cached.saved[0], hit.assistantMessage.contentAr);
}

async function testCommercialRc3(): Promise<void> {
  for (const phrase of REVIEW_PHRASES) {
    await expectCleanTurn('ما الروتين المناسب لبشرتي؟', phrase);
  }
  const nearby = [
    'سعر المنتج مئة وخمسون ريال.',
    'التكلفة ٩٩ ر.س.',
    'The product costs 99 riyals.',
    'يمكنك شراء المنتج مقابل مبلغ ٩٩.',
    'المنتج غير متوفر داخل ميرا.',
    'موعد مؤكد غداً الساعة الخامسة.',
    'استخدمي واقي شمس يوميًا. سعر المنتج مئة ريال.',
  ];
  for (const phrase of nearby) {
    await expectCleanTurn('ما الأنسب لبشرتي؟', phrase);
  }
  const asked = createHarness({ complete: modelPayload('استخدمي واقي شمس يوميًا.') });
  const askedReply = await asked.orchestrator.sendMessage({} as never, 's1', { message: 'how much does it cost?' });
  assert.equal(askedReply.assistantMessage.contentAr.includes('واقي شمس'), false);
  assert.equal(askedReply.assistantMessage.contentAr, `${COMMERCIAL_GAP_AR}\n\n${ADVISOR_DISCLAIMER_AR}`);
  assert.equal(asked.calls.complete, 0);
  const care = createHarness({ complete: modelPayload('درجة حيوية بشرتك 72، وهذا رقم التقرير وليس سعرًا.') });
  const score = await care.orchestrator.sendMessage({} as never, 's1', { message: 'ما درجة الحيوية؟' });
  assert.equal(score.assistantMessage.contentAr.includes('72'), true);
  assert.equal(score.assistantMessage.contentAr.includes(COMMERCIAL_GAP_AR), false);
  const size = createHarness({ complete: modelPayload('حجم العبوة 50 مل يناسب الاستخدام اليومي.') });
  const sized = await size.orchestrator.sendMessage({} as never, 's1', { message: 'ما حجم العبوة؟' });
  assert.equal(sized.assistantMessage.contentAr.includes('50 مل'), true);
  assert.equal(sized.assistantMessage.contentAr.includes(COMMERCIAL_GAP_AR), false);
  const general = createHarness({ complete: modelPayload('استخدمي واقي شمس يوميًا.') });
  const kept = await general.orchestrator.sendMessage({} as never, 's1', { message: 'ما الروتين؟' });
  assert.equal(kept.assistantMessage.contentAr.includes('واقي شمس'), true);
  assert.equal(kept.assistantMessage.contentAr.includes(COMMERCIAL_GAP_AR), false);

  const serverLine = 'سعر سيروم النهار 50 ريال، وهو متوفر.';
  const matched = createHarness({
    complete: modelPayload('سعر سيروم النهار 50 دولار وهو غير متوفر.'),
    facts: [serumFact],
  });
  const factReply = await matched.orchestrator.sendMessage({} as never, 's1', { message: 'كم سعر سيروم النهار؟' });
  assert.equal(factReply.assistantMessage.contentAr.includes(serverLine), true);
  assert.equal(factReply.assistantMessage.contentAr.includes('دولار'), false);
  assert.equal(factReply.assistantMessage.contentAr.includes('غير متوفر'), false);

  for (const sample of [
    'السعر داخل ميرا تسعة وتسعون ريالًا.',
    'المنتج موجود في متجر ميرا وجاهز للشراء.',
    'The product is available today in Mira.',
    'يمكنك حجز موعد غدًا الساعة الخامسة في عيادة ميرا.',
  ]) {
    await expectCleanTurn('ما الروتين المناسب لبشرتي؟', sample);
  }
}

function legacyReport() {
  return {
    version: 2,
    overallBeautyScore: 70,
    skinTypeAr: 'مختلطة',
    skinTypeEn: 'combination',
    headlineAr: 'المسام بارزة — مقشر BHA خفيف 1–2 مرات أسبوعياً قد يساعد.',
    summaryAdviceAr: 'استخدمي BPO موضعيًا وريتينويد ليلي.',
    childSafety: { isMinor: false },
    confidenceLayer: { enabled: false, headlineAr: '' },
    faceHealthMap: { concernOverlays: [], disclaimerAr: '' },
    mainConcerns: [
      {
        id: 'pore',
        titleAr: 'المسام',
        narrativeAr: 'المسام بارزة — مقشر BHA خفيف 1–2 مرات أسبوعياً قد يساعد.',
        severity: 'noticeable' as const,
      },
      {
        id: 'acne',
        titleAr: 'الحبوب',
        narrativeAr: 'حبوب — BPO بتركيز منخفض.',
        severity: 'moderate' as const,
      },
    ],
    dailyRoutine: {
      morning: [],
      evening: [
        {
          id: 'exfoliant',
          nameAr: 'مقشر BHA خفيف',
          nameEn: 'Light BHA Exfoliant',
          stepAr: '2–3 مرات أسبوعياً — مساءً',
          stepEn: '2–3 evenings a week',
          period: 'pm',
        },
      ],
    },
    weeklyPlan: {
      enabled: true,
      headlineAr: 'خطة قديمة',
      summaryAr: 'BHA خفيف — مساءً فقط',
      days: [{ dayIndex: 1, labelAr: 'الأحد', focusAr: 'تقشير', stepsAr: ['BHA خفيف — مساءً فقط'] }],
    },
    tipsAr: ['استخدمي BPO موضعيًا على البثور.', 'ريتينويد ليلي'],
    recommendationsAr: ['Use BPO nightly.'],
    recommendationsEn: ['Nightly retinoid.'],
  };
}

function assertCurrentAdvice(value: unknown): void {
  const text = JSON.stringify(value);
  assert.equal(/BHA|BPO|ريتينويد|retinoid|Light BHA/i.test(text), false, text);
}

async function expectServerPrice(userMessage: string, leaked: string, facts: MceFactEntry[] = [skinFact]): Promise<void> {
  const send = createHarness({ complete: modelPayload(leaked), facts });
  const sent = await send.orchestrator.sendMessage({} as never, 's1', { message: userMessage });
  assert.equal(sent.assistantMessage.contentAr.includes(leaked), false, userMessage);
  assert.equal(sent.assistantMessage.contentAr.includes('99'), false, userMessage);
  assert.equal(sent.assistantMessage.contentAr.includes('٩٩'), false, userMessage);
  assert.equal(sent.assistantMessage.contentAr.includes('مئة'), false, userMessage);
  assert.equal(send.calls.complete, 0, userMessage);
  assert.equal(send.calls.stream, 0, userMessage);
  assert.equal(send.calls.persistAssistant, 1, userMessage);
  assert.equal(send.saved[0], sent.assistantMessage.contentAr);

  const streamed = createHarness({ complete: modelPayload(leaked), facts, stream: async function* () { yield JSON.stringify(modelPayload(leaked)); } });
  const sse = new FakeSse();
  await streamed.orchestrator.sendMessageStream({} as never, 's1', { message: userMessage }, sse as never);
  assert.equal(sse.text().includes(leaked), false, userMessage);
  assert.equal(sse.text().includes('event: delta'), true);
  assert.equal(sse.text().includes('event: done'), true);
  assert.equal(streamed.calls.complete, 0);
  assert.equal(streamed.calls.stream, 0);
  assert.equal(streamed.calls.persistAssistant, 1);
  assert.equal(streamed.saved[0].includes(leaked), false);

  const cached = createHarness({ cached: modelPayload(leaked), facts });
  const hit = await cached.orchestrator.sendMessage({} as never, 's1', { message: userMessage });
  assert.equal(cached.calls.complete, 0);
  assert.equal(cached.calls.stream, 0);
  assert.equal(hit.assistantMessage.contentAr.includes(leaked), false);
  assert.equal(cached.saved[0], hit.assistantMessage.contentAr);

  const bridge = createHarness({ complete: modelPayload(leaked), facts });
  const advised = await bridge.orchestrator.advisorBridge({} as never, userMessage);
  assert.equal(bridge.calls.complete, 0);
  assert.equal(advised.answer.includes(leaked), false);
  assert.equal(advised.disclaimerAr, ADVISOR_DISCLAIMER_AR);
}

async function testCommercialDirectRc4(): Promise<void> {
  for (const leaked of ['99 فقط.', '٩٩ فقط.', 'مئة.', 'It is 99.']) {
    await expectServerPrice('كم سعر المنتج؟', leaked);
  }
  const named = createHarness({
    complete: modelPayload('99 فقط.'),
    facts: [serumFact],
  });
  const matched = await named.orchestrator.sendMessage({} as never, 's1', { message: 'كم سعر سيروم النهار؟' });
  assert.equal(named.calls.complete, 0);
  assert.equal(matched.assistantMessage.contentAr.includes('سعر سيروم النهار 50 ريال، وهو متوفر.'), true);
  assert.equal(matched.assistantMessage.contentAr.includes('99'), false);
  const other = createHarness({ complete: modelPayload('99 فقط.'), facts: [serumFact] });
  const otherReply = await other.orchestrator.sendMessage({} as never, 's1', { message: 'كم سعر الكريم؟' });
  assert.equal(other.calls.complete, 0);
  assert.equal(otherReply.assistantMessage.contentAr.includes('50'), false);
  assert.equal(otherReply.assistantMessage.contentAr.includes(COMMERCIAL_GAP_AR), true);
  const mixed = createHarness({ complete: modelPayload('استخدمي واقي شمس يوميًا. 99 فقط.') });
  const mixedReply = await mixed.orchestrator.sendMessage({} as never, 's1', { message: 'ما الروتين وكم السعر؟' });
  assert.equal(mixed.calls.complete, 0);
  assert.equal(mixedReply.assistantMessage.contentAr.includes('روتين يومي'), true);
  assert.equal(mixedReply.assistantMessage.contentAr.includes('واقي شمس'), true);
  assert.equal(mixedReply.assistantMessage.contentAr.includes('99'), false);
  assert.equal(mixedReply.assistantMessage.contentAr.includes(COMMERCIAL_GAP_AR), true);
  const score = createHarness({ complete: modelPayload('درجة حيوية بشرتك 72، وهذا رقم التقرير وليس سعرًا.') });
  const scoreReply = await score.orchestrator.sendMessage({} as never, 's1', { message: 'ما درجة الحيوية؟' });
  assert.equal(score.calls.complete, 1);
  assert.equal(scoreReply.assistantMessage.contentAr.includes('72'), true);
  assert.equal(scoreReply.assistantMessage.contentAr.includes(COMMERCIAL_GAP_AR), false);
  const size = createHarness({ complete: modelPayload('حجم العبوة 50 مل يناسب الاستخدام اليومي.') });
  const sizeReply = await size.orchestrator.sendMessage({} as never, 's1', { message: 'ما حجم العبوة؟' });
  assert.equal(size.calls.complete, 1);
  assert.equal(sizeReply.assistantMessage.contentAr.includes('50 مل'), true);
  assert.equal(sizeReply.assistantMessage.contentAr.includes(COMMERCIAL_GAP_AR), false);
  const generalCache = createHarness({ cached: modelPayload('استخدمي واقي شمس يوميًا.') });
  await generalCache.orchestrator.sendMessage({} as never, 's1', { message: 'ما الروتين؟' });
  assert.equal(generalCache.calls.complete, 0);
  assert.equal(generalCache.calls.stream, 0);
}

const sunscreenFact: MceFactEntry = {
  id: 'catalog.sunscreen',
  labelAr: 'سعر الواقي',
  valueAr: '80 ريال',
  confidence: 'high',
  commercial: { subjectAr: 'واقي الشمس', priceAmount: '80', currency: 'SAR', availability: true },
};

async function testCommercialProductRc5(): Promise<void> {
  const leaks = ['بـ99.', 'بـ٩٩.', '99 فقط.', 'مئة.', 'It is 99.'];
  for (const question of ['كم سعر واقي الشمس؟', 'بكم المرطب؟', 'كم سعر الغسول؟', 'كم سعر سيروم الترطيب؟', 'How much is the sunscreen?']) {
    for (const leaked of leaks) await expectServerPrice(question, leaked);
  }
  const cachedStream = createHarness({ cached: modelPayload('بـ99.'), stream: async function* () { yield JSON.stringify(modelPayload('بـ99.')); } });
  const sse = new FakeSse();
  await cachedStream.orchestrator.sendMessageStream({} as never, 's1', { message: 'كم سعر واقي الشمس؟' }, sse as never);
  assert.equal(cachedStream.calls.complete, 0);
  assert.equal(cachedStream.calls.stream, 0);
  assert.equal(cachedStream.calls.persistAssistant, 1);
  assert.equal(sse.text().includes('بـ99'), false);
  assert.equal(sse.text().includes(COMMERCIAL_GAP_AR), true);
  assert.equal(cachedStream.saved[0].includes('بـ99'), false);
  assert.equal(cachedStream.saved.length, 1);

  const mixedQuestion = 'ما الروتين المناسب وكم سعر واقي الشمس؟';
  for (const leaked of ['استخدمي واقي شمس يوميًا. بـ99.', 'استخدمي واقي شمس يوميًا بـ99.']) {
    const mixed = createHarness({ complete: modelPayload(leaked) });
    const reply = await mixed.orchestrator.sendMessage({} as never, 's1', { message: mixedQuestion });
    assert.equal(mixed.calls.complete, 0, leaked);
    assert.equal(mixed.calls.persistAssistant, 1, leaked);
    assert.equal(reply.assistantMessage.contentAr.includes('روتين يومي'), true, leaked);
    assert.equal(reply.assistantMessage.contentAr.includes('بـ99'), false, leaked);
    assert.equal(reply.assistantMessage.contentAr.includes('99'), false, leaked);
    assert.equal(reply.assistantMessage.contentAr.includes(COMMERCIAL_GAP_AR), true, leaked);
    assert.equal(mixed.saved[0], reply.assistantMessage.contentAr);
    assert.equal(mixed.saved.length, 1);
  }
  const mixedStream = createHarness({ complete: modelPayload('استخدمي واقي شمس يوميًا. بـ99.') });
  const mixedSse = new FakeSse();
  await mixedStream.orchestrator.sendMessageStream({} as never, 's1', { message: mixedQuestion }, mixedSse as never);
  assert.equal(mixedStream.calls.stream, 0);
  assert.equal(mixedStream.calls.complete, 0);
  assert.equal(mixedSse.text().includes('بـ99'), false);
  assert.equal(mixedSse.text().includes('روتين يومي'), true);
  const mixedCache = createHarness({ cached: modelPayload('بـ99.') });
  const mixedHit = await mixedCache.orchestrator.sendMessage({} as never, 's1', { message: mixedQuestion });
  assert.equal(mixedCache.calls.complete, 0);
  assert.equal(mixedHit.assistantMessage.contentAr.includes('99'), false);
  assert.equal(mixedHit.assistantMessage.contentAr.includes('روتين يومي'), true);
  const mixedBridge = createHarness({ complete: modelPayload('بـ99.') });
  const mixedAdvised = await mixedBridge.orchestrator.advisorBridge({} as never, 'كيف أستخدم المرطب وكم سعره؟');
  assert.equal(mixedBridge.calls.complete, 0);
  assert.equal(mixedAdvised.answer.includes('بـ99'), false);
  assert.equal(mixedAdvised.answer.includes('روتين يومي'), true);
  assert.equal(mixedAdvised.answer.includes(COMMERCIAL_GAP_AR), true);

  const matched = createHarness({ complete: modelPayload('بـ99.'), facts: [sunscreenFact] });
  const matchedReply = await matched.orchestrator.sendMessage({} as never, 's1', { message: 'كم سعر واقي الشمس؟' });
  assert.equal(matched.calls.complete, 0);
  assert.equal(matchedReply.assistantMessage.contentAr.includes('سعر واقي الشمس 80 ريال، وهو متوفر.'), true);
  assert.equal(matchedReply.assistantMessage.contentAr.includes('99'), false);
  assert.equal(matchedReply.assistantMessage.contentAr.includes(COMMERCIAL_GAP_AR), false);
  const other = createHarness({ complete: modelPayload('بـ99.'), facts: [sunscreenFact] });
  const otherReply = await other.orchestrator.sendMessage({} as never, 's1', { message: 'كم سعر الغسول؟' });
  assert.equal(otherReply.assistantMessage.contentAr.includes('80'), false);
  assert.equal(otherReply.assistantMessage.contentAr.includes(COMMERCIAL_GAP_AR), true);

  const suggestions = validator.validate(
    { ...modelPayload('استخدمي واقي شمس يوميًا.'), suggestedQuestionsAr: ['بـ99.', 'ما حجم العبوة 50 مل؟', 'درجة الحيوية 72'] },
    [skinFact],
    'ما الروتين؟',
  );
  assert.equal(suggestions.suggestedQuestionsAr.includes('بـ99.'), false);
  assert.equal(suggestions.suggestedQuestionsAr.includes('ما حجم العبوة 50 مل؟'), true);
  assert.equal(suggestions.suggestedQuestionsAr.includes('درجة الحيوية 72'), true);
  assert.equal(suggestions.answerAr.includes('واقي شمس'), true);
}

function reportWithMoisture(score: number, routine = buildTreatmentPlan({
  beautyScore: 70,
  skinTypeAr: 'مختلطة',
  skinTypeEn: 'combination',
  hydration: score,
  oiliness: 40,
  pores: 1,
  wrinkles: 1,
  darkSpots: 1,
  acne: 1,
  redness: 1,
  undertoneAr: '',
  undertoneEn: '',
  skinToneAr: '',
  skinToneEn: '',
  recommendationsAr: [],
  recommendationsEn: [],
  concernScores: { moisture: score },
})) {
  return {
    overallBeautyScore: 70,
    headlineAr: 'عنوان',
    summaryAdviceAr: 'نصيحة حالية',
    mainConcerns: [{ id: 'moisture', titleAr: 'الترطيب', narrativeAr: 'ترطيب', severity: 'moderate' as const }],
    dailyRoutine: routine,
    weeklyPlan: { enabled: true, headlineAr: 'خطة', summaryAr: 'ملخص', days: [] },
    tipsAr: ['نصيحة'],
    faceHealthMap: { concernOverlays: [{ concernId: 'moisture', globalScore: score, severity: 'moderate' }] },
  };
}

async function testReportSourceRc4(): Promise<void> {
  const originalRoutine = buildTreatmentPlan({
    beautyScore: 70,
    skinTypeAr: 'مختلطة',
    skinTypeEn: 'combination',
    hydration: 64,
    oiliness: 40,
    pores: 1,
    wrinkles: 1,
    darkSpots: 1,
    acne: 1,
    redness: 1,
    undertoneAr: '',
    undertoneEn: '',
    skinToneAr: '',
    skinToneEn: '',
    recommendationsAr: [],
    recommendationsEn: [],
    concernScores: { moisture: 64 },
  });
  assert.equal(originalRoutine.morning.some((step) => step.id === 'serum_am'), false);
  const source = reportWithMoisture(64, originalRoutine);
  const before = JSON.stringify(source);
  const shown = presentCurrentReportTips(source as never);
  assert.equal(JSON.stringify(source), before);
  assert.equal(knownSourceScores(shown).moisture, 64);
  assert.equal(knownSourceScores(shown).moisture === 55, false);
  assert.equal(shown.dailyRoutine.morning.some((step) => step.id === 'serum_am'), false);
  const again = presentCurrentReportTips(shown);
  assert.equal(JSON.stringify(again.dailyRoutine), JSON.stringify(shown.dailyRoutine));
  assert.equal(JSON.stringify(again.weeklyPlan), JSON.stringify(shown.weeklyPlan));
  assert.equal(JSON.stringify(again.mainConcerns), JSON.stringify(shown.mainConcerns));
  for (const value of [61, 62, 64, 65]) {
    const next = presentCurrentReportTips(reportWithMoisture(value) as never);
    const hasSerum = next.dailyRoutine.morning.some((step) => step.id === 'serum_am');
    assert.equal(hasSerum, value < 62, String(value));
    assert.equal(knownSourceScores(next).moisture, value);
  }
  const severityOnly = presentCurrentReportTips({
    overallBeautyScore: 70,
    mainConcerns: [{ id: 'moisture', titleAr: 'الترطيب', narrativeAr: 'متوسط', severity: 'moderate' }],
    dailyRoutine: originalRoutine,
    weeklyPlan: { enabled: true, headlineAr: 'خطة', summaryAr: 'ملخص', days: [] },
    tipsAr: [],
    faceHealthMap: { concernOverlays: [] },
  } as never);
  assert.equal(Object.keys(knownSourceScores(severityOnly)).length, 0);
  assert.equal(severityOnly.dailyRoutine.morning.some((step) => step.id === 'serum_am'), false);
  assert.equal(severityOnly.overallBeautyScore, 70);
  const twice = presentCurrentReportTips(severityOnly);
  assert.equal(JSON.stringify(twice.dailyRoutine), JSON.stringify(severityOnly.dailyRoutine));
}

async function testLegacyReportRc3(): Promise<void> {
  const mapped = skin.mapYouCamResults(tskin007);
  assert.equal(mapped.wrinkles, 3);
  assert.equal(mapped.acne, 3);
  assert.equal(mapped.hydration, 80);
  assert.equal(mapped.oiliness, 40);
  const freshRoutine = buildTreatmentPlan(mapped);
  const fresh = presentCurrentReportTips({
    overallBeautyScore: mapped.beautyScore,
    mainConcerns: buildConcernNarratives(mapped),
    dailyRoutine: freshRoutine,
    weeklyPlan: buildWeeklyPlan(mapped, freshRoutine),
    tipsAr: buildTipsAr(mapped),
    summaryAdviceAr: 'نصيحة حالية',
    headlineAr: 'عنوان حالي',
  } as never);
  assert.equal(mapped.wrinkles, 3);
  assert.equal(mapped.hydration, 80);
  assert.equal(fresh.overallBeautyScore, mapped.beautyScore);
  assertCurrentAdvice(fresh);

  const original = legacyReport();
  const before = JSON.stringify(original);
  const shown = presentCurrentReportTips(original as never);
  assert.equal(JSON.stringify(original), before);
  assert.equal(original.overallBeautyScore, 70);
  assert.equal(shown.overallBeautyScore, 70);
  assert.equal(shown.mainConcerns[0].severity, 'noticeable');
  assert.equal(shown.mainConcerns[1].severity, 'moderate');
  assertCurrentAdvice({
    narrative: shown.mainConcerns.map((row) => row.narrativeAr),
    routine: shown.dailyRoutine,
    weekly: shown.weeklyPlan,
    tips: shown.tipsAr,
    summary: shown.summaryAdviceAr,
    headline: shown.headlineAr,
  });
  assert.equal(shown.dailyRoutine.evening.some((step) => step.nameAr.includes('لطيف') || step.nameAr.includes('غسول')), true);
  assert.equal(shown.tipsAr.length > 0, true);

  const sparse = presentCurrentReportTips({ overallBeautyScore: 61, tipsAr: [], mainConcerns: [] } as never);
  assert.equal(sparse.overallBeautyScore, 61);
  assert.equal(sparse.mainConcerns.length, 0);
  assert.equal(sparse.tipsAr.length > 0, true);
  assert.equal(sparse.dailyRoutine.morning.length > 0, true);
  const limited = presentCurrentReportTips({
    mainConcerns: [{ id: 'pore', titleAr: 'المسام', narrativeAr: 'مقشر BHA خفيف', severity: 'noticeable' }],
  } as never);
  assert.equal(limited.overallBeautyScore, undefined);
  assertCurrentAdvice(limited);

  const stored = { version: 2, miraReport: original };
  const history = Object.create(SkinAnalysisService.prototype) as SkinAnalysisService;
  Object.assign(history, {
    usersService: {
      findOrCreateFromFirebase: async () => ({ id: 'u1' }),
      getPreferences: async () => null,
    },
    prisma: {
      skinAnalysis: {
        findMany: async () => [{ id: 'a1', createdAt: new Date('2026-01-02T00:00:00.000Z'), resultJson: stored }],
      },
    },
    intelligence: {
      enrichWithUserContext: (report: unknown) => report,
      attachProgressForecast: async (_userId: string, report: unknown) => report,
    },
  });
  const items = await history.history({ uid: 'x' } as never, 5);
  assert.equal(JSON.stringify(original), before);
  assert.equal(items[0].miraReport.overallBeautyScore, 70);
  assertCurrentAdvice(items[0].miraReport);

  const grounding = new MceGroundingPipelineService(
    { skinAnalysis: { findFirst: async () => ({ id: 'a1', resultJson: stored }) } } as never,
    {
      enrichWithUserContext: (report: unknown) => report,
      attachProgressForecast: async (_userId: string, report: unknown) => report,
    } as never,
    new MceFactExtractorService(),
  );
  const context = await grounding.build({
    userId: 'u1',
    skinAnalysisId: 'a1',
    locale: 'ar',
    subscriptionPlan: 'free',
  });
  assert.equal(JSON.stringify(original), before);
  assertCurrentAdvice(context.snapshot.skin);
}

async function main(): Promise<void> {
  testCommercialCases();
  await testSendPaths();
  await testCommercialRc3();
  await testCommercialDirectRc4();
  await testCommercialProductRc5();
  testSkinTips();
  await testReportSourceRc4();
  await testLegacyReportRc3();
  console.log('risk-remediation-batch1: PASS');
  console.log('T-COMM-RC2 T-STREAM-RC2 T-TIPS-RC2 T-COMM-RC3 T-STREAM-REGRESSION-RC3 T-LEGACY-REPORT-RC3 T-COMM-DIRECT-RC4 T-REPORT-SOURCE-RC4 T-REPORT-STABILITY-RC4 T-COMM-PRODUCT-MIXED-RC5');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
