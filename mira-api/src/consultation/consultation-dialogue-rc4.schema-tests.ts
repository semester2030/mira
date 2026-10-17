import 'reflect-metadata';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import type { FaceIntelligenceReportDto } from '../intelligence/face-intelligence/report/face-report.engine';
import { ConsultationOrchestratorService } from './services/consultation-orchestrator.service';
import { ConsultationMessageService } from './services/consultation-message.service';
import { MceIntentClassifierService } from './services/mce-intent-classifier.service';
import { MceModerationService } from './services/mce-moderation.service';
import { McePromptAssemblerService, MceResponseValidatorService } from './services/mce-prompt-assembler.service';
import { resolveFaceSelection } from './services/consultation-face-selection';
import {
  MemoryAttachmentRepository,
  PrivateFileAttachmentRepository,
  removeUnsentAttachment,
  resolveDialogueTurn,
  type AttachmentRow,
} from './services/consultation-attachment.service';
import {
  UPLOAD_GRACE_MS,
  attachmentExpired,
  dataUrlForJpeg,
  isDialogueTopicChange,
  orphanStorageKeys,
  requestFingerprint,
  selectImagesForTurn,
} from './services/consultation-dialogue';
import { assertOutfitCaptureSource, outfitCameraCaptureEnabled } from '../outfit-analysis/outfit-capture-policy';
import { ServiceUnavailableException } from '@nestjs/common';
import { MceContextSnapshotV1, MceAssistantPayloadV1 } from './contracts/mce-context-snapshot.v1';

const checks: string[] = [];
const evidence: Record<string, unknown> = {};

function record(name: string, ok: boolean, detail?: unknown) {
  if (!ok) {
    console.error('FAIL', name, detail);
    process.exitCode = 1;
  }
  checks.push(name);
  if (detail !== undefined) evidence[name] = detail;
}

function report(): FaceIntelligenceReportDto {
  return {
    analysisId: 'fx-rc4',
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
    executiveSummaryAr: 'ملخص عام للوجه المحفوظ.',
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
    ],
    metrics: [],
    recommendations: [],
    featureLayers: [],
    retakeGuidanceAr: 'أعيدي الالتقاط',
    retakeGuidanceEn: 'retake',
    metadata: { isMock: true, measurementEligible: true, schemaNote: 'test' },
  } as unknown as FaceIntelligenceReportDto;
}

function imageRow(id: string, at: string, bytes: Buffer): AttachmentRow {
  return {
    id,
    userId: 'user-a',
    sessionId: 'session-a',
    messageId: id === 'photo' ? null : `msg-${id}`,
    createdAt: new Date(at),
    mimeType: 'image/jpeg',
    byteSize: bytes.length,
    sha256: id,
    width: 10,
    height: 10,
    storageKey: `${id}.jpg`,
    status: 'ready',
    deletedAt: null,
    bytes,
  };
}

async function modelImages(message: string, pinnedIds: string[]) {
  const repo = new MemoryAttachmentRepository();
  const dress = imageRow('dress', '2026-10-01T00:00:00.000Z', Buffer.from('dress-bytes'));
  const bag = imageRow('bag', '2026-10-02T00:00:00.000Z', Buffer.from('bag-bytes'));
  await repo.insert(dress);
  await repo.insert(bag);
  const resolved = await resolveDialogueTurn({
    repo,
    userId: 'user-a',
    sessionId: 'session-a',
    message,
    attachmentIds: [],
    pinnedIds,
    model: 'gpt-4o-mini',
  });
  const moderation = new MceModerationService();
  const assembler = new McePromptAssemblerService(moderation);
  const snapshot = {
    schemaVersion: '1.0.0' as const,
    user: { locale: 'ar', isMinor: false, subscriptionPlan: 'free' },
    builtAt: '2026-10-17T00:00:00.000Z',
  } satisfies MceContextSnapshotV1;
  const messages = assembler.buildMessages({
    snapshot,
    factRegistry: [],
    history: [],
    userMessage: message,
    imageDataUrls: resolved.dataUrls,
    imageLabels: resolved.imageLabels,
  });
  const user = messages[messages.length - 1];
  const payload = JSON.stringify(user.content);
  return { resolved, payload };
}

async function images() {
  const dress = { id: 'dress', userId: 'user-a', sessionId: 'session-a', messageId: 'm1', createdAt: '2026-10-01T00:00:00.000Z', bytesReady: true, ordinal: 0 };
  const bag = { id: 'bag', userId: 'user-a', sessionId: 'session-a', messageId: 'm2', createdAt: '2026-10-02T00:00:00.000Z', bytesReady: true, ordinal: 1 };
  const first = selectImagesForTurn({ message: 'صفي الصورة الأولى', current: [], prior: [dress, bag] });
  const cases = ['هل يناسب الدوام؟', 'هل تناسب الدوام؟', 'وش خامته؟', 'وش المكونات المكتوبة؟'];
  const reached: Record<string, string[]> = {};
  for (const message of cases) {
    const selected = selectImagesForTurn({ message, current: [], prior: [dress, bag], pinnedIds: first.pinIds });
    const model = await modelImages(message, first.pinIds);
    reached[message] = model.resolved.imageIds;
    const dressUrl = dataUrlForJpeg(Buffer.from('dress-bytes'));
    const bagUrl = dataUrlForJpeg(Buffer.from('bag-bytes'));
    record(`follow-${message}`, selected.images.map((item) => item.id).join(',') === 'dress' && model.resolved.imageIds.join(',') === 'dress' && model.payload.includes(dressUrl) && !model.payload.includes(bagUrl) && !model.resolved.clarify, { selected: selected.images.map((item) => item.id), model: model.resolved.imageIds });
  }
  const general = await modelImages('ما روتين العناية بالبشرة؟', first.pinIds);
  record('topic-change-sends-no-image', general.resolved.imageIds.length === 0 && !general.payload.includes(dataUrlForJpeg(Buffer.from('dress-bytes'))) && isDialogueTopicChange('ما روتين العناية بالبشرة؟'), general.resolved.imageIds);
  const ambiguous = selectImagesForTurn({ message: 'وش خامته؟', current: [], prior: [dress, bag] });
  record('real-ambiguity-asks-clarification', ambiguous.clarify && ambiguous.images.length === 0, ambiguous);
  evidence.imagesReachingModel = reached;
}

function face() {
  const owned = report();
  const general = resolveFaceSelection({
    owned: true,
    report: owned,
    focus: { reportRef: 'fx-rc4', contextType: 'generalFaceResult', publicFactAr: 'نص العميلة ليس حقيقة' },
  });
  const joined = general.selection.statementsAr.join('\n');
  record(
    'general-face-includes-summary-limits-confidence',
    general.facts.length > 0
      && joined.includes('ملخص عام للوجه المحفوظ.')
      && joined.includes('قيد التحليل: إضاءة غير متساوية')
      && joined.includes('مستوى الثقة في التقرير: 80٪')
      && !joined.includes('نص العميلة ليس حقيقة')
      && general.facts.every((fact) => fact.confidence === 'high'),
    general.selection.statementsAr,
  );
  const region = resolveFaceSelection({
    owned: true,
    report: owned,
    focus: { reportRef: 'fx-rc4', contextType: 'selectedRegion', selectedRegion: 'jaw', selectedResultId: 'jaw-finding' },
  });
  const regionText = region.selection.statementsAr.join('\n');
  record(
    'region-selection-keeps-finding-and-limits',
    regionText.includes('ملاحظة الفك المحفوظة') && regionText.includes('قيد التحليل: إضاءة غير متساوية') && !regionText.includes('نص العميلة'),
    region.selection.statementsAr,
  );
  const moderation = new MceModerationService();
  const assembler = new McePromptAssemblerService(moderation);
  const snapshot = {
    schemaVersion: '1.0.0' as const,
    user: { locale: 'ar', isMinor: false, subscriptionPlan: 'free' },
    builtAt: '2026-10-17T00:00:00.000Z',
    faceSelection: region.selection,
  } satisfies MceContextSnapshotV1;
  const follow = assembler.buildMessages({
    snapshot,
    factRegistry: region.facts,
    history: [{ role: 'user', content: 'حدثيني عن الفك' }, { role: 'assistant', content: 'حاضر' }],
    userMessage: 'وضحي أكثر',
  }).map((item) => String(item.content)).join('\n');
  record('face-follow-up-keeps-selection', follow.includes('ملاحظة الفك المحفوظة') && follow.includes('قيد التحليل: إضاءة غير متساوية'), true);
  const stale = resolveFaceSelection({
    owned: true,
    report: owned,
    focus: { reportRef: 'fx-rc4', contextType: 'generalFaceResult', evidenceStale: true },
  });
  record('stale-report-is-not-replaced', stale.selection.status === 'stale' && stale.facts.length === 0 && Boolean(stale.selection.noticeAr), stale.selection.status);
  const missing = resolveFaceSelection({ owned: false, report: null, focus: { reportRef: 'missing', contextType: 'generalFaceResult' } });
  record('missing-report-stays-empty', missing.selection.status === 'unavailable' && missing.facts.length === 0, missing.selection.status);
}

class FlakyMemory extends MemoryAttachmentRepository {
  attempts = 0;
  protected override async removeFile(): Promise<boolean> {
    this.attempts += 1;
    return this.attempts > 1;
  }
}

async function deletion() {
  const repo = new FlakyMemory();
  const row = imageRow('photo', '2026-10-10T00:00:00.000Z', Buffer.from('photo'));
  await repo.insert(row);
  await removeUnsentAttachment(repo, 'user-a', 'photo').then(
    () => { throw new Error('delete should fail'); },
    () => undefined,
  );
  const hidden = await repo.find('photo');
  const meta = await repo.meta('photo');
  record('failed-delete-is-not-success-and-blocks-access', hidden === null && meta?.status === 'delete_pending' && repo.attempts === 1, meta?.status);
  await removeUnsentAttachment(repo, 'user-a', 'photo');
  const after = await repo.meta('photo');
  record('delete-retry-removes-file', after?.deletedAt instanceof Date && repo.attempts === 2 && (await repo.find('photo')) === null, { attempts: repo.attempts });

  const dir = mkdtempSync(join(tmpdir(), 'mira-rc4-'));
  let release: (value: unknown) => void = () => undefined;
  const gate = new Promise((resolve) => { release = resolve; });
  const hanging = {
    consultationAttachment: { create: () => gate },
  };
  const files = new PrivateFileAttachmentRepository(hanging as never, dir);
  const pending = files.insert(imageRow('inflight', '2026-10-17T00:00:00.000Z', Buffer.from('inflight')));
  await new Promise((resolve) => setTimeout(resolve, 30));
  const protectedKeys = files.inflightKeys();
  record(
    'inflight-upload-is-not-an-orphan',
    protectedKeys.includes('inflight.jpg') && orphanStorageKeys(['inflight.jpg'], [], protectedKeys).length === 0,
    protectedKeys,
  );
  release({});
  await pending;
  record('inflight-cleared-after-record', files.inflightKeys().length === 0, files.inflightKeys());
  const recent = ['fresh.jpg'];
  record(
    'grace-period-protects-unrecorded-file',
    orphanStorageKeys(['fresh.jpg', 'old.jpg'], [], recent).join(',') === 'old.jpg' && UPLOAD_GRACE_MS >= 60_000,
    UPLOAD_GRACE_MS,
  );
  record('expired-image-still-rejected', attachmentExpired(new Date('2020-01-01T00:00:00.000Z'), 30, new Date('2026-10-17T00:00:00.000Z')), true);
}

function camera() {
  record('outfit-camera-flag-defaults-off', outfitCameraCaptureEnabled({}) === false, false);
  record('gallery-analysis-still-allowed', (() => { assertOutfitCaptureSource('gallery', {}); assertOutfitCaptureSource(undefined, {}); return true; })(), true);
  let paused = false;
  try {
    assertOutfitCaptureSource('camera', {});
  } catch (error) {
    paused = error instanceof ServiceUnavailableException;
  }
  record('camera-start-is-refused', paused, paused);
  record('camera-start-can-be-enabled', outfitCameraCaptureEnabled({ OUTFIT_CAMERA_CAPTURE_ENABLED: 'true' }) === true, true);
}

const answer: MceAssistantPayloadV1 = {
  answerAr: 'جواب واحد محفوظ.',
  confidence: 'medium',
  intent: 'general',
  citedFactIds: [],
  suggestedQuestionsAr: [],
  blocked: false,
  disclaimerAr: '',
};

function fakeRes() {
  const events: string[] = [];
  return {
    events,
    writableEnded: false,
    setHeader() { return undefined; },
    flushHeaders() { return undefined; },
    write(chunk: string) { events.push(chunk); return true; },
    end() { this.writableEnded = true; },
    on() { return this; },
  };
}

async function turns() {
  const url = `postgresql://${process.env.USER || 'localhost'}@localhost:5432/mira_dialogue_dev`;
  if (url.includes('/mira_db')) throw new Error('refused operating database');
  try {
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'pipe',
    });
  } catch (error) {
    record('turn-lease', false, 'migrate failed');
    return;
  }
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const stamp = Date.now().toString(36);
  const user = await prisma.user.create({ data: { firebaseUid: `rc4-${stamp}`, email: `rc4-${stamp}@test.local` } });
  const session = await prisma.consultationSession.create({ data: { userId: user.id, metadataJson: {} } });
  const calls = { n: 0 };
  let releaseSend: () => void = () => undefined;
  let releaseStream: () => void = () => undefined;
  const sendGate = new Promise<void>((resolve) => { releaseSend = resolve; });
  const streamGate = new Promise<void>((resolve) => { releaseStream = resolve; });
  const messages = new ConsultationMessageService(prisma as never);
  const moderation = new MceModerationService();
  const orchestrator = new ConsultationOrchestratorService(
    { get: (_key: string, fallback?: unknown) => fallback ?? 'true' } as never,
    { findOrCreateFromFirebase: async () => user, getPreferences: async () => null, writeAuditLog: async () => undefined } as never,
    prisma as never,
    { assertWithinLimit: async () => undefined } as never,
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
    {
      isConfigured: () => true,
      configuredModel: () => 'gpt-4o-mini',
      complete: async () => { calls.n += 1; await sendGate; return { payload: answer, modelId: 'test' }; },
      stream: () => ({
        async *[Symbol.asyncIterator]() {
          calls.n += 1;
          await streamGate;
          yield JSON.stringify(answer);
        },
      }),
    } as never,
  );
  const auth = { firebaseUid: user.firebaseUid, email: user.email ?? undefined, name: 'اختبار' };
  const old = new Date(Date.now() - 10 * 60 * 1000);
  await prisma.consultationMessage.create({
    data: {
      sessionId: session.id,
      role: 'user',
      contentAr: 'سؤال قديم',
      clientMessageId: 'old-send',
      requestHash: requestFingerprint('سؤال قديم', []),
      turnStatus: 'pending',
      createdAt: old,
    },
  });
  await prisma.consultationMessage.create({
    data: {
      sessionId: session.id,
      role: 'user',
      contentAr: 'سؤال البث',
      clientMessageId: 'old-stream',
      requestHash: requestFingerprint('سؤال البث', []),
      turnStatus: 'pending',
      createdAt: old,
    },
  });

  const first = orchestrator.sendMessage(auth, session.id, { message: 'سؤال قديم', clientMessageId: 'old-send' } as never);
  await new Promise((resolve) => setTimeout(resolve, 80));
  const during = await prisma.consultationMessage.findFirst({ where: { clientMessageId: 'old-send' } });
  const callsAtResume = calls.n;
  const second = await orchestrator.sendMessage(auth, session.id, { message: 'سؤال قديم', clientMessageId: 'old-send' } as never).then(
    () => 'saved',
    (error: unknown) => {
      const body = typeof (error as { getResponse?: () => unknown }).getResponse === 'function'
        ? (error as { getResponse: () => { code?: string } }).getResponse()
        : null;
      return body?.code ?? 'error';
    },
  );
  record(
    'resumed-send-is-not-stuck-by-createdAt',
    callsAtResume === 1
      && second === 'MCE_TURN_IN_PROGRESS'
      && during?.turnStatus === 'pending'
      && during.createdAt.getTime() === old.getTime()
      && (during.attemptExpiresAt?.getTime() ?? 0) > Date.now(),
    { callsAtResume, second, status: during?.turnStatus },
  );
  releaseSend();
  await first;
  const beforeReplay = calls.n;
  await orchestrator.sendMessage(auth, session.id, { message: 'سؤال قديم', clientMessageId: 'old-send' } as never);
  const sendRows = await prisma.consultationMessage.findMany({ where: { sessionId: session.id, contentAr: { contains: 'سؤال قديم' } } });
  const sendAssistants = await prisma.consultationMessage.count({ where: { sessionId: session.id, role: 'assistant', replyToMessageId: during?.id } });
  record(
    'saved-send-is-not-regenerated',
    calls.n === beforeReplay && sendAssistants === 1 && sendRows.filter((row) => row.role === 'user').length === 1,
    { modelCalls: calls.n, users: sendRows.filter((row) => row.role === 'user').length, assistants: sendAssistants },
  );

  const stream = orchestrator.sendMessageStream(auth, session.id, { message: 'سؤال البث', clientMessageId: 'old-stream' } as never, fakeRes() as never);
  await new Promise((resolve) => setTimeout(resolve, 80));
  const streamCalls = calls.n;
  const streamRetry = await orchestrator.sendMessageStream(auth, session.id, { message: 'سؤال البث', clientMessageId: 'old-stream' } as never, fakeRes() as never).then(
    () => 'saved',
    (error: unknown) => {
      const body = typeof (error as { getResponse?: () => unknown }).getResponse === 'function'
        ? (error as { getResponse: () => { code?: string } }).getResponse()
        : null;
      return body?.code ?? 'error';
    },
  );
  record('resumed-stream-is-not-stuck-by-createdAt', streamCalls === beforeReplay + 1 && streamRetry === 'MCE_TURN_IN_PROGRESS', { streamCalls, streamRetry });
  releaseStream();
  await stream;
  const streamBeforeReplay = calls.n;
  const replayRes = fakeRes();
  await orchestrator.sendMessageStream(auth, session.id, { message: 'سؤال البث', clientMessageId: 'old-stream' } as never, replayRes as never);
  const assistants = await prisma.consultationMessage.count({ where: { sessionId: session.id, role: 'assistant' } });
  record(
    'saved-stream-is-not-regenerated',
    calls.n === streamBeforeReplay && assistants === 2 && replayRes.events.some((event) => event.includes('event: done')),
    { modelCalls: calls.n, assistants, processingAttempts: calls.n },
  );
  evidence.turnCounts = { modelCalls: calls.n, assistants, userMessages: 2 };

  await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
}

async function main() {
  await images();
  face();
  await deletion();
  camera();
  await turns();
  const out = join(process.cwd(), 'audit-out');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'consultation-dialogue-rc4.json'), JSON.stringify({
    round: 'CONSULT_DIALOGUE_RC4',
    ranAt: new Date().toISOString(),
    status: process.exitCode ? 'FAIL' : 'PASS',
    checks,
    evidence,
    liveModel: 'NOT_RUN',
    liveModelReason: 'Checked after the schema run. Stub calls are not answer quality.',
  }, null, 2));
  if (process.exitCode) process.exit(process.exitCode);
  console.log('CONSULT_DIALOGUE_RC4_PASS', checks.length);
}

main().catch((error) => {
  const message = (error instanceof Error ? error.message : 'failed').replace(/postgres(?:ql)?:\/\/\S+/g, '[url]');
  console.error(message);
  process.exit(1);
});
