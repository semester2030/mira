/**
 * P2.2 acceptance: cover/order/variant media bind, READY-only public, draft survives upload fail.
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
import { CatalogContentService } from '../../marketplace/catalog-content.service';
import { CatalogMediaController } from '../../marketplace/catalog-media.controller';
import { CatalogMediaStorage, MemoryCatalogMediaStorage } from '../../marketplace/catalog-media.storage';
import { PartnerTokenGuard } from '../guards/partner-token.guard';
import { MemoryMultipartUploadStore, MultipartUploadStore } from './multipart.store';
import { UploadCleanupService } from './upload-cleanup.service';
import { UploadFinalizeService } from './upload-finalize.service';
import { UploadSessionsController } from './upload-sessions.controller';
import { UploadSessionsService } from './upload-sessions.service';

process.env.MIRA_PARTNER_UPLOAD_SESSION = 'true';
process.env.NODE_ENV = 'test';
process.env.MIRA_UPLOAD_ALLOW_DIRECT_PARTS = 'true';
process.env.MIRA_UPLOAD_PART_SIZE_BYTES = '262144';
process.env.MIRA_UPLOAD_FINALIZE_CONCURRENCY = '2';

const outDir =
  process.env.MIRA_P21_OUT_DIR || join(process.cwd(), '..', 'audit-out', 'p2-1-p2-2', 'logs', 'p22');
mkdirSync(outDir, { recursive: true });
const fixturesDir = join(__dirname, 'fixtures');

type Case = { id: string; ok: boolean | 'BLOCKED'; expected: unknown; actual: unknown; detail?: string };
const cases: Case[] = [];

function record(id: string, ok: boolean | 'BLOCKED', expected: unknown, actual: unknown, detail?: string) {
  cases.push({ id, ok, expected, actual, detail });
  console.log(JSON.stringify({ id, ok, detail: detail || null }));
}

function sha256(buf: Buffer) {
  return createHash('sha256').update(buf).digest('hex');
}

function loadFixture(name: string) {
  const p = join(fixturesDir, name);
  if (!existsSync(p)) throw new Error('missing ' + name);
  return readFileSync(p);
}

function isLocal(url: string) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h === 'localhost' || h === '127.0.0.1' || h === '::1';
  } catch {
    return false;
  }
}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!isLocal(url)) {
    console.error('REFUSE non-local DATABASE_URL');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const brand = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `P22 ${suffix}`, nameEn: 'P22', city: 'الرياض' },
  });
  const other = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `P22O ${suffix}`, nameEn: 'O', city: 'جدة' },
  });
  const token = `token-p22-${suffix}`;
  await prisma.partnerUser.create({
    data: { partnerId: brand.id, email: `p22-${suffix}@test.local`, accessToken: token },
  });
  const product = await prisma.product.create({
    data: {
      partnerId: brand.id,
      nameAr: 'منتج P22',
      nameEn: 'P22',
      priceHalalas: 5000,
      externalUrl: '',
      concernTags: [],
      skinTypes: [],
      contentStatus: 'draft',
      reviewStatus: 'draft',
      active: true,
      catalogSource: 'catalog',
      optionsJson: [{ id: 'size', labelAr: 'المقاس', kind: 'size', values: [{ id: 'm', labelAr: 'M' }] }],
      variantsJson: [{ id: 'm-only', selections: { size: 'm' }, available: true, mediaIds: [] }],
    },
  });
  const service = await prisma.service.create({
    data: {
      partnerId: brand.id,
      nameAr: 'خدمة P22',
      nameEn: 'Svc',
      durationMin: 30,
      priceHalalas: 3000,
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

  const memoryStore = new MemoryMultipartUploadStore();
  const memoryCatalog = new MemoryCatalogMediaStorage();

  @Module({
    imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
    controllers: [UploadSessionsController, CatalogMediaController],
    providers: [
      PartnerTokenGuard,
      UploadSessionsService,
      UploadFinalizeService,
      UploadCleanupService,
      CatalogContentService,
      { provide: MultipartUploadStore, useValue: memoryStore },
      { provide: CatalogMediaStorage, useValue: memoryCatalog },
    ],
  })
  class Harness {}

  const app = await NestFactory.create(Harness, { bodyParser: false, logger: ['error'] });
  app.use((req: Request, res: Response, next: NextFunction) => {
    const path = (req.originalUrl || req.url || '').split('?')[0];
    if (req.method === 'PUT' && /\/upload-sessions\/[^/]+\/direct-parts\/\d+$/.test(path)) {
      return raw({ type: '*/*', limit: '64mb' })(req, res, next);
    }
    return json({ limit: '4mb' })(req, res, next);
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  await app.listen(0);
  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const base = `http://127.0.0.1:${port}/api/v1`;
  const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const finalize = app.get(UploadFinalizeService);
  const content = app.get(CatalogContentService);
  const png = loadFixture('valid.png');

  async function abs(u: string) {
    return u.startsWith('http') ? u : `http://127.0.0.1:${port}${u.startsWith('/') ? u : '/' + u}`;
  }

  async function uploadPng(ownerKind: 'product' | 'service', ownerId: string, bytes = png) {
    const init = await (
      await fetch(`${base}/partners-portal/upload-sessions`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({
          ownerKind,
          ownerId,
          clientMediaId: randomUUID(),
          idempotencyKey: randomUUID(),
          mimeType: 'image/png',
          byteSize: bytes.length,
          checksum: sha256(bytes),
        }),
      })
    ).json();
    if (!init.sessionId) throw new Error('init failed ' + JSON.stringify(init));
    const completed: Array<{ partNumber: number; etag: string; size: number }> = [];
    for (let n = 1; n <= init.totalParts; n++) {
      const start = (n - 1) * init.partSizeBytes;
      const chunk = bytes.subarray(start, Math.min(bytes.length, start + init.partSizeBytes));
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
    await finalize.finalizeOne(init.sessionId);
    return (await fetch(`${base}/partners-portal/upload-sessions/${init.sessionId}`, { headers: auth })).json();
  }

  {
    const up = await uploadPng('product', product.id);
    const media = await prisma.catalogMedia.findUnique({ where: { id: up.catalogMediaId } });
    record(
      'P22-01',
      up.status === 'ready' && media?.publication === 'draft' && !!media.storageKey,
      { ready: true, publication: 'draft', hasStorage: true },
      { status: up.status, publication: media?.publication, storageKey: !!media?.storageKey },
    );
  }

  {
    const a = await uploadPng('product', product.id);
    const bBytes = Buffer.from(png);
    bBytes[bBytes.length - 1] = (bBytes[bBytes.length - 1] + 1) % 256;
    const b = await uploadPng('product', product.id, bBytes);
    const allIds = (await prisma.catalogMedia.findMany({ where: { ownerId: product.id }, select: { id: true } })).map(
      (r) => r.id,
    );
    // Put b first, a second, preserve remaining ids after.
    const rest = allIds.filter((id) => id !== a.catalogMediaId && id !== b.catalogMediaId);
    const order = [b.catalogMediaId, a.catalogMediaId, ...rest];
    await content.reorder(brand.id, 'product', product.id, order);
    await content.setPrimary(brand.id, 'product', product.id, b.catalogMediaId);
    const rows = await prisma.catalogMedia.findMany({
      where: { ownerId: product.id },
      orderBy: { sortOrder: 'asc' },
    });
    const primary = rows.find((r) => r.isPrimary || r.draftIsPrimary);
    record(
      'P22-02',
      rows[0]?.id === b.catalogMediaId && primary?.id === b.catalogMediaId,
      { reorder: true, cover: true },
      { firstId: rows[0]?.id, primaryId: primary?.id, sortOrders: rows.map((r) => ({ id: r.id, sort: r.sortOrder })) },
    );
  }

  {
    const own = await uploadPng('product', product.id, Buffer.concat([png, Buffer.from([7])]));
    const foreign = await prisma.catalogMedia.create({
      data: {
        ownerKind: 'product',
        ownerId: otherProduct.id,
        kind: 'image',
        url: 'https://example.invalid/x.png',
        mimeType: 'image/png',
        byteSize: 10,
        publication: 'draft',
        sortOrder: 0,
      },
    });
    const okBind = await content.bindVariantMedia(brand.id, product.id, 'm-only', [own.catalogMediaId]);
    let foreignRejected = false;
    try {
      await content.bindVariantMedia(brand.id, product.id, 'm-only', [foreign.id]);
    } catch {
      foreignRejected = true;
    }
    const prod = await prisma.product.findUnique({ where: { id: product.id } });
    const variants = Array.isArray(prod?.variantsJson)
      ? (prod!.variantsJson as Array<{ id: string; mediaIds?: string[] }>)
      : [];
    const bound = variants.find((v) => v.id === 'm-only');
    record(
      'P22-03',
      okBind.ok === true && foreignRejected && Array.isArray(bound?.mediaIds) && bound!.mediaIds!.includes(own.catalogMediaId),
      { bindOwn: true, rejectForeign: true },
      { okBind, foreignRejected, boundMediaIds: bound?.mediaIds },
    );
  }

  {
    const up = await uploadPng('product', product.id, Buffer.concat([png, Buffer.from([9, 9])]));
    await content.bindVariantMedia(brand.id, product.id, 'm-only', [up.catalogMediaId]);
    await content.removeMedia(brand.id, 'product', product.id, up.catalogMediaId);
    const prod = await prisma.product.findUnique({ where: { id: product.id } });
    const variants = Array.isArray(prod?.variantsJson)
      ? (prod!.variantsJson as Array<{ id: string; mediaIds?: string[] }>)
      : [];
    const bound = variants.find((v) => v.id === 'm-only');
    const still = await prisma.catalogMedia.findUnique({ where: { id: up.catalogMediaId } });
    record(
      'P22-04',
      !still && !(bound?.mediaIds || []).includes(up.catalogMediaId),
      { deleted: true, unbound: true },
      { still: !!still, mediaIds: bound?.mediaIds },
    );
  }

  {
    const beforeCount = await prisma.catalogMedia.count({ where: { ownerId: service.id } });
    const bad = loadFixture('header-only.png');
    const up = await uploadPng('service', service.id, bad);
    const afterCount = await prisma.catalogMedia.count({ where: { ownerId: service.id } });
    const svc = await prisma.service.findUnique({ where: { id: service.id } });
    record(
      'P22-05',
      up.status === 'failed' && afterCount === beforeCount && svc?.contentStatus === 'draft',
      { failedUpload: true, mediaUnchanged: true, draftKept: true },
      { status: up.status, beforeCount, afterCount, contentStatus: svc?.contentStatus },
    );
  }

  {
    await prisma.product.update({
      where: { id: product.id },
      data: { contentStatus: 'published', active: true, reviewStatus: 'none' },
    });
    await prisma.catalogMedia.updateMany({
      where: { ownerId: product.id, publication: 'draft', storageKey: { not: null } },
      data: { publication: 'published', active: true },
    });
    const published = await prisma.catalogMedia.findFirst({
      where: { ownerId: product.id, publication: 'published', storageKey: { not: null } },
    });
    const leftoverDraft = await prisma.catalogMedia.create({
      data: {
        ownerKind: 'product',
        ownerId: product.id,
        kind: 'image',
        url: '',
        mimeType: 'image/png',
        byteSize: png.length,
        storageKey: randomUUID(),
        publication: 'draft',
        active: false,
        sortOrder: 99,
      },
    });
    await memoryCatalog.put(leftoverDraft.storageKey!, png);
    const visible = published
      ? await fetch(`${base}/marketplace/media/${published.id}`)
      : { ok: false, status: 0 };
    const hidden = await fetch(`${base}/marketplace/media/${leftoverDraft.id}`);
    const ranged = published
      ? await fetch(`${base}/marketplace/media/${published.id}`, { headers: { Range: 'bytes=0-3' } })
      : null;
    let rangeBodyOk = false;
    if (ranged && ranged.status === 206) {
      const buf = Buffer.from(await ranged.arrayBuffer());
      rangeBodyOk = buf.length === 4;
    }
    record(
      'P22-06',
      !!(visible as Response).ok && hidden.status === 404 && rangeBodyOk,
      { publishedVisible: true, draftHidden: true, rangeBody: true },
      {
        visibleStatus: (visible as Response).status,
        hiddenStatus: hidden.status,
        rangeStatus: ranged?.status,
        rangeBodyOk,
      },
    );
  }

  {
    const incomplete = await prisma.catalogMedia.create({
      data: {
        ownerKind: 'product',
        ownerId: product.id,
        kind: 'image',
        url: '',
        publication: 'draft',
        active: false,
        sortOrder: 100,
      },
    });
    let rejected = false;
    try {
      await content.setPrimary(brand.id, 'product', product.id, incomplete.id);
    } catch {
      rejected = true;
    }
    record('P22-07', rejected, { rejectIncompleteCover: true }, { rejected });
  }

  // —— C01: preview ready contract (no storageKey/url required for picker)
  {
    const up = await uploadPng('product', product.id, Buffer.concat([png, Buffer.from([0xc0, 0x01])]));
    const preview = await content.preview(brand.id, 'product', product.id);
    const row = (preview.media as Array<Record<string, unknown>>).find((m) => m.id === up.catalogMediaId);
    const hasInternalKey = row != null && ('storageKey' in row || Object.prototype.hasOwnProperty.call(row, 'storageKey'));
    const readyOk = row?.ready === true && row?.pendingRemoval !== true;
    const uiFilter = (preview.media as Array<Record<string, unknown>>).filter(
      (m) => m && m.id && !m.pendingRemoval && m.ready === true,
    );
    record(
      'C01',
      readyOk && !hasInternalKey && uiFilter.some((m) => m.id === up.catalogMediaId),
      { ready: true, noStorageKey: true, pickerOption: true },
      { ready: row?.ready, hasInternalKey, pickerCount: uiFilter.length, mediaId: up.catalogMediaId },
    );
  }

  // —— C02: bind respects draft for published products
  {
    const pubProduct = await prisma.product.create({
      data: {
        partnerId: brand.id,
        nameAr: 'منشور C02',
        nameEn: 'C02',
        priceHalalas: 4000,
        externalUrl: '',
        concernTags: [],
        skinTypes: [],
        contentStatus: 'published',
        reviewStatus: 'none',
        active: true,
        catalogSource: 'catalog',
        optionsJson: [
          {
            id: 'size',
            labelAr: 'المقاس',
            kind: 'size',
            values: [
              { id: 's', labelAr: 'S' },
              { id: 'm', labelAr: 'M' },
              { id: 'l', labelAr: 'L' },
            ],
          },
        ],
        variantsJson: [
          { id: 's-only', selections: { size: 's' }, available: true, mediaIds: [] },
          { id: 'keep', selections: { size: 'm' }, available: true, mediaIds: ['keep-me'] },
        ],
      },
    });
    // Draft-only variant (not yet published)
    await prisma.product.update({
      where: { id: pubProduct.id },
      data: {
        draftVariantsSet: true,
        draftVariantsJson: [
          { id: 's-only', selections: { size: 's' }, available: true, mediaIds: [] },
          { id: 'keep', selections: { size: 'm' }, available: true, mediaIds: ['keep-me'] },
          { id: 'draft-only', selections: { size: 'l' }, available: true, mediaIds: [] },
        ],
      },
    });
    const up = await uploadPng('product', pubProduct.id, Buffer.concat([png, Buffer.from([0xc0, 0x02])]));
    const beforePub = await prisma.product.findUnique({ where: { id: pubProduct.id } });
    const publishedBefore = JSON.stringify(beforePub?.variantsJson);
    await content.bindVariantMedia(brand.id, pubProduct.id, 'draft-only', [up.catalogMediaId]);
    await content.bindVariantMedia(brand.id, pubProduct.id, 's-only', [up.catalogMediaId]);
    const mid = await prisma.product.findUnique({ where: { id: pubProduct.id } });
    const publishedUnchanged = JSON.stringify(mid?.variantsJson) === publishedBefore;
    const draft = Array.isArray(mid?.draftVariantsJson)
      ? (mid!.draftVariantsJson as Array<{ id: string; mediaIds?: string[] }>)
      : [];
    const draftBound = draft.find((v) => v.id === 'draft-only');
    const sOnly = draft.find((v) => v.id === 's-only');
    const keep = draft.find((v) => v.id === 'keep');
    // Approve draft merge
    const rev = mid!.reviewRevision;
    await prisma.product.update({
      where: { id: pubProduct.id },
      data: { reviewStatus: 'in_review', submittedRevision: rev, reviewRevision: rev },
    });
    // Need at least one non-pending image for approve — upload already ready
    await content.decide('admin-test', 'product', pubProduct.id, 'approve', undefined, rev);
    const after = await prisma.product.findUnique({ where: { id: pubProduct.id } });
    const finals = Array.isArray(after?.variantsJson)
      ? (after!.variantsJson as Array<{ id: string; mediaIds?: string[] }>)
      : [];
    const finalDraftOnly = finals.find((v) => v.id === 'draft-only');
    const finalKeep = finals.find((v) => v.id === 'keep');
    record(
      'C02',
      publishedUnchanged &&
        mid?.draftVariantsSet === true &&
        Array.isArray(draftBound?.mediaIds) &&
        draftBound!.mediaIds!.includes(up.catalogMediaId) &&
        Array.isArray(sOnly?.mediaIds) &&
        sOnly!.mediaIds!.includes(up.catalogMediaId) &&
        Array.isArray(keep?.mediaIds) &&
        keep!.mediaIds!.includes('keep-me') &&
        Array.isArray(finalDraftOnly?.mediaIds) &&
        finalDraftOnly!.mediaIds!.includes(up.catalogMediaId) &&
        Array.isArray(finalKeep?.mediaIds) &&
        finalKeep!.mediaIds!.includes('keep-me') &&
        after?.draftVariantsSet === false,
      {
        publishedUntouchedBeforeApprove: true,
        draftOnlyBind: true,
        keepOtherBindings: true,
        mergeOnApprove: true,
      },
      {
        publishedUnchanged,
        draftBound: draftBound?.mediaIds,
        sOnly: sOnly?.mediaIds,
        keep: keep?.mediaIds,
        finalDraftOnly: finalDraftOnly?.mediaIds,
        finalKeep: finalKeep?.mediaIds,
        draftVariantsSetAfter: after?.draftVariantsSet,
      },
    );
  }

  // —— C03: pendingRemoval + approve strips mediaIds
  {
    const c03 = await prisma.product.create({
      data: {
        partnerId: brand.id,
        nameAr: 'C03',
        nameEn: 'C03',
        priceHalalas: 3000,
        externalUrl: '',
        concernTags: [],
        skinTypes: [],
        contentStatus: 'published',
        reviewStatus: 'none',
        active: true,
        catalogSource: 'catalog',
        optionsJson: [{ id: 'size', labelAr: 'المقاس', kind: 'size', values: [{ id: 'm', labelAr: 'M' }] }],
        variantsJson: [{ id: 'm1', selections: { size: 'm' }, available: true, mediaIds: [] }],
      },
    });
    const keepUp = await uploadPng('product', c03.id, Buffer.concat([png, Buffer.from([0xc0, 0x03, 1])]));
    const dropUp = await uploadPng('product', c03.id, Buffer.concat([png, Buffer.from([0xc0, 0x03, 2])]));
    await prisma.catalogMedia.updateMany({
      where: { id: { in: [keepUp.catalogMediaId, dropUp.catalogMediaId] } },
      data: { publication: 'published', active: true },
    });
    await prisma.product.update({
      where: { id: c03.id },
      data: {
        variantsJson: [
          {
            id: 'm1',
            selections: { size: 'm' },
            available: true,
            mediaIds: [keepUp.catalogMediaId, dropUp.catalogMediaId],
          },
        ],
      },
    });
    await content.removeMedia(brand.id, 'product', c03.id, dropUp.catalogMediaId);
    const pending = await prisma.catalogMedia.findUnique({ where: { id: dropUp.catalogMediaId } });
    const beforeApprove = await prisma.product.findUnique({ where: { id: c03.id } });
    const beforeVariants = Array.isArray(beforeApprove?.variantsJson)
      ? (beforeApprove!.variantsJson as Array<{ mediaIds?: string[] }>)
      : [];
    // Published variants still reference until approve
    const stillReferenced = (beforeVariants[0]?.mediaIds || []).includes(dropUp.catalogMediaId);
    const revRow = await prisma.product.findUnique({ where: { id: c03.id } });
    const rev = revRow!.reviewRevision;
    await prisma.product.update({
      where: { id: c03.id },
      data: { reviewStatus: 'in_review', submittedRevision: rev, reviewRevision: rev },
    });
    await content.decide('admin-test', 'product', c03.id, 'approve', undefined, rev);
    const afterMedia = await prisma.catalogMedia.findUnique({ where: { id: dropUp.catalogMediaId } });
    const keepStill = await prisma.catalogMedia.findUnique({ where: { id: keepUp.catalogMediaId } });
    const afterProd = await prisma.product.findUnique({ where: { id: c03.id } });
    const afterVariants = Array.isArray(afterProd?.variantsJson)
      ? (afterProd!.variantsJson as Array<{ mediaIds?: string[] }>)
      : [];
    const ids = afterVariants[0]?.mediaIds || [];
    record(
      'C03',
      pending?.pendingRemoval === true &&
        stillReferenced &&
        !afterMedia &&
        !!keepStill &&
        ids.includes(keepUp.catalogMediaId) &&
        !ids.includes(dropUp.catalogMediaId),
      { pendingThenApprove: true, droppedRefGone: true, otherKept: true },
      {
        pendingRemoval: pending?.pendingRemoval,
        stillReferencedBeforeApprove: stillReferenced,
        dropGone: !afterMedia,
        keepAlive: !!keepStill,
        mediaIds: ids,
      },
    );
  }

  // —— C05: bootRecover default batch=20 must arm ALL future sessions (21+) without client GET
  {
    process.env.MIRA_UPLOAD_FINALIZE_RETRY_BASE_MS = '200';
    process.env.MIRA_UPLOAD_FINALIZE_RETRY_MAX_MS = '800';
    const worker = app.get(UploadFinalizeService);
    const futureIds: string[] = [];
    const dueAt = new Date(Date.now() + 60_000); // far future — arm only, do not consume attempts
    for (let i = 0; i < 21; i++) {
      // DB-only fixtures for arming proof (objects not required until due).
      const row = await prisma.partnerUploadSession.create({
        data: {
          partnerId: brand.id,
          ownerKind: 'product',
          ownerId: product.id,
          clientMediaId: randomUUID(),
          idempotencyKey: randomUUID(),
          objectKey: `partners/${brand.id}/upload-sessions/c05-future-${i}-${randomUUID()}.png`,
          storageUploadId: randomUUID(),
          declaredMimeType: 'image/png',
          declaredByteSize: png.length,
          declaredChecksum: sha256(png),
          partSizeBytes: png.length,
          totalParts: 1,
          status: 'failed',
          failureClass: 'retryable',
          failureCode: 'transient',
          failureMessageAr: 'c05-batch',
          storageCompletedAt: new Date(),
          completedPartsJson: [{ partNumber: 1, etag: '"c05"', size: png.length }],
          catalogMediaId: null,
          finalizeLeaseOwner: null,
          finalizeLeaseUntil: null,
          finalizeNextAttemptAt: new Date(dueAt.getTime() + i),
          finalizeAttempts: 1,
          placement: 'main',
          expiresAt: new Date(Date.now() + 3600_000),
        },
      });
      futureIds.push(row.id);
    }
    // One real soon-due session to prove auto-ready without client
    const soonBytes = Buffer.concat([png, Buffer.from([0x05])]);
    const soonInit = await (
      await fetch(`${base}/partners-portal/upload-sessions`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({
          ownerKind: 'product',
          ownerId: product.id,
          clientMediaId: randomUUID(),
          idempotencyKey: randomUUID(),
          mimeType: 'image/png',
          byteSize: soonBytes.length,
          checksum: sha256(soonBytes),
        }),
      })
    ).json();
    const soonParts: Array<{ partNumber: number; etag: string; size: number }> = [];
    for (let n = 1; n <= soonInit.totalParts; n++) {
      const start = (n - 1) * soonInit.partSizeBytes;
      const chunk = soonBytes.subarray(start, Math.min(soonBytes.length, start + soonInit.partSizeBytes));
      const sign = await (
        await fetch(`${base}/partners-portal/upload-sessions/${soonInit.sessionId}/parts/${n}/sign`, {
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
      soonParts.push({ partNumber: n, etag: body.etag, size: chunk.length });
    }
    const soonRow = await prisma.partnerUploadSession.findUnique({ where: { id: soonInit.sessionId } });
    await memoryStore.complete(soonRow!.objectKey, soonRow!.storageUploadId!, soonParts);
    const soonAt = new Date(Date.now() + 350);
    await prisma.partnerUploadSession.update({
      where: { id: soonInit.sessionId },
      data: {
        status: 'failed',
        failureClass: 'retryable',
        failureCode: 'transient',
        failureMessageAr: 'c05-soon',
        storageCompletedAt: new Date(),
        completedPartsJson: soonParts,
        catalogMediaId: null,
        finalizeLeaseOwner: null,
        finalizeLeaseUntil: null,
        finalizeNextAttemptAt: soonAt,
        finalizeAttempts: 1,
      },
    });

    worker.backoffScheduleCount = 0;
    // Default path — do NOT pass a larger limit to force PASS
    const boot = await worker.bootRecover();
    const attemptsSnap = await prisma.partnerUploadSession.findMany({
      where: { id: { in: futureIds } },
      select: { id: true, finalizeAttempts: true },
    });
    const attemptsUnchanged = attemptsSnap.every((r) => r.finalizeAttempts === 1);
    const allArmed = boot.futureArmed >= 22; // 21 far + 1 soon
    const deadline = Date.now() + 5000;
    let soonReady = false;
    let soonMedia: string | null = null;
    while (Date.now() < deadline) {
      const live = await prisma.partnerUploadSession.findUnique({ where: { id: soonInit.sessionId } });
      if (live?.status === 'ready' && live.catalogMediaId) {
        soonReady = true;
        soonMedia = live.catalogMediaId;
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    const mediaCount = soonMedia
      ? await prisma.catalogMedia.count({ where: { sourceMediaKey: `upload-session:${soonInit.sessionId}` } })
      : 0;
    record(
      'C05',
      allArmed && attemptsUnchanged && soonReady && mediaCount === 1,
      {
        futureArmedGte22: true,
        defaultBatchDrain: true,
        noEarlyAttemptBurn: true,
        autoReadyWithoutClient: true,
        singleMedia: true,
      },
      {
        boot,
        futureIds: futureIds.length,
        attemptsUnchanged,
        soonReady,
        soonMedia,
        mediaCount,
        scheduleCount: worker.backoffScheduleCount,
      },
    );
  }

  // —— C04 static: catalog-journey must not auto-publish from file-select / uploadOne
  {
    const journeyPath = join(process.cwd(), '..', 'partners-portal', 'web', 'js', 'catalog-journey.js');
    const src = existsSync(journeyPath) ? readFileSync(journeyPath, 'utf8') : '';
    const uploadFn = (src.split('async function uploadOne')[1] || '').slice(0, 4000);
    const hasPublishOpt = /persistListing\(\{\s*publish:\s*false\s*\}\)/.test(src);
    const uploadOneNoSubmit = !!uploadFn && !uploadFn.includes('submitReview');
    const wantPublishGate = /wantPublish\s*&&/.test(src) && /opts\.publish === true/.test(src);
    record(
      'C04_STATIC',
      !!src && hasPublishOpt && uploadOneNoSubmit && wantPublishGate,
      { publishFalseOnFileSelect: true, uploadOneNoSubmit: true, wantPublishGate: true },
      { hasPublishOpt, uploadOneNoSubmit, wantPublishGate, bytes: src.length },
    );
  }

  const required = [
    'P22-01',
    'P22-02',
    'P22-03',
    'P22-04',
    'P22-05',
    'P22-06',
    'P22-07',
    'C01',
    'C02',
    'C03',
    'C05',
    'C04_STATIC',
  ];
  const byId = Object.fromEntries(cases.map((c) => [c.id, c]));
  const failed = required.filter((id) => !byId[id] || byId[id].ok !== true);
  const summary = {
    ok: failed.length === 0,
    failed,
    cases,
    finishedUtc: new Date().toISOString(),
    command: 'npx tsx src/partners-portal/upload-sessions/p22-media-publish.integration-tests.ts',
  };
  writeFileSync(join(outDir, 'p22-integration.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ok: summary.ok, failed }, null, 2));
  await app.close();
  await prisma.$disconnect();
  process.exit(summary.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
