/**
 * RC3 local consultation checks. Real assembler, validator, session lookup,
 * and stream orchestrator. External model, database, and paid calls are stubs.
 * A passing check reproduces behavior. It does not repair it.
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NotFoundException } from '@nestjs/common';
import { McePromptAssemblerService, MceResponseValidatorService } from './services/mce-prompt-assembler.service';
import { MceModerationService } from './services/mce-moderation.service';
import {
  isDirectCommercialQuestion,
  guardCommercialTurn,
} from './services/mce-commercial-guard';
import { ConsultationSessionService } from './services/consultation-session.service';
import { ConsultationOrchestratorService } from './services/consultation-orchestrator.service';
import {
  MceContextSnapshotV1,
  MceFactEntry,
} from './contracts/mce-context-snapshot.v1';

const AD_QUESTION = 'هل هذه النصيحة إعلان مدفوع؟';
const DENIAL = 'هذه نصيحة عناية وليست إعلانًا مدفوعًا.';

function snapshot(skinTypeAr: string): MceContextSnapshotV1 {
  return {
    schemaVersion: '1.0.0',
    builtAt: '2026-10-16T00:00:00.000Z',
    user: { locale: 'ar', isMinor: false, subscriptionPlan: 'free' },
    skin: {
      analysisId: 'skin-a',
      beautyScore: 70,
      overallScoreAvailable: true,
      skinTypeAr,
      headlineAr: 'عنوان التقرير',
      summaryAdviceAr: 'ملخص',
      mainConcerns: [],
      tipsAr: [],
      routineMorningAr: [],
      routineEveningAr: [],
      concernScores: [],
      disclaimerAr: 'تجميلي',
      isMinor: false,
    },
  };
}

function fact(id: string, labelAr: string, valueAr: string): MceFactEntry {
  return { id, labelAr, valueAr, confidence: 'high' };
}

function systemText(
  assembler: McePromptAssemblerService,
  facts: MceFactEntry[],
  skinTypeAr: string,
): string {
  const messages = assembler.buildMessages({
    snapshot: snapshot(skinTypeAr),
    factRegistry: facts,
    history: [],
    userMessage: AD_QUESTION,
  });
  const system = messages.find((message) => message.role === 'system');
  assert.ok(system);
  assert.equal(typeof system.content, 'string');
  return system.content as string;
}

async function main(): Promise<void> {
  const moderation = new MceModerationService();
  const assembler = new McePromptAssemblerService(moderation);
  const validator = new MceResponseValidatorService(moderation);
  const checks: Array<{ id: string; pass: boolean; actual: unknown }> = [];

  const paidFacts = [
    fact('ad-status', 'طبيعة النصيحة', 'إعلان مدفوع مثبت'),
    fact('moisture', 'الترطيب', '70'),
  ];
  const unpaidFacts = [
    fact('ad-status', 'طبيعة النصيحة', 'ليست إعلانًا مدفوعًا'),
    fact('moisture', 'الترطيب', '70'),
  ];
  const unknownFacts = [fact('moisture', 'الترطيب', '70')];

  const paidPrompt = systemText(assembler, paidFacts, 'جافة');
  const unpaidPrompt = systemText(assembler, unpaidFacts, 'جافة');
  const unknownPrompt = systemText(assembler, unknownFacts, 'جافة');
  const denialRule = 'ليست إعلانًا مدفوعًا';

  checks.push({
    id: 'ad-instruction-is-unconditional',
    pass:
      paidPrompt.includes(denialRule) &&
      unpaidPrompt.includes(denialRule) &&
      unknownPrompt.includes(denialRule) &&
      paidPrompt.includes('إعلان مدفوع مثبت') &&
      unknownPrompt.includes('الترطيب = 70') &&
      !unknownPrompt.includes('إعلان مدفوع مثبت'),
    actual: {
      schemaHasPaidFlag: false,
      factFields: ['id', 'labelAr', 'valueAr', 'confidence', 'commercial?'],
      paidContainsDenial: paidPrompt.includes(denialRule),
      unpaidContainsDenial: unpaidPrompt.includes(denialRule),
      unknownContainsDenial: unknownPrompt.includes(denialRule),
      questionIsDirectCommercial: isDirectCommercialQuestion(AD_QUESTION),
    },
  });

  const guarded = guardCommercialTurn(DENIAL, paidFacts, AD_QUESTION);
  const validated = validator.validate(
    {
      answerAr: DENIAL,
      confidence: 'high',
      intent: 'general',
      citedFactIds: ['ad-status'],
      suggestedQuestionsAr: [],
      blocked: false,
      disclaimerAr: '',
    },
    paidFacts,
    AD_QUESTION,
  );
  checks.push({
    id: 'later-guard-does-not-correct-denial',
    pass:
      isDirectCommercialQuestion(AD_QUESTION) === false &&
      guarded.text.includes(denialRule) &&
      validated.answerAr.includes(denialRule),
    actual: {
      directCommercial: isDirectCommercialQuestion(AD_QUESTION),
      guarded: guarded.text,
      validated: validated.answerAr,
      modelWasCalled: false,
    },
  });

  const otherReport = systemText(assembler, unknownFacts, 'دهنية');
  checks.push({
    id: 'prompt-embeds-the-snapshot-it-is-given',
    pass: paidPrompt.includes('نوع: جافة') && otherReport.includes('نوع: دهنية') && !otherReport.includes('نوع: جافة'),
    actual: { first: 'جافة', second: 'دهنية' },
  });

  const rows = new Map<string, { id: string; userId: string }>([
    ['user-a:s-a', { id: 's-a', userId: 'user-a' }],
    ['user-b:s-b', { id: 's-b', userId: 'user-b' }],
  ]);
  const prisma = {
    consultationSession: {
      findFirst: async ({ where }: { where: { id: string; userId: string } }) => {
        return rows.get(`${where.userId}:${where.id}`) ?? null;
      },
    },
  };
  const sessions = new ConsultationSessionService(
    prisma as never,
    {} as never,
    {} as never,
  );
  const own = await sessions.getForUser('user-a', 's-a');
  let cross: string | null = null;
  try {
    await sessions.getForUser('user-b', 's-a');
  } catch (error) {
    cross = error instanceof NotFoundException ? 'NotFoundException' : String(error);
  }
  checks.push({
    id: 'session-lookup-rejects-the-other-user',
    pass: own.id === 's-a' && cross === 'NotFoundException',
    actual: { own: own.id, cross },
  });

  let aborted = false;
  let streamCalls = 0;
  const writes: string[] = [];
  const streamAbort: { run: (() => void) | null } = { run: null };
  const res = {
    writableEnded: false,
    setHeader() {},
    flushHeaders() {},
    write(chunk: string) {
      writes.push(chunk);
      return true;
    },
    end() {
      this.writableEnded = true;
    },
    on(event: string, handler: () => void) {
      if (event === 'close') streamAbort.run = handler;
    },
  };
  const skin = snapshot('جافة');
  const orchestrator = new ConsultationOrchestratorService(
    { get: (_key: string, fallback?: string) => fallback ?? 'true' } as never,
    {
      findOrCreateFromFirebase: async () => ({ id: 'user-a' }),
      writeAuditLog: async () => undefined,
    } as never,
    {
      subscription: { findUnique: async () => ({ plan: 'free' }) },
      consultationSession: { update: async () => ({}) },
    } as never,
    { assertWithinLimit: async () => undefined } as never,
    {
      assertDailyQuota: async () => undefined,
      answerCacheKey: () => 'cache-key',
      getFaqCache: async () => null,
      setFaqCache: async () => undefined,
    } as never,
    { shouldCompact: () => false, compact: async () => null } as never,
    {
      getForUser: async () => ({
        id: 's-a',
        titleAr: 'استشارة',
        status: 'active',
        activeSnapshotId: 'snap-1',
        occasionId: null,
        rollingSummaryAr: null,
        turnCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      toDto: (row: { id: string }) => ({ id: row.id }),
    } as never,
    {
      recentPairs: async () => [],
      persistUser: async () => ({ id: 'm1', contentAr: AD_QUESTION, role: 'user', blocked: false, createdAt: new Date() }),
      persistAssistant: async () => ({ id: 'm2', contentAr: 'x', role: 'assistant', blocked: false, createdAt: new Date() }),
      toDto: (row: { id: string; contentAr: string; role: string; createdAt: Date }) => row,
    } as never,
    { loadForSession: async () => ({ id: 'snap-1', snapshot: skin, factRegistry: paidFacts }) } as never,
    {} as never,
    { classify: () => 'general', intentHintAr: () => '' } as never,
    moderation,
    assembler,
    validator,
    {
      isConfigured: () => true,
      stream: async function* (_messages: unknown, opts?: { signal?: AbortSignal }) {
        streamCalls += 1;
        if (opts?.signal?.aborted) return;
        yield JSON.stringify({
          answerAr: DENIAL,
          confidence: 'high',
          intent: 'general',
          citedFactIds: [],
          suggestedQuestionsAr: [],
          blocked: false,
          disclaimerAr: '',
        });
        await new Promise((resolve) => setTimeout(resolve, 20));
        if (opts?.signal?.aborted) return;
        yield 'SHOULD_NOT_APPEND';
      },
      complete: async () => {
        throw new Error('complete must not run when stream is used');
      },
    } as never,
  );

  const pending = orchestrator.sendMessageStream(
    { uid: 'firebase-a' } as never,
    's-a',
    { message: AD_QUESTION } as never,
    res as never,
  );
  await new Promise((resolve) => setTimeout(resolve, 5));
  streamAbort.run?.();
  aborted = true;
  await pending;
  const deltas = writes.filter((chunk) => chunk.startsWith('event: delta'));
  checks.push({
    id: 'stream-close-aborts-and-writes-one-delta',
    pass: aborted && streamCalls === 1 && deltas.length === 1 && !writes.join('\n').includes('SHOULD_NOT_APPEND'),
    actual: {
      closeRegistered: streamAbort.run != null,
      streamCalls,
      deltaCount: deltas.length,
      joinedHasSecondChunk: writes.join('\n').includes('SHOULD_NOT_APPEND'),
    },
  });

  const failed = checks.filter((check) => !check.pass);
  const out = {
    round: 'RC3',
    ranAt: new Date().toISOString(),
    paidCalls: 0,
    note: 'PASS reproduces behavior. The model was not called. The prompt file was not edited.',
    checks,
  };
  const dir = join(process.cwd(), 'audit-out');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'rc3-consultation.json'), JSON.stringify(out, null, 2));
  if (failed.length) {
    console.error(JSON.stringify(failed, null, 2));
    throw new Error(`AI_SYSTEM_AUDIT_RC3_CONSULT_FAIL ${failed.map((check) => check.id).join(',')}`);
  }
  console.log(`AI_SYSTEM_AUDIT_RC3_CONSULT_PASS ${out.ranAt}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
