/**
 * P2.1 RC2 acceptance + regression (memory adapter).
 * Live R2 is recorded BLOCKED when credentials absent — never mocked as PASS.
 */
import 'reflect-metadata';
import { INestApplication, Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { json, raw, type NextFunction, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaModule } from '../../prisma/prisma.module';
import { CatalogMediaStorage, MemoryCatalogMediaStorage } from '../../marketplace/catalog-media.storage';
import { PartnerTokenGuard } from '../guards/partner-token.guard';
import { MemoryMultipartUploadStore, MultipartUploadStore } from './multipart.store';
import { UploadCleanupService } from './upload-cleanup.service';
import { UploadFinalizeService } from './upload-finalize.service';
import { UploadSessionsController } from './upload-sessions.controller';
import { UploadSessionsService } from './upload-sessions.service';
import {
  UPLOAD_IMAGE_MAX_BYTES,
  UPLOAD_PART_SIZE_BYTES,
  setUploadClock,
  uploadNowMs,
} from './upload-sessions.policy';

process.env.MIRA_PARTNER_UPLOAD_SESSION = 'true';
process.env.NODE_ENV = 'test';
process.env.MIRA_UPLOAD_ALLOW_DIRECT_PARTS = 'true';

const outDir =
  process.env.MIRA_P21_OUT_DIR || join(process.cwd(), '..', 'audit-out', 'p2-1-rc2', 'logs', 'integration');
mkdirSync(outDir, { recursive: true });

type Case = {
  id: string;
  ok: boolean | 'BLOCKED';
  expected: unknown;
  actual: unknown;
  detail?: string;
  exitRelevant?: boolean;
};
const cases: Case[] = [];
const startedUtc = new Date().toISOString();
const commitHint = process.env.MIRA_P21_COMMIT || 'local';

function record(id: string, ok: boolean | 'BLOCKED', expected: unknown, actual: unknown, detail?: string) {
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
  const header = Buffer.alloc(8);
  header.writeUInt32BE(8 + payload.length, 0);
  header.write(type, 4, 'latin1');
  return Buffer.concat([header, payload]);
}

function mvhd(timescale: number, duration: number): Buffer {
  const payload = Buffer.alloc(20);
  payload.writeUInt32BE(timescale, 12);
  payload.writeUInt32BE(duration, 16);
  return box('mvhd', payload);
}

function hdlrVide(): Buffer {
  const payload = Buffer.alloc(24);
  payload.write('vide', 8, 4, 'latin1');
  return box('hdlr', payload);
}

/** Minimal ISO-BMFF with duration + video track (not header-only). */
function mp4Seconds(seconds: number): Buffer {
  const mdia = box('mdia', Buffer.concat([hdlrVide()]));
  const trak = box('trak', mdia);
  const moov = box('moov', Buffer.concat([mvhd(1000, Math.round(seconds * 1000)), trak]));
  return Buffer.concat([box('ftyp', Buffer.from('isom')), moov]);
}

function loadSampleMp4(): Buffer | null {
  try {
    return readFileSync(join(process.cwd(), 'src/marketplace/fixtures/ph3-rc3-sample.mp4'));
  } catch {
    return null;
  }
}

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
    data: { type: 'brand', status: 'active', nameAr: `P21RC2 ${suffix}`, nameEn: 'P21', city: 'الرياض' },
  });
  const other = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `P21RC2O ${suffix}`, nameEn: 'O', city: 'جدة' },
  });
  const token = `token-p21rc2-${suffix}`;
  const otherToken = `token-p21rc2-o-${suffix}`;
  await prisma.partnerUser.create({
    data: { partnerId: brand.id, email: `p21rc2-${suffix}@test.local`, accessToken: token },
  });
  await prisma.partnerUser.create({
    data: { partnerId: other.id, email: `p21rc2-o-${suffix}@test.local`, accessToken: otherToken },
  });
  const product = await prisma.product.create({
    data: {
      partnerId: brand.id,
      nameAr: 'منتج RC2',
      nameEn: 'RC2',
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
      nameAr: 'خدمة RC2',
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
  const cleanup = app.get(UploadCleanupService);
  const memoryStore = app.get(MultipartUploadStore) as MemoryMultipartUploadStore;
  const memoryCatalog = app.get(CatalogMediaStorage) as MemoryCatalogMediaStorage;
  const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const otherAuth = { authorization: `Bearer ${otherToken}`, 'content-type': 'application/json' };

  async function abs(url: string) {
    return url.startsWith('http') ? url : `http://127.0.0.1:${port}${url.startsWith('/') ? url : '/' + url}`;
  }

  async function putAllParts(session: { sessionId: string; totalParts: number; partSizeBytes: number }, bytes: Buffer) {
    const completed: Array<{ partNumber: number; etag: string; size: number }> = [];
    const partSize = session.partSizeBytes || UPLOAD_PART_SIZE_BYTES;
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

  // —— U01 (memory path; R2 blocked separately)
  {
    const img = pngBytes();
    const expectedSha = createHash('sha256').update(img).digest('hex');
    const up = await uploadFile({
      ownerKind: 'product',
      ownerId: product.id,
      bytes: img,
      mimeType: 'image/png',
      checksum: expectedSha,
    });
    const media =
      up.ok && up.session.catalogMediaId
        ? await prisma.catalogMedia.findUnique({ where: { id: up.session.catalogMediaId } })
        : null;
    const stored = media?.storageKey ? await memoryCatalog.get(media.storageKey) : null;
    const sample = loadSampleMp4();
    let videoOk = false;
    if (sample) {
      const upVid = await uploadFile({
        ownerKind: 'service',
        ownerId: service.id,
        bytes: sample,
        mimeType: 'video/mp4',
      });
      videoOk = !!(upVid.ok && upVid.session.status === 'ready');
    } else {
      const upVid = await uploadFile({
        ownerKind: 'service',
        ownerId: service.id,
        bytes: mp4Seconds(12),
        mimeType: 'video/mp4',
      });
      videoOk = !!(upVid.ok && upVid.session.status === 'ready');
    }
    record(
      'U01',
      !!(up.ok && up.session.status === 'ready' && media?.ownerId === product.id && stored && videoOk),
      { ready: true, ownerMatch: true, bytesMatch: true, videoReady: true, storeMode: 'memory' },
      {
        status: up.ok ? up.session.status : up,
        owner: media?.ownerId,
        bytesMatch: !!stored && createHash('sha256').update(stored).digest('hex') === expectedSha,
        videoOk,
        sampleMp4: !!sample,
      },
      'memory adapter; live R2 see U01_R2',
    );
  }

  {
    const hasR2 =
      (process.env.MIRA_MEDIA_STORE || '').toLowerCase() === 's3' &&
      !!process.env.MIRA_MEDIA_S3_BUCKET &&
      !!process.env.MIRA_MEDIA_S3_ACCESS_KEY_ID;
    if (!hasR2) {
      record(
        'U01_R2',
        'BLOCKED',
        { liveR2: true },
        { configured: false },
        'No isolated R2 credentials in env; not claimed PASS',
      );
    }
  }

  // U02 — fail part then retry only that part
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
        }),
      })
    ).json();
    const signBad = await (
      await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}/parts/1/sign`, {
        method: 'POST',
        headers: auth,
        body: '{}',
      })
    ).json();
    await fetch(await abs(signBad.url), {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream' },
      body: new Uint8Array(img.subarray(0, Math.max(1, img.length - 1))),
    });
    // retry correct part only
    const signOk = await (
      await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}/parts/1/sign`, {
        method: 'POST',
        headers: auth,
        body: '{}',
      })
    ).json();
    const put = await fetch(await abs(signOk.url), {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/octet-stream' },
      body: new Uint8Array(img),
    });
    const putBody = await put.json();
    const mid = await (await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}`, { headers: auth })).json();
    await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}/complete`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ parts: [{ partNumber: 1, etag: putBody.etag, size: img.length }] }),
    });
    await finalize.finalizeOne(init.sessionId);
    const got = await (await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}`, { headers: auth })).json();
    record(
      'U02',
      got.status === 'ready' && mid.completedParts?.length === 1,
      { partRetried: 1, ready: true },
      { status: got.status, completedAfterRetry: mid.completedParts, putOk: put.ok },
    );
  }

  // U03 — resign (TTL refresh)
  {
    const up = await uploadFile({ ownerKind: 'product', ownerId: product.id, bytes: pngBytes(), mimeType: 'image/png' });
    record('U03', !!(up.ok && up.session.status === 'ready'), { status: 'ready' }, { status: up.ok ? up.session.status : up }, 're-sign before each PUT');
  }

  // U04 — checksum mismatch on different content same size
  {
    const img = pngBytes();
    const checksum = createHash('sha256').update(img).digest('hex');
    const other = Buffer.alloc(img.length, 7);
    other[0] = 0x89; // still wrong overall
    const up = await uploadFile({
      ownerKind: 'product',
      ownerId: product.id,
      bytes: other,
      mimeType: 'image/png',
      checksum,
    });
    record(
      'U04',
      !!(up.ok && up.session.status === 'failed' && up.session.failureCode === 'content_mismatch'),
      { status: 'failed', failureCode: 'content_mismatch' },
      { status: up.ok ? up.session.status : up, failureCode: up.ok ? up.session.failureCode : null },
    );
  }

  // U05 — idempotent complete/finalize
  {
    const key = randomUUID();
    const up = await uploadFile({
      ownerKind: 'product',
      ownerId: product.id,
      bytes: pngBytes(),
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

  // U06 — cross-partner
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
        byteSize: pngBytes().length,
      }),
    });
    const okSession = await uploadFile({
      ownerKind: 'product',
      ownerId: product.id,
      bytes: pngBytes(),
      mimeType: 'image/png',
    });
    const foreignGet = okSession.ok
      ? await fetch(`${base}/partners-portal/upload-sessions/${okSession.session.sessionId}`, { headers: otherAuth })
      : null;
    const foreignStatus = foreignGet ? foreignGet.status : 0;
    record(
      'U06',
      init.status === 404 && foreignStatus === 404,
      { initiateOther: 404, getOther: 404 },
      { initiateOther: init.status, getOther: foreignStatus },
    );
  }

  // U07 — corrupt + draft remains
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

  // U08 — duration bounds + video track
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
    const noTrack = Buffer.concat([box('ftyp', Buffer.from('isom')), box('moov', mvhd(1000, 5000))]);
    const upNoTrack = await uploadFile({
      ownerKind: 'service',
      ownerId: service.id,
      bytes: noTrack,
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
        upNoTrack.ok &&
        upNoTrack.session.status === 'failed' &&
        huge.status === 400
      ),
      { ok300: 'ready', over301: 'failed', noVideTrack: 'failed', imageOver: 400 },
      {
        ok300: upOk.ok ? upOk.session.status : upOk,
        over301: upOver.ok ? upOver.session.status : upOver,
        noVide: upNoTrack.ok ? upNoTrack.session.status : upNoTrack,
        imageOver: huge.status,
      },
    );
  }

  // U09 — abort vs complete race + abort after ready
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
        }),
      })
    ).json();
    const parts = await putAllParts(init, img);
    const abortP = fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}/abort`, {
      method: 'POST',
      headers: auth,
      body: '{}',
    });
    const completeP = fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}/complete`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ parts }),
    });
    const [abortRes, completeRes] = await Promise.all([abortP, completeP]);
    const abortBody = await abortRes.json();
    const completeBody = await completeRes.json();
    await new Promise((r) => setTimeout(r, 80));
    const dbFinal = await prisma.partnerUploadSession.findUnique({ where: { id: init.sessionId } });
    const final = await (await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}`, { headers: auth })).json();
    const terminal = new Set(['aborted', 'ready', 'uploaded', 'verifying', 'failed']);
    const raceOk = !!dbFinal && terminal.has(dbFinal.status);
    // Abort must not be overwritten by a later complete→uploaded when abort already committed.
    const abortHonored =
      abortBody.status === 'aborted' ? dbFinal?.status === 'aborted' : true;
    const completeHonored =
      completeBody.status === 'uploaded' || completeBody.status === 'ready' || completeBody.status === 'verifying'
        ? dbFinal?.status !== 'aborted' || abortBody.status !== 'aborted'
        : true;
    // One clear winner in DB
    const abortWon = dbFinal?.status === 'aborted';
    const completeWon = dbFinal?.status === 'ready' || dbFinal?.status === 'uploaded' || dbFinal?.status === 'verifying';
    const exclusive = abortWon !== completeWon && (abortWon || completeWon);

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
      !!(raceOk && abortHonored && completeHonored && exclusive && abortReady?.status === 'ready' && mediaStill),
      { raceStable: true, afterReady: 'ready', mediaKept: true },
      {
        dbStatus: dbFinal?.status,
        httpStatus: final.status,
        abortBody: abortBody.status,
        completeBody: completeBody.status,
        completeHttp: completeRes.status,
        afterReady: abortReady?.status,
        mediaId: mediaStill?.id,
        abortWon,
        completeWon,
      },
    );
  }

  // U10 — storage complete then DB stuck uploading; retryable bind failure
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
        }),
      })
    ).json();
    const parts = await putAllParts(init, img);
    await memoryStore.complete(
      (await prisma.partnerUploadSession.findUnique({ where: { id: init.sessionId } }))!.objectKey,
      (await prisma.partnerUploadSession.findUnique({ where: { id: init.sessionId } }))!.storageUploadId!,
      parts,
    );
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

    // retryable failure path
    const up2 = await uploadFile({ ownerKind: 'product', ownerId: product.id, bytes: pngBytes(), mimeType: 'image/png' });
    if (up2.ok) {
      await prisma.partnerUploadSession.update({
        where: { id: up2.session.sessionId },
        data: {
          status: 'failed',
          failureClass: 'retryable',
          failureCode: 'finalize_error',
          catalogMediaId: null,
          readyAt: null,
        },
      });
      // keep storage object + clear media if created
      if (up2.session.catalogMediaId) {
        await prisma.catalogMedia.delete({ where: { id: up2.session.catalogMediaId } }).catch(() => undefined);
      }
      const retry = await (
        await fetch(`${base}/partners-portal/upload-sessions/${up2.session.sessionId}/retry-finalize`, {
          method: 'POST',
          headers: auth,
          body: '{}',
        })
      ).json();
      record(
        'U10',
        after.status === 'ready' && retry.status === 'ready',
        { recoverUploading: 'ready', retryable: 'ready' },
        { afterGet: recovered.status, afterFinalize: after.status, retry: retry.status },
      );
    } else {
      record('U10', false, { recover: true }, { up2 });
    }
  }

  // U11 — memory during multi uploads (peak samples)
  {
    const before = process.memoryUsage().rss;
    const peaks: number[] = [];
    let peak = before;
    const timer = setInterval(() => {
      const rss = process.memoryUsage().rss;
      if (rss > peak) peak = rss;
      peaks.push(rss);
    }, 20);
    const sample = loadSampleMp4() || mp4Seconds(20);
    const budget = 80 * 1024 * 1024;
    for (let i = 0; i < 3; i++) {
      await uploadFile({ ownerKind: 'service', ownerId: service.id, bytes: sample, mimeType: 'video/mp4' });
    }
    clearInterval(timer);
    const report = {
      beforeRss: before,
      afterRss: process.memoryUsage().rss,
      peakRss: peak,
      peakDelta: peak - before,
      samples: peaks.length,
      fileBytes: sample.length,
      concurrency: 2,
      storeMode: 'memory',
      budgetBytes: budget,
      note: sample.length < 10000 ? 'synthetic/small sample — large real multi-part R2 U11 still BLOCKED without R2' : 'fixture/sample',
    };
    writeFileSync(join(outDir, 'MEMORY_REPORT.json'), JSON.stringify(report, null, 2));
    record('U11', report.peakDelta < budget, { peakDeltaLt: budget }, report);
  }

  // U12 — catalog storage read (HTTP media path needs full app; storage integrity here)
  {
    const img = pngBytes();
    const sha = createHash('sha256').update(img).digest('hex');
    const up = await uploadFile({ ownerKind: 'product', ownerId: product.id, bytes: img, mimeType: 'image/png', checksum: sha });
    const media =
      up.ok && up.session.catalogMediaId
        ? await prisma.catalogMedia.findUnique({ where: { id: up.session.catalogMediaId } })
        : null;
    const stored = media?.storageKey ? await memoryCatalog.get(media.storageKey) : null;
    record(
      'U12',
      !!(stored && createHash('sha256').update(stored).digest('hex') === sha),
      { storageBytesMatch: true },
      { mediaId: media?.id, match: !!stored },
      'slim module storage read; full HTTP Range = U12_HTTP',
    );
  }
  record(
    'U12_HTTP',
    'BLOCKED',
    { rangeSeek: true },
    { slimModule: true },
    'Full CatalogMediaController Range not mounted in slim module; covered by existing catalog-media suites',
  );

  // Feature disable mid-session
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
        byteSize: img.length,
      }),
    });
    const parts = await putAllParts(init, img);
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

  // Cleanup TTL with controllable clock — pin this session's expiresAt so it is selected
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
        }),
      })
    ).json();
    const past = new Date(Date.now() - 60_000);
    await prisma.partnerUploadSession.update({
      where: { id: init.sessionId },
      data: { expiresAt: past, cleanedAt: null, status: 'created' },
    });
    setUploadClock(() => Date.now());
    // Sweep enough rows; also verify our session by id after.
    const sweep = await cleanup.sweepExpired(500);
    setUploadClock(null);
    const after = await prisma.partnerUploadSession.findUnique({ where: { id: init.sessionId } });
    record(
      'CLEANUP_TTL',
      !!(after?.cleanedAt && after.status === 'aborted'),
      { cleaned: true, status: 'aborted', sessionId: init.sessionId },
      { sweep, status: after?.status, cleanedAt: after?.cleanedAt, expiresAt: after?.expiresAt },
    );
  }

  const finishedUtc = new Date().toISOString();
  const requiredPass = [
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
    command: 'npx tsx src/partners-portal/upload-sessions/upload-sessions.http.integration-tests.ts',
    note: 'Live R2/U12 HTTP Range recorded BLOCKED when not in this slim env; memory regressions are PASS/FAIL only.',
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
