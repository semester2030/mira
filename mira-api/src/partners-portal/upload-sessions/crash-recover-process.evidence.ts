/**
 * OS-process crash evidence: child completes storage then process.exit(1);
 * parent starts fresh DiskMultipartUploadStore + UploadFinalizeService and recovers.
 */
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { PrismaModule } from '../../prisma/prisma.module';
import { CatalogMediaStorage, LocalCatalogMediaStorage } from '../../marketplace/catalog-media.storage';
import { DiskMultipartUploadStore, MultipartUploadStore } from './multipart.store';
import { UploadFinalizeService } from './upload-finalize.service';

const mode = process.argv.includes('--child') ? 'child' : 'parent';

async function childMain() {
  const sessionId = process.env.MIRA_CRASH_SESSION_ID!;
  const diskRoot = process.env.MIRA_UPLOAD_DISK_ROOT!;
  const prisma = new PrismaClient();
  const store = new DiskMultipartUploadStore(diskRoot);
  const row = await prisma.partnerUploadSession.findUnique({ where: { id: sessionId } });
  if (!row?.storageUploadId) throw new Error('no-session');
  const parts = (row.completedPartsJson as Array<{ partNumber: number; etag: string; size: number }>) || [];
  // Rehydrate process-local Map from disk parts left by parent, then CompleteMultipart.
  store.adoptUpload(row.objectKey, row.storageUploadId, row.declaredMimeType);
  await store.complete(row.objectKey, row.storageUploadId, parts);
  await prisma.partnerUploadSession.update({
    where: { id: sessionId },
    data: {
      status: 'uploading',
      storageCompletedAt: new Date(),
      completeIntentAt: new Date(),
      completedPartsJson: parts,
      catalogMediaId: null,
      finalizeLeaseOwner: null,
      finalizeLeaseUntil: null,
    },
  });
  console.log(JSON.stringify({ child: 'storage-complete-exiting', sessionId, pid: process.pid }));
  await prisma.$disconnect();
  process.exit(1);
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
  const store = new DiskMultipartUploadStore(diskRoot);
  const objectKey = `partners/${brand.id}/upload-sessions/${randomUUID()}.png`;
  const created = await store.create(objectKey, 'image/png');
  const put = await store.putPartDirect('s', objectKey, created.storageUploadId, 1, png);
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
      completedPartsJson: [{ partNumber: 1, etag: put.etag, size: png.length }],
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
        MIRA_UPLOAD_DISK_ROOT: diskRoot,
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

  // Parent: new process-equivalent store instance + Nest finalize worker
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
  const recovered = await finalize.recoverStaleWork(20);
  await finalize.finalizeOne(session.id);
  const after = await prisma.partnerUploadSession.findUnique({ where: { id: session.id } });
  const mediaCount = await prisma.catalogMedia.count({ where: { sourceMediaKey: `upload-session:${session.id}` } });
  const head = await new DiskMultipartUploadStore(diskRoot).head(objectKey);

  const ok =
    childCode === 1 &&
    !!head &&
    recovered >= 1 &&
    after?.status === 'ready' &&
    !!after.catalogMediaId &&
    mediaCount === 1;

  const report = {
    ok,
    childCode,
    childOut: childOut.trim(),
    childErr: childErr.slice(0, 500),
    recovered,
    status: after?.status,
    catalogMediaId: after?.catalogMediaId,
    mediaCount,
    headBytes: head?.contentLength ?? null,
    parentPid: process.pid,
    note: 'Child OS exit(1) after storage complete; parent new Disk store + recoverStaleWork',
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
