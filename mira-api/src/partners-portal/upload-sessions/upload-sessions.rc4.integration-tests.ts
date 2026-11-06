/**
 * P2.1 RC4 — F01/F02/F05/U10 + acceptance evidence (memory + disk streaming).
 * Live R2 recorded BLOCKED when credentials absent.
 */
import 'reflect-metadata';
import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { json, raw, type NextFunction, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PrismaModule } from '../../prisma/prisma.module';
import { CatalogMediaController } from '../../marketplace/catalog-media.controller';
import { CatalogMediaStorage, LocalCatalogMediaStorage, MemoryCatalogMediaStorage } from '../../marketplace/catalog-media.storage';
import { PartnerTokenGuard } from '../guards/partner-token.guard';
import {
  DiskMultipartUploadStore,
  MemoryMultipartUploadStore,
  MultipartUploadStore,
} from './multipart.store';
import { UploadCleanupService } from './upload-cleanup.service';
import { UploadFinalizeService } from './upload-finalize.service';
import { UploadSessionsController } from './upload-sessions.controller';
import { UploadSessionsService } from './upload-sessions.service';
import { assertVerifyToolsAvailable, verifyMediaFile } from './upload-media-verify';
import {
  UPLOAD_FINALIZE_MAX_ATTEMPTS,
  finalizeRetryDelayMs,
  setUploadClock,
  uploadNowMs,
} from './upload-sessions.policy';

process.env.MIRA_PARTNER_UPLOAD_SESSION = 'true';
process.env.NODE_ENV = 'test';
process.env.MIRA_UPLOAD_ALLOW_DIRECT_PARTS = 'true';
process.env.MIRA_UPLOAD_FINALIZE_CONCURRENCY = process.env.MIRA_UPLOAD_FINALIZE_CONCURRENCY || '2';
process.env.MIRA_UPLOAD_FINALIZE_RETRY_BASE_MS = process.env.MIRA_UPLOAD_FINALIZE_RETRY_BASE_MS || '100';
process.env.MIRA_UPLOAD_FINALIZE_RETRY_MAX_MS = process.env.MIRA_UPLOAD_FINALIZE_RETRY_MAX_MS || '800';
process.env.MIRA_UPLOAD_FINALIZE_MAX_ATTEMPTS = process.env.MIRA_UPLOAD_FINALIZE_MAX_ATTEMPTS || '5';

const outDir =
  process.env.MIRA_P21_OUT_DIR || join(process.cwd(), '..', 'audit-out', 'p2-1-rc4', 'logs', 'integration');
mkdirSync(outDir, { recursive: true });
const fixturesDir = join(__dirname, 'fixtures');

type Case = { id: string; ok: boolean | 'BLOCKED' | 'NOT_RUN'; expected: unknown; actual: unknown; detail?: string };
const cases: Case[] = [];
const startedUtc = new Date().toISOString();
const commitHint = process.env.MIRA_P21_COMMIT || 'local';

function record(id: string, ok: boolean | 'BLOCKED' | 'NOT_RUN', expected: unknown, actual: unknown, detail?: string) {
  cases.push({ id, ok, expected, actual, detail });
  console.log(JSON.stringify({ id, ok, detail: detail || null }));
}

function isLocalDatabaseUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = (u.hostname || '').toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

function loadFixture(name: string): Buffer {
  const p = join(fixturesDir, name);
  if (!existsSync(p)) throw new Error('missing fixture ' + name);
  return readFileSync(p);
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

  const tools = await assertVerifyToolsAvailable();
  record(
    'VERIFY_TOOLS',
    tools.ok === true,
    { ffprobe: true, ffmpeg: true },
    tools.ok === true ? { ok: true } : tools,
  );

  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const brand = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `P21RC4 ${suffix}`, nameEn: 'P21', city: 'الرياض' },
  });
  const other = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `P21RC4O ${suffix}`, nameEn: 'O', city: 'جدة' },
  });
  const token = `token-p21rc4-${suffix}`;
  const otherToken = `token-p21rc4-o-${suffix}`;
  await prisma.partnerUser.create({
    data: { partnerId: brand.id, email: `p21rc4-${suffix}@test.local`, accessToken: token },
  });
  await prisma.partnerUser.create({
    data: { partnerId: other.id, email: `p21rc4-o-${suffix}@test.local`, accessToken: otherToken },
  });
  const product = await prisma.product.create({
    data: {
      partnerId: brand.id,
      nameAr: 'منتج RC4',
      nameEn: 'RC4',
      priceHalalas: 1000,
      externalUrl: '',
      concernTags: [],
      skinTypes: [],
      contentStatus: 'draft',
      reviewStatus: 'draft',
      active: true,
      catalogSource: 'catalog',
    },
  });
  const service = await prisma.service.create({
    data: {
      partnerId: brand.id,
      nameAr: 'خدمة RC4',
      nameEn: 'Svc',
      durationMin: 30,
      priceHalalas: 2000,
      concernTags: [],
      contentStatus: 'draft',
      reviewStatus: 'draft',
      active: true,
      catalogSource: 'catalog',
    },
  });
  const otherProduct = await prisma.product.create({
    data: {
      partnerId: other.id,
      nameAr: 'آخر',
      nameEn: 'O',
      priceHalalas: 1000,
      externalUrl: '',
      concernTags: [],
      skinTypes: [],
      contentStatus: 'draft',
      reviewStatus: 'draft',
    },
  });

  const mediaDir = mkdtempSync(join(tmpdir(), 'mira-rc4-media-'));
  process.env.MIRA_MEDIA_DIR = mediaDir;

  const memoryStore = new MemoryMultipartUploadStore();
  const diskRoot = mkdtempSync(join(tmpdir(), 'mira-rc4-disk-'));
  const diskStore = new DiskMultipartUploadStore(diskRoot);

  @Module({
    imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
    controllers: [UploadSessionsController, CatalogMediaController],
    providers: [
      PartnerTokenGuard,
      UploadSessionsService,
      UploadFinalizeService,
      UploadCleanupService,
      { provide: MultipartUploadStore, useValue: memoryStore },
      {
        provide: CatalogMediaStorage,
        useFactory: (config: ConfigService) => new LocalCatalogMediaStorage(config),
        inject: [ConfigService],
      },
    ],
  })
  class HarnessModule {}

  const app = await NestFactory.create(HarnessModule, { bodyParser: false, logger: ['error'] });
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
  const finalize = app.get(UploadFinalizeService);
  const cleanup = app.get(UploadCleanupService);
  const localCatalog = app.get(CatalogMediaStorage) as LocalCatalogMediaStorage;
  const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const otherAuth = { authorization: `Bearer ${otherToken}`, 'content-type': 'application/json' };

  const png = loadFixture('valid.png');
  const shortMp4 = loadFixture('valid-short.mp4');
  const corrupt = loadFixture('corrupt-mdat.mp4');
  const corruptAfterFirst = loadFixture('corrupt-after-first.mp4');
  const headerOnly = loadFixture('header-only.png');
  const synthetic96 = loadFixture('synthetic-96.mp4');
  const mp4_300 = loadFixture('valid-300s.mp4');
  const mp4_301 = loadFixture('valid-301s.mp4');
  const largeU11 = loadFixture('valid-u11-16m.mp4');

  async function abs(u: string) {
    return u.startsWith('http') ? u : `http://127.0.0.1:${port}${u.startsWith('/') ? u : '/' + u}`;
  }

  async function putAllParts(
    session: { sessionId: string; totalParts: number; partSizeBytes: number },
    bytes: Buffer,
    store: MemoryMultipartUploadStore | DiskMultipartUploadStore = memoryStore,
  ) {
    void store;
    const completed: Array<{ partNumber: number; etag: string; size: number }> = [];
    const partSize = session.partSizeBytes;
    for (let partNumber = 1; partNumber <= session.totalParts; partNumber++) {
      const start = (partNumber - 1) * partSize;
      const chunk = bytes.subarray(start, Math.min(bytes.length, start + partSize));
      const sign = await (
        await fetch(`${base}/partners-portal/upload-sessions/${session.sessionId}/parts/${partNumber}/sign`, {
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
      const putBody = await put.json();
      if (!put.ok) throw new Error('put failed ' + put.status);
      completed.push({ partNumber, etag: putBody.etag, size: chunk.length });
    }
    return completed;
  }

  async function initiate(bytes: Buffer, mime: string, ownerId = product.id, ownerKind: 'product' | 'service' = 'product') {
    const initRes = await fetch(`${base}/partners-portal/upload-sessions`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        ownerKind,
        ownerId,
        clientMediaId: randomUUID(),
        idempotencyKey: randomUUID(),
        mimeType: mime,
        byteSize: bytes.length,
        checksum: sha256(bytes),
      }),
    });
    const session = await initRes.json();
    if (!initRes.ok) throw new Error('init failed ' + JSON.stringify(session));
    return session;
  }

  async function uploadReady(bytes: Buffer, mime: string, ownerId = product.id, ownerKind: 'product' | 'service' = 'product') {
    const session = await initiate(bytes, mime, ownerId, ownerKind);
    const parts = await putAllParts(session, bytes);
    await fetch(`${base}/partners-portal/upload-sessions/${session.sessionId}/complete`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ parts }),
    });
    await finalize.finalizeOne(session.sessionId);
    return (await fetch(`${base}/partners-portal/upload-sessions/${session.sessionId}`, { headers: auth })).json();
  }

  // —— F01 direct verify + session path (incl. mid-stream corrupt that still yields frame 1)
  {
    const direct = await Promise.all([
      verifyMediaFile({ filePath: join(fixturesDir, 'header-only.png'), mime: 'image/png', declaredByteSize: headerOnly.length, imageMaxBytes: 20 << 20 }),
      verifyMediaFile({ filePath: join(fixturesDir, 'synthetic-96.mp4'), mime: 'video/mp4', declaredByteSize: synthetic96.length, imageMaxBytes: 20 << 20 }),
      verifyMediaFile({ filePath: join(fixturesDir, 'corrupt-mdat.mp4'), mime: 'video/mp4', declaredByteSize: corrupt.length, imageMaxBytes: 20 << 20 }),
      verifyMediaFile({
        filePath: join(fixturesDir, 'corrupt-after-first.mp4'),
        mime: 'video/mp4',
        declaredByteSize: corruptAfterFirst.length,
        imageMaxBytes: 20 << 20,
      }),
      verifyMediaFile({ filePath: join(fixturesDir, 'valid.png'), mime: 'image/png', declaredByteSize: png.length, imageMaxBytes: 20 << 20 }),
      verifyMediaFile({ filePath: join(fixturesDir, 'valid-short.mp4'), mime: 'video/mp4', declaredByteSize: shortMp4.length, imageMaxBytes: 20 << 20 }),
    ]);
    const upCorrupt = await uploadReady(corrupt, 'video/mp4', service.id, 'service');
    const upCorruptAfterFirst = await uploadReady(corruptAfterFirst, 'video/mp4', service.id, 'service');
    const upOk = await uploadReady(shortMp4, 'video/mp4', service.id, 'service');
    const up300 = await uploadReady(mp4_300, 'video/mp4', service.id, 'service');
    const up301 = await uploadReady(mp4_301, 'video/mp4', service.id, 'service');
    record(
      'F01',
      !direct[0].ok &&
        !direct[1].ok &&
        !direct[2].ok &&
        !direct[3].ok &&
        !!direct[4].ok &&
        !!direct[5].ok &&
        upCorrupt.status === 'failed' &&
        upCorruptAfterFirst.status === 'failed' &&
        upOk.status === 'ready' &&
        up300.status === 'ready' &&
        up301.status === 'failed' &&
        upCorrupt.failureCode === 'content_mismatch' &&
        upCorruptAfterFirst.failureCode === 'content_mismatch',
      {
        headerOnly: 'reject',
        synthetic96: 'reject',
        corruptMdat: 'reject',
        corruptAfterFirst: 'reject',
        valid: 'accept',
        d300: 'ready',
        d301: 'failed',
      },
      {
        direct: direct.map((d) => (d.ok ? 'ok' : `${d.code}:${d.permanent}`)),
        corruptSession: { status: upCorrupt.status, code: upCorrupt.failureCode },
        corruptAfterFirstSession: { status: upCorruptAfterFirst.status, code: upCorruptAfterFirst.failureCode },
        okSession: upOk.status,
        d300: up300.status,
        d301: up301.status,
        largeU11Bytes: largeU11.length,
        largeU11PartsAt16MiB: Math.ceil(largeU11.length / (16 * 1024 * 1024)),
      },
    );
  }

  // —— F02 abort failure + delete failure + orphan completed object
  {
    const unbound = await initiate(png, 'image/png');
    const parts = await putAllParts(unbound, png);
    await memoryStore.complete(
      (await prisma.partnerUploadSession.findUnique({ where: { id: unbound.sessionId } }))!.objectKey,
      (await prisma.partnerUploadSession.findUnique({ where: { id: unbound.sessionId } }))!.storageUploadId!,
      parts,
    );
    // storage completed without DB flag
    await prisma.partnerUploadSession.update({
      where: { id: unbound.sessionId },
      data: {
        status: 'uploading',
        completedPartsJson: parts,
        completeIntentAt: new Date(),
        storageCompletedAt: null,
        expiresAt: new Date(Date.now() - 60_000),
        cleanedAt: null,
      },
    });
    const key = (await prisma.partnerUploadSession.findUnique({ where: { id: unbound.sessionId } }))!.objectKey;

    memoryStore.failNextAbort = new Error('injected-abort-connection');
    // force needAbort by clearing storageCompleted and keeping upload id — but object exists
    // For completed object, upload id may be deleted from memory map. Create another session for abort fail.
    const mid = await initiate(png, 'image/png');
    await prisma.partnerUploadSession.update({
      where: { id: mid.sessionId },
      data: { expiresAt: new Date(Date.now() - 60_000), cleanedAt: null, status: 'uploading' },
    });
    memoryStore.failNextAbort = new Error('injected-abort-connection');
    const abortFail = await cleanup.cleanOne(mid.sessionId);
    const midAfter = await prisma.partnerUploadSession.findUnique({ where: { id: mid.sessionId } });

    memoryStore.failNextAbort = null;
    const abortRetry = await cleanup.cleanOne(mid.sessionId);
    const midClean = await prisma.partnerUploadSession.findUnique({ where: { id: mid.sessionId } });

    // orphan completed object without storageCompletedAt
    const orphanClean1 = await cleanup.cleanOne(unbound.sessionId);
    // may fail if delete injected — ensure object removed on success
    let orphanClean = orphanClean1;
    if (orphanClean1 === 'failed') {
      // delete fail path separately below
      orphanClean = await cleanup.cleanOne(unbound.sessionId);
    }
    const unboundAfter = await prisma.partnerUploadSession.findUnique({ where: { id: unbound.sessionId } });
    const objectGone = !memoryStore.objects.has(key);

    // DeleteObject fail then retry
    const delSess = await initiate(png, 'image/png');
    const delParts = await putAllParts(delSess, png);
    const delRow = await prisma.partnerUploadSession.findUnique({ where: { id: delSess.sessionId } });
    await memoryStore.complete(delRow!.objectKey, delRow!.storageUploadId!, delParts);
    await prisma.partnerUploadSession.update({
      where: { id: delSess.sessionId },
      data: {
        status: 'uploaded',
        storageCompletedAt: new Date(),
        completedPartsJson: delParts,
        expiresAt: new Date(Date.now() - 60_000),
        cleanedAt: null,
      },
    });
    const origDelete = memoryStore.deleteObject.bind(memoryStore);
    let once = true;
    memoryStore.deleteObject = async (k: string) => {
      if (once) {
        once = false;
        throw new Error('injected-delete-fail');
      }
      return origDelete(k);
    };
    const delFail = await cleanup.cleanOne(delSess.sessionId);
    const delAfterFail = await prisma.partnerUploadSession.findUnique({ where: { id: delSess.sessionId } });
    const delRetry = await cleanup.cleanOne(delSess.sessionId);
    memoryStore.deleteObject = origDelete;

    const bound = await uploadReady(png, 'image/png');
    await prisma.partnerUploadSession.update({
      where: { id: bound.sessionId },
      data: { expiresAt: new Date(Date.now() - 60_000), cleanedAt: null },
    });
    const boundClean = await cleanup.cleanOne(bound.sessionId);
    const mediaStill = await prisma.catalogMedia.findUnique({ where: { id: bound.catalogMediaId } });

    record(
      'F02',
      abortFail === 'failed' &&
        !midAfter?.cleanedAt &&
        (abortRetry === 'cleaned' || abortRetry === 'skipped' || !!midClean?.cleanedAt) &&
        (orphanClean === 'cleaned' || objectGone) &&
        delFail === 'failed' &&
        !delAfterFail?.cleanedAt &&
        delRetry === 'cleaned' &&
        boundClean === 'bound' &&
        !!mediaStill,
      {
        abortFailNoCleanedAt: true,
        abortRetry: true,
        orphanCompletedDeleted: true,
        deleteFailNoCleanedAt: true,
        boundKept: true,
      },
      {
        abortFail,
        midCleanedAt: midAfter?.cleanedAt,
        abortRetry,
        orphanClean,
        objectGone,
        delFail,
        delRetry,
        boundClean,
        mediaId: mediaStill?.id,
      },
    );
  }

  // —— F05 GET polling does not burn attempts; backoff then ready
  {
    const session = await initiate(png, 'image/png');
    const parts = await putAllParts(session, png);
    const row = await prisma.partnerUploadSession.findUnique({ where: { id: session.sessionId } });
    await memoryStore.complete(row!.objectKey, row!.storageUploadId!, parts);
    await prisma.partnerUploadSession.update({
      where: { id: session.sessionId },
      data: { status: 'uploaded', storageCompletedAt: new Date(), completedPartsJson: parts },
    });

    // Force retryable failure once by making head throw then restore
    const origHead = memoryStore.head.bind(memoryStore);
    memoryStore.head = async () => {
      throw new Error('injected-storage-down');
    };
    finalize.enqueue(session.sessionId);
    for (let i = 0; i < 100; i++) {
      const row = await prisma.partnerUploadSession.findUnique({ where: { id: session.sessionId } });
      if (row?.status === 'failed' && row.failureClass === 'retryable') break;
      await new Promise((r) => setTimeout(r, 20));
    }
    const afterFail = await prisma.partnerUploadSession.findUnique({ where: { id: session.sessionId } });
    const attemptsAfterFail = afterFail?.finalizeAttempts || 0;

    // Burst of GETs/retry during backoff must not increase attempts (clock frozen before due).
    const nextAt = afterFail?.finalizeNextAttemptAt?.getTime() || uploadNowMs() + 60_000;
    setUploadClock(() => nextAt - 1_000);
    for (let i = 0; i < 8; i++) {
      await fetch(`${base}/partners-portal/upload-sessions/${session.sessionId}`, { headers: auth });
      await fetch(`${base}/partners-portal/upload-sessions/${session.sessionId}/retry-finalize`, {
        method: 'POST',
        headers: auth,
        body: '{}',
      });
    }
    const afterPoll = await prisma.partnerUploadSession.findUnique({ where: { id: session.sessionId } });
    memoryStore.head = origHead;

    // Advance clock past nextAttemptAt then recover
    setUploadClock(() => nextAt + 10);
    await finalize.recoverStaleWork(20);
    await finalize.finalizeOne(session.sessionId);
    setUploadClock(null);
    const ready = await prisma.partnerUploadSession.findUnique({ where: { id: session.sessionId } });

    record(
      'F05',
      afterFail?.failureClass === 'retryable' &&
        afterPoll?.finalizeAttempts === attemptsAfterFail &&
        ready?.status === 'ready' &&
        !!ready.catalogMediaId &&
        finalizeRetryDelayMs(1) >= 100,
      { pollNoBurn: true, thenReady: true, backoffMs: finalizeRetryDelayMs(1) },
      {
        attemptsAfterFail,
        attemptsAfterPoll: afterPoll?.finalizeAttempts,
        nextAttemptAt: afterFail?.finalizeNextAttemptAt,
        final: ready?.status,
        maxAttempts: UPLOAD_FINALIZE_MAX_ATTEMPTS,
      },
    );
  }

  // —— U10 crash after storage complete, before DB — recover without GET
  {
    const session = await initiate(png, 'image/png');
    const parts = await putAllParts(session, png);
    memoryStore.failNextCompleteDbHook = () => {
      throw new Error('inject-complete-db-crash');
    };
    const completeRes = await fetch(`${base}/partners-portal/upload-sessions/${session.sessionId}/complete`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ parts }),
    });
    const stuck = await prisma.partnerUploadSession.findUnique({ where: { id: session.sessionId } });
    const objectExists = memoryStore.objects.has(stuck!.objectKey);

    // Simulate worker restart: new recover without GET and without hand-setting storageCompletedAt
    const recovered = await finalize.recoverStaleWork(50);
    await finalize.finalizeOne(session.sessionId);
    const after = await prisma.partnerUploadSession.findUnique({ where: { id: session.sessionId } });
    const mediaCount = await prisma.catalogMedia.count({
      where: { sourceMediaKey: `upload-session:${session.sessionId}` },
    });

    record(
      'U10',
      completeRes.status >= 500 &&
        stuck?.status === 'uploading' &&
        stuck.storageCompletedAt == null &&
        !!stuck.completeIntentAt &&
        objectExists &&
        recovered >= 1 &&
        after?.status === 'ready' &&
        mediaCount === 1,
      {
        crashLeftUploading: true,
        noStorageCompletedAt: true,
        recoverWithoutGet: true,
        readyOnce: true,
        singleMedia: true,
      },
      {
        completeHttp: completeRes.status,
        stuckStatus: stuck?.status,
        storageCompletedAt: stuck?.storageCompletedAt,
        completeIntentAt: stuck?.completeIntentAt,
        objectExists,
        recovered,
        final: after?.status,
        mediaCount,
      },
      'RC3 hand-set storageCompletedAt reclassified; this injects crash after multipart.complete',
    );
  }

  // —— U06 cross-partner isolation on session ops
  {
    const own = await uploadReady(png, 'image/png');
    const ops = await Promise.all([
      fetch(`${base}/partners-portal/upload-sessions/${own.sessionId}`, { headers: otherAuth }),
      fetch(`${base}/partners-portal/upload-sessions/${own.sessionId}/parts/1/sign`, {
        method: 'POST',
        headers: otherAuth,
        body: '{}',
      }),
      fetch(`${base}/partners-portal/upload-sessions/${own.sessionId}/complete`, {
        method: 'POST',
        headers: otherAuth,
        body: JSON.stringify({ parts: [] }),
      }),
      fetch(`${base}/partners-portal/upload-sessions/${own.sessionId}/abort`, {
        method: 'POST',
        headers: otherAuth,
        body: '{}',
      }),
      fetch(`${base}/partners-portal/upload-sessions/${own.sessionId}/retry-finalize`, {
        method: 'POST',
        headers: otherAuth,
        body: '{}',
      }),
      fetch(`${base}/partners-portal/upload-sessions`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({
          ownerKind: 'product',
          ownerId: otherProduct.id,
          clientMediaId: randomUUID(),
          idempotencyKey: randomUUID(),
          mimeType: 'image/png',
          byteSize: png.length,
        }),
      }),
    ]);
    record(
      'U06',
      ops.every((r) => r.status === 404 || r.status === 403),
      { allForbiddenOrMissing: true },
      { statuses: ops.map((r) => r.status) },
    );
  }

  // —— U12 real CatalogMediaController + Local streaming Range on multi-MB video
  {
    const up = await uploadReady(largeU11, 'video/mp4', service.id, 'service');
    const mediaId = up.catalogMediaId as string;
    // Publish for marketplace controller gates
    await prisma.catalogMedia.update({
      where: { id: mediaId },
      data: { active: true, publication: 'published' },
    });
    await prisma.service.update({
      where: { id: service.id },
      data: { active: true, contentStatus: 'published', catalogSource: 'catalog' },
    });
    await prisma.partner.update({ where: { id: brand.id }, data: { status: 'active' } });

    const full = await fetch(`${base}/marketplace/media/${mediaId}`);
    const fullBuf = Buffer.from(await full.arrayBuffer());
    const midStart = Math.floor(largeU11.length / 2);
    const midEnd = midStart + 1024 * 1024 - 1; // 1MiB from mid
    const ranged = await fetch(`${base}/marketplace/media/${mediaId}`, {
      headers: { Range: `bytes=${midStart}-${midEnd}` },
    });
    const rangeBuf = Buffer.from(await ranged.arrayBuffer());
    const cr = ranged.headers.get('content-range') || '';
    const expectedLen = Math.min(largeU11.length - 1, midEnd) - midStart + 1;
    record(
      'U12',
      full.ok &&
        fullBuf.length === largeU11.length &&
        sha256(fullBuf) === sha256(largeU11) &&
        ranged.status === 206 &&
        rangeBuf.length === expectedLen &&
        rangeBuf.equals(largeU11.subarray(midStart, midStart + expectedLen)) &&
        cr.includes(`/${largeU11.length}`),
      { fullMatch: true, midRange1MiB: true, status206: true },
      {
        mediaId,
        fullBytes: fullBuf.length,
        rangeStatus: ranged.status,
        rangeBytes: rangeBuf.length,
        contentRange: cr,
        fileBytes: largeU11.length,
      },
      'CatalogMediaController + LocalCatalogMediaStorage streaming open',
    );
  }

  // —— U11 disk streaming store + 16MiB parts + dual concurrent + declared budget
  {
    // Swap multipart provider for disk store by using diskStore APIs directly with a second app would be heavy.
    // Instead: drive DiskMultipartUploadStore + Local catalog through finalize by temporarily replacing methods.
    // Practical approach: spin a second nest app with Disk store and production part size.
    process.env.MIRA_UPLOAD_PART_SIZE_BYTES = String(16 * 1024 * 1024);
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
    class DiskHarness {}
    const diskApp = await NestFactory.create(DiskHarness, { bodyParser: false, logger: ['error'] });
    diskApp.use((req: Request, res: Response, next: NextFunction) => {
      const path = (req.originalUrl || req.url || '').split('?')[0];
      if (req.method === 'PUT' && /\/upload-sessions\/[^/]+\/direct-parts\/\d+$/.test(path)) {
        return raw({ type: '*/*', limit: '64mb' })(req, res, next);
      }
      return json({ limit: '2mb' })(req, res, next);
    });
    diskApp.setGlobalPrefix('api/v1');
    diskApp.useGlobalPipes(new ValidationPipe({ transform: true }));
    await diskApp.listen(0);
    const dAddr = diskApp.getHttpServer().address();
    const dPort = typeof dAddr === 'object' && dAddr ? dAddr.port : 0;
    const dBase = `http://127.0.0.1:${dPort}/api/v1`;
    const dFinalize = diskApp.get(UploadFinalizeService);

    async function dAbs(u: string) {
      return u.startsWith('http') ? u : `http://127.0.0.1:${dPort}${u.startsWith('/') ? u : '/' + u}`;
    }
    async function diskUpload(bytes: Buffer) {
      const init = await (
        await fetch(`${dBase}/partners-portal/upload-sessions`, {
          method: 'POST',
          headers: auth,
          body: JSON.stringify({
            ownerKind: 'service',
            ownerId: service.id,
            clientMediaId: randomUUID(),
            idempotencyKey: randomUUID(),
            mimeType: 'video/mp4',
            byteSize: bytes.length,
          }),
        })
      ).json();
      const completed: Array<{ partNumber: number; etag: string; size: number }> = [];
      for (let n = 1; n <= init.totalParts; n++) {
        const start = (n - 1) * init.partSizeBytes;
        const chunk = bytes.subarray(start, Math.min(bytes.length, start + init.partSizeBytes));
        const sign = await (
          await fetch(`${dBase}/partners-portal/upload-sessions/${init.sessionId}/parts/${n}/sign`, {
            method: 'POST',
            headers: auth,
            body: '{}',
          })
        ).json();
        const put = await fetch(await dAbs(sign.url), {
          method: 'PUT',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream' },
          body: new Uint8Array(chunk),
        });
        const body = await put.json();
        if (!put.ok) throw new Error('disk put fail');
        completed.push({ partNumber: n, etag: body.etag, size: chunk.length });
      }
      await fetch(`${dBase}/partners-portal/upload-sessions/${init.sessionId}/complete`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ parts: completed }),
      });
      await dFinalize.finalizeOne(init.sessionId);
      return (await fetch(`${dBase}/partners-portal/upload-sessions/${init.sessionId}`, { headers: auth })).json();
    }

    const budget = 512 * 1024 * 1024;
    const before = process.memoryUsage().rss;
    let peak = before;
    const timer = setInterval(() => {
      const rss = process.memoryUsage().rss;
      if (rss > peak) peak = rss;
    }, 20);
    const t0 = Date.now();
    const [a, b] = await Promise.all([diskUpload(largeU11), diskUpload(largeU11)]);
    clearInterval(timer);
    const elapsedMs = Date.now() - t0;
    const report = {
      storeMode: 'disk',
      partSizeBytes: 16 * 1024 * 1024,
      fileBytes: largeU11.length,
      expectedParts: Math.ceil(largeU11.length / (16 * 1024 * 1024)),
      concurrency: 2,
      beforeRss: before,
      peakRss: peak,
      peakDelta: peak - before,
      afterRss: process.memoryUsage().rss,
      elapsedMs,
      budgetBytes: budget,
      results: [a.status, b.status],
      note: 'DiskMultipartUploadStore streams parts/objects on disk; LocalCatalogMediaStorage Range-capable',
    };
    writeFileSync(join(outDir, 'MEMORY_REPORT.json'), JSON.stringify(report, null, 2));
    await diskApp.close();
    delete process.env.MIRA_UPLOAD_PART_SIZE_BYTES;

    record(
      'U11',
      a.status === 'ready' &&
        b.status === 'ready' &&
        report.expectedParts >= 3 &&
        report.peakDelta < budget,
      { bothReady: true, partsGte3: true, peakUnderBudget: true },
      report,
    );
  }

  // —— U04/F06 browser: attempt if playwright available, else NOT_RUN with API resume proof
  {
    let browserOk: boolean | 'NOT_RUN' = 'NOT_RUN';
    let browserDetail = 'playwright not available';
    try {
      // API-level resume proof (not a substitute for browser, recorded separately)
      const session = await initiate(largeU11.subarray(0, Math.min(largeU11.length, 2 * 256 * 1024)), 'video/mp4');
      // Use small multi-part via env already default; for resume use short mp4 with forced small parts on memory app
      void session;
      browserDetail = 'API resume covered in U04_API; headed browser NOT_RUN in this environment';
    } catch (e) {
      browserDetail = String((e as Error).message);
    }

    // U04 API resume (session restore + remaining parts) — honest partial for browser criterion
    process.env.MIRA_UPLOAD_PART_SIZE_BYTES = '262144';
    const big = loadFixture('valid-large.mp4');
    const init = await initiate(big, 'video/mp4', service.id, 'service');
    // upload half
    const half = Math.max(1, Math.floor(init.totalParts / 2));
    for (let n = 1; n <= half; n++) {
      const start = (n - 1) * init.partSizeBytes;
      const chunk = big.subarray(start, Math.min(big.length, start + init.partSizeBytes));
      const sign = await (
        await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}/parts/${n}/sign`, {
          method: 'POST',
          headers: auth,
          body: '{}',
        })
      ).json();
      await fetch(await abs(sign.url), {
        method: 'PUT',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream' },
        body: new Uint8Array(chunk),
      });
    }
    const restored = await (await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}`, { headers: auth })).json();
    const done = new Set((restored.completedParts || []).map((p: { partNumber: number }) => p.partNumber));
    for (let n = 1; n <= init.totalParts; n++) {
      if (done.has(n)) continue;
      const start = (n - 1) * init.partSizeBytes;
      const chunk = big.subarray(start, Math.min(big.length, start + init.partSizeBytes));
      const sign = await (
        await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}/parts/${n}/sign`, {
          method: 'POST',
          headers: auth,
          body: '{}',
        })
      ).json();
      await fetch(await abs(sign.url), {
        method: 'PUT',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream' },
        body: new Uint8Array(chunk),
      });
    }
    const after = await (await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}`, { headers: auth })).json();
    await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}/complete`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ parts: after.completedParts }),
    });
    await finalize.finalizeOne(init.sessionId);
    const got = await (await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}`, { headers: auth })).json();
    delete process.env.MIRA_UPLOAD_PART_SIZE_BYTES;

    record(
      'U04_API',
      restored.sessionId === init.sessionId && done.size >= 1 && got.status === 'ready',
      { resumeSession: true, remainingOnly: true, ready: true },
      { restoredParts: done.size, totalParts: init.totalParts, final: got.status },
      'API session resume — not a headed browser journey',
    );
    record('U04_BROWSER', browserOk, { headedPortal: true }, { detail: browserDetail });
    record('F06_BROWSER', browserOk, { retryableUiPoll: true }, { detail: browserDetail });
  }

  {
    const hasR2 =
      (process.env.MIRA_MEDIA_STORE || '').toLowerCase() === 's3' &&
      !!process.env.MIRA_MEDIA_S3_BUCKET &&
      !!process.env.MIRA_MEDIA_S3_ACCESS_KEY_ID &&
      !!process.env.MIRA_MEDIA_S3_SECRET_ACCESS_KEY &&
      !!process.env.MIRA_MEDIA_S3_ENDPOINT;
    record(
      'U01_R2',
      'BLOCKED',
      { liveR2Browser: true, suite: 'r2-browser-multipart.evidence.ts' },
      { configured: hasR2 },
      hasR2
        ? 'Env present — run: npx tsx src/partners-portal/upload-sessions/r2-browser-multipart.evidence.ts'
        : 'No isolated R2 credentials; suite: npx tsx src/partners-portal/upload-sessions/r2-browser-multipart.evidence.ts',
    );
  }

  // Smoke U01
  {
    const up = await uploadReady(png, 'image/png');
    record('U01', up.status === 'ready', { ready: true }, { status: up.status });
  }

  const finishedUtc = new Date().toISOString();
  const requiredPass = ['F01', 'F02', 'F05', 'U10', 'U06', 'U11', 'U12', 'U01', 'U04_API', 'VERIFY_TOOLS'];
  const byId = Object.fromEntries(cases.map((c) => [c.id, c]));
  const missing = requiredPass.filter((id) => !byId[id]);
  const failed = requiredPass.filter((id) => byId[id] && byId[id].ok !== true);
  const blocked = cases.filter((c) => c.ok === 'BLOCKED').map((c) => c.id);
  const notRun = cases.filter((c) => c.ok === 'NOT_RUN').map((c) => c.id);
  const ok = missing.length === 0 && failed.length === 0;
  const summary = {
    ok,
    missing,
    failed,
    blocked,
    notRun,
    cases,
    startedUtc,
    finishedUtc,
    commit: commitHint,
    command: 'npx tsx src/partners-portal/upload-sessions/upload-sessions.rc4.integration-tests.ts',
  };
  writeFileSync(join(outDir, 'upload-sessions-rc4-integration.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ok, missing, failed, blocked, notRun, outDir }, null, 2));
  await app.close();
  await prisma.$disconnect();
  rmSync(mediaDir, { recursive: true, force: true });
  rmSync(diskRoot, { recursive: true, force: true });
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
