/**
 * Isolated database proof for consultation attachments and turn identity.
 * Refuses mira_db. Does not print connection strings.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import { config as loadEnv } from 'dotenv';
import { PrivateFileAttachmentRepository } from './services/consultation-attachment.service';
import { ConsultationMessageService } from './services/consultation-message.service';
import { classifyClientTurn } from './services/consultation-dialogue';

loadEnv();

const ISOLATED_URL = `postgresql://${process.env.USER || 'localhost'}@localhost:5432/mira_dialogue_dev`;

async function main() {
  const result: Record<string, unknown> = {
    round: 'CONSULT_DIALOGUE_DB',
    ranAt: new Date().toISOString(),
    database: 'mira_dialogue_dev',
    httpApi: { status: 'NOT_RUN', reason: 'مسار HTTP يمر على FirebaseAuthGuard ولا توجد جلسة جهاز في هذه الدفعة. الحفظ والاسترجاع اختُبرا على الطبقة التي يستدعيها المسار بعد التحقق.' },
  };
  const url = ISOLATED_URL;
  if (url.includes('/mira_db')) throw new Error('refused operating database');
  const migrated = execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url },
    encoding: 'utf8',
  });
  if (/error/i.test(migrated) && !/No pending migrations/i.test(migrated)) {
    throw new Error('migration failed');
  }

  process.env.DATABASE_URL = url;
  const prisma = new PrismaClient();
  const messages = new ConsultationMessageService(prisma as never);
  const dir = mkdtempSync(join(tmpdir(), 'mira-dialogue-'));
  const files = new PrivateFileAttachmentRepository(prisma as never, dir);
  const stamp = Date.now().toString(36);
  const userA = await prisma.user.create({ data: { firebaseUid: `dialogue-a-${stamp}`, displayName: 'dialogue-a' } });
  const userB = await prisma.user.create({ data: { firebaseUid: `dialogue-b-${stamp}`, displayName: 'dialogue-b' } });
  const sessionA = await prisma.consultationSession.create({ data: { userId: userA.id, titleAr: 'جلسة أ' } });
  const sessionB = await prisma.consultationSession.create({ data: { userId: userB.id, titleAr: 'جلسة ب' } });
  const jpeg = await sharp({ create: { width: 8, height: 6, channels: 3, background: { r: 20, g: 80, b: 140 } } }).jpeg().toBuffer();
  const prepared = await sharp(jpeg).jpeg().toBuffer();
  const attachmentId = `att${stamp}`.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
  await files.insert({
    id: attachmentId,
    userId: userA.id,
    sessionId: sessionA.id,
    messageId: null,
    createdAt: new Date(),
    mimeType: 'image/jpeg',
    byteSize: prepared.length,
    sha256: 'generated',
    width: 8,
    height: 6,
    storageKey: `${userA.id}/${sessionA.id}/${attachmentId}.jpg`,
    status: 'ready',
    deletedAt: null,
    bytes: prepared,
  });
  const loaded = await files.find(attachmentId);
  if (!loaded?.bytes?.equals(prepared)) throw new Error('stored image did not round-trip');
  const foreign = await files.listSession(userB.id, sessionA.id);
  if (foreign.length !== 0) throw new Error('cross-user session list leaked');
  await files.bind([attachmentId], 'pending-message', { userId: userB.id, sessionId: sessionB.id }).then(
    () => { throw new Error('foreign bind succeeded'); },
    () => undefined,
  );
  const still = await files.find(attachmentId);
  if (still?.messageId) throw new Error('foreign bind changed ownership');

  for (let index = 0; index < 55; index += 1) {
    await prisma.consultationMessage.create({
      data: {
        sessionId: sessionA.id,
        role: index % 2 === 0 ? 'user' : 'assistant',
        contentAr: `رسالة ${index}`,
        createdAt: new Date(Date.UTC(2026, 9, 16, 0, 0, index)),
      },
    });
  }
  const latest = await messages.listPage(sessionA.id, { limit: 50 });
  const older = await messages.listPage(sessionA.id, { beforeId: latest.nextCursor ?? undefined, limit: 50 });
  const ids = new Set([...latest.messages, ...older.messages].map((row) => row.id));
  if (latest.messages.length !== 50 || latest.messages[0]?.contentAr !== 'رسالة 5' || latest.messages.at(-1)?.contentAr !== 'رسالة 54') {
    throw new Error(`latest page mismatch ${latest.messages[0]?.contentAr}..${latest.messages.at(-1)?.contentAr}`);
  }
  if (older.messages.length !== 5 || ids.size !== 55) throw new Error('older page lost or duplicated messages');

  const first = await messages.claimUser({ sessionId: sessionA.id, contentAr: 'سؤال أول', clientMessageId: `c-${stamp}` });
  if (first.status !== 'created') throw new Error('first claim did not create the turn');
  await messages.claimUser({ sessionId: sessionA.id, contentAr: 'سؤال أول', clientMessageId: `c-${stamp}` }).then(
    () => { throw new Error('pending turn was claimed twice'); },
    (error: { getResponse?: () => unknown }) => {
      const body = typeof error?.getResponse === 'function' ? error.getResponse() : null;
      const code = body && typeof body === 'object' ? (body as { code?: string }).code : '';
      if (code !== 'MCE_TURN_IN_PROGRESS') throw error;
    },
  );
  await messages.markTurn(first.user.id, 'failed');
  const resumed = await messages.claimUser({ sessionId: sessionA.id, contentAr: 'سؤال أول', clientMessageId: `c-${stamp}` });
  if (resumed.status !== 'resume' || resumed.user.id !== first.user.id) throw new Error('failed turn did not resume in place');
  await messages.claimUser({ sessionId: sessionA.id, contentAr: 'سؤال مختلف', clientMessageId: `c-${stamp}` }).then(
    () => { throw new Error('different content reused the id'); },
    (error: { getResponse?: () => unknown }) => {
      const body = typeof error?.getResponse === 'function' ? error.getResponse() : null;
      const code = body && typeof body === 'object' ? (body as { code?: string }).code : '';
      if (code !== 'MCE_CLIENT_MESSAGE_CONFLICT') throw error;
    },
  );
  const assistant = await messages.persistAssistant(sessionA.id, 'جواب السؤال الأول', {
    answerAr: 'جواب السؤال الأول', confidence: 'low', intent: 'general', citedFactIds: [], suggestedQuestionsAr: ['وهل يناسب الدوام؟'], blocked: false, disclaimerAr: '',
  }, { latencyMs: 1, blocked: false, replyToMessageId: first.user.id });
  await messages.markTurn(first.user.id, 'complete');
  const linked = classifyClientTurn([
    { id: first.user.id, role: 'user', clientMessageId: `c-${stamp}`, requestHash: first.user.requestHash, turnStatus: 'complete' },
    { id: assistant.id, role: 'assistant', replyToMessageId: first.user.id },
    { id: 'other', role: 'assistant', replyToMessageId: 'not-this' },
  ], { clientMessageId: `c-${stamp}`, requestHash: first.user.requestHash ?? '' });
  if (linked.status !== 'complete' || linked.assistant.id !== assistant.id) throw new Error('assistant was not bound to the request');

  const count = await prisma.consultationMessage.count({ where: { sessionId: sessionA.id, clientMessageId: `c-${stamp}` } });
  if (count !== 1) throw new Error('duplicate user message');

  await prisma.user.delete({ where: { id: userA.id } });
  await prisma.user.delete({ where: { id: userB.id } });
  await prisma.$disconnect();
  result.status = 'PASS';
  result.checks = ['migrate', 'upload-roundtrip', 'cross-user-blocked', 'page-55', 'retry-identity', 'linked-assistant'];
  write(result);
  console.log('CONSULT_DIALOGUE_DB_PASS');
}

function write(result: Record<string, unknown>) {
  mkdirSync('audit-out', { recursive: true });
  writeFileSync(join('audit-out', 'consultation-dialogue-db.json'), JSON.stringify(result, null, 2));
}

main().catch(async (error) => {
  const message = (error instanceof Error ? error.message : 'failed').replace(/postgres(?:ql)?:\/\/\S+/g, '[url]');
  write({ round: 'CONSULT_DIALOGUE_DB', ranAt: new Date().toISOString(), status: 'FAIL', reason: message });
  console.error(message);
  process.exit(1);
});
