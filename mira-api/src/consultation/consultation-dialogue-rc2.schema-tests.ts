/**
 * Completion checks for the text-and-image consultation.
 * These exercise the real selection, guard, and turn-identity functions.
 * A pass is not a live model grade.
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { evaluateMceFashionQuarantine } from '../fashion-knowledge/advisor-integration/mce-bypass';
import { MemoryAttachmentRepository, resolveDialogueTurn } from './services/consultation-attachment.service';
import {
  attachmentTokenSecret,
  classifyClientTurn,
  consultationQuarantineApplies,
  dialogueMemoryLines,
  selectImagesForTurn,
} from './services/consultation-dialogue';
import { isBudgetPreference, isDirectCommercialQuestion, retainTrustedSkinNumbers } from './services/mce-commercial-guard';
import { MceContextSnapshotV1 } from './contracts/mce-context-snapshot.v1';

void (0 as unknown as MceContextSnapshotV1);

function image(id: string, createdAt: string, ordinal: number) {
  return {
    id,
    userId: 'user-a',
    sessionId: 'session-a',
    messageId: `msg-${id}`,
    createdAt,
    bytesReady: true,
    ordinal,
  };
}

async function main() {
  const checks: Array<{ id: string; status: 'PASS' | 'FAIL'; actual?: unknown }> = [];
  const record = (id: string, pass: boolean, actual?: unknown) => {
    checks.push({ id, status: pass ? 'PASS' : 'FAIL', actual });
    assert.equal(pass, true, `${id} => ${JSON.stringify(actual)}`);
  };

  const dress = image('dress', '2026-10-16T00:00:01.000Z', 1);
  const color = selectImagesForTurn({ message: 'وش لونه؟', current: [], prior: [dress] });
  record('follow-up-color-keeps-only-image', color.clarify === false && color.images[0]?.id === 'dress', color.images);

  const office = selectImagesForTurn({ message: 'هل يناسب الدوام؟', current: [], prior: [dress] });
  record('follow-up-occasion-keeps-only-image', office.images[0]?.id === 'dress', office.images);

  const opinion = selectImagesForTurn({ message: 'ما رأيك في هذه؟', current: [], prior: [dress] });
  record('single-image-this-is-clear', opinion.clarify === false && opinion.images[0]?.id === 'dress', opinion);

  const bag = image('bag', '2026-10-16T00:00:02.000Z', 2);
  const many = [dress, bag, image('c', '2026-10-16T00:00:03.000Z', 3), image('d', '2026-10-16T00:00:04.000Z', 4), image('e', '2026-10-16T00:00:05.000Z', 5), image('f', '2026-10-16T00:00:06.000Z', 6), image('g', '2026-10-16T00:00:07.000Z', 7), image('h', '2026-10-16T00:00:08.000Z', 8)];
  const latest = selectImagesForTurn({ message: 'وش لونه؟', current: [], prior: many });
  record('follow-up-uses-newest-not-oldest', latest.images.length === 1 && latest.images[0]?.id === 'h', latest.images);
  const compared = selectImagesForTurn({ message: 'قارني الأولى بالثانية', current: [], prior: many });
  record('ordinal-compare-is-stable', compared.images.map((item) => item.id).join(',') === 'dress,bag', compared.images.map((item) => item.id));
  const recentPair = selectImagesForTurn({ message: 'قارني بينهما', current: [], prior: many, limits: { maxImagesPerMessage: 3, maxImagesInContext: 6, maxImageBytes: 8000000, maxImagesPerDay: 20, maxEdgePx: 1600, retentionDays: 30, readTokenTtlSec: 300 } });
  record('compare-prefers-two-newest', recentPair.images.map((item) => item.id).join(',') === 'h,g', recentPair.images.map((item) => item.id));
  const vague = selectImagesForTurn({ message: 'ما رأيك في هذه؟', current: [], prior: [dress, bag] });
  record('two-images-this-asks', vague.clarify === true, vague);

  const styling = evaluateMceFashionQuarantine('تنسيق الفستان للدوام');
  record('styling-question-is-not-refused', styling.quarantine === true && consultationQuarantineApplies(styling.reasonCode) === false, styling.reasonCode);
  const religious = evaluateMceFashionQuarantine('هل هذا الفستان حرام؟');
  record('religious-styling-stays-blocked', consultationQuarantineApplies(religious.reasonCode) === true, religious.reasonCode);

  record('budget-is-not-a-price-question', isBudgetPreference('ميزانيتي ٣٠٠ ريال') && isDirectCommercialQuestion('ميزانيتي ٣٠٠ ريال') === false, true);
  record('explicit-price-stays-commercial', isDirectCommercialQuestion('كم سعر الكريم؟') && isDirectCommercialQuestion('بـ 99 ريال'), true);
  record('indicative-number-is-not-personal', retainTrustedSkinNumbers('عادة الترطيب يكون بين 40 و60.', []).includes('40'), retainTrustedSkinNumbers('عادة الترطيب يكون بين 40 و60.', []));
  record('personal-score-is-not-invented', !retainTrustedSkinNumbers('ترطيبك 80.', []).includes('80'), retainTrustedSkinNumbers('ترطيبك 80.', []));

  const memory = dialogueMemoryLines([
    { role: 'user', content: 'ميزانيتي ٣٠٠ وأفضل الأسود', attachmentIds: ['dress'] },
    { role: 'user', content: 'تصحيح: أقصد كحلي لا أسود', attachmentIds: ['bag'] },
  ]);
  record('summary-keeps-preference-correction-and-image', memory.some((line) => line.includes('ميزانيتي')) && memory.some((line) => line.includes('تصحيح')) && memory.some((line) => line.includes('dress') && line.includes('bag')), memory);

  const conflict = classifyClientTurn([
    { id: 'u1', role: 'user', clientMessageId: 'c-1', requestHash: 'hash-a', turnStatus: 'failed' },
  ], { clientMessageId: 'c-1', requestHash: 'hash-b' });
  record('same-id-different-content-conflicts', conflict.status === 'conflict', conflict.status);
  record('static-token-is-rejected', attachmentTokenSecret({ attachmentSecret: 'mira-local-attachment-token' }) == null, true);

  const jpeg = await sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 10, g: 20, b: 30 } } }).jpeg().toBuffer();
  const repo = new MemoryAttachmentRepository();
  await repo.insert({
    id: 'dress', userId: 'user-a', sessionId: 'session-a', messageId: 'm1', createdAt: new Date('2026-10-16T00:00:01.000Z'),
    mimeType: 'image/jpeg', byteSize: jpeg.length, sha256: 'dress', width: 4, height: 4, storageKey: 'user-a/session-a/dress.jpg', status: 'ready', deletedAt: null, bytes: jpeg,
  });
  const seen = await resolveDialogueTurn({
    repo, userId: 'user-a', sessionId: 'session-a', message: 'وش لونه؟', attachmentIds: [], model: 'gpt-4o-mini',
  });
  record('resolver-sends-follow-up-bytes', seen.localReply == null && seen.dataUrls.length === 1 && seen.imageLabels[0] === 'الصورة السابقة', seen.imageLabels);

  const file = join('audit-out', 'consultation-dialogue-rc2.json');
  mkdirSync('audit-out', { recursive: true });
  writeFileSync(file, JSON.stringify({ round: 'CONSULT_DIALOGUE_RC2', ranAt: new Date().toISOString(), paidCalls: 0, modelCalled: false, checks }, null, 2));
  console.log(`CONSULT_DIALOGUE_RC2_PASS ${checks.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
