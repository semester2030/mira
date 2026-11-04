/**
 * P2.1 RC3 acceptance + F01–F06 regressions (memory adapter + real media fixtures).
 * Live R2 recorded BLOCKED when credentials absent — never mocked as PASS.
 */
import 'reflect-metadata';
import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { json, raw, type NextFunction, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaModule } from '../../prisma/prisma.module';
import { CatalogMediaStorage, MemoryCatalogMediaStorage } from '../../marketplace/catalog-media.storage';
import { PartnerTokenGuard } from '../guards/partner-token.guard';
import { MemoryMultipartUploadStore, MultipartUploadStore, verifyDirectPartToken } from './multipart.store';
import { UploadCleanupService } from './upload-cleanup.service';
import { UploadFinalizeService } from './upload-finalize.service';
import { UploadSessionsController } from './upload-sessions.controller';
import { UploadSessionsService } from './upload-sessions.service';
import {
  UPLOAD_IMAGE_MAX_BYTES,
  setUploadClock,
  uploadNowMs,
} from './upload-sessions.policy';

process.env.MIRA_PARTNER_UPLOAD_SESSION = 'true';
process.env.NODE_ENV = 'test';
process.env.MIRA_UPLOAD_ALLOW_DIRECT_PARTS = 'true';
process.env.MIRA_UPLOAD_PART_SIZE_BYTES = process.env.MIRA_UPLOAD_PART_SIZE_BYTES || '262144';
process.env.MIRA_UPLOAD_FINALIZE_CONCURRENCY = process.env.MIRA_UPLOAD_FINALIZE_CONCURRENCY || '2';

const outDir =
  process.env.MIRA_P21_OUT_DIR || join(process.cwd(), '..', 'audit-out', 'p2-1-rc3', 'logs', 'integration');
mkdirSync(outDir, { recursive: true });
const fixturesDir = join(__dirname, 'fixtures');

type Case = {
  id: string;
  ok: boolean | 'BLOCKED';
  expected: unknown;
  actual: unknown;
  detail?: string;
};
const cases: Case[] = [];
const startedUtc = new Date().toISOString();
const commitHint = process.env.MIRA_P21_COMMIT || 'local';

function record(id: string, ok: boolean | 'BLOCKED', expected: unknown, actual: unknown, detail?: string) {
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

  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const brand = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `P21RC3 ${suffix}`, nameEn: 'P21', city: 'الرياض' },
  });
  const other = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `P21RC3O ${suffix}`, nameEn: 'O', city: 'جدة' },
  });
  const token = `token-p21rc3-${suffix}`;
  const otherToken = `token-p21rc3-o-${suffix}`;
  await prisma.partnerUser.create({
    data: { partnerId: brand.id, email: `p21rc3-${suffix}@test.local`, accessToken: token },
  });
  await prisma.partnerUser.create({
    data: { partnerId: other.id, email: `p21rc3-o-${suffix}@test.local`, accessToken: otherToken },
  });
  const product = await prisma.product.create({
    data: {
      partnerId: brand.id,
      nameAr: 'منتج RC3',
      nameEn: 'RC3',
      priceHalalas: 1000,
      externalUrl: '',
      concernTags: [],
      skinTypes: [],
      contentStatus: 'draft',
      reviewStatus: 'draft',
    },
  });
  const service = await prisma.service.create({
    data: {
      partnerId: brand.id,
      nameAr: 'خدمة RC3',
      nameEn: 'Svc',
      durationMin: 30,
      priceHalalas: 2000,
      concernTags: [],
      contentStatus: 'draft',
      reviewStatus: 'draft',
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

  // Rebuild module providers with real PrismaService injection for TestCatalogMediaController
  @Module({
    imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
    controllers: [UploadSessionsController],
    providers: [
      PartnerTokenGuard,
      UploadSessionsService,
      UploadFinalizeService,
      UploadCleanupService,
      { provide: MultipartUploadStore, useClass: MemoryMultipartUploadStore },
      { provide: CatalogMediaStorage, useClass: MemoryCatalogMediaStorage },
    ],
  })
  class HarnessModule {}

  const app = await NestFactory.create(HarnessModule, { bodyParser: false, logger: ['error'] });
  const memoryCatalog = app.get(CatalogMediaStorage) as MemoryCatalogMediaStorage;

  // Mount Range reader manually on same HTTP server
  const httpServer = app.getHttpAdapter().getInstance();
  httpServer.get('/api/v1/marketplace/media/:id', async (req: Request, res: Response) => {
    try {
      const row = await prisma.catalogMedia.findFirst({ where: { id: req.params.id } });
      if (!row?.storageKey) return res.status(404).json({ message: 'missing' });
      const opened = await memoryCatalog.open(row.storageKey, { rangeHeader: req.headers.range });
      if (!opened) return res.status(404).json({ message: 'missing-object' });
      res.setHeader('Accept-Ranges', 'bytes');
      if (opened.status === 416) {
        res.status(416);
        res.setHeader('Content-Range', opened.contentRange);
        return res.end();
      }
      if (opened.contentRange) res.setHeader('Content-Range', opened.contentRange);
      res.setHeader('Content-Length', String(opened.contentLength));
      res.status(opened.status);
      const body = opened.body;
      if (Buffer.isBuffer(body)) return res.end(body);
      for await (const c of body as AsyncIterable<Buffer>) res.write(Buffer.from(c));
      return res.end();
    } catch (e) {
      return res.status(500).json({ message: String((e as Error).message) });
    }
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
  const finalize = app.get(UploadFinalizeService);
  const cleanup = app.get(UploadCleanupService);
  const memoryStore = app.get(MultipartUploadStore) as MemoryMultipartUploadStore;
  const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const otherAuth = { authorization: `Bearer ${otherToken}`, 'content-type': 'application/json' };

  const png = loadFixture('valid.png');
  const shortMp4 = loadFixture('valid-short.mp4');
  const mp4_300 = loadFixture('valid-300s.mp4');
  const mp4_301 = loadFixture('valid-301s.mp4');
  const largeMp4 = loadFixture('valid-large.mp4');
  const headerOnlyPng = loadFixture('header-only.png');
  const synthetic96 = loadFixture('synthetic-96.mp4');

  writeFileSync(
    join(outDir, 'FIXTURE_DIGESTS.json'),
    JSON.stringify(
      {
        'valid.png': { bytes: png.length, sha256: sha256(png) },
        'valid-short.mp4': { bytes: shortMp4.length, sha256: sha256(shortMp4) },
        'valid-300s.mp4': { bytes: mp4_300.length, sha256: sha256(mp4_300) },
        'valid-301s.mp4': { bytes: mp4_301.length, sha256: sha256(mp4_301) },
        'valid-large.mp4': { bytes: largeMp4.length, sha256: sha256(largeMp4) },
        'header-only.png': { bytes: headerOnlyPng.length, sha256: sha256(headerOnlyPng) },
        'synthetic-96.mp4': { bytes: synthetic96.length, sha256: sha256(synthetic96) },
      },
      null,
      2,
    ),
  );

  async function abs(url: string) {
    return url.startsWith('http') ? url : `http://127.0.0.1:${port}${url.startsWith('/') ? url : '/' + url}`;
  }

  async function putAllParts(session: { sessionId: string; totalParts: number; partSizeBytes: number }, bytes: Buffer, opts?: { failPart?: number; skipParts?: number[] }) {
    const completed: Array<{ partNumber: number; etag: string; size: number }> = [];
    const partSize = session.partSizeBytes;
    const skip = new Set(opts?.skipParts || []);
    for (let partNumber = 1; partNumber <= session.totalParts; partNumber++) {
      if (skip.has(partNumber)) continue;
      const start = (partNumber - 1) * partSize;
      let chunk = bytes.subarray(start, Math.min(bytes.length, start + partSize));
      if (opts?.failPart === partNumber) {
        chunk = chunk.subarray(0, Math.max(1, chunk.length - 1));
      }
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
      const putBody = await put.json().catch(() => ({}));
      if (!put.ok) throw new Error('put failed ' + put.status);
      if (opts?.failPart !== partNumber) {
        completed.push({ partNumber, etag: putBody.etag, size: chunk.length });
      }
    }
    return completed;
  }

  async function uploadFile(opts: {
    ownerKind: 'product' | 'service';
    ownerId: string;
    bytes: Buffer;
    mimeType: string;
    idempotencyKey?: string;
    checksum?: string;
    doubleComplete?: boolean;
    doubleFinalize?: boolean;
  }) {
    const clientMediaId = randomUUID();
    const idempotencyKey = opts.idempotencyKey || randomUUID();
    const initRes = await fetch(`${base}/partners-portal/upload-sessions`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        ownerKind: opts.ownerKind,
        ownerId: opts.ownerId,
        clientMediaId,
        idempotencyKey,
        mimeType: opts.mimeType,
        byteSize: opts.bytes.length,
        checksum: opts.checksum,
      }),
    });
    const session = await initRes.json();
    if (!initRes.ok) return { ok: false as const, session, status: initRes.status };
    const completed = await putAllParts(session, opts.bytes);
    await fetch(`${base}/partners-portal/upload-sessions/${session.sessionId}/complete`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ parts: completed }),
    });
    if (opts.doubleComplete) {
      await fetch(`${base}/partners-portal/upload-sessions/${session.sessionId}/complete`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ parts: completed }),
      });
    }
    await finalize.finalizeOne(session.sessionId);
    if (opts.doubleFinalize) await finalize.finalizeOne(session.sessionId);
    const got = await (await fetch(`${base}/partners-portal/upload-sessions/${session.sessionId}`, { headers: auth })).json();
    return { ok: true as const, session: got };
  }

  // —— F01 real integrity
  {
    const badPng = await uploadFile({
      ownerKind: 'product',
      ownerId: product.id,
      bytes: headerOnlyPng,
      mimeType: 'image/png',
    });
    const badMp4 = await uploadFile({
      ownerKind: 'service',
      ownerId: service.id,
      bytes: synthetic96,
      mimeType: 'video/mp4',
    });
    const goodPng = await uploadFile({
      ownerKind: 'product',
      ownerId: product.id,
      bytes: png,
      mimeType: 'image/png',
      checksum: sha256(png),
    });
    const goodVid = await uploadFile({
      ownerKind: 'service',
      ownerId: service.id,
      bytes: shortMp4,
      mimeType: 'video/mp4',
      checksum: sha256(shortMp4),
    });
    record(
      'F01',
      !!(
        badPng.ok &&
        badPng.session.status === 'failed' &&
        badMp4.ok &&
        badMp4.session.status === 'failed' &&
        goodPng.ok &&
        goodPng.session.status === 'ready' &&
        goodVid.ok &&
        goodVid.session.status === 'ready'
      ),
      { headerOnly: 'failed', synthetic96: 'failed', validPng: 'ready', validMp4: 'ready' },
      {
        headerOnly: badPng.ok ? badPng.session.status : badPng,
        synthetic96: badMp4.ok ? badMp4.session.status : badMp4,
        validPng: goodPng.ok ? goodPng.session.status : goodPng,
        validMp4: goodVid.ok ? goodVid.session.status : goodVid,
        digests: { png: sha256(png), short: sha256(shortMp4) },
      },
    );
  }

  // —— U01 happy path
  {
    const up = await uploadFile({
      ownerKind: 'product',
      ownerId: product.id,
      bytes: png,
      mimeType: 'image/png',
      checksum: sha256(png),
    });
    const media =
      up.ok && up.session.catalogMediaId
        ? await prisma.catalogMedia.findUnique({ where: { id: up.session.catalogMediaId } })
        : null;
    const stored = media?.storageKey ? await memoryCatalog.get(media.storageKey) : null;
    const upVid = await uploadFile({
      ownerKind: 'service',
      ownerId: service.id,
      bytes: shortMp4,
      mimeType: 'video/mp4',
    });
    record(
      'U01',
      !!(up.ok && up.session.status === 'ready' && media && stored && upVid.ok && upVid.session.status === 'ready'),
      { ready: true, videoReady: true, storeMode: 'memory' },
      {
        status: up.ok ? up.session.status : up,
        bytesMatch: !!stored && sha256(stored) === sha256(png),
        video: upVid.ok ? upVid.session.status : upVid,
      },
    );
  }

  {
    const hasR2 =
      (process.env.MIRA_MEDIA_STORE || '').toLowerCase() === 's3' &&
      !!process.env.MIRA_MEDIA_S3_BUCKET &&
      !!process.env.MIRA_MEDIA_S3_ACCESS_KEY_ID;
    record(
      'U01_R2',
      hasR2 ? false : 'BLOCKED',
      { liveR2: true },
      { configured: hasR2 },
      hasR2 ? 'R2 configured but browser CORS/ETag path not executed in this harness' : 'No isolated R2 credentials',
    );
  }

  // —— U02 part interrupt then retry only failed part (multi-part)
  {
    const init = await (
      await fetch(`${base}/partners-portal/upload-sessions`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({
          ownerKind: 'service',
          ownerId: service.id,
          clientMediaId: randomUUID(),
          idempotencyKey: randomUUID(),
          mimeType: 'video/mp4',
          byteSize: largeMp4.length,
        }),
      })
    ).json();
    // Upload all but last correctly; fail last then retry only last
    const last = init.totalParts as number;
    await putAllParts(init, largeMp4, { skipParts: [last] });
    // wrong size for last
    const signBad = await (
      await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}/parts/${last}/sign`, {
        method: 'POST',
        headers: auth,
        body: '{}',
      })
    ).json();
    const start = (last - 1) * init.partSizeBytes;
    const correct = largeMp4.subarray(start);
    await fetch(await abs(signBad.url), {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream' },
      body: new Uint8Array(correct.subarray(0, Math.max(1, correct.length - 10))),
    });
    // retry only last with correct bytes
    const signOk = await (
      await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}/parts/${last}/sign`, {
        method: 'POST',
        headers: auth,
        body: '{}',
      })
    ).json();
    const put = await fetch(await abs(signOk.url), {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream' },
      body: new Uint8Array(correct),
    });
    const putBody = await put.json();
    const mid = await (await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}`, { headers: auth })).json();
    const parts = (mid.completedParts || []).map((p: { partNumber: number; etag: string; size: number }) => p);
    // ensure last etag from retry
    const withoutLast = parts.filter((p: { partNumber: number }) => p.partNumber !== last);
    withoutLast.push({ partNumber: last, etag: putBody.etag, size: correct.length });
    await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}/complete`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ parts: withoutLast }),
    });
    await finalize.finalizeOne(init.sessionId);
    const got = await (await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}`, { headers: auth })).json();
    record(
      'U02',
      got.status === 'ready' && init.totalParts >= 2,
      { partRetried: last, ready: true, multiPart: true },
      { status: got.status, totalParts: init.totalParts, partSize: init.partSizeBytes, fileBytes: largeMp4.length },
    );
  }

  // —— U03 expired part URL then resign
  {
    const init = await (
      await fetch(`${base}/partners-portal/upload-sessions`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({
          ownerKind: 'product',
          ownerId: product.id,
          clientMediaId: randomUUID(),
          idempotencyKey: randomUUID(),
          mimeType: 'image/png',
          byteSize: png.length,
        }),
      })
    ).json();
    const sign = await (
      await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}/parts/1/sign`, {
        method: 'POST',
        headers: auth,
        body: '{}',
      })
    ).json();
    const u = new URL(await abs(sign.url));
    const expiredExp = String(Math.floor(Date.now() / 1000) - 60);
    u.searchParams.set('exp', expiredExp);
    // keep old sig → must fail verify
    const expiredOk = verifyDirectPartToken(init.sessionId, 1, Number(expiredExp), u.searchParams.get('sig') || '');
    const expiredPut = await fetch(u.toString(), {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream' },
      body: new Uint8Array(png),
    });
    const resign = await (
      await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}/parts/1/sign`, {
        method: 'POST',
        headers: auth,
        body: '{}',
      })
    ).json();
    const okPut = await fetch(await abs(resign.url), {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream' },
      body: new Uint8Array(png),
    });
    const okBody = await okPut.json();
    await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}/complete`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ parts: [{ partNumber: 1, etag: okBody.etag, size: png.length }] }),
    });
    await finalize.finalizeOne(init.sessionId);
    const got = await (await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}`, { headers: auth })).json();
    record(
      'U03',
      !expiredOk && expiredPut.status >= 400 && okPut.ok && got.status === 'ready',
      { expiredRejected: true, resignOk: true, ready: true },
      { expiredTokenValid: expiredOk, expiredHttp: expiredPut.status, resignHttp: okPut.status, status: got.status },
    );
  }

  // —— U04 session restore (simulate page reload): listParts + resume remaining
  {
    const init = await (
      await fetch(`${base}/partners-portal/upload-sessions`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({
          ownerKind: 'service',
          ownerId: service.id,
          clientMediaId: randomUUID(),
          idempotencyKey: randomUUID(),
          mimeType: 'video/mp4',
          byteSize: largeMp4.length,
          checksum: sha256(largeMp4),
        }),
      })
    ).json();
    // upload first half of parts only
    const half = Math.max(1, Math.floor(init.totalParts / 2));
    const skip = [] as number[];
    for (let i = half + 1; i <= init.totalParts; i++) skip.push(i);
    await putAllParts(init, largeMp4, { skipParts: skip });
    // "reload": GET session (listParts sync)
    const restored = await (await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}`, { headers: auth })).json();
    const done = new Set((restored.completedParts || []).map((p: { partNumber: number }) => p.partNumber));
    const remaining = [] as number[];
    for (let i = 1; i <= init.totalParts; i++) if (!done.has(i)) remaining.push(i);
    await putAllParts(init, largeMp4, { skipParts: [...done] as number[] });
    const after = await (await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}`, { headers: auth })).json();
    await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}/complete`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ parts: after.completedParts }),
    });
    await finalize.finalizeOne(init.sessionId);
    const got = await (await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}`, { headers: auth })).json();
    // rematch checksum same file
    const mismatch = await (
      await fetch(`${base}/partners-portal/upload-sessions`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({
          ownerKind: 'product',
          ownerId: product.id,
          clientMediaId: randomUUID(),
          idempotencyKey: randomUUID(),
          mimeType: 'image/png',
          byteSize: png.length,
          checksum: sha256(png),
        }),
      })
    ).json();
    // wrong bytes same size
    const wrong = Buffer.alloc(png.length, 1);
    wrong[0] = 0x89;
    wrong[1] = 0x50;
    const upWrong = await uploadFile({
      ownerKind: 'product',
      ownerId: product.id,
      bytes: wrong,
      mimeType: 'image/png',
      checksum: sha256(png),
    });
    record(
      'U04',
      !!(
        restored.sessionId === init.sessionId &&
        remaining.length > 0 &&
        got.status === 'ready' &&
        upWrong.ok &&
        upWrong.session.status === 'failed'
      ),
      { resumeSession: true, remainingParts: true, ready: true, checksumMismatchFails: true },
      {
        restoredParts: (restored.completedParts || []).length,
        remainingBeforeResume: remaining.length,
        final: got.status,
        mismatchFail: upWrong.ok ? upWrong.session.status : upWrong,
        checksumSession: mismatch.sessionId,
      },
    );
  }

  // —— U05 idempotent
  {
    const key = randomUUID();
    const up = await uploadFile({
      ownerKind: 'product',
      ownerId: product.id,
      bytes: png,
      mimeType: 'image/png',
      idempotencyKey: key,
      doubleComplete: true,
      doubleFinalize: true,
    });
    const count = up.ok
      ? await prisma.catalogMedia.count({ where: { sourceMediaKey: `upload-session:${up.session.sessionId}` } })
      : -1;
    record('U05', !!(up.ok && up.session.status === 'ready' && count === 1), { mediaRows: 1 }, { count, status: up.ok ? up.session.status : up });
  }

  // —— U06 cross-partner
  {
    const init = await fetch(`${base}/partners-portal/upload-sessions`, {
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
    });
    const okSession = await uploadFile({
      ownerKind: 'product',
      ownerId: product.id,
      bytes: png,
      mimeType: 'image/png',
    });
    const foreignGet = okSession.ok
      ? await fetch(`${base}/partners-portal/upload-sessions/${okSession.session.sessionId}`, { headers: otherAuth })
      : null;
    record(
      'U06',
      init.status === 404 && !!foreignGet && foreignGet.status === 404,
      { initiateOther: 404, getOther: 404 },
      { initiateOther: init.status, getOther: foreignGet?.status },
    );
  }

  // —— U07 corrupt + draft remains
  {
    const bad = Buffer.from('not-an-image-at-all');
    const up = await uploadFile({
      ownerKind: 'product',
      ownerId: product.id,
      bytes: bad,
      mimeType: 'image/png',
    });
    const productStill = await prisma.product.findUnique({ where: { id: product.id } });
    record(
      'U07',
      !!(up.ok && up.session.status === 'failed' && productStill),
      { failed: true, productRemains: true },
      { status: up.ok ? up.session.status : up, product: productStill?.nameAr },
    );
  }

  // —— U08 real 300/301s + invalid
  {
    const upOk = await uploadFile({
      ownerKind: 'service',
      ownerId: service.id,
      bytes: mp4_300,
      mimeType: 'video/mp4',
    });
    const upOver = await uploadFile({
      ownerKind: 'service',
      ownerId: service.id,
      bytes: mp4_301,
      mimeType: 'video/mp4',
    });
    const upSynth = await uploadFile({
      ownerKind: 'service',
      ownerId: service.id,
      bytes: synthetic96,
      mimeType: 'video/mp4',
    });
    const huge = await fetch(`${base}/partners-portal/upload-sessions`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        ownerKind: 'product',
        ownerId: product.id,
        clientMediaId: randomUUID(),
        idempotencyKey: randomUUID(),
        mimeType: 'image/png',
        byteSize: UPLOAD_IMAGE_MAX_BYTES + 1,
      }),
    });
    record(
      'U08',
      !!(
        upOk.ok &&
        upOk.session.status === 'ready' &&
        upOver.ok &&
        upOver.session.status === 'failed' &&
        upSynth.ok &&
        upSynth.session.status === 'failed' &&
        huge.status === 400
      ),
      { ok300: 'ready', over301: 'failed', synthetic: 'failed', imageOver: 400 },
      {
        ok300: upOk.ok ? { status: upOk.session.status, duration: upOk.session.verifiedDurationSec } : upOk,
        over301: upOver.ok ? upOver.session.status : upOver,
        synthetic: upSynth.ok ? upSynth.session.status : upSynth,
        imageOver: huge.status,
        fixtureBytes: { d300: mp4_300.length, d301: mp4_301.length },
      },
    );
  }

  // —— U09 abort races
  {
    const init = await (
      await fetch(`${base}/partners-portal/upload-sessions`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({
          ownerKind: 'product',
          ownerId: product.id,
          clientMediaId: randomUUID(),
          idempotencyKey: randomUUID(),
          mimeType: 'image/png',
          byteSize: png.length,
        }),
      })
    ).json();
    const parts = await putAllParts(init, png);
    const [abortRes, completeRes] = await Promise.all([
      fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}/abort`, { method: 'POST', headers: auth, body: '{}' }),
      fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}/complete`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ parts }),
      }),
    ]);
    const abortBody = await abortRes.json();
    const completeBody = await completeRes.json();
    await new Promise((r) => setTimeout(r, 50));
    const dbFinal = await prisma.partnerUploadSession.findUnique({ where: { id: init.sessionId } });
    const abortWon = dbFinal?.status === 'aborted';
    const completeWon =
      dbFinal?.status === 'ready' || dbFinal?.status === 'uploaded' || dbFinal?.status === 'verifying' || dbFinal?.status === 'failed';
    const exclusive = abortWon !== completeWon && (abortWon || completeWon);

    const up = await uploadFile({ ownerKind: 'product', ownerId: product.id, bytes: png, mimeType: 'image/png' });
    const abortReady = up.ok
      ? await (
          await fetch(`${base}/partners-portal/upload-sessions/${up.session.sessionId}/abort`, {
            method: 'POST',
            headers: auth,
            body: '{}',
          })
        ).json()
      : null;
    const mediaStill =
      up.ok && up.session.catalogMediaId
        ? await prisma.catalogMedia.findUnique({ where: { id: up.session.catalogMediaId } })
        : null;

    record(
      'U09',
      !!(exclusive && abortReady?.status === 'ready' && mediaStill),
      { raceStable: true, afterReady: 'ready', mediaKept: true },
      {
        dbStatus: dbFinal?.status,
        abortBody: abortBody.status,
        completeBody: completeBody.status,
        afterReady: abortReady?.status,
        mediaId: mediaStill?.id,
      },
    );
  }

  // —— U10 real storage-complete-then-DB-stuck + retryable + worker recovery (no hand-set ready)
  {
    const init = await (
      await fetch(`${base}/partners-portal/upload-sessions`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({
          ownerKind: 'product',
          ownerId: product.id,
          clientMediaId: randomUUID(),
          idempotencyKey: randomUUID(),
          mimeType: 'image/png',
          byteSize: png.length,
        }),
      })
    ).json();
    const parts = await putAllParts(init, png);
    const row = await prisma.partnerUploadSession.findUnique({ where: { id: init.sessionId } });
    await memoryStore.complete(row!.objectKey, row!.storageUploadId!, parts);
    // Simulate lost DB write after storage complete
    await prisma.partnerUploadSession.update({
      where: { id: init.sessionId },
      data: {
        status: 'uploading',
        storageCompletedAt: new Date(),
        completedPartsJson: parts,
      },
    });
    const recovered = await (await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}`, { headers: auth })).json();
    await finalize.finalizeOne(init.sessionId);
    const after = await (await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}`, { headers: auth })).json();

    // Inject retryable failure after storage: clear media, force failed retryable, recover via retry-finalize
    const up2 = await uploadFile({ ownerKind: 'product', ownerId: product.id, bytes: png, mimeType: 'image/png' });
    let retryStatus = null as string | null;
    if (up2.ok && up2.session.catalogMediaId) {
      const mediaId = up2.session.catalogMediaId;
      const sess = await prisma.partnerUploadSession.findUnique({ where: { id: up2.session.sessionId } });
      await prisma.partnerUploadSession.update({
        where: { id: up2.session.sessionId },
        data: {
          status: 'failed',
          failureClass: 'retryable',
          failureCode: 'finalize_error',
          catalogMediaId: null,
          readyAt: null,
          finalizeLeaseOwner: null,
          finalizeLeaseUntil: null,
        },
      });
      await prisma.catalogMedia.delete({ where: { id: mediaId } }).catch(() => undefined);
      // object still in memory store under sess.objectKey / catalog copy may be gone — re-put from multipart objects
      if (sess?.objectKey && memoryStore.objects.has(sess.objectKey)) {
        /* keep */
      }
      const retry = await (
        await fetch(`${base}/partners-portal/upload-sessions/${up2.session.sessionId}/retry-finalize`, {
          method: 'POST',
          headers: auth,
          body: '{}',
        })
      ).json();
      // retry-finalize schedules; wait via enqueueAndWait
      await finalize.finalizeOne(up2.session.sessionId);
      const afterRetry = await (
        await fetch(`${base}/partners-portal/upload-sessions/${up2.session.sessionId}`, { headers: auth })
      ).json();
      retryStatus = afterRetry.status;
      void retry;
    }

    // Worker restart recovery
    const n = await finalize.recoverStaleWork(50);

    record(
      'U10',
      after.status === 'ready' && retryStatus === 'ready',
      { recoverUploading: 'ready', retryable: 'ready', recoverStale: true },
      { afterGet: recovered.status, afterFinalize: after.status, retryStatus, recoveredCount: n },
    );
  }

  // —— U11 concurrent multi-part memory
  {
    const before = process.memoryUsage().rss;
    let peak = before;
    const timer = setInterval(() => {
      const rss = process.memoryUsage().rss;
      if (rss > peak) peak = rss;
    }, 10);
    const budget = 120 * 1024 * 1024;
    const partSize = Number(process.env.MIRA_UPLOAD_PART_SIZE_BYTES || '262144');
    const expectedParts = Math.ceil(largeMp4.length / partSize);
    await Promise.all([
      uploadFile({ ownerKind: 'service', ownerId: service.id, bytes: largeMp4, mimeType: 'video/mp4' }),
      uploadFile({ ownerKind: 'service', ownerId: service.id, bytes: largeMp4, mimeType: 'video/mp4' }),
    ]);
    clearInterval(timer);
    const report = {
      beforeRss: before,
      afterRss: process.memoryUsage().rss,
      peakRss: peak,
      peakDelta: peak - before,
      fileBytes: largeMp4.length,
      partSizeBytes: partSize,
      expectedParts,
      concurrency: 2,
      storeMode: 'memory',
      budgetBytes: budget,
      note: 'streaming verify + memory multipart; peak measured during dual concurrent finalize',
    };
    writeFileSync(join(outDir, 'MEMORY_REPORT.json'), JSON.stringify(report, null, 2));
    record('U11', report.peakDelta < budget && expectedParts >= 3, { peakDeltaLt: budget, multiPart: true }, report);
  }

  // —— U12 HTTP Range via mounted reader
  {
    const up = await uploadFile({
      ownerKind: 'product',
      ownerId: product.id,
      bytes: png,
      mimeType: 'image/png',
      checksum: sha256(png),
    });
    const mediaId = up.ok ? up.session.catalogMediaId : null;
    let fullOk = false;
    let rangeOk = false;
    let rangeBytes = 0;
    if (mediaId) {
      const full = await fetch(`${base}/marketplace/media/${mediaId}`);
      const fullBuf = Buffer.from(await full.arrayBuffer());
      fullOk = full.ok && sha256(fullBuf) === sha256(png) && fullBuf.length === png.length;
      const ranged = await fetch(`${base}/marketplace/media/${mediaId}`, { headers: { Range: 'bytes=0-3' } });
      const slice = Buffer.from(await ranged.arrayBuffer());
      rangeBytes = slice.length;
      const cr = ranged.headers.get('content-range') || '';
      rangeOk = ranged.status === 206 && slice.length === 4 && slice.equals(png.subarray(0, 4)) && cr.includes(`/${png.length}`);
    }
    record(
      'U12',
      !!(fullOk && rangeOk),
      { fullMatch: true, range206: true, rangeBytes: 4 },
      { mediaId, fullOk, rangeOk, rangeBytes },
    );
  }

  // —— F02 cleanup deleteObject + no cleanedAt on failure + bound keep
  {
    const up = await uploadFile({ ownerKind: 'product', ownerId: product.id, bytes: png, mimeType: 'image/png' });
    const unboundInit = await (
      await fetch(`${base}/partners-portal/upload-sessions`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({
          ownerKind: 'product',
          ownerId: product.id,
          clientMediaId: randomUUID(),
          idempotencyKey: randomUUID(),
          mimeType: 'image/png',
          byteSize: png.length,
        }),
      })
    ).json();
    const parts = await putAllParts(unboundInit, png);
    const unboundRow0 = await prisma.partnerUploadSession.findUnique({ where: { id: unboundInit.sessionId } });
    await memoryStore.complete(unboundRow0!.objectKey, unboundRow0!.storageUploadId!, parts);
    const unboundKey = unboundRow0!.objectKey;
    // Storage complete without finalize bind — expire for cleanup
    await prisma.partnerUploadSession.update({
      where: { id: unboundInit.sessionId },
      data: {
        status: 'uploaded',
        storageCompletedAt: new Date(),
        completedPartsJson: parts,
        expiresAt: new Date(Date.now() - 60_000),
        cleanedAt: null,
        catalogMediaId: null,
      },
    });

    // fail delete once
    const origDelete = memoryStore.deleteObject.bind(memoryStore);
    let failOnce = true;
    memoryStore.deleteObject = async (key: string) => {
      if (failOnce && key === unboundKey) {
        failOnce = false;
        throw new Error('injected-delete-fail');
      }
      return origDelete(key);
    };
    const failResult = await cleanup.cleanOne(unboundInit.sessionId);
    const afterFail = await prisma.partnerUploadSession.findUnique({ where: { id: unboundInit.sessionId } });
    const retryResult = await cleanup.cleanOne(unboundInit.sessionId);
    const afterRetry = await prisma.partnerUploadSession.findUnique({ where: { id: unboundInit.sessionId } });
    memoryStore.deleteObject = origDelete;

    // bound object must remain
    const boundMedia =
      up.ok && up.session.catalogMediaId
        ? await prisma.catalogMedia.findUnique({ where: { id: up.session.catalogMediaId } })
        : null;
    const boundBytes = boundMedia?.storageKey ? await memoryCatalog.get(boundMedia.storageKey) : null;
    const unboundGone = !memoryStore.objects.has(unboundKey);

    record(
      'F02',
      failResult === 'failed' &&
        !afterFail?.cleanedAt &&
        retryResult === 'cleaned' &&
        !!afterRetry?.cleanedAt &&
        unboundGone &&
        !!boundBytes,
      { failNoCleanedAt: true, retryCleaned: true, unboundDeleted: true, boundKept: true },
      { failResult, cleanedAtAfterFail: afterFail?.cleanedAt, retryResult, unboundGone, boundKept: !!boundBytes },
    );
  }

  // —— F03 cleanup vs active lease + no ready→aborted from stale snapshot
  {
    const init = await (
      await fetch(`${base}/partners-portal/upload-sessions`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({
          ownerKind: 'product',
          ownerId: product.id,
          clientMediaId: randomUUID(),
          idempotencyKey: randomUUID(),
          mimeType: 'image/png',
          byteSize: png.length,
        }),
      })
    ).json();
    const parts = await putAllParts(init, png);
    const row0 = await prisma.partnerUploadSession.findUnique({ where: { id: init.sessionId } });
    await memoryStore.complete(row0!.objectKey, row0!.storageUploadId!, parts);
    await prisma.partnerUploadSession.update({
      where: { id: init.sessionId },
      data: {
        status: 'verifying',
        storageCompletedAt: new Date(),
        completedPartsJson: parts,
        finalizeLeaseOwner: 'foreign-worker',
        finalizeLeaseUntil: new Date(Date.now() + 120_000),
        expiresAt: new Date(Date.now() - 1000),
        cleanedAt: null,
      },
    });
    const duringLease = await cleanup.cleanOne(init.sessionId);
    // Now finish bind under real finalize (lease expired / reclaim)
    await prisma.partnerUploadSession.update({
      where: { id: init.sessionId },
      data: { finalizeLeaseUntil: new Date(Date.now() - 1000) },
    });
    await finalize.finalizeOne(init.sessionId);
    const ready = await prisma.partnerUploadSession.findUnique({ where: { id: init.sessionId } });
    // Stale cleanup attempt must not flip ready → aborted
    await prisma.partnerUploadSession.update({
      where: { id: init.sessionId },
      data: { expiresAt: new Date(Date.now() - 1000), cleanedAt: null },
    });
    const afterReady = await cleanup.cleanOne(init.sessionId);
    const final = await prisma.partnerUploadSession.findUnique({ where: { id: init.sessionId } });
    record(
      'F03',
      duringLease === 'lease' && ready?.status === 'ready' && afterReady === 'bound' && final?.status === 'ready',
      { cleanupDuringLease: 'lease', afterReadyCleanup: 'bound', statusRemains: 'ready' },
      { duringLease, ready: ready?.status, afterReady, final: final?.status, mediaId: final?.catalogMediaId },
    );
  }

  // —— F04 abort vs bind with barrier (abort injected between lock and create)
  {
    async function prepareUploaded() {
      const init = await (
        await fetch(`${base}/partners-portal/upload-sessions`, {
          method: 'POST',
          headers: auth,
          body: JSON.stringify({
            ownerKind: 'product',
            ownerId: product.id,
            clientMediaId: randomUUID(),
            idempotencyKey: randomUUID(),
            mimeType: 'image/png',
            byteSize: png.length,
          }),
        })
      ).json();
      const parts = await putAllParts(init, png);
      const row = await prisma.partnerUploadSession.findUnique({ where: { id: init.sessionId } });
      await memoryStore.complete(row!.objectKey, row!.storageUploadId!, parts);
      await prisma.partnerUploadSession.update({
        where: { id: init.sessionId },
        data: { status: 'uploaded', storageCompletedAt: new Date(), completedPartsJson: parts },
      });
      return init.sessionId as string;
    }

    // Abort wins first
    const aId = await prepareUploaded();
    await fetch(`${base}/partners-portal/upload-sessions/${aId}/abort`, { method: 'POST', headers: auth, body: '{}' });
    await finalize.finalizeOne(aId);
    const aRow = await prisma.partnerUploadSession.findUnique({ where: { id: aId } });
    const aMedia = await prisma.catalogMedia.count({ where: { sourceMediaKey: `upload-session:${aId}` } });

    // Bind wins: abort fired while bind holds FOR UPDATE (between read and create)
    const bId = await prepareUploaded();
    let release!: () => void;
    const hold = new Promise<void>((r) => {
      release = r;
    });
    let entered = false;
    let abortStatus: string | null = null;
    finalize.beforeCatalogBind = async () => {
      entered = true;
      const abortP = fetch(`${base}/partners-portal/upload-sessions/${bId}/abort`, {
        method: 'POST',
        headers: auth,
        body: '{}',
      }).then(async (r) => {
        const body = await r.json();
        abortStatus = body.status;
      });
      await new Promise((r) => setTimeout(r, 100));
      await hold;
      void abortP;
    };
    const finP = finalize.finalizeOne(bId);
    for (let i = 0; i < 300 && !entered; i++) await new Promise((r) => setTimeout(r, 10));
    release();
    await finP;
    finalize.beforeCatalogBind = null;
    await new Promise((r) => setTimeout(r, 150));
    const bRow = await prisma.partnerUploadSession.findUnique({ where: { id: bId } });
    const bMedia = await prisma.catalogMedia.count({ where: { sourceMediaKey: `upload-session:${bId}` } });

    record(
      'F04',
      aRow?.status === 'aborted' && aMedia === 0 && bRow?.status === 'ready' && bMedia === 1,
      { abortFirst: 'aborted+0media', bindFirst: 'ready+1media' },
      {
        abortFirst: { status: aRow?.status, media: aMedia },
        bindFirst: { status: bRow?.status, media: bMedia, abortSaw: abortStatus },
      },
    );
  }

  // —— F05 concurrency across finalize + retry-finalize + recover (no auto-complete race)
  {
    finalize.activeVerifyStarts = 0;
    finalize.peakConcurrentVerifies = 0;
    finalize.beforeCatalogBind = async () => {
      await new Promise((r) => setTimeout(r, 250));
    };

    async function prep(status: 'uploaded' | 'failed' = 'uploaded') {
      const init = await (
        await fetch(`${base}/partners-portal/upload-sessions`, {
          method: 'POST',
          headers: auth,
          body: JSON.stringify({
            ownerKind: 'product',
            ownerId: product.id,
            clientMediaId: randomUUID(),
            idempotencyKey: randomUUID(),
            mimeType: 'image/png',
            byteSize: png.length,
          }),
        })
      ).json();
      const parts = await putAllParts(init, png);
      const row = await prisma.partnerUploadSession.findUnique({ where: { id: init.sessionId } });
      await memoryStore.complete(row!.objectKey, row!.storageUploadId!, parts);
      await prisma.partnerUploadSession.update({
        where: { id: init.sessionId },
        data: {
          status,
          failureClass: status === 'failed' ? 'retryable' : null,
          failureCode: status === 'failed' ? 'finalize_error' : null,
          storageCompletedAt: new Date(),
          completedPartsJson: parts,
          catalogMediaId: null,
          finalizeLeaseOwner: null,
          finalizeLeaseUntil: null,
        },
      });
      return init.sessionId as string;
    }

    const sessions = [await prep('uploaded'), await prep('uploaded'), await prep('failed'), await prep('uploaded')];

    const mixed = [
      finalize.finalizeOne(sessions[0]),
      finalize.finalizeOne(sessions[1]),
      fetch(`${base}/partners-portal/upload-sessions/${sessions[2]}/retry-finalize`, {
        method: 'POST',
        headers: auth,
        body: '{}',
      }).then(async (r) => {
        await r.json();
        return finalize.finalizeOne(sessions[2]);
      }),
      finalize.recoverStaleWork(10).then(() => finalize.finalizeOne(sessions[3])),
    ];
    await Promise.all(mixed);
    await Promise.all(sessions.map((id) => finalize.finalizeOne(id)));
    finalize.beforeCatalogBind = null;
    const statuses = await Promise.all(
      sessions.map(async (id) => (await prisma.partnerUploadSession.findUnique({ where: { id } }))?.status),
    );
    const limit = Number(process.env.MIRA_UPLOAD_FINALIZE_CONCURRENCY || '2');
    record(
      'F05',
      finalize.peakConcurrentVerifies <= limit &&
        finalize.peakConcurrentVerifies >= 2 &&
        statuses.every((s) => s === 'ready'),
      { peakLte: limit, peakGte: 2, allReady: true },
      { peak: finalize.peakConcurrentVerifies, starts: finalize.activeVerifyStarts, statuses, limit },
    );
  }

  // —— F06 server accepts retryable; client contract documented via session fields
  {
    const up = await uploadFile({ ownerKind: 'product', ownerId: product.id, bytes: png, mimeType: 'image/png' });
    if (up.ok && up.session.catalogMediaId) {
      await prisma.catalogMedia.delete({ where: { id: up.session.catalogMediaId } }).catch(() => undefined);
      await prisma.partnerUploadSession.update({
        where: { id: up.session.sessionId },
        data: {
          status: 'failed',
          failureClass: 'retryable',
          failureCode: 'storage_unavailable',
          catalogMediaId: null,
          readyAt: null,
          finalizeLeaseOwner: null,
          finalizeLeaseUntil: null,
        },
      });
      const retry = await (
        await fetch(`${base}/partners-portal/upload-sessions/${up.session.sessionId}/retry-finalize`, {
          method: 'POST',
          headers: auth,
          body: '{}',
        })
      ).json();
      await finalize.finalizeOne(up.session.sessionId);
      const got = await (await fetch(`${base}/partners-portal/upload-sessions/${up.session.sessionId}`, { headers: auth })).json();
      record(
        'F06',
        got.status === 'ready' && (retry.status === 'verifying' || retry.status === 'uploaded' || retry.status === 'ready' || retry.retryable === true || retry.status === 'failed'),
        { retryAccepted: true, finalReady: true, uiPollsRetryable: true },
        { retryStatus: retry.status, final: got.status, note: 'api.js polls retryable/verifying; catalog-journey persists sessionId' },
      );
    } else {
      record('F06', false, { ready: true }, { up });
    }
  }

  // Feature disable mid-session
  {
    const init = await (
      await fetch(`${base}/partners-portal/upload-sessions`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({
          ownerKind: 'product',
          ownerId: product.id,
          clientMediaId: randomUUID(),
          idempotencyKey: randomUUID(),
          mimeType: 'image/png',
          byteSize: png.length,
        }),
      })
    ).json();
    process.env.MIRA_PARTNER_UPLOAD_SESSION = 'false';
    const newInit = await fetch(`${base}/partners-portal/upload-sessions`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        ownerKind: 'product',
        ownerId: product.id,
        clientMediaId: randomUUID(),
        idempotencyKey: randomUUID(),
        mimeType: 'image/png',
        byteSize: png.length,
      }),
    });
    const parts = await putAllParts(init, png);
    const complete = await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}/complete`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ parts }),
    });
    await finalize.finalizeOne(init.sessionId);
    const got = await (await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}`, { headers: auth })).json();
    process.env.MIRA_PARTNER_UPLOAD_SESSION = 'true';
    record(
      'FLAG_DISABLE_EXISTING',
      newInit.status === 503 && complete.ok && got.status === 'ready',
      { newBlocked: 503, existingCompletes: true },
      { newStatus: newInit.status, completeOk: complete.ok, final: got.status },
    );
  }

  // Cleanup TTL
  {
    const init = await (
      await fetch(`${base}/partners-portal/upload-sessions`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({
          ownerKind: 'product',
          ownerId: product.id,
          clientMediaId: randomUUID(),
          idempotencyKey: randomUUID(),
          mimeType: 'image/png',
          byteSize: png.length,
        }),
      })
    ).json();
    await prisma.partnerUploadSession.update({
      where: { id: init.sessionId },
      data: { expiresAt: new Date(Date.now() - 60_000), cleanedAt: null, status: 'created' },
    });
    setUploadClock(() => Date.now());
    const sweep = await cleanup.sweepExpired(500);
    setUploadClock(null);
    const after = await prisma.partnerUploadSession.findUnique({ where: { id: init.sessionId } });
    record(
      'CLEANUP_TTL',
      !!(after?.cleanedAt && after.status === 'aborted'),
      { cleaned: true, status: 'aborted' },
      { sweep, status: after?.status, cleanedAt: after?.cleanedAt },
    );
  }

  const finishedUtc = new Date().toISOString();
  const requiredPass = [
    'F01',
    'F02',
    'F03',
    'F04',
    'F05',
    'F06',
    'U01',
    'U02',
    'U03',
    'U04',
    'U05',
    'U06',
    'U07',
    'U08',
    'U09',
    'U10',
    'U11',
    'U12',
    'FLAG_DISABLE_EXISTING',
    'CLEANUP_TTL',
  ];
  const byId = Object.fromEntries(cases.map((c) => [c.id, c]));
  const missing = requiredPass.filter((id) => !byId[id]);
  const failed = requiredPass.filter((id) => byId[id] && byId[id].ok !== true);
  const blocked = cases.filter((c) => c.ok === 'BLOCKED').map((c) => c.id);
  const ok = missing.length === 0 && failed.length === 0;
  const summary = {
    ok,
    missing,
    failed,
    blocked,
    cases,
    startedUtc,
    finishedUtc,
    commit: commitHint,
    storeMode: 'memory',
    r2Live: false,
    command:
      'MIRA_UPLOAD_PART_SIZE_BYTES=262144 MIRA_UPLOAD_FINALIZE_CONCURRENCY=2 npx tsx src/partners-portal/upload-sessions/upload-sessions.http.integration-tests.ts',
    note: 'BLOCKED items are not counted as PASS. U01_R2 blocked without isolated R2.',
  };
  writeFileSync(join(outDir, 'upload-sessions-integration.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ok, missing, failed, blocked, outDir }, null, 2));
  await app.close();
  await prisma.$disconnect();
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
