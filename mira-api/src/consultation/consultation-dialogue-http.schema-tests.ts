import 'reflect-metadata';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { INestApplication, Module, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import { FirebaseIdTokenVerifier, VerifiedFirebaseIdentity } from '../common/auth/firebase-id-token-verifier';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersService } from '../users/users.service';
import { ConsultationController } from './consultation.controller';
import { ConsultationOrchestratorService } from './services/consultation-orchestrator.service';
import { ConsultationSessionService } from './services/consultation-session.service';
import { ConsultationMessageService } from './services/consultation-message.service';
import { ConsultationDialogueService } from './services/consultation-attachment.service';
import { MceContextSnapshotService } from './services/mce-context-snapshot.service';
import { MceIntentClassifierService } from './services/mce-intent-classifier.service';
import { MceModerationService } from './services/mce-moderation.service';
import { McePromptAssemblerService, MceResponseValidatorService } from './services/mce-prompt-assembler.service';
import { MceMemoryCompactionService } from './services/mce-memory-compaction.service';
import { MceCostGuardService } from './services/mce-cost-guard.service';
import { RateLimitService } from '../common/services/rate-limit.service';
import { MceLlmService } from './services/mce-llm.service';
import { MceGroundingPipelineService } from './services/mce-grounding-pipeline.service';

class ScriptedVerifier extends FirebaseIdTokenVerifier {
  constructor(private readonly known: Record<string, string>) { super(); }
  async verify(token: string): Promise<VerifiedFirebaseIdentity> {
    const uid = this.known[token];
    if (!uid) throw new UnauthorizedException('Invalid or expired Firebase token');
    return { uid, email: `${uid}@test.local`, name: uid };
  }
}

const answer = {
  answerAr: 'رد الاختبار',
  confidence: 'low',
  intent: 'general',
  citedFactIds: [],
  suggestedQuestionsAr: ['ما الخطوة التالية؟'],
  blocked: false,
  disclaimerAr: '',
};

class CountingLlm {
  calls = 0;
  isConfigured() { return true; }
  configuredModel() { return 'gpt-4o-mini'; }
  async complete() {
    this.calls += 1;
    return { payload: answer, modelId: 'http-test' };
  }
  async *stream() {
    this.calls += 1;
    yield JSON.stringify(answer);
  }
}

class EmptyGrounding {
  async build(input: { locale: string; subscriptionPlan: string; statedGoalAr?: string; skinAnalysisId?: string; outfitAnalysisId?: string; recolorAttemptId?: string }) {
    return {
      snapshot: {
        schemaVersion: '1.0.0',
        user: { locale: input.locale, isMinor: false, subscriptionPlan: input.subscriptionPlan, statedGoalAr: input.statedGoalAr },
        builtAt: new Date().toISOString(),
      },
      factRegistry: [],
      contentHash: 'http-test',
      skinAnalysisId: input.skinAnalysisId,
      outfitAnalysisId: input.outfitAnalysisId,
      recolorAttemptId: input.recolorAttemptId,
    };
  }
}

const stamp = Date.now().toString(36);
const tokens = { 'tok-a': `http-${stamp}-a`, 'tok-b': `http-${stamp}-b` };
const llm = new CountingLlm();

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
  controllers: [ConsultationController],
  providers: [
    ConsultationOrchestratorService,
    ConsultationSessionService,
    ConsultationMessageService,
    ConsultationDialogueService,
    MceContextSnapshotService,
    MceIntentClassifierService,
    MceModerationService,
    McePromptAssemblerService,
    MceResponseValidatorService,
    UsersService,
    FirebaseAuthGuard,
    { provide: FirebaseIdTokenVerifier, useValue: new ScriptedVerifier(tokens) },
    { provide: MceGroundingPipelineService, useClass: EmptyGrounding },
    { provide: MceLlmService, useValue: llm },
    { provide: RateLimitService, useValue: { assertWithinLimit: async () => undefined } },
    { provide: MceCostGuardService, useValue: { assertDailyQuota: async () => undefined, answerCacheKey: () => null, getFaqCache: async () => null, setFaqCache: async () => undefined } },
    { provide: MceMemoryCompactionService, useValue: { shouldCompact: () => false, compact: async () => null } },
  ],
})
class ConsultationHttpTestModule {}

async function main() {
  const url = `postgresql://${process.env.USER || 'localhost'}@localhost:5432/mira_dialogue_dev`;
  if (url.includes('/mira_db')) throw new Error('refused operating database');
  process.env.DATABASE_URL = url;
  process.env.AUTH_SKIP = 'false';
  process.env.MCE_CONSULTATION_ENABLED = 'true';
  process.env.MCE_ATTACHMENT_SWEEP_MS = '3600000';
  process.env.MCE_ATTACHMENT_DIR = join(process.cwd(), '.private', `consultation-http-${stamp}`);
  const app = await NestFactory.create(ConsultationHttpTestModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(0);
  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const base = `http://127.0.0.1:${port}/api/v1`;
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const jpeg = await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 180, g: 40, b: 40 } } }).jpeg().toBuffer();

  const call = async (method: string, path: string, opts: { token?: string; json?: unknown; file?: Buffer } = {}) => {
    const headers: Record<string, string> = {};
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;
    let body: BodyInit | undefined;
    if (opts.file) {
      const form = new FormData();
      form.set('image', new Blob([new Uint8Array(opts.file)]), 'swatch.jpg');
      body = form;
    } else if (opts.json !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(opts.json);
    }
    const res = await fetch(`${base}${path}`, { method, headers, body });
    const text = await res.text();
    let json: Record<string, unknown> | null = null;
    try { json = text ? JSON.parse(text) as Record<string, unknown> : null; } catch { json = { raw: text }; }
    return { status: res.status, json, text };
  };

  const result: Record<string, unknown> = { round: 'CONSULT_DIALOGUE_HTTP', modelCalls: 0 };
  try {
    assert.equal((await call('GET', '/consultation/sessions')).status, 401);
    assert.equal((await call('GET', '/consultation/sessions', { token: 'nope' })).status, 401);
    const created = await call('POST', '/consultation/sessions', { token: 'tok-a', json: { locale: 'ar' } });
    assert.equal(created.status, 201, JSON.stringify(created.json));
    const sessionId = String(created.json?.id);
    const other = await call('GET', `/consultation/sessions/${sessionId}/messages`, { token: 'tok-b' });
    assert.equal(other.status, 404);
    const uploaded = await call('POST', `/consultation/sessions/${sessionId}/attachments`, { token: 'tok-a', file: jpeg });
    assert.equal(uploaded.status, 201, JSON.stringify(uploaded.json));
    const attachmentId = String(uploaded.json?.id);
    const stolen = await call('GET', `/consultation/attachments/${attachmentId}`, { token: 'tok-b' });
    assert.equal(stolen.status, 404);
    const owned = await call('GET', `/consultation/attachments/${attachmentId}`, { token: 'tok-a' });
    assert.equal(owned.status, 200);
    const sent = await call('POST', `/consultation/sessions/${sessionId}/messages`, {
      token: 'tok-a',
      json: { message: 'ما رأيك في هذه الصورة؟', attachmentIds: [attachmentId], clientMessageId: `http-${stamp}` },
    });
    assert.equal(sent.status, 201, JSON.stringify(sent.json));
    const streamed = await call('POST', `/consultation/sessions/${sessionId}/messages/stream`, {
      token: 'tok-a',
      json: { message: 'وما الخطوة التالية؟', clientMessageId: `http-stream-${stamp}` },
    });
    assert.equal(streamed.status, 201, streamed.text.slice(0, 180));
    assert.match(streamed.text, /event: done/);
    const page = await call('GET', `/consultation/sessions/${sessionId}/messages`, { token: 'tok-a' });
    const messages = (page.json?.messages as unknown[]) ?? [];
    assert.equal(messages.length, 4, JSON.stringify(page.json));
    const draft = await call('POST', `/consultation/sessions/${sessionId}/attachments`, { token: 'tok-a', file: jpeg });
    const removed = await call('DELETE', `/consultation/attachments/${String(draft.json?.id)}`, { token: 'tok-a' });
    assert.equal(removed.status, 200, JSON.stringify(removed.json));
    const removedAgain = await call('GET', `/consultation/attachments/${String(draft.json?.id)}`, { token: 'tok-a' });
    assert.equal(removedAgain.status, 404);
    result.status = 'PASS';
    result.modelCalls = llm.calls;
    result.checks = ['auth-401', 'cross-user-session', 'upload', 'cross-user-image', 'download', 'send', 'stream', 'list', 'delete'];
  } finally {
    const users = await prisma.user.findMany({ where: { firebaseUid: { in: Object.values(tokens) } }, select: { id: true } });
    for (const user of users) await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
    await app.close();
  }
  const out = join(process.cwd(), 'audit-out');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'consultation-dialogue-http.json'), JSON.stringify(result, null, 2));
  if (result.status !== 'PASS') process.exit(1);
  console.log('CONSULT_DIALOGUE_HTTP_PASS', llm.calls);
}

main().catch((error) => {
  const message = (error instanceof Error ? error.message : 'failed').replace(/postgres(?:ql)?:\/\/\S+/g, '[url]');
  console.error(message);
  process.exit(1);
});
