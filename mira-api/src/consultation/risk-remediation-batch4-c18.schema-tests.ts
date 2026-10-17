/**
 * C18 — two test accounts, saved sessions, server-side access check.
 * A cache-key difference is not this test.
 *
 * Run from mira-api:
 *   MIRA_CONSULTATION_TEST_DATABASE_URL=postgresql://... ./node_modules/.bin/tsx src/consultation/risk-remediation-batch4-c18.schema-tests.ts
 *
 * The URL must be a local database or a database whose name contains test/ci/local,
 * and it must differ from DATABASE_URL. No customer accounts and no production database.
 */
async function main(): Promise<void> {
  const databaseUrl = process.env.MIRA_CONSULTATION_TEST_DATABASE_URL;
  if (!databaseUrl) {
    console.error('NOT_RUN C18: MIRA_CONSULTATION_TEST_DATABASE_URL is unset. No isolated consultation database is available. Cache-key comparison was not used as a pass.');
    process.exit(2);
  }
  if (process.env.DATABASE_URL && databaseUrl === process.env.DATABASE_URL) {
    console.error('REFUSED C18: the test URL matches DATABASE_URL. The configured database was not used.');
    process.exit(2);
  }
  let host = '';
  let name = '';
  try {
    const parsed = new URL(databaseUrl);
    host = parsed.hostname;
    name = parsed.pathname;
  } catch {
    console.error('REFUSED C18: the test URL could not be parsed.');
    process.exit(2);
  }
  const local = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  const namedTest = /(test|ci|local)/i.test(name);
  if (!local && !namedTest) {
    console.error('REFUSED C18: host is not local and the database name is not marked as a test database.');
    process.exit(2);
  }

  process.env.DATABASE_URL = databaseUrl;
  const { PrismaClient } = await import('@prisma/client');
  const { NotFoundException } = await import('@nestjs/common');
  const { ConsultationSessionService } = await import('./services/consultation-session.service');
  const { ConsultationMessageService } = await import('./services/consultation-message.service');
  const { ConsultationOrchestratorService } = await import('./services/consultation-orchestrator.service');
  const { MceModerationService } = await import('./services/mce-moderation.service');
  const { McePromptAssemblerService, MceResponseValidatorService } = await import('./services/mce-prompt-assembler.service');
  const prisma = new PrismaClient();
  const sessions = new ConsultationSessionService(prisma as never, {} as never, {} as never);
  const messages = new ConsultationMessageService(prisma as never);
  const stamp = Date.now();
  const created: string[] = [];
  try {
    const userA = await prisma.user.create({ data: { firebaseUid: `b4-c18-a-${stamp}`, displayName: 'b4-test-a' } });
    const userB = await prisma.user.create({ data: { firebaseUid: `b4-c18-b-${stamp}`, displayName: 'b4-test-b' } });
    created.push(userA.id, userB.id);
    const sessionA = await prisma.consultationSession.create({ data: { userId: userA.id, titleAr: 'جلسة أ' } });
    const sessionB = await prisma.consultationSession.create({ data: { userId: userB.id, titleAr: 'جلسة ب' } });
    await prisma.consultationMessage.create({ data: { sessionId: sessionA.id, role: 'user', contentAr: 'محتوى خاص بالحساب أ' } });
    await prisma.consultationMessage.create({ data: { sessionId: sessionB.id, role: 'user', contentAr: 'محتوى خاص بالحساب ب' } });

    const ownA = await sessions.getForUser(userA.id, sessionA.id);
    const ownB = await sessions.getForUser(userB.id, sessionB.id);
    if (ownA.id !== sessionA.id || ownB.id !== sessionB.id) throw new Error('own session was not returned');

    let crossReadRejected = false;
    try {
      await sessions.getForUser(userB.id, sessionA.id);
    } catch {
      crossReadRejected = true;
    }
    if (!crossReadRejected) throw new Error('account B read account A session');

    const ownMessages = await messages.list(sessionA.id);
    const ownText = ownMessages.map((row) => row.contentAr).join('\n');
    if (!ownText.includes('الحساب أ') || ownText.includes('الحساب ب')) throw new Error('message list leaked the other account');

    let listedOther = false;
    try {
      await sessions.getForUser(userA.id, sessionB.id);
      listedOther = true;
    } catch {
      listedOther = false;
    }
    if (listedOther) throw new Error('account A reached account B session before listing messages');

    const llmCalls = { n: 0 };
    const orchestrator = new ConsultationOrchestratorService(
      { get: (_key: string, fallback?: unknown) => fallback } as never,
      {
        findOrCreateFromFirebase: async (auth: { uid: string }) => {
          const row = await prisma.user.findUnique({ where: { firebaseUid: auth.uid } });
          if (!row) throw new Error('test user missing');
          return row;
        },
        getPreferences: async () => ({ birthYear: 1990 }),
        writeAuditLog: async () => undefined,
      } as never,
      prisma as never,
      { assertWithinLimit: async () => undefined } as never,
      { assertDailyQuota: async () => undefined, faqCacheKey: () => null, answerCacheKey: () => null, getFaqCache: async () => null, setFaqCache: async () => undefined } as never,
      { shouldCompact: () => false } as never,
      sessions as never,
      messages as never,
      { loadForSession: async () => { throw new Error('snapshot loaded before access check'); } } as never,
      { build: async () => { throw new Error('snapshot built before access check'); } } as never,
      { classify: () => 'general', intentHintAr: () => '' } as never,
      new MceModerationService(),
      new McePromptAssemblerService(new MceModerationService()),
      new MceResponseValidatorService(new MceModerationService()),
      { isConfigured: () => true, complete: async () => { llmCalls.n += 1; throw new Error('model called'); }, stream: async function* () { llmCalls.n += 1; yield ''; } } as never,
    );

    async function expectIsolation(uid: string, otherSessionId: string, marker: string): Promise<void> {
      const before = await prisma.consultationMessage.count({ where: { sessionId: otherSessionId } });
      try {
        await orchestrator.sendMessage({ uid } as never, otherSessionId, { message: marker });
        throw new Error('cross-session send was accepted');
      } catch (error) {
        if (error instanceof Error && error.message === 'cross-session send was accepted') throw error;
        if (!(error instanceof NotFoundException)) {
          throw new Error(`rejection was not the session-not-found result: ${error instanceof Error ? error.name : 'unknown'}`);
        }
      }
      const after = await prisma.consultationMessage.count({ where: { sessionId: otherSessionId } });
      if (after !== before) throw new Error('a rejected send wrote a message');
      const leaked = await prisma.consultationMessage.count({ where: { contentAr: marker } });
      if (leaked !== 0) throw new Error('rejected text was stored');
    }

    await expectIsolation(userA.firebaseUid, sessionB.id, 'رسالة غير مصرح بها من أ');
    await expectIsolation(userB.firebaseUid, sessionA.id, 'رسالة غير مصرح بها من ب');
    if (llmCalls.n !== 0) throw new Error('the model was called for an unauthorized session');

    console.log('PASS C18 server session isolation');
  } finally {
    for (const id of created) {
      await prisma.user.delete({ where: { id } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  }
}

void main();
