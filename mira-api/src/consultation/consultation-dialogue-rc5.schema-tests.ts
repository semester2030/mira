import 'reflect-metadata';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { ConflictException } from '@nestjs/common';
import { ConsultationMessageService } from './services/consultation-message.service';
import { MemoryAttachmentRepository, resolveDialogueTurn, type AttachmentRow } from './services/consultation-attachment.service';
import { dataUrlForJpeg, selectImagesForTurn } from './services/consultation-dialogue';
import { MceModerationService } from './services/mce-moderation.service';
import { McePromptAssemblerService } from './services/mce-prompt-assembler.service';
import { MceContextSnapshotV1, MceAssistantPayloadV1 } from './contracts/mce-context-snapshot.v1';
import { ConsultationOrchestratorService } from './services/consultation-orchestrator.service';
import { MceIntentClassifierService } from './services/mce-intent-classifier.service';
import { MceResponseValidatorService } from './services/mce-prompt-assembler.service';
import { requestFingerprint } from './services/consultation-dialogue';

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

function row(id: string, bytes: Buffer): AttachmentRow {
  return {
    id, userId: 'user-a', sessionId: 'session-a', messageId: `msg-${id}`, createdAt: new Date('2026-10-01T00:00:00.000Z'),
    mimeType: 'image/jpeg', byteSize: bytes.length, sha256: id, width: 8, height: 8, storageKey: `${id}.jpg`,
    status: 'ready', deletedAt: null, bytes,
  };
}

async function payloadFor(message: string, pinnedIds: string[], history: Array<{ role: string; content: string }>) {
  const repo = new MemoryAttachmentRepository();
  await repo.insert(row('cream', Buffer.from('cream-bytes')));
  await repo.insert(row('other', Buffer.from('other-bytes')));
  const resolved = await resolveDialogueTurn({
    repo, userId: 'user-a', sessionId: 'session-a', message, attachmentIds: [], pinnedIds, history, model: 'gpt-4o-mini',
  });
  const moderation = new MceModerationService();
  const messages = new McePromptAssemblerService(moderation).buildMessages({
    snapshot: { schemaVersion: '1.0.0', user: { locale: 'ar', isMinor: false, subscriptionPlan: 'free' }, builtAt: '2026-10-17T00:00:00.000Z' } satisfies MceContextSnapshotV1,
    factRegistry: [], history: [], userMessage: message, imageDataUrls: resolved.dataUrls, imageLabels: resolved.imageLabels,
  });
  return { ids: resolved.imageIds, pinIds: resolved.pinIds, text: JSON.stringify(messages[messages.length - 1].content) };
}

async function images() {
  const cream = { id: 'cream', userId: 'user-a', sessionId: 'session-a', messageId: 'm1', createdAt: '2026-10-01T00:00:00.000Z', bytesReady: true, ordinal: 0 };
  const other = { id: 'other', userId: 'user-a', sessionId: 'session-a', messageId: 'm2', createdAt: '2026-10-02T00:00:00.000Z', bytesReady: true, ordinal: 1 };
  const pinned = selectImagesForTurn({ message: 'انظري هذه الصورة', current: [cream], prior: [] }).pinIds;
  const acne = await payloadFor('هل يسبب حبوب؟', pinned, []);
  const use = await payloadFor('كيف أستخدمه للترطيب؟', pinned, [{ role: 'user', content: 'هل يسبب حبوب؟' }]);
  const creamUrl = dataUrlForJpeg(Buffer.from('cream-bytes'));
  const otherUrl = dataUrlForJpeg(Buffer.from('other-bytes'));
  record('cream-acne-reaches-model', acne.ids.join(',') === 'cream' && acne.text.includes(creamUrl) && !acne.text.includes(otherUrl), acne.ids);
  record('cream-use-reaches-model', use.ids.join(',') === 'cream' && use.text.includes(creamUrl) && !use.text.includes(otherUrl), use.ids);
  const leave = selectImagesForTurn({
    message: 'سؤال عام عن العناية بدون الصورة',
    current: [], prior: [cream, other], pinnedIds: pinned,
    history: [{ role: 'user', content: 'كيف أستخدمه للترطيب؟' }],
  });
  const more = await payloadFor('وضحي أكثر', leave.pinIds, [
    { role: 'user', content: 'كيف أستخدمه للترطيب؟' },
    { role: 'assistant', content: 'يوضع على بشرة نظيفة.' },
    { role: 'user', content: 'سؤال عام عن العناية بدون الصورة' },
  ]);
  record('general-follow-up-does-not-recall-image', leave.pinIds.length === 0 && more.ids.length === 0 && !more.text.includes(creamUrl), { leave: leave.pinIds, more: more.ids });
  const compared = selectImagesForTurn({ message: 'قارني الأولى بالثانية', current: [], prior: [cream, other], pinnedIds: [] });
  record('ordinal-compare-still-selects-both', compared.images.map((item) => item.id).join(',') === 'cream,other', compared.images.map((item) => item.id));
  const ambiguous = selectImagesForTurn({ message: 'هل يسبب حبوب؟', current: [], prior: [cream, other] });
  record('two-images-without-pin-ask-clarification', ambiguous.clarify && ambiguous.images.length === 0, ambiguous);
}

const answer: MceAssistantPayloadV1 = {
  answerAr: 'جواب واحد.', confidence: 'medium', intent: 'general', citedFactIds: [], suggestedQuestionsAr: [], blocked: false, disclaimerAr: '',
};

function fakeRes() {
  const events: string[] = [];
  return { events, writableEnded: false, setHeader() {}, flushHeaders() {}, write(chunk: string) { events.push(chunk); return true; }, end() { this.writableEnded = true; }, on() { return this; } };
}

async function turns() {
  const url = `postgresql://${process.env.USER || 'localhost'}@localhost:5432/mira_dialogue_dev`;
  if (url.includes('/mira_db')) throw new Error('refused operating database');
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const stamp = Date.now().toString(36);
  const user = await prisma.user.create({ data: { firebaseUid: `rc5-${stamp}`, email: `rc5-${stamp}@test.local` } });
  const session = await prisma.consultationSession.create({ data: { userId: user.id, metadataJson: {} } });
  const messages = new ConsultationMessageService(prisma as never);
  const past = new Date(Date.now() - 10 * 60 * 1000);
  const seeded = await prisma.consultationMessage.create({
    data: { sessionId: session.id, role: 'user', contentAr: 'طلب عالق', clientMessageId: 'stuck-race', requestHash: 'race', turnStatus: 'pending', attemptToken: 'stale-token', attemptExpiresAt: past, createdAt: past },
  });
  const snapshot = { id: seeded.id, attemptToken: seeded.attemptToken, attemptExpiresAt: seeded.attemptExpiresAt };
  let ready = 0;
  const race = await Promise.all([0, 1].map(async () => {
    ready += 1;
    while (ready < 2) await new Promise((resolve) => setTimeout(resolve, 5));
    return messages.commitStuckRecovery(snapshot);
  }));
  const afterRace = await prisma.consultationMessage.findUnique({ where: { id: seeded.id } });
  record('concurrent-recovery-commits-once', race.filter((item) => item === 'recovered').length === 1 && race.filter((item) => item === 'skipped').length === 1 && afterRace?.turnStatus === 'failed', { race, status: afterRace?.turnStatus });

  await prisma.consultationMessage.update({ where: { id: seeded.id }, data: { turnStatus: 'pending', attemptToken: 'new-token', attemptExpiresAt: new Date(Date.now() + 120000) } });
  const skipped = await messages.commitStuckRecovery(snapshot);
  const owned = await messages.markOwned(seeded.id, 'stale-token', 'failed');
  let persisted = false;
  try {
    await messages.persistAssistant(session.id, 'قديم', answer, { latencyMs: 1, blocked: false, replyToMessageId: seeded.id, attemptToken: 'stale-token' });
    persisted = true;
  } catch (error) {
    persisted = !(error instanceof ConflictException);
  }
  const kept = await prisma.consultationMessage.findUnique({ where: { id: seeded.id } });
  const assistants = await prisma.consultationMessage.count({ where: { replyToMessageId: seeded.id, role: 'assistant' } });
  record('old-attempt-cannot-change-new-lease', skipped === 'skipped' && owned === false && persisted === false && kept?.attemptToken === 'new-token' && kept.turnStatus === 'pending' && assistants === 0, { skipped, owned, token: kept?.attemptToken, assistants });

  const calls = { n: 0 };
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const moderation = new MceModerationService();
  const orchestrator = new ConsultationOrchestratorService(
    { get: (_key: string, fallback?: unknown) => fallback ?? 'true' } as never,
    { findOrCreateFromFirebase: async () => user, getPreferences: async () => null, writeAuditLog: async () => undefined } as never,
    prisma as never,
    { assertWithinLimit: async () => undefined } as never,
    { assertDailyQuota: async () => undefined, answerCacheKey: () => null, getFaqCache: async () => null, setFaqCache: async () => undefined } as never,
    { shouldCompact: () => false, compact: async () => null } as never,
    { getForUser: async () => session, toDto: () => ({ id: session.id, titleAr: 'اختبار', status: 'active', activeSnapshotId: null, contextSummary: {}, turnCount: 0, suggestedStartersAr: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }) } as never,
    messages, { loadForSession: async () => ({ id: 'snap', snapshot: { schemaVersion: '1.0.0', user: { locale: 'ar', isMinor: false, subscriptionPlan: 'free' }, builtAt: new Date().toISOString() }, factRegistry: [] }) } as never,
    {} as never, new MceIntentClassifierService(), moderation, new McePromptAssemblerService(moderation), new MceResponseValidatorService(moderation),
    { isConfigured: () => true, configuredModel: () => 'gpt-4o-mini', complete: async () => { calls.n += 1; await gate; return { payload: answer, modelId: 'stub' }; }, stream: () => ({ async *[Symbol.asyncIterator]() { calls.n += 1; await gate; yield JSON.stringify(answer); } }) } as never,
  );
  const auth = { firebaseUid: user.firebaseUid, email: user.email ?? undefined, name: 'اختبار' };
  await prisma.consultationMessage.update({ where: { id: seeded.id }, data: { turnStatus: 'pending', attemptToken: 'expired-send', attemptExpiresAt: past, contentAr: 'إرسال', clientMessageId: 'send-race', requestHash: requestFingerprint('إرسال', []) } });
  const sendSnapshot = { id: seeded.id, attemptToken: 'expired-send', attemptExpiresAt: past };
  const firstSend = orchestrator.sendMessage(auth, session.id, { message: 'إرسال', clientMessageId: 'send-race' } as never);
  await new Promise((resolve) => setTimeout(resolve, 100));
  const staleSend = await messages.commitStuckRecovery(sendSnapshot);
  const secondSend = await orchestrator.sendMessage(auth, session.id, { message: 'إرسال', clientMessageId: 'send-race' } as never).then(() => 'saved', (error: unknown) => (error as { getResponse?: () => { code?: string } }).getResponse?.().code ?? 'error');
  record('send-stale-recovery-does-not-cancel-new-lease', calls.n === 1 && staleSend === 'skipped' && secondSend === 'MCE_TURN_IN_PROGRESS', { calls: calls.n, staleSend, secondSend });
  release();
  await firstSend;
  const sendCalls = calls.n;
  await orchestrator.sendMessage(auth, session.id, { message: 'إرسال', clientMessageId: 'send-race' } as never);
  const sendAssistants = await prisma.consultationMessage.count({ where: { sessionId: session.id, role: 'assistant' } });
  record('send-replay-returns-saved-answer', calls.n === sendCalls && sendAssistants === 1, { calls: calls.n, sendAssistants });

  let releaseStream: () => void = () => undefined;
  const streamGate = new Promise<void>((resolve) => { releaseStream = resolve; });
  (orchestrator as unknown as { llm: { stream: () => AsyncIterable<string> } }).llm.stream = () => ({ async *[Symbol.asyncIterator]() { calls.n += 1; await streamGate; yield JSON.stringify(answer); } });
  await prisma.consultationMessage.create({ data: { sessionId: session.id, role: 'user', contentAr: 'بث', clientMessageId: 'stream-race', requestHash: requestFingerprint('بث', []), turnStatus: 'pending', attemptToken: 'expired-stream', attemptExpiresAt: past, createdAt: past } });
  const streamRow = await prisma.consultationMessage.findFirst({ where: { clientMessageId: 'stream-race' } });
  const streamSnapshot = { id: streamRow!.id, attemptToken: 'expired-stream', attemptExpiresAt: past };
  const firstStream = orchestrator.sendMessageStream(auth, session.id, { message: 'بث', clientMessageId: 'stream-race' } as never, fakeRes() as never);
  await new Promise((resolve) => setTimeout(resolve, 100));
  const staleStream = await messages.commitStuckRecovery(streamSnapshot);
  const beforeRetry = calls.n;
  const secondStream = await orchestrator.sendMessageStream(auth, session.id, { message: 'بث', clientMessageId: 'stream-race' } as never, fakeRes() as never).then(() => 'saved', (error: unknown) => (error as { getResponse?: () => { code?: string } }).getResponse?.().code ?? 'error');
  record('stream-stale-recovery-does-not-cancel-new-lease', beforeRetry === sendCalls + 1 && staleStream === 'skipped' && secondStream === 'MCE_TURN_IN_PROGRESS', { beforeRetry, staleStream, secondStream });
  releaseStream();
  await firstStream;
  const streamCalls = calls.n;
  const replay = fakeRes();
  await orchestrator.sendMessageStream(auth, session.id, { message: 'بث', clientMessageId: 'stream-race' } as never, replay as never);
  const allAssistants = await prisma.consultationMessage.count({ where: { sessionId: session.id, role: 'assistant' } });
  record('stream-replay-returns-saved-answer', calls.n === streamCalls && allAssistants === 2 && replay.events.some((event) => event.includes('event: done')), { calls: calls.n, allAssistants });
  evidence.counts = { modelCalls: calls.n, assistants: allAssistants, userMessages: 2 };

  await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
}

async function main() {
  await images();
  await turns();
  const out = join(process.cwd(), 'audit-out');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'consultation-dialogue-rc5.json'), JSON.stringify({
    round: 'CONSULT_DIALOGUE_RC5', ranAt: new Date().toISOString(), status: process.exitCode ? 'FAIL' : 'PASS', checks, evidence,
    liveModel: 'NOT_RUN', liveModelReason: 'Local schema run uses a stub. Live OpenAI is a separate step.',
  }, null, 2));
  if (process.exitCode) process.exit(process.exitCode);
  console.log('CONSULT_DIALOGUE_RC5_PASS', checks.length);
}

main().catch((error) => {
  console.error((error instanceof Error ? error.message : 'failed').replace(/postgres(?:ql)?:\/\/\S+/g, '[url]'));
  process.exit(1);
});
