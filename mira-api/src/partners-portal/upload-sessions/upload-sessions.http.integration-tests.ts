/**
 * P2.1 UploadSession acceptance (U01–U12) — memory multipart adapter.
 * Live R2 is NOT claimed here.
 */
import 'reflect-metadata';
import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { json, raw, type NextFunction, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { CatalogMediaStorage, MemoryCatalogMediaStorage } from '../../marketplace/catalog-media.storage';
import { PartnerTokenGuard } from '../guards/partner-token.guard';
import { MemoryMultipartUploadStore, MultipartUploadStore } from './multipart.store';
import { UploadFinalizeService } from './upload-finalize.service';
import { UploadSessionsController } from './upload-sessions.controller';
import { UploadSessionsService } from './upload-sessions.service';
import { UPLOAD_IMAGE_MAX_BYTES, UPLOAD_PART_SIZE_BYTES } from './upload-sessions.policy';

process.env.MIRA_PARTNER_UPLOAD_SESSION = 'true';
process.env.NODE_ENV = 'test';

const outDir =
  process.env.MIRA_P21_OUT_DIR || join(process.cwd(), '..', 'audit-out', 'p2-1', 'logs', 'integration');
mkdirSync(outDir, { recursive: true });

type Case = { id: string; ok: boolean; expected: unknown; actual: unknown; detail?: string };
const cases: Case[] = [];
const startedUtc = new Date().toISOString();

function record(id: string, ok: boolean, expected: unknown, actual: unknown, detail?: string) {
  cases.push({ id, ok, expected, actual, detail });
  console.log(JSON.stringify({ id, ok, detail: detail || null }));
}

function pngBytes(): Buffer {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
}

function box(type: string, payload: Buffer): Buffer {
  const size = 8 + payload.length;
  const header = Buffer.alloc(8);
  header.writeUInt32BE(size, 0);
  header.write(type, 4, 4, 'latin1');
  return Buffer.concat([header, payload]);
}

function mvhd(timescale: number, duration: number): Buffer {
  const payload = Buffer.alloc(20);
  payload.writeUInt32BE(timescale, 12);
  payload.writeUInt32BE(duration, 16);
  return box('mvhd', payload);
}

function mp4Seconds(seconds: number): Buffer {
  return Buffer.concat([box('ftyp', Buffer.from('isom')), box('moov', mvhd(1000, Math.round(seconds * 1000)))]);
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
  controllers: [UploadSessionsController],
  providers: [
    PartnerTokenGuard,
    UploadSessionsService,
    UploadFinalizeService,
    { provide: MultipartUploadStore, useClass: MemoryMultipartUploadStore },
    { provide: CatalogMediaStorage, useClass: MemoryCatalogMediaStorage },
  ],
})
class UploadSessionTestModule {}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE non-local DATABASE_URL');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const brand = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `P21 Brand ${suffix}`, nameEn: 'P21', city: 'الرياض' },
  });
  const other = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `P21 Other ${suffix}`, nameEn: 'Other', city: 'جدة' },
  });
  const token = `token-p21-${suffix}`;
  const otherToken = `token-p21-other-${suffix}`;
  await prisma.partnerUser.create({
    data: { partnerId: brand.id, email: `p21-${suffix}@test.local`, accessToken: token },
  });
  await prisma.partnerUser.create({
    data: { partnerId: other.id, email: `p21-other-${suffix}@test.local`, accessToken: otherToken },
  });
  const product = await prisma.product.create({
    data: {
      partnerId: brand.id,
      nameAr: 'منتج P21',
      nameEn: 'P21',
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
      nameAr: 'خدمة P21',
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
      nameAr: 'منتج آخر',
      nameEn: 'O',
      priceHalalas: 1000,
      externalUrl: '',
      concernTags: [],
      skinTypes: [],
      contentStatus: 'draft',
      reviewStatus: 'draft',
    },
  });

  const app = await NestFactory.create(UploadSessionTestModule, { bodyParser: false, logger: ['error'] });
  app.use((req: Request, res: Response, next: NextFunction) => {
    const path = (req.originalUrl || req.url || '').split('?')[0];
    if (req.method === 'PUT' && /\/upload-sessions\/[^/]+\/direct-parts\/\d+$/.test(path)) {
      return raw({ type: '*/*', limit: '32mb' })(req, res, next);
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
  const memoryCatalog = app.get(CatalogMediaStorage) as MemoryCatalogMediaStorage;
  const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

  async function abs(url: string) {
    return url.startsWith('http') ? url : `http://127.0.0.1:${port}${url.startsWith('/') ? url : '/' + url}`;
  }

  async function uploadFile(opts: {
    ownerKind: 'product' | 'service';
    ownerId: string;
    bytes: Buffer;
    mimeType: string;
    idempotencyKey?: string;
    clientMediaId?: string;
    failPart?: number;
    doubleComplete?: boolean;
    doubleFinalize?: boolean;
  }) {
    const clientMediaId = opts.clientMediaId || randomUUID();
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
      }),
    });
    const session = await initRes.json();
    if (!initRes.ok) return { ok: false as const, session, status: initRes.status };

    const partSize = session.partSizeBytes || UPLOAD_PART_SIZE_BYTES;
    const completed: Array<{ partNumber: number; etag: string; size: number }> = [];
    for (let partNumber = 1; partNumber <= session.totalParts; partNumber++) {
      const start = (partNumber - 1) * partSize;
      const chunk = opts.bytes.subarray(start, Math.min(opts.bytes.length, start + partSize));
      const sign = await (
        await fetch(`${base}/partners-portal/upload-sessions/${session.sessionId}/parts/${partNumber}/sign`, {
          method: 'POST',
          headers: auth,
          body: '{}',
        })
      ).json();
      if (opts.failPart === partNumber) {
        const bad = chunk.subarray(0, Math.max(1, chunk.length - 1));
        await fetch(await abs(sign.url), {
          method: 'PUT',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream' },
          body: new Uint8Array(bad),
        });
      }
      // renew path: always re-sign once
      const sign2 = await (
        await fetch(`${base}/partners-portal/upload-sessions/${session.sessionId}/parts/${partNumber}/sign`, {
          method: 'POST',
          headers: auth,
          body: '{}',
        })
      ).json();
      const put = await fetch(await abs(sign2.url), {
        method: 'PUT',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream' },
        body: new Uint8Array(chunk),
      });
      const putBody = await put.json();
      if (!put.ok) return { ok: false as const, session, putStatus: put.status, putBody };
      completed.push({ partNumber, etag: putBody.etag, size: chunk.length });
    }

    const completeOnce = () =>
      fetch(`${base}/partners-portal/upload-sessions/${session.sessionId}/complete`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ parts: completed }),
      });
    await completeOnce();
    if (opts.doubleComplete) await completeOnce();
    await finalize.finalizeOne(session.sessionId);
    if (opts.doubleFinalize) await finalize.finalizeOne(session.sessionId);
    const got = await (await fetch(`${base}/partners-portal/upload-sessions/${session.sessionId}`, { headers: auth })).json();
    return { ok: true as const, session: got };
  }

  // U01
  {
    const img = pngBytes();
    const expectedSha = createHash('sha256').update(img).digest('hex');
    const up = await uploadFile({ ownerKind: 'product', ownerId: product.id, bytes: img, mimeType: 'image/png' });
    const media = up.ok && up.session.catalogMediaId
      ? await prisma.catalogMedia.findUnique({ where: { id: up.session.catalogMediaId } })
      : null;
    const stored = media?.storageKey ? await memoryCatalog.get(media.storageKey) : null;
    const bytesOk = !!stored && createHash('sha256').update(stored).digest('hex') === expectedSha;
    const upVid = await uploadFile({
      ownerKind: 'service',
      ownerId: service.id,
      bytes: mp4Seconds(10),
      mimeType: 'video/mp4',
    });
    record(
      'U01',
      !!(up.ok && up.session.status === 'ready' && media?.ownerId === product.id && bytesOk && upVid.ok && upVid.session.status === 'ready'),
      { imageReady: true, bytesMatch: true, videoReady: true },
      {
        image: up.ok ? up.session.status : up,
        owner: media?.ownerId,
        bytesOk,
        video: upVid.ok ? upVid.session.status : upVid,
      },
    );
  }

  // U02
  {
    const up = await uploadFile({
      ownerKind: 'product',
      ownerId: product.id,
      bytes: pngBytes(),
      mimeType: 'image/png',
      failPart: 1,
    });
    record('U02', !!(up.ok && up.session.status === 'ready'), { status: 'ready' }, { status: up.ok ? up.session.status : up });
  }

  // U03 (resign covered in uploadFile loop)
  {
    const up = await uploadFile({ ownerKind: 'product', ownerId: product.id, bytes: pngBytes(), mimeType: 'image/png' });
    record('U03', !!(up.ok && up.session.status === 'ready'), { status: 'ready' }, { status: up.ok ? up.session.status : up });
  }

  // U04 different file same size
  {
    const img = pngBytes();
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
          byteSize: img.length,
          checksum: createHash('sha256').update(img).digest('hex'),
        }),
      })
    ).json();
    const other = Buffer.alloc(img.length, 7);
    const sign = await (
      await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}/parts/1/sign`, {
        method: 'POST',
        headers: auth,
        body: '{}',
      })
    ).json();
    const put = await fetch(await abs(sign.url), {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream' },
      body: new Uint8Array(other),
    });
    const putBody = await put.json();
    await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}/complete`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ parts: [{ partNumber: 1, etag: putBody.etag, size: other.length }] }),
    });
    await finalize.finalizeOne(init.sessionId);
    const got = await (await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}`, { headers: auth })).json();
    record(
      'U04',
      got.status === 'failed' && got.failureCode === 'content_mismatch',
      { status: 'failed', failureCode: 'content_mismatch' },
      { status: got.status, failureCode: got.failureCode },
    );
  }

  // U05
  {
    const key = randomUUID();
    const up = await uploadFile({
      ownerKind: 'product',
      ownerId: product.id,
      bytes: pngBytes(),
      mimeType: 'image/png',
      idempotencyKey: key,
      clientMediaId: key,
      doubleComplete: true,
      doubleFinalize: true,
    });
    const count = up.ok
      ? await prisma.catalogMedia.count({ where: { sourceMediaKey: `upload-session:${up.session.sessionId}` } })
      : -1;
    record('U05', !!(up.ok && up.session.status === 'ready' && count === 1), { mediaRows: 1 }, { count, status: up.ok ? up.session.status : up });
  }

  // U06
  {
    const res = await fetch(`${base}/partners-portal/upload-sessions`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        ownerKind: 'product',
        ownerId: otherProduct.id,
        clientMediaId: randomUUID(),
        idempotencyKey: randomUUID(),
        mimeType: 'image/png',
        byteSize: pngBytes().length,
      }),
    });
    record('U06', res.status === 404, { status: 404 }, { status: res.status, body: await res.json() });
  }

  // U07
  {
    const bad = Buffer.from('not-an-image');
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
          byteSize: bad.length,
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
    const put = await fetch(await abs(sign.url), {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream' },
      body: new Uint8Array(bad),
    });
    const putBody = await put.json();
    await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}/complete`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ parts: [{ partNumber: 1, etag: putBody.etag, size: bad.length }] }),
    });
    await finalize.finalizeOne(init.sessionId);
    const got = await (await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}`, { headers: auth })).json();
    const productStill = await prisma.product.findUnique({ where: { id: product.id } });
    record(
      'U07',
      got.status === 'failed' && !!productStill,
      { status: 'failed', productRemains: true },
      { status: got.status, failureCode: got.failureCode, product: productStill?.nameAr },
    );
  }

  // U08
  {
    const upOk = await uploadFile({
      ownerKind: 'service',
      ownerId: service.id,
      bytes: mp4Seconds(300),
      mimeType: 'video/mp4',
    });
    const upOver = await uploadFile({
      ownerKind: 'service',
      ownerId: service.id,
      bytes: mp4Seconds(301),
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
      !!(upOk.ok && upOk.session.status === 'ready' && upOver.ok && upOver.session.status === 'failed' && huge.status === 400),
      { ok300: 'ready', over301: 'failed', imageOver: 400 },
      {
        ok300: upOk.ok ? upOk.session.status : upOk,
        over301: upOver.ok ? upOver.session.status : upOver,
        imageOver: huge.status,
      },
    );
  }

  // U09
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
          byteSize: pngBytes().length,
        }),
      })
    ).json();
    const abortBody = await (
      await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}/abort`, {
        method: 'POST',
        headers: auth,
        body: '{}',
      })
    ).json();
    const up = await uploadFile({ ownerKind: 'product', ownerId: product.id, bytes: pngBytes(), mimeType: 'image/png' });
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
      abortBody.status === 'aborted' && abortReady?.status === 'ready' && !!mediaStill,
      { early: 'aborted', afterReady: 'ready', mediaKept: true },
      { early: abortBody.status, afterReady: abortReady?.status, mediaId: mediaStill?.id },
    );
  }

  // U10
  {
    const up = await uploadFile({ ownerKind: 'product', ownerId: product.id, bytes: pngBytes(), mimeType: 'image/png' });
    if (up.ok) await finalize.finalizeOne(up.session.sessionId);
    const count = up.ok
      ? await prisma.catalogMedia.count({ where: { sourceMediaKey: `upload-session:${up.session.sessionId}` } })
      : -1;
    record('U10', !!(up.ok && up.session.status === 'ready' && count === 1), { mediaRows: 1 }, { count, status: up.ok ? up.session.status : up });
  }

  // U11
  {
    const before = process.memoryUsage().rss;
    const samples: number[] = [];
    for (let i = 0; i < 5; i++) {
      const rss0 = process.memoryUsage().rss;
      await uploadFile({ ownerKind: 'service', ownerId: service.id, bytes: mp4Seconds(15 + i), mimeType: 'video/mp4' });
      samples.push(process.memoryUsage().rss - rss0);
    }
    const report = {
      beforeRss: before,
      afterRss: process.memoryUsage().rss,
      maxPerUploadDelta: Math.max(...samples),
      samples,
      storeMode: 'memory',
      note: 'S3 finalize streams to temp file then single buffer verify; this run uses memory adapter',
    };
    writeFileSync(join(outDir, 'MEMORY_REPORT.json'), JSON.stringify(report, null, 2));
    record('U11', report.maxPerUploadDelta < 80 * 1024 * 1024, { maxDeltaLt: '80MB' }, report);
  }

  // U12 — partner media read not wired in this slim module; verify storage bytes + prior rows remain
  {
    const img = pngBytes();
    const expectedSha = createHash('sha256').update(img).digest('hex');
    const up = await uploadFile({ ownerKind: 'product', ownerId: product.id, bytes: img, mimeType: 'image/png' });
    const media =
      up.ok && up.session.catalogMediaId
        ? await prisma.catalogMedia.findUnique({ where: { id: up.session.catalogMediaId } })
        : null;
    const stored = media?.storageKey ? await memoryCatalog.get(media.storageKey) : null;
    const readOk = !!stored && createHash('sha256').update(stored).digest('hex') === expectedSha;
    const priorCount = await prisma.catalogMedia.count({
      where: { ownerKind: 'product', ownerId: product.id, kind: 'image' },
    });
    record(
      'U12',
      !!(readOk && priorCount >= 1),
      { storageReadOk: true, priorMediaKept: true },
      { readOk, priorCount, mediaId: media?.id },
      'slim module: storage-byte read stands in for GET /media; full HTTP read covered by existing catalog-media tests',
    );
  }

  const finishedUtc = new Date().toISOString();
  const required = ['U01', 'U02', 'U03', 'U04', 'U05', 'U06', 'U07', 'U08', 'U09', 'U10', 'U11', 'U12'];
  const byId = Object.fromEntries(cases.map((c) => [c.id, c]));
  const missing = required.filter((id) => !byId[id]);
  const failed = required.filter((id) => byId[id] && !byId[id].ok);
  const ok = missing.length === 0 && failed.length === 0;
  const summary = {
    ok,
    missing,
    failed,
    cases,
    startedUtc,
    finishedUtc,
    storeMode: 'memory',
    r2Live: false,
    note: 'Live R2 not exercised; memory multipart adapter. Configure MIRA_MEDIA_STORE=s3 + isolated bucket for live proof.',
  };
  writeFileSync(join(outDir, 'upload-sessions-integration.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ok, missing, failed, outDir }, null, 2));
  await app.close();
  await prisma.$disconnect();
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
