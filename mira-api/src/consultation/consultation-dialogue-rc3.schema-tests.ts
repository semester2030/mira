import 'reflect-metadata';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import type { FaceIntelligenceReportDto } from '../intelligence/face-intelligence/report/face-report.engine';
import { ConsultationOrchestratorService } from './services/consultation-orchestrator.service';
import { ConsultationMessageService } from './services/consultation-message.service';
import { MceIntentClassifierService } from './services/mce-intent-classifier.service';
import { MceModerationService } from './services/mce-moderation.service';
import { McePromptAssemblerService, MceResponseValidatorService } from './services/mce-prompt-assembler.service';
import { resolveFaceSelection } from './services/consultation-face-selection';
import { MemoryAttachmentRepository, resolveDialogueTurn } from './services/consultation-attachment.service';
import {
  attachmentExpired,
  orphanStorageKeys,
  purgeExpiredAttachments,
  requestFingerprint,
  selectImagesForTurn,
} from './services/consultation-dialogue';
import { MceContextSnapshotV1 } from './contracts/mce-context-snapshot.v1';
import { MceAssistantPayloadV1 } from './contracts/mce-context-snapshot.v1';

const checks: string[] = [];
function record(name: string, ok: boolean, detail?: unknown) {
  if (!ok) {
    console.error('FAIL', name, detail);
    process.exitCode = 1;
  }
  checks.push(name);
}

function report(): FaceIntelligenceReportDto {
  return {
    analysisId: 'fx-rc3',
    provider: 'test',
    formulaVersion: 'f',
    captureVersion: 'c',
    faceVersion: 'fv',
    intelligenceVersion: 'iv',
    geometryVersion: 'gv',
    geometryFormulaId: 'gf',
    shapeVersion: 'sv',
    shapeFormulaId: 'sf',
    recommendationVersion: 'rv',
    recommendationEngineId: 're',
    reportVersion: 'face-report-v1',
    generatedAt: '2026-01-01T00:00:00.000Z',
    confidence: 80,
    limitations: ['إضاءة غير متساوية'],
    language: 'ar+en',
    executiveSummaryAr: 'ملخص عام لا يخص اختيارًا واحدًا.',
    executiveSummaryEn: 'summary',
    measurementEligible: true,
    eligibilityReasonCodes: [],
    shape: {
      availability: 'available',
      shapeId: 'oval',
      displayNameAr: 'بيضاوي',
      displayNameEn: 'Oval',
      confidence: 80,
      explanationAr: 'شكل بيضاوي.',
      explanationEn: 'oval',
    },
    findings: [],
    notableFindings: [
      {
        id: 'jaw-finding',
        category: 'proportion',
        metricIds: [],
        titleAr: 'الفك',
        titleEn: 'jaw',
        detailAr: 'ملاحظة الفك المحفوظة.',
        detailEn: 'jaw',
        severity: 'info',
        confidence: 'high',
        recommendationEligible: false,
        priority: 1,
        limitations: [],
        source: 'geometry',
      },
      {
        id: 'cheek-finding',
        category: 'proportion',
        metricIds: [],
        titleAr: 'الخد',
        titleEn: 'cheek',
        detailAr: 'ملاحظة الخد المحفوظة.',
        detailEn: 'cheek',
        severity: 'info',
        confidence: 'high',
        recommendationEligible: false,
        priority: 2,
        limitations: [],
        source: 'geometry',
      },
    ],
    metrics: [],
    recommendations: [],
    featureLayers: [],
    retakeGuidanceAr: 'أعيدي الالتقاط',
    retakeGuidanceEn: 'retake',
  } as unknown as FaceIntelligenceReportDto;
}

function promptFor(selection: ReturnType<typeof resolveFaceSelection>['selection'], message: string) {
  const moderation = new MceModerationService();
  const assembler = new McePromptAssemblerService(moderation);
  const snapshot = {
    schemaVersion: '1.0.0' as const,
    user: { locale: 'ar', isMinor: false, subscriptionPlan: 'free' },
    builtAt: '2026-10-17T00:00:00.000Z',
    faceSelection: selection,
  } satisfies MceContextSnapshotV1;
  const first = assembler.buildMessages({
    snapshot,
    factRegistry: [],
    history: [],
    userMessage: message,
  }).map((item) => String(item.content)).join('\n');
  const follow = assembler.buildMessages({
    snapshot,
    factRegistry: [],
    history: [{ role: 'user', content: message }, { role: 'assistant', content: 'حسناً' }],
    userMessage: 'وضحي أكثر',
  }).map((item) => String(item.content)).join('\n');
  return { first, follow };
}

function image(id: string, at: string) {
  return {
    id,
    userId: 'user-a',
    sessionId: 'session-a',
    messageId: `msg-${id}`,
    createdAt: at,
    bytesReady: true,
    ordinal: 0,
  };
}

class FlakyDeleteRepository extends MemoryAttachmentRepository {
  fails = new Set<string>();
  override async deleteStored(id: string, at: Date): Promise<'deleted' | 'failed'> {
    if (this.fails.has(id)) {
      this.fails.delete(id);
      return 'failed';
    }
    return super.deleteStored(id, at);
  }
}

async function faceAndImages() {
  const stored = report();
  const jaw = resolveFaceSelection({
    owned: true,
    report: stored,
    focus: {
      contextType: 'region',
      reportRef: 'report-1',
      analysisId: 'fx-rc3',
      selectedRegion: 'jaw',
      selectedInsightId: 'jaw-finding',
      resultVersion: 'face-report-v1',
      limitationRefs: ['إضاءة غير متساوية'],
      publicFactAr: 'نص الواجهة المزيف عن الفك',
      contextLabelAr: 'قسم الفك',
    },
  });
  const cheek = resolveFaceSelection({
    owned: true,
    report: stored,
    focus: {
      contextType: 'region',
      reportRef: 'report-1',
      selectedRegion: 'cheek',
      selectedInsightId: 'cheek-finding',
      resultVersion: 'face-report-v1',
    },
  });
  const jawPrompt = promptFor(jaw.selection, 'وش عندي هنا؟');
  const cheekPrompt = promptFor(cheek.selection, 'وش عندي هنا؟');
  record(
    'face-region-context-is-specific',
    jawPrompt.first.includes('ملاحظة الفك المحفوظة')
      && jawPrompt.first.includes('jaw')
      && !jawPrompt.first.includes('ملاحظة الخد المحفوظة')
      && !jawPrompt.first.includes('نص الواجهة المزيف')
      && cheekPrompt.first.includes('ملاحظة الخد المحفوظة')
      && !cheekPrompt.first.includes('ملاحظة الفك المحفوظة'),
    { jaw: jaw.selection.statementsAr, cheek: cheek.selection.statementsAr },
  );
  record('face-follow-up-keeps-selection', jawPrompt.follow.includes('ملاحظة الفك المحفوظة'), true);
  const stale = resolveFaceSelection({
    owned: true,
    report: stored,
    focus: { contextType: 'region', selectedRegion: 'jaw', selectedInsightId: 'jaw-finding', evidenceStale: true },
  });
  const stalePrompt = promptFor(stale.selection, 'وش عندي هنا؟').first;
  record('stale-face-result-is-not-replaced', stale.selection.status === 'stale' && stalePrompt.includes('قديمة') && !stalePrompt.includes('ملاحظة الفك المحفوظة'), stale.selection.status);
  const missing = resolveFaceSelection({ owned: false, report: null, focus: { contextType: 'region', reportRef: 'other-report', selectedRegion: 'jaw' } });
  record('missing-face-result-does-not-pick-another', missing.selection.status === 'unavailable' && missing.facts.length === 0, missing.selection.noticeAr);

  const dress = image('dress', '2026-10-01T00:00:00.000Z');
  const bag = image('bag', '2026-10-02T00:00:00.000Z');
  const first = selectImagesForTurn({ message: 'صفي الصورة الأولى', current: [], prior: [dress, bag] });
  const follow = selectImagesForTurn({ message: 'هل يناسب الدوام؟', current: [], prior: [dress, bag], pinnedIds: first.pinIds });
  const second = selectImagesForTurn({ message: 'الصورة الثانية', current: [], prior: [dress, bag], pinnedIds: first.pinIds });
  const general = selectImagesForTurn({ message: 'ما روتين العناية؟', current: [], prior: [dress, bag], pinnedIds: first.pinIds });
  record(
    'pin-survives-newer-image',
    first.images[0]?.id === 'dress' && follow.images.map((item) => item.id).join(',') === 'dress' && second.images[0]?.id === 'bag' && general.images.length === 0,
    { first: first.images, follow: follow.images, second: second.images, general: general.images },
  );
  record('image-order-changes-fingerprint', requestFingerprint('قارني', ['dress', 'bag']) !== requestFingerprint('قارني', ['bag', 'dress']), true);

  const repo = new MemoryAttachmentRepository();
  await repo.insert({
    id: 'old-dress', userId: 'user-a', sessionId: 'session-a', messageId: 'm1', createdAt: new Date('2026-01-01T00:00:00.000Z'),
    mimeType: 'image/jpeg', byteSize: 1, sha256: 'x', width: 1, height: 1, storageKey: 'old', status: 'ready', deletedAt: null, bytes: null,
  });
  const textOnly = await resolveDialogueTurn({
    repo, userId: 'user-a', sessionId: 'session-a', message: 'ما روتين العناية؟', attachmentIds: [], model: 'gpt-4o-mini', now: new Date('2026-10-17T00:00:00.000Z'),
  });
  record('missing-old-image-does-not-block-text', textOnly.localReply == null && textOnly.imageIds.length === 0, textOnly);
  const expiredAsk = await resolveDialogueTurn({
    repo, userId: 'user-a', sessionId: 'session-a', message: 'وش لونه؟', attachmentIds: [], model: 'gpt-4o-mini', now: new Date('2026-10-17T00:00:00.000Z'),
  });
  record('expired-image-is-not-sent', expiredAsk.localReply != null && expiredAsk.dataUrls.length === 0, expiredAsk.localReply);
  record('expiry-is-immediate', attachmentExpired(new Date('2026-01-01T00:00:00.000Z'), 30, new Date('2026-10-17T00:00:00.000Z')), true);

  const flaky = new FlakyDeleteRepository();
  await flaky.insert({
    id: 'keep', userId: 'user-a', sessionId: 'session-a', messageId: null, createdAt: new Date('2026-01-01T00:00:00.000Z'),
    mimeType: 'image/jpeg', byteSize: 1, sha256: 'x', width: 1, height: 1, storageKey: 'keep', status: 'ready', deletedAt: null, bytes: Buffer.from('x'),
  });
  flaky.fails.add('keep');
  const firstSweep = await purgeExpiredAttachments(flaky, 30, new Date('2026-10-17T00:00:00.000Z'));
  const stillThere = await flaky.find('keep');
  const secondSweep = await purgeExpiredAttachments(flaky, 30, new Date('2026-10-17T00:00:00.000Z'));
  record('retention-retries-failed-delete', firstSweep.failed === 1 && stillThere != null && secondSweep.deleted === 1 && (await flaky.find('keep')) == null, { firstSweep, secondSweep });
  record('orphan-keys-are-separate', orphanStorageKeys(['a.jpg', 'b.jpg'], ['a.jpg']).join(',') === 'b.jpg', true);
}

const answer: MceAssistantPayloadV1 = {
  answerAr: 'رد واحد',
  confidence: 'low',
  intent: 'general',
  citedFactIds: [],
  suggestedQuestionsAr: [],
  blocked: false,
  disclaimerAr: '',
};

async function turns() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    record('turn-lifecycle', false, 'DATABASE_URL missing');
    return;
  }
  const url = `postgresql://${process.env.USER || 'localhost'}@localhost:5432/mira_dialogue_dev`;
  if (url.includes('/mira_db')) throw new Error('refused operating database');
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const stamp = Date.now().toString(36);
  const user = await prisma.user.create({ data: { firebaseUid: `rc3-${stamp}`, email: `rc3-${stamp}@test.local` } });
  const session = await prisma.consultationSession.create({ data: { userId: user.id, metadataJson: {} } });
  const calls = { n: 0 };
  let failUpdate = false;
  const db = new Proxy(prisma, {
    get(target, prop, receiver) {
      if (prop === 'consultationSession') {
        const model = target.consultationSession;
        return new Proxy(model, {
          get(sessionModel, key) {
            const value = Reflect.get(sessionModel, key, receiver);
            if (key === 'update') {
              return async (args: Prisma.ConsultationSessionUpdateArgs) => {
                if (failUpdate) {
                  failUpdate = false;
                  throw new Error('session update failed');
                }
                return model.update(args);
              };
            }
            return typeof value === 'function' ? value.bind(model) : value;
          },
        });
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const messages = new ConsultationMessageService(prisma as never);
  const moderation = new MceModerationService();
  let failPrepare = false;
  let failSave = false;
  const originalSave = messages.persistAssistant.bind(messages);
  messages.persistAssistant = (async (...args: Parameters<ConsultationMessageService['persistAssistant']>) => {
    if (failSave) {
      failSave = false;
      throw new Error('assistant save failed');
    }
    return originalSave(...args);
  }) as ConsultationMessageService['persistAssistant'];
  const orchestrator = new ConsultationOrchestratorService(
    { get: (_key: string, fallback?: unknown) => fallback ?? 'true' } as never,
    { findOrCreateFromFirebase: async () => user, getPreferences: async () => null, writeAuditLog: async () => undefined } as never,
    db as never,
    { assertWithinLimit: async () => { if (failPrepare) { failPrepare = false; throw new Error('prepare failed'); } } } as never,
    { assertDailyQuota: async () => undefined, answerCacheKey: () => null, getFaqCache: async () => null, setFaqCache: async () => undefined } as never,
    { shouldCompact: () => false, compact: async () => null } as never,
    { getForUser: async () => session, toDto: () => ({ id: session.id, titleAr: 'اختبار', status: 'active', activeSnapshotId: null, contextSummary: {}, turnCount: 0, suggestedStartersAr: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }) } as never,
    messages,
    { loadForSession: async () => ({ id: 'snap', snapshot: { schemaVersion: '1.0.0', user: { locale: 'ar', isMinor: false, subscriptionPlan: 'free' }, builtAt: new Date().toISOString() }, factRegistry: [] }) } as never,
    {} as never,
    new MceIntentClassifierService(),
    moderation,
    new McePromptAssemblerService(moderation),
    new MceResponseValidatorService(moderation),
    { isConfigured: () => true, configuredModel: () => 'gpt-4o-mini', complete: async () => { calls.n += 1; return { payload: answer, modelId: 'test' }; } } as never,
  );
  const auth = { firebaseUid: user.firebaseUid, email: user.email ?? undefined, name: 'اختبار' };
  const count = async () => {
    const rows = await prisma.consultationMessage.findMany({ where: { sessionId: session.id } });
    return {
      users: rows.filter((row) => row.role === 'user').length,
      assistants: rows.filter((row) => row.role === 'assistant').length,
    };
  };

  failPrepare = true;
  await orchestrator.sendMessage(auth, session.id, { message: 'سؤال التحضير', clientMessageId: 'prep-1' } as never).then(
    () => { throw new Error('prepare should fail'); },
    () => undefined,
  );
  const afterPrepare = await count();
  record('prepare-failure-is-retryable', afterPrepare.users === 1 && afterPrepare.assistants === 0 && calls.n === 0, afterPrepare);
  await orchestrator.sendMessage(auth, session.id, { message: 'سؤال التحضير', clientMessageId: 'prep-1' } as never);
  const afterPrepareRetry = await count();
  record('prepare-retry-creates-one-answer', afterPrepareRetry.users === 1 && afterPrepareRetry.assistants === 1 && calls.n === 1, { afterPrepareRetry, calls: calls.n });

  failSave = true;
  await orchestrator.sendMessage(auth, session.id, { message: 'سؤال الحفظ', clientMessageId: 'save-1' } as never).then(
    () => { throw new Error('save should fail'); },
    () => undefined,
  );
  const callsAfterSaveFail = calls.n;
  await orchestrator.sendMessage(auth, session.id, { message: 'سؤال الحفظ', clientMessageId: 'save-1' } as never);
  const afterSave = await count();
  record('save-failure-retries-same-request', afterSave.users === 2 && afterSave.assistants === 2 && calls.n === callsAfterSaveFail + 1, { afterSave, calls: calls.n });

  failUpdate = true;
  const beforeUpdate = calls.n;
  await orchestrator.sendMessage(auth, session.id, { message: 'سؤال التحديث', clientMessageId: 'update-1' } as never);
  await orchestrator.sendMessage(auth, session.id, { message: 'سؤال التحديث', clientMessageId: 'update-1' } as never);
  const afterUpdate = await count();
  record('update-failure-does-not-call-model-again', afterUpdate.assistants === 3 && calls.n === beforeUpdate + 1, { afterUpdate, calls: calls.n, beforeUpdate });

  const concurrent = await Promise.allSettled([
    orchestrator.sendMessage(auth, session.id, { message: 'سؤال متزامن', clientMessageId: 'race-1' } as never),
    orchestrator.sendMessage(auth, session.id, { message: 'سؤال متزامن', clientMessageId: 'race-1' } as never),
  ]);
  const afterRace = await count();
  record('concurrent-same-id-keeps-one-answer', concurrent.filter((item) => item.status === 'fulfilled').length >= 1 && afterRace.assistants === 4 && afterRace.users === 4, { afterRace, calls: calls.n });

  await prisma.consultationMessage.create({
    data: {
      sessionId: session.id,
      role: 'user',
      contentAr: 'سؤال عالق',
      clientMessageId: 'stuck-1',
      requestHash: requestFingerprint('سؤال عالق', []),
      turnStatus: 'pending',
      createdAt: new Date(Date.now() - 10 * 60 * 1000),
    },
  });
  const beforeStuck = calls.n;
  await orchestrator.sendMessage(auth, session.id, { message: 'سؤال عالق', clientMessageId: 'stuck-1' } as never);
  const afterStuck = await count();
  record('stuck-pending-recovers-once', afterStuck.users === 5 && afterStuck.assistants === 5 && calls.n === beforeStuck + 1, { afterStuck, calls: calls.n });

  await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
}

async function main() {
  await faceAndImages();
  await turns();
  const out = join(process.cwd(), 'audit-out');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'consultation-dialogue-rc3.json'), JSON.stringify({
    round: 'CONSULT_DIALOGUE_RC3',
    ranAt: new Date().toISOString(),
    status: process.exitCode ? 'FAIL' : 'PASS',
    checks,
  }, null, 2));
  if (process.exitCode) process.exit(process.exitCode);
  console.log('CONSULT_DIALOGUE_RC3_PASS', checks.length);
}

main().catch((error) => {
  const message = (error instanceof Error ? error.message : 'failed').replace(/postgres(?:ql)?:\/\/\S+/g, '[url]');
  console.error(message);
  process.exit(1);
});
