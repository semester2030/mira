/**
 * P2.1 closure harness — browser U04/F06 + worker crash recovery on persistent disk+DB.
 * Does not mock R2. Records U01_R2 BLOCKED when isolated credentials absent.
 */
import 'reflect-metadata';
import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { json, raw, type NextFunction, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { PrismaModule } from '../../prisma/prisma.module';
import { CatalogMediaStorage, LocalCatalogMediaStorage } from '../../marketplace/catalog-media.storage';
import { PartnerTokenGuard } from '../guards/partner-token.guard';
import { DiskMultipartUploadStore, MultipartUploadStore } from './multipart.store';
import { UploadCleanupService } from './upload-cleanup.service';
import { UploadFinalizeService } from './upload-finalize.service';
import { UploadSessionsController } from './upload-sessions.controller';
import { UploadSessionsService } from './upload-sessions.service';

process.env.MIRA_PARTNER_UPLOAD_SESSION = 'true';
process.env.NODE_ENV = 'test';
process.env.MIRA_UPLOAD_ALLOW_DIRECT_PARTS = 'true';
process.env.MIRA_UPLOAD_FINALIZE_CONCURRENCY = process.env.MIRA_UPLOAD_FINALIZE_CONCURRENCY || '2';
process.env.MIRA_UPLOAD_PART_SIZE_BYTES = process.env.MIRA_UPLOAD_PART_SIZE_BYTES || '262144';

const outDir =
  process.env.MIRA_P21_OUT_DIR || join(process.cwd(), '..', 'audit-out', 'p2-1-closure', 'logs', 'harness');
mkdirSync(outDir, { recursive: true });
const fixturesDir = join(__dirname, 'fixtures');

function isLocalDatabaseUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = (u.hostname || '').toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!isLocalDatabaseUrl(url)) {
    console.error('REFUSE non-local DATABASE_URL host');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const brand = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `P21CL ${suffix}`, nameEn: 'CL', city: 'الرياض' },
  });
  const token = `token-p21cl-${suffix}`;
  await prisma.partnerUser.create({
    data: { partnerId: brand.id, email: `p21cl-${suffix}@test.local`, accessToken: token },
  });
  const service = await prisma.service.create({
    data: {
      partnerId: brand.id,
      nameAr: 'خدمة إغلاق',
      nameEn: 'Closure',
      durationMin: 30,
      priceHalalas: 1000,
      concernTags: [],
      contentStatus: 'draft',
      reviewStatus: 'draft',
      active: true,
      catalogSource: 'catalog',
    },
  });

  const diskRoot = mkdtempSync(join(tmpdir(), 'mira-p21-closure-disk-'));
  const mediaDir = mkdtempSync(join(tmpdir(), 'mira-p21-closure-media-'));
  process.env.MIRA_MEDIA_DIR = mediaDir;
  const diskStore = new DiskMultipartUploadStore(diskRoot);

  @Module({
    imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
    controllers: [UploadSessionsController],
    providers: [
      PartnerTokenGuard,
      UploadSessionsService,
      UploadFinalizeService,
      UploadCleanupService,
      { provide: MultipartUploadStore, useValue: diskStore },
      {
        provide: CatalogMediaStorage,
        useFactory: (config: ConfigService) => new LocalCatalogMediaStorage(config),
        inject: [ConfigService],
      },
    ],
  })
  class Harness {}

  const app = await NestFactory.create(Harness, { bodyParser: false, logger: ['error'] });
  app.enableCors({
    origin: true,
    credentials: true,
    exposedHeaders: ['ETag', 'etag', 'Content-Range', 'Accept-Ranges'],
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    const path = (req.originalUrl || req.url || '').split('?')[0];
    if (req.method === 'PUT' && /\/upload-sessions\/[^/]+\/direct-parts\/\d+$/.test(path)) {
      return raw({ type: '*/*', limit: '64mb' })(req, res, next);
    }
    return json({ limit: '2mb' })(req, res, next);
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  await app.listen(0);
  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const base = `http://127.0.0.1:${port}/api/v1`;
  const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

  async function abs(u: string) {
    return u.startsWith('http') ? u : `http://127.0.0.1:${port}${u.startsWith('/') ? u : '/' + u}`;
  }

  // —— Browser U04/F06
  const browserOut = join(outDir, 'browser');
  mkdirSync(browserOut, { recursive: true });
  const browserCode: number = await new Promise((resolve) => {
    const child = spawn(
      'npx',
      ['tsx', 'src/partners-portal/upload-sessions/upload-sessions.rc4.browser.mjs'],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          MIRA_RC4_BROWSER_BASE: base,
          MIRA_RC4_BROWSER_TOKEN: token,
          MIRA_RC4_BROWSER_OWNER_ID: service.id,
          MIRA_P21_OUT_DIR: browserOut,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (c) => {
      stdout += c.toString();
    });
    child.stderr?.on('data', (c) => {
      stderr += c.toString();
    });
    child.on('exit', (c) => {
      writeFileSync(join(browserOut, 'browser-run.stdout.txt'), stdout);
      writeFileSync(join(browserOut, 'browser-run.stderr.txt'), stderr);
      resolve(c ?? 1);
    });
  });
  let browserJourney: { ok?: boolean; result?: { logs?: string[]; status?: string; catalogMediaId?: string } } | null =
    null;
  const journeyPath = join(browserOut, 'browser-journey.json');
  if (existsSync(journeyPath)) browserJourney = JSON.parse(readFileSync(journeyPath, 'utf8'));
  const browserOk = browserCode === 0 && !!browserJourney?.ok;

  // —— Crash recovery on persistent disk + DB (worker1 dies mid-verify; worker2 recovers)
  const png = readFileSync(join(fixturesDir, 'valid.png'));
  const init = await (
    await fetch(`${base}/partners-portal/upload-sessions`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        ownerKind: 'service',
        ownerId: service.id,
        clientMediaId: randomUUID(),
        idempotencyKey: randomUUID(),
        mimeType: 'image/png',
        byteSize: png.length,
        checksum: sha256(png),
      }),
    })
  ).json();
  const completed: Array<{ partNumber: number; etag: string; size: number }> = [];
  for (let n = 1; n <= init.totalParts; n++) {
    const start = (n - 1) * init.partSizeBytes;
    const chunk = png.subarray(start, Math.min(png.length, start + init.partSizeBytes));
    const sign = await (
      await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}/parts/${n}/sign`, {
        method: 'POST',
        headers: auth,
        body: '{}',
      })
    ).json();
    const put = await fetch(await abs(sign.url), {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream' },
      body: new Uint8Array(chunk),
    });
    const body = await put.json();
    completed.push({ partNumber: n, etag: body.etag, size: chunk.length });
  }
  await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}/complete`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ parts: completed }),
  });
  await prisma.partnerUploadSession.update({
    where: { id: init.sessionId },
    data: {
      status: 'verifying',
      storageCompletedAt: new Date(),
      completedPartsJson: completed,
      finalizeLeaseOwner: 'dead-worker-before-restart',
      finalizeLeaseUntil: new Date(Date.now() - 60_000),
      catalogMediaId: null,
      finalizeNextAttemptAt: null,
    },
  });
  const row = await prisma.partnerUploadSession.findUnique({ where: { id: init.sessionId } });
  const headBefore = await diskStore.head(row!.objectKey);
  const worker1Id = app.get(UploadFinalizeService).workerId;

  // Close app1 (worker death) — disk root + DB rows persist; new store instance reads objects from disk
  await app.close();
  const diskStore2 = new DiskMultipartUploadStore(diskRoot);
  const headAfterRestart = await diskStore2.head(row!.objectKey);

  @Module({
    imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
    controllers: [UploadSessionsController],
    providers: [
      PartnerTokenGuard,
      UploadSessionsService,
      UploadFinalizeService,
      UploadCleanupService,
      { provide: MultipartUploadStore, useValue: diskStore2 },
      {
        provide: CatalogMediaStorage,
        useFactory: (config: ConfigService) => new LocalCatalogMediaStorage(config),
        inject: [ConfigService],
      },
    ],
  })
  class Harness2 {}

  const app2 = await NestFactory.create(Harness2, { bodyParser: false, logger: ['error'] });
  await app2.init();
  const worker2 = app2.get(UploadFinalizeService);
  const recovered = await worker2.recoverStaleWork(20);
  await worker2.finalizeOne(init.sessionId);
  const after = await prisma.partnerUploadSession.findUnique({ where: { id: init.sessionId } });
  const crashOk =
    !!headBefore &&
    !!headAfterRestart &&
    headAfterRestart.contentLength === headBefore.contentLength &&
    recovered >= 1 &&
    after?.status === 'ready' &&
    !!after.catalogMediaId &&
    worker2.workerId !== worker1Id &&
    existsSync(diskRoot);

  const hasR2 =
    (process.env.MIRA_MEDIA_STORE || '').toLowerCase() === 's3' &&
    !!process.env.MIRA_MEDIA_S3_BUCKET &&
    !!process.env.MIRA_MEDIA_S3_ACCESS_KEY_ID;

  const summary = {
    ok: browserOk && crashOk,
    finishedUtc: new Date().toISOString(),
    cases: [
      {
        id: 'U04_BROWSER',
        ok: browserOk,
        detail: 'playwright journey against local UploadSession API (disk multipart)',
        journey: browserJourney,
        exitCode: browserCode,
      },
      {
        id: 'F06_BROWSER',
        ok: browserOk,
        detail: 'same journey covers retryable mismatch rejection in UI path',
        logsTail: (browserJourney?.result?.logs || []).slice(-6),
      },
      {
        id: 'CRASH_RECOVER_DISK',
        ok: crashOk,
        expected: { headSurvives: true, recoverStale: true, ready: true, newWorker: true },
        actual: {
          headBytesBefore: headBefore?.contentLength ?? null,
          headBytesAfterRestart: headAfterRestart?.contentLength ?? null,
          recovered,
          status: after?.status,
          catalogMediaId: after?.catalogMediaId,
          diskRootAlive: existsSync(diskRoot),
          worker1Id,
          worker2Id: worker2.workerId,
        },
      },
      {
        id: 'U01_R2',
        ok: hasR2 ? false : ('BLOCKED' as const),
        detail: hasR2
          ? 'R2 env present but isolated live CORS/ETag journey not executed'
          : 'No isolated R2 credentials in available env; production secrets unused',
        actual: { configured: hasR2 },
      },
    ],
    apiBase: base,
  };
  writeFileSync(join(outDir, 'closure-harness.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ok: summary.ok, cases: summary.cases.map((c) => ({ id: c.id, ok: c.ok })) }, null, 2));

  await app2.close();
  await prisma.$disconnect();
  rmSync(mediaDir, { recursive: true, force: true });
  rmSync(diskRoot, { recursive: true, force: true });
  process.exit(summary.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
