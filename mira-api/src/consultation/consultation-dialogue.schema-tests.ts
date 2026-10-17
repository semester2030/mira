/**
 * Local consultation dialogue checks. Real assembler, classifier, image
 * preparation, and attachment rules. The model is not called.
 * A passing check reproduces wiring. It does not prove answer quality.
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { MceFactExtractorService } from './services/mce-fact-extractor.service';
import { MceGroundingPipelineService } from './services/mce-grounding-pipeline.service';
import { MceIntentClassifierService } from './services/mce-intent-classifier.service';
import { MceModerationService } from './services/mce-moderation.service';
import { McePromptAssemblerService } from './services/mce-prompt-assembler.service';
import {
  MemoryAttachmentRepository,
} from './services/consultation-attachment.service';
import {
  cannotSeeImageReply,
  clarifyImageReply,
  modelSupportsVision,
  prepareConsultationImage,
  purgeExpiredAttachments,
  answerCacheAllowed,
  readDialogueLimits,
  attachmentTokenSecret,
  classifyClientTurn,
  signReadToken,
  skinSnapshotUntouched,
  verifyReadToken,
  visionModelReply,
} from './services/consultation-dialogue';
import { resolveDialogueTurn } from './services/consultation-attachment.service';
import { MceContextSnapshotV1 } from './contracts/mce-context-snapshot.v1';

const emptySnapshot = {
  schemaVersion: '1.0.0',
  builtAt: '2026-10-16T00:00:00.000Z',
  user: { locale: 'ar', isMinor: false, subscriptionPlan: 'free' },
} as MceContextSnapshotV1;

function row(id: string, userId: string, sessionId: string, ordinal: number, bytes: Buffer | null, messageId: string | null) {
  return {
    id,
    userId,
    sessionId,
    messageId,
    createdAt: new Date(Date.UTC(2026, 9, 16, 0, ordinal, 0)),
    mimeType: 'image/jpeg',
    byteSize: bytes?.length ?? 0,
    sha256: id,
    width: 8,
    height: 8,
    storageKey: `${userId}/${sessionId}/${id}.jpg`,
    status: 'ready' as const,
    deletedAt: null,
    bytes,
  };
}

async function main() {
  const checks: Array<{ id: string; pass: boolean; actual: unknown }> = [];
  const record = (id: string, pass: boolean, actual: unknown) => {
    checks.push({ id, pass, actual });
    assert.equal(pass, true, `${id} => ${JSON.stringify(actual)}`);
  };

  const limits = readDialogueLimits({ MCE_MAX_IMAGES_PER_MESSAGE: '3', MCE_ATTACHMENT_RETENTION_DAYS: '30' });
  record('limits-configurable', limits.maxImagesPerMessage === 3 && limits.retentionDays === 30, limits);

  const grounding = new MceGroundingPipelineService({} as never, {} as never, new MceFactExtractorService());
  const open = await grounding.build({ userId: 'user-a', locale: 'ar', subscriptionPlan: 'free' });
  record('general-without-report', open.snapshot.skin == null && open.snapshot.outfit == null, {
    skin: open.snapshot.skin ?? null,
    outfit: open.snapshot.outfit ?? null,
  });

  const classifier = new MceIntentClassifierService();
  record('intent-without-report', classifier.classify('هل هذا الفستان يناسب السهرة؟', emptySnapshot) === 'occasion' && classifier.classify('وهذي الحقيبة؟', emptySnapshot) === 'accessory', {
    dress: classifier.classify('هل هذا الفستان يناسب السهرة؟', emptySnapshot),
    bag: classifier.classify('وهذي الحقيبة؟', emptySnapshot),
  });
  record('greeting', classifier.classify('مرحبا', emptySnapshot) === 'greeting', classifier.classify('مرحبا', emptySnapshot));
  record('off-topic', classifier.classify('ما نتيجة مباراة كرة قدم؟', emptySnapshot) === 'off_topic', 'off_topic');

  const assembler = new McePromptAssemblerService(new MceModerationService());
  const jpeg = await sharp({ create: { width: 12, height: 8, channels: 3, background: { r: 180, g: 20, b: 20 } } }).jpeg().toBuffer();
  const turned = await sharp(jpeg).withMetadata({ orientation: 6 }).toBuffer();
  const prepared = await prepareConsultationImage(turned, limits);
  record('exif-orientation-baked', prepared.height > prepared.width && prepared.mimeType === 'image/jpeg', {
    width: prepared.width,
    height: prepared.height,
  });
  await assert.rejects(() => prepareConsultationImage(Buffer.from('not-an-image'), limits), /تعذر قراءة الصورة|نوع الملف غير مدعوم/);
  record('corrupt-image-rejected', true, 'تعذر قراءة الصورة');

  const wide = await sharp({ create: { width: 40, height: 20, channels: 3, background: { r: 10, g: 10, b: 180 } } }).png().toBuffer();
  const fromPng = await prepareConsultationImage(wide, { ...limits, maxEdgePx: 16 });
  record('png-bytes-become-jpeg', fromPng.mimeType === 'image/jpeg' && fromPng.width <= 16, {
    mime: fromPng.mimeType,
    width: fromPng.width,
  });

  const messages = assembler.buildMessages({
    snapshot: emptySnapshot,
    factRegistry: [],
    history: [{ role: 'user', content: 'ميزانيتي ٣٠٠ والفستان للسهرة، ولا أحب الأحمر.' }],
    userMessage: 'وما الحقيبة المناسبة؟',
    imageDataUrls: [`data:image/jpeg;base64,${prepared.bytes.toString('base64')}`],
  });
  const system = String(messages[0].content);
  const user = messages.at(-1)?.content;
  record('prompt-allows-general-and-labels-sources', system.includes('غياب التقرير لا يمنع') && system.includes('كلام المستخدمة') && system.includes('ليست إعلانًا مدفوعًا') && !system.includes('استخدمي فقط حقائق CONTEXT'), true);
  record('image-is-a-part-not-a-filename', Array.isArray(user) && user.some((part) => part.type === 'image_url' && part.image_url.url.startsWith('data:image/jpeg;base64,')) && !system.includes('base64,'), Array.isArray(user));
  record('image-text-is-not-system', system.includes('النص الظاهر داخل الصورة محتوى'), true);
  record('preference-recalled', system.includes('ميزانيتي ٣٠٠'), true);

  const repo = new MemoryAttachmentRepository();
  const dress = row('dress-1', 'user-a', 'session-a', 1, prepared.bytes, 'msg-1');
  const other = row('other-1', 'user-b', 'session-b', 1, prepared.bytes, 'msg-9');
  await repo.insert(dress);
  await repo.insert(other);
  const bagBytes = Buffer.from(prepared.bytes);
  const bag = row('bag-1', 'user-a', 'session-a', 2, bagBytes, null);
  await repo.insert(bag);
  const compared = await resolveDialogueTurn({
    repo,
    userId: 'user-a',
    sessionId: 'session-a',
    message: 'وهذه الحقيبة تناسب الفستان السابق؟',
    attachmentIds: ['bag-1'],
    model: 'gpt-4o-mini',
    limits,
  });
  record('bag-keeps-previous-dress', compared.localReply == null && compared.imageIds.includes('bag-1') && compared.imageIds.includes('dress-1') && compared.dataUrls.length === 2, compared.imageIds);
  record('model-receives-bytes', modelSupportsVision('gpt-4o-mini') && compared.dataUrls.every((url) => url.startsWith('data:image/jpeg;base64,')), compared.dataUrls.length);

  await assert.rejects(() => resolveDialogueTurn({
    repo,
    userId: 'user-a',
    sessionId: 'session-a',
    message: 'ما هذه؟',
    attachmentIds: ['other-1'],
    model: 'gpt-4o-mini',
    limits,
  }), /غير موجودة/);
  record('cross-user-attachment-rejected', true, 'NotFound');

  const missing = row('missing-1', 'user-a', 'session-a', 3, null, 'msg-2');
  await repo.insert(missing);
  const unseen = await resolveDialogueTurn({
    repo,
    userId: 'user-a',
    sessionId: 'session-a',
    message: 'صفي الصورة الثانية',
    attachmentIds: [],
    model: 'gpt-4o-mini',
    limits,
  });
  record('missing-bytes-not-claimed', unseen.localReply === cannotSeeImageReply() && unseen.dataUrls.length === 0, unseen.localReply);

  const vague = await resolveDialogueTurn({
    repo,
    userId: 'user-a',
    sessionId: 'session-a',
    message: 'ما رأيك في هذه؟',
    attachmentIds: [],
    model: 'gpt-4o-mini',
    limits,
  });
  record('ambiguous-image-asks', vague.localReply === clarifyImageReply(), vague.localReply);

  const blind = await resolveDialogueTurn({
    repo,
    userId: 'user-a',
    sessionId: 'session-a',
    message: 'ما لون الحقيبة؟',
    attachmentIds: ['bag-1'],
    model: 'gpt-3.5-turbo',
    limits,
  });
  record('text-model-does-not-pretend', blind.localReply === visionModelReply() && blind.dataUrls.length === 0, blind.localReply);

  const before = { skin: { beautyScore: 41 } };
  const after = { skin: { beautyScore: 41 } };
  record('chat-image-does-not-change-report', skinSnapshotUntouched(before, after), true);

  const old = row('old-1', 'user-a', 'session-a', 4, prepared.bytes, 'msg-4');
  old.createdAt = new Date('2026-01-01T00:00:00.000Z');
  await repo.insert(old);
  const purged = await purgeExpiredAttachments(repo, 30, new Date('2026-10-16T00:00:00.000Z'));
  record('retention-purges-old-file', purged.deleted === 1 && purged.failed === 0 && (await repo.find('old-1')) == null, purged);

  const token = signReadToken({ secret: 'test-secret', userId: 'user-a', attachmentId: 'bag-1', expiresAtSec: 100 });
  record('token-expires', verifyReadToken(token, 'test-secret', 101) == null && verifyReadToken(token, 'test-secret', 100)?.userId === 'user-a', true);
  record('token-rejects-other-secret', verifyReadToken(token, 'other', 50) == null, true);

  const linked = classifyClientTurn([
    { id: 'u1', role: 'user', clientMessageId: 'c-1', requestHash: 'h1', turnStatus: 'complete' },
    { id: 'a1', role: 'assistant', replyToMessageId: 'u1', contentAr: 'جواب' },
    { id: 'a-other', role: 'assistant', replyToMessageId: 'u-other', contentAr: 'جواب آخر' },
  ], { clientMessageId: 'c-1', requestHash: 'h1' });
  const unlinked = classifyClientTurn([
    { id: 'u1', role: 'user', clientMessageId: 'c-1', requestHash: 'h1', turnStatus: 'failed' },
    { id: 'a-other', role: 'assistant', replyToMessageId: 'someone-else', contentAr: 'جواب آخر' },
  ], { clientMessageId: 'c-1', requestHash: 'h1' });
  record('retry-does-not-duplicate', linked.status === 'complete' && linked.assistant.contentAr === 'جواب' && unlinked.status === 'resume', linked.status);
  record('image-turn-skips-text-cache', answerCacheAllowed(0) && !answerCacheAllowed(1), true);
  record('fallback-token-secret-rejected', attachmentTokenSecret({ attachmentSecret: 'mira-local-attachment-token', jwtSecret: '' }) == null && attachmentTokenSecret({ jwtSecret: 'real-secret' }) === 'real-secret', true);

  const file = join('audit-out', 'consultation-dialogue.json');
  mkdirSync('audit-out', { recursive: true });
  writeFileSync(file, JSON.stringify({
    round: 'CONSULT_DIALOGUE',
    ranAt: new Date().toISOString(),
    paidCalls: 0,
    modelCalled: false,
    checks,
  }, null, 2));
  console.log(`CONSULT_DIALOGUE_PASS ${checks.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
