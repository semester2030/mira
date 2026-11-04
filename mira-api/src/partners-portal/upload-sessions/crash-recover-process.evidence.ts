/**
 * V01 — true storage→DB crash gap via real complete() path:
 * 1) Parent prepares session + uploaded parts (test fixtures only).
 * 2) Child runs UploadSessionsService.complete(); Disk store finishes multipart.complete,
 *    then process.exit(1) BEFORE storageCompletedAt is written.
 * 3) Parent asserts orphaned object + null storageCompletedAt + completeIntentAt set.
 * 4) Parent boots a NEW finalize worker and calls recoverStaleWork only (no finalizeOne).
 * 5) Pump recovery reaches ready with a single CatalogMedia row.
 */
import 'reflect-metadata';
import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { json, raw, type NextFunction, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { PrismaModule } from '../../prisma/prisma.module';
import { CatalogMediaStorage, LocalCatalogMediaStorage } from '../../marketplace/catalog-media.storage';
import { DiskMultipartUploadStore, MultipartUploadStore } from './multipart.store';
import { UploadCleanupService } from './upload-cleanup.service';
import { UploadFinalizeService } from './upload-finalize.service';
import { UploadSessionsController } from './upload-sessions.controller';
import { UploadSessionsService } from './upload-sessions.service';
import { PartnerTokenGuard } from '../guards/partner-token.guard';

const mode = process.argv.includes('--child') ? 'child' : 'parent';

async function childMain() {
  const sessionId = process.env.MIRA_CRASH_SESSION_ID!;
  const partnerId = process.env.MIRA_CRASH_PARTNER_ID!;
  const diskRoot = process.env.MIRA_UPLOAD_DISK_ROOT!;
  const mediaDir = process.env.MIRA_MEDIA_DIR!;
  const partsJson = process.env.MIRA_CRASH_PARTS_JSON!;
  process.env.MIRA_MEDIA_DIR = mediaDir;
  process.env.MIRA_PARTNER_UPLOAD_SESSION = 'true';
  process.env.NODE_ENV = 'test';
  process.env.MIRA_UPLOAD_ALLOW_DIRECT_PARTS = 'true';

  const prisma = new PrismaClient();
  const row = await prisma.partnerUploadSession.findUnique({ where: { id: sessionId } });
  if (!row?.storageUploadId || !row.objectKey) throw new Error('no-session');
  const store = new DiskMultipartUploadStore(diskRoot);
  // Rehydrate process-local Map from disk parts left by parent.
  store.adoptUpload(row.objectKey, row.storageUploadId, row.declaredMimeType);
  // Exit AFTER storage object exists, BEFORE service writes storageCompletedAt.
  store.failNextCompleteDbHook = () => {
    console.log(JSON.stringify({ child: 'storage-complete-exiting', sessionId, pid: process.pid }));
    process.exit(1);
  };

  @Module({
    imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
    controllers: [UploadSessionsController],
    providers: [
      PartnerTokenGuard,
      UploadSessionsService,
      UploadFinalizeService,
      UploadCleanupService,
      { provide: MultipartUploadStore, useValue: store },
      {
        provide: CatalogMediaStorage,
        useFactory: (config: ConfigService) => new LocalCatalogMediaStorage(config),
        inject: [ConfigService],
      },
    ],
  })
  class ChildMod {}

  const app = await NestFactory.create(ChildMod, { bodyParser: false, logger: ['error'] });
  app.use((req: Request, res: Response, next: NextFunction) => {
    const path = (req.originalUrl || req.url || '').split('?')[0];
    if (req.method === 'PUT' && /\/upload-sessions\/[^/]+\/direct-parts\/\d+$/.test(path)) {
      return raw({ type: '*/*', limit: '64mb' })(req, res, next);
    }
    return json({ limit: '4mb' })(req, res, next);
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  await app.init();
  const sessions = app.get(UploadSessionsService);
  const parts = JSON.parse(partsJson) as Array<{ partNumber: number; etag: string; size: number }>;
  try {
    await sessions.complete(partnerId, sessionId, { parts });
    console.error(JSON.stringify({ child: 'unexpected-complete-returned' }));
    await prisma.$disconnect();
    process.exit(3);
  } catch (e) {
    // If hook threw instead of exiting, still fail — we require OS exit.
    console.error(JSON.stringify({ child: 'complete-threw', message: String((e as Error).message) }));
    await prisma.$disconnect();
    process.exit(2);
  }
}

async function parentMain() {
  const outDir =
    process.env.MIRA_P21_OUT_DIR || join(process.cwd(), '..', 'audit-out', 'p2-1-p2-2', 'logs', 'crash-process');
  mkdirSync(outDir, { recursive: true });
  const url = process.env.DATABASE_URL || '';
  const host = new URL(url).hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    console.error('REFUSE non-local DB');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const brand = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `CRASH ${suffix}`, nameEn: 'C', city: 'الرياض' },
  });
  const product = await prisma.product.create({
    data: {
      partnerId: brand.id,
      nameAr: 'منتج',
      nameEn: 'P',
      priceHalalas: 1000,
      externalUrl: '',
      concernTags: [],
      skinTypes: [],
      contentStatus: 'draft',
      reviewStatus: 'draft',
    },
  });
  const png = readFileSync(join(__dirname, 'fixtures', 'valid.png'));
  const diskRoot = mkdtempSync(join(tmpdir(), 'mira-crash-disk-'));
  const mediaDir = mkdtempSync(join(tmpdir(), 'mira-crash-media-'));
  process.env.MIRA_MEDIA_DIR = mediaDir;
  process.env.MIRA_PARTNER_UPLOAD_SESSION = 'true';
  process.env.NODE_ENV = 'test';
  process.env.MIRA_UPLOAD_ALLOW_DIRECT_PARTS = 'true';

  const prepStore = new DiskMultipartUploadStore(diskRoot);
  const objectKey = `partners/${brand.id}/upload-sessions/${randomUUID()}.png`;
  const created = await prepStore.create(objectKey, 'image/png');
  const put = await prepStore.putPartDirect('s', objectKey, created.storageUploadId, 1, png);
  const parts = [{ partNumber: 1, etag: put.etag, size: png.length }];
  const session = await prisma.partnerUploadSession.create({
    data: {
      partnerId: brand.id,
      ownerKind: 'product',
      ownerId: product.id,
      clientMediaId: randomUUID(),
      idempotencyKey: randomUUID(),
      objectKey,
      storageUploadId: created.storageUploadId,
      declaredMimeType: 'image/png',
      declaredByteSize: png.length,
      declaredChecksum: createHash('sha256').update(png).digest('hex'),
      partSizeBytes: png.length,
      totalParts: 1,
      status: 'uploading',
      completedPartsJson: parts,
      placement: 'main',
      expiresAt: new Date(Date.now() + 3600_000),
    },
  });

  const child = spawn(
    process.execPath,
    ['--import', 'tsx', join(__dirname, 'crash-recover-process.evidence.ts'), '--child'],
    {
      env: {
        ...process.env,
        MIRA_CRASH_SESSION_ID: session.id,
        MIRA_CRASH_PARTNER_ID: brand.id,
        MIRA_CRASH_PARTS_JSON: JSON.stringify(parts),
        MIRA_UPLOAD_DISK_ROOT: diskRoot,
        MIRA_MEDIA_DIR: mediaDir,
        DATABASE_URL: url,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let childOut = '';
  let childErr = '';
  child.stdout?.on('data', (c) => {
    childOut += c.toString();
  });
  child.stderr?.on('data', (c) => {
    childErr += c.toString();
  });
  const childCode: number = await new Promise((r) => child.on('exit', (c) => r(c ?? 1)));

  const stuck = await prisma.partnerUploadSession.findUnique({ where: { id: session.id } });
  const headBefore = await new DiskMultipartUploadStore(diskRoot).head(objectKey);
  const gapOk =
    childCode === 1 &&
    stuck?.status === 'uploading' &&
    stuck.storageCompletedAt == null &&
    !!stuck.completeIntentAt &&
    !!headBefore &&
    headBefore.contentLength === png.length;

  // Parent: NEW Disk store + finalize worker — recoverStaleWork only (no finalizeOne).
  @Module({
    imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
    providers: [
      UploadFinalizeService,
      { provide: MultipartUploadStore, useValue: new DiskMultipartUploadStore(diskRoot) },
      {
        provide: CatalogMediaStorage,
        useFactory: (config: ConfigService) => new LocalCatalogMediaStorage(config),
        inject: [ConfigService],
      },
    ],
  })
  class RecoverMod {}

  const app = await NestFactory.createApplicationContext(RecoverMod, { logger: ['error'] });
  const finalize = app.get(UploadFinalizeService);
  // Production path: onModuleInit → bootRecover already scheduled. Also call explicitly
  // so recover count is observed even if boot raced ahead.
  const recovered = await finalize.recoverStaleWork(20);
  // Wait for pump — do not call finalizeOne (that would bypass "automatic recovery" proof).
  const deadline = Date.now() + 30_000;
  let after = await prisma.partnerUploadSession.findUnique({ where: { id: session.id } });
  while (Date.now() < deadline) {
    after = await prisma.partnerUploadSession.findUnique({ where: { id: session.id } });
    if (after?.status === 'ready' && after.catalogMediaId) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  const mediaCount = await prisma.catalogMedia.count({
    where: { sourceMediaKey: `upload-session:${session.id}` },
  });
  const head = await new DiskMultipartUploadStore(diskRoot).head(objectKey);

  // recovered may be 0 when onModuleInit bootRecover already finished before the explicit call;
  // readiness + single media without finalizeOne is the acceptance signal.
  const ok =
    gapOk &&
    after?.status === 'ready' &&
    !!after.catalogMediaId &&
    mediaCount === 1 &&
    !!head;

  const report = {
    ok,
    id: 'V01',
    childCode,
    childOut: childOut.trim().slice(0, 800),
    childErr: childErr.slice(0, 500),
    gap: {
      status: stuck?.status,
      storageCompletedAt: stuck?.storageCompletedAt,
      completeIntentAt: stuck?.completeIntentAt,
      headBytes: headBefore?.contentLength ?? null,
    },
    recovered,
    status: after?.status,
    catalogMediaId: after?.catalogMediaId,
    mediaCount,
    headBytes: head?.contentLength ?? null,
    parentPid: process.pid,
    note:
      'Child OS exit(1) inside DiskMultipartUploadStore.complete after object write; parent worker bootRecover/recoverStaleWork only (no finalizeOne)',
  };
  writeFileSync(join(outDir, 'crash-process.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await app.close();
  await prisma.$disconnect();
  rmSync(diskRoot, { recursive: true, force: true });
  rmSync(mediaDir, { recursive: true, force: true });
  process.exit(ok ? 0 : 1);
}

if (mode === 'child') {
  childMain().catch((e) => {
    console.error(e);
    process.exit(2);
  });
} else {
  parentMain().catch((e) => {
    console.error(e);
    process.exit(2);
  });
}
