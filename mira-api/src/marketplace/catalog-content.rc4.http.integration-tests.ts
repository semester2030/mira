import 'reflect-metadata';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Module, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { FirebaseIdTokenVerifier, VerifiedFirebaseIdentity } from '../common/auth/firebase-id-token-verifier';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { PartnerTokenGuard } from '../partners-portal/guards/partner-token.guard';
import { PartnersPortalController } from '../partners-portal/partners-portal.controller';
import { PartnersPortalService } from '../partners-portal/partners-portal.service';
import { CatalogContentService } from './catalog-content.service';
import { CatalogMediaController } from './catalog-media.controller';
import { CatalogMediaStorage, LocalCatalogMediaStorage } from './catalog-media.storage';
import { CatalogReviewAdminController } from './catalog-review.admin.controller';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

class ScriptedIdTokenVerifier extends FirebaseIdTokenVerifier {
  async verify(): Promise<VerifiedFirebaseIdentity> {
    throw new UnauthorizedException('Invalid or expired Firebase token');
  }
}

class CleanupFailStorage extends LocalCatalogMediaStorage {
  failDelete = false;

  override async delete(key: string): Promise<void> {
    if (this.failDelete) throw new Error('cleanup failed');
    await super.delete(key);
  }
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
  controllers: [PartnersPortalController, CatalogMediaController, CatalogReviewAdminController, MarketplaceController],
  providers: [
    PartnersPortalService,
    PartnerTokenGuard,
    AdminApiKeyGuard,
    CatalogContentService,
    { provide: CatalogMediaStorage, useClass: CleanupFailStorage },
    { provide: MarketplaceService, useFactory: (prisma: PrismaService) => new MarketplaceService(prisma), inject: [PrismaService] },
    { provide: FirebaseIdTokenVerifier, useValue: new ScriptedIdTokenVerifier() },
  ],
})
class Rc4HttpTestModule {}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) process.exit(1);
  const dir = await mkdtemp(join(tmpdir(), 'mira-rc4-media-'));
  process.env.MIRA_MEDIA_DIR = dir;
  process.env.ADMIN_API_KEY = 'ph3-rc4-admin';
  const prisma = new PrismaClient();
  const brand = await prisma.partner.create({ data: { type: 'brand', status: 'active', nameAr: 'بيانات اختبار RC4', nameEn: 'RC4 fixture', city: 'الرياض' } });
  const clinic = await prisma.partner.create({ data: { type: 'clinic', status: 'active', nameAr: 'عيادة اختبار RC4', nameEn: 'RC4 clinic', city: 'الرياض' } });
  await prisma.partnerUser.create({ data: { partnerId: brand.id, email: 'rc4-brand@test.local', accessToken: 'token-rc4-brand' } });
  await prisma.partnerUser.create({ data: { partnerId: clinic.id, email: 'rc4-clinic@test.local', accessToken: 'token-rc4-clinic' } });
  const app = await NestFactory.create(Rc4HttpTestModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  await app.listen(0);
  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const base = `http://127.0.0.1:${port}`;
  const brandHeaders = { authorization: 'Bearer token-rc4-brand', 'content-type': 'application/json' };
  const clinicHeaders = { authorization: 'Bearer token-rc4-clinic', 'content-type': 'application/json' };
  const adminHeaders = { 'x-admin-key': 'ph3-rc4-admin', 'content-type': 'application/json' };
  const storage = app.get(CatalogMediaStorage) as CleanupFailStorage;

  async function revision(kind: string, id: string) {
    const body = await (await fetch(`${base}/api/v1/admin/catalog-reviews/${kind}/${id}`, { headers: adminHeaders })).json() as { submittedRevision: number };
    return body.submittedRevision;
  }

  async function waitForWaiter(table: string) {
    const needle = `%${table}%`;
    for (let attempt = 0; attempt < 150; attempt += 1) {
      const rows = await prisma.$queryRaw<{ waiting: number }[]>`
        SELECT COUNT(*)::int AS waiting
        FROM pg_stat_activity
        WHERE datname = current_database()
          AND wait_event_type = 'Lock'
          AND query ILIKE ${needle}`;
      if (Number(rows[0]?.waiting) > 0) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const activity = await prisma.$queryRaw<{ state: string | null; wait: string | null; query: string | null }[]>`
      SELECT state, wait_event_type AS wait, left(query, 180) AS query
      FROM pg_stat_activity
      WHERE datname = current_database() AND pid <> pg_backend_pid()`;
    throw new Error(`no lock waiter on ${table}: ${JSON.stringify(activity)}`);
  }

  async function addImage(kind: 'products' | 'services', id: string, headers: Record<string, string>) {
    const response = await fetch(`${base}/api/v1/partners-portal/${kind}/${id}/media`, {
      method: 'POST', headers, body: JSON.stringify({ mimeType: 'image/png', dataBase64: PNG }),
    });
    assert.equal(response.status, 201);
    return response.json() as Promise<{ id: string; storageKey: string }>;
  }

  const draftProduct = await (await fetch(`${base}/api/v1/partners-portal/products`, {
    method: 'POST', headers: brandHeaders,
    body: JSON.stringify({ nameAr: 'منتج قفل', nameEn: 'Lock product', descriptionAr: 'وصف', priceHalalas: 1000, externalUrl: 'https://example.com/lock', concernTags: ['لون'] }),
  })).json() as { id: string };
  const draftImage = await addImage('products', draftProduct.id, brandHeaders);
  let releaseProduct: () => void = () => undefined;
  const productHold = new Promise<void>((resolve) => { releaseProduct = resolve; });
  let productLocked = false;
  const productTx = prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM products WHERE id = ${draftProduct.id} FOR UPDATE`;
    productLocked = true;
    await productHold;
    await tx.catalogMedia.update({ where: { id: draftImage.id }, data: { publication: 'published', active: true } });
  });
  for (let attempt = 0; attempt < 100 && !productLocked; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(productLocked, true);
  const productRemoval = fetch(`${base}/api/v1/partners-portal/products/${draftProduct.id}/media/${draftImage.id}`, { method: 'DELETE', headers: brandHeaders });
  await waitForWaiter('products');
  releaseProduct();
  const [productRemovalResult] = await Promise.all([productRemoval, productTx]);
  assert.equal(productRemovalResult.status, 200);
  const productMedia = await prisma.catalogMedia.findUniqueOrThrow({ where: { id: draftImage.id } });
  assert.equal(productMedia.publication, 'published');
  assert.equal(productMedia.pendingRemoval, true);
  assert.ok(await readFile(join(dir, productMedia.storageKey!)));

  const draftService = await (await fetch(`${base}/api/v1/partners-portal/services`, {
    method: 'POST', headers: clinicHeaders,
    body: JSON.stringify({ nameAr: 'خدمة قفل', nameEn: 'Lock service', descriptionAr: 'وصف خدمة', durationMin: 30, priceHalalas: 2000, concernTags: ['عناية'] }),
  })).json() as { id: string };
  const serviceImage = await addImage('services', draftService.id, clinicHeaders);
  let releaseService: () => void = () => undefined;
  const serviceHold = new Promise<void>((resolve) => { releaseService = resolve; });
  let serviceLocked = false;
  const serviceTx = prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM services WHERE id = ${draftService.id} FOR UPDATE`;
    serviceLocked = true;
    await serviceHold;
    await tx.catalogMedia.update({ where: { id: serviceImage.id }, data: { publication: 'published', active: true } });
  });
  for (let attempt = 0; attempt < 100 && !serviceLocked; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 20));
  const serviceRemoval = fetch(`${base}/api/v1/partners-portal/services/${draftService.id}/media/${serviceImage.id}`, { method: 'DELETE', headers: clinicHeaders });
  await waitForWaiter('services');
  releaseService();
  const [serviceRemovalResult] = await Promise.all([serviceRemoval, serviceTx]);
  assert.equal(serviceRemovalResult.status, 200);
  const serviceMedia = await prisma.catalogMedia.findUniqueOrThrow({ where: { id: serviceImage.id } });
  assert.equal(serviceMedia.publication, 'published');
  assert.equal(serviceMedia.pendingRemoval, true);
  assert.ok(await readFile(join(dir, serviceMedia.storageKey!)));

  const orderProduct = await (await fetch(`${base}/api/v1/partners-portal/products`, {
    method: 'POST', headers: brandHeaders,
    body: JSON.stringify({ nameAr: 'ترتيب', nameEn: 'Order', descriptionAr: 'قبل', priceHalalas: 1100, externalUrl: 'https://example.com/order', concernTags: ['لون'] }),
  })).json() as { id: string };
  const orderA = await addImage('products', orderProduct.id, brandHeaders);
  const orderB = await addImage('products', orderProduct.id, brandHeaders);
  let releaseOrder: () => void = () => undefined;
  const orderHold = new Promise<void>((resolve) => { releaseOrder = resolve; });
  let orderLocked = false;
  const orderTx = prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM products WHERE id = ${orderProduct.id} FOR UPDATE`;
    orderLocked = true;
    await orderHold;
    await tx.product.update({ where: { id: orderProduct.id }, data: { contentStatus: 'published', active: true } });
  });
  for (let attempt = 0; attempt < 100 && !orderLocked; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 20));
  const reorder = fetch(`${base}/api/v1/partners-portal/products/${orderProduct.id}/media/order`, {
    method: 'PATCH', headers: brandHeaders, body: JSON.stringify({ ids: [orderB.id, orderA.id] }),
  });
  await waitForWaiter('products');
  releaseOrder();
  assert.equal((await Promise.all([reorder, orderTx]))[0].status, 200);
  const ordered = await prisma.catalogMedia.findMany({ where: { ownerId: orderProduct.id }, orderBy: { sortOrder: 'asc' } });
  assert.deepEqual(ordered.map((row) => row.sortOrder), [0, 1]);
  assert.deepEqual(ordered.map((row) => row.id), [orderA.id, orderB.id]);
  assert.equal(ordered.find((row) => row.id === orderB.id)?.draftSortOrder, 0);
  assert.equal(ordered.find((row) => row.id === orderA.id)?.draftSortOrder, 1);

  const primaryService = await (await fetch(`${base}/api/v1/partners-portal/services`, {
    method: 'POST', headers: clinicHeaders,
    body: JSON.stringify({ nameAr: 'رئيسي', nameEn: 'Primary', descriptionAr: 'خدمة', durationMin: 20, priceHalalas: 1500, concernTags: ['عناية'] }),
  })).json() as { id: string };
  const primaryA = await addImage('services', primaryService.id, clinicHeaders);
  const primaryB = await addImage('services', primaryService.id, clinicHeaders);
  let releasePrimary: () => void = () => undefined;
  const primaryHold = new Promise<void>((resolve) => { releasePrimary = resolve; });
  let primaryLocked = false;
  const primaryTx = prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM services WHERE id = ${primaryService.id} FOR UPDATE`;
    primaryLocked = true;
    await primaryHold;
    await tx.service.update({ where: { id: primaryService.id }, data: { contentStatus: 'published', active: true } });
  });
  for (let attempt = 0; attempt < 100 && !primaryLocked; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 20));
  const primaryChange = fetch(`${base}/api/v1/partners-portal/services/${primaryService.id}/media/${primaryB.id}/primary`, { method: 'PATCH', headers: clinicHeaders });
  await waitForWaiter('services');
  releasePrimary();
  assert.equal((await Promise.all([primaryChange, primaryTx]))[0].status, 200);
  const primaryRows = await prisma.catalogMedia.findMany({ where: { ownerId: primaryService.id } });
  assert.equal(primaryRows.find((row) => row.id === primaryA.id)?.isPrimary, true);
  assert.equal(primaryRows.find((row) => row.id === primaryB.id)?.isPrimary, false);
  assert.equal(primaryRows.find((row) => row.id === primaryB.id)?.draftIsPrimary, true);

  const reviewed = await (await fetch(`${base}/api/v1/partners-portal/products`, {
    method: 'POST', headers: brandHeaders,
    body: JSON.stringify({ nameAr: '<b>اسم</b>', nameEn: 'Quoted "name"', descriptionAr: 'وصف منشور', priceHalalas: 3200, externalUrl: 'https://example.com/fields', concernTags: ['لون'] }),
  })).json() as { id: string };
  const reviewedA = await addImage('products', reviewed.id, brandHeaders);
  const reviewedB = await addImage('products', reviewed.id, brandHeaders);
  await fetch(`${base}/api/v1/partners-portal/products/${reviewed.id}/submit-review`, { method: 'POST', headers: brandHeaders });
  assert.equal((await fetch(`${base}/api/v1/admin/catalog-reviews/product/${reviewed.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: await revision('product', reviewed.id) }),
  })).status, 201);
  await fetch(`${base}/api/v1/partners-portal/products/${reviewed.id}/media/order`, {
    method: 'PATCH', headers: brandHeaders, body: JSON.stringify({ ids: [reviewedB.id, reviewedA.id] }),
  });
  await fetch(`${base}/api/v1/partners-portal/products/${reviewed.id}/submit-review`, { method: 'POST', headers: brandHeaders });
  const seen = await revision('product', reviewed.id);
  await fetch(`${base}/api/v1/partners-portal/products/${reviewed.id}/media/order`, {
    method: 'PATCH', headers: brandHeaders, body: JSON.stringify({ ids: [reviewedA.id, reviewedB.id] }),
  });
  assert.equal((await fetch(`${base}/api/v1/admin/catalog-reviews/product/${reviewed.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: seen }),
  })).status, 409);
  const publicBefore = await (await fetch(`${base}/api/v1/marketplace/catalog/product/${reviewed.id}`)).json() as { media: { sortOrder: number }[] };
  assert.deepEqual(publicBefore.media.map((row) => row.sortOrder), [0, 1]);
  await fetch(`${base}/api/v1/partners-portal/products/${reviewed.id}/submit-review`, { method: 'POST', headers: brandHeaders });
  assert.equal((await fetch(`${base}/api/v1/admin/catalog-reviews/product/${reviewed.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: await revision('product', reviewed.id) }),
  })).status, 201);
  await fetch(`${base}/api/v1/partners-portal/products/${reviewed.id}/media/order`, {
    method: 'PATCH', headers: brandHeaders, body: JSON.stringify({ ids: [reviewedB.id, reviewedA.id] }),
  });
  const afterLaterEdit = await (await fetch(`${base}/api/v1/marketplace/catalog/product/${reviewed.id}`)).json() as { media: { isPrimary: boolean; sortOrder: number }[] };
  assert.deepEqual(afterLaterEdit.media.map((row) => row.sortOrder), [0, 1]);

  const edited = await (await fetch(`${base}/api/v1/partners-portal/products/${reviewed.id}`, {
    method: 'PATCH', headers: brandHeaders,
    body: JSON.stringify({ nameAr: 'اسم جديد', nameEn: 'New English', descriptionAr: 'وصف جديد' }),
  })).json() as { id: string; draftNameEn: string; draftDescriptionAr: string };
  assert.equal(edited.id, reviewed.id);
  assert.equal(edited.draftNameEn, 'New English');
  const reopened = await (await fetch(`${base}/api/v1/partners-portal/products/${reviewed.id}/preview`, { headers: brandHeaders })).json() as { draftNameEn: string; draftDescriptionAr: string; publishedNameEn: string };
  assert.equal(reopened.draftNameEn, 'New English');
  assert.equal(reopened.draftDescriptionAr, 'وصف جديد');
  assert.equal(reopened.publishedNameEn, 'Quoted "name"');
  await fetch(`${base}/api/v1/partners-portal/products/${reviewed.id}/submit-review`, { method: 'POST', headers: brandHeaders });
  assert.equal((await fetch(`${base}/api/v1/admin/catalog-reviews/product/${reviewed.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'reject', revision: await revision('product', reviewed.id), note: 'أبقوا المنشور' }),
  })).status, 201);
  const rejected = await (await fetch(`${base}/api/v1/marketplace/catalog/product/${reviewed.id}`)).json() as { nameAr: string; nameEn: string; descriptionAr: string };
  assert.equal(rejected.nameAr, '<b>اسم</b>');
  assert.equal(rejected.nameEn, 'Quoted "name"');
  assert.equal(rejected.descriptionAr, 'وصف منشور');
  await fetch(`${base}/api/v1/partners-portal/products/${reviewed.id}/submit-review`, { method: 'POST', headers: brandHeaders });
  assert.equal((await fetch(`${base}/api/v1/admin/catalog-reviews/product/${reviewed.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: await revision('product', reviewed.id) }),
  })).status, 201);
  const approvedFields = await (await fetch(`${base}/api/v1/marketplace/catalog/product/${reviewed.id}`)).json() as { id: string; nameAr: string; nameEn: string; descriptionAr: string };
  assert.equal(approvedFields.id, reviewed.id);
  assert.equal(approvedFields.nameAr, 'اسم جديد');
  assert.equal(approvedFields.nameEn, 'New English');
  assert.equal(approvedFields.descriptionAr, 'وصف جديد');
  await fetch(`${base}/api/v1/partners-portal/products/${reviewed.id}`, {
    method: 'PATCH', headers: brandHeaders, body: JSON.stringify({ descriptionAr: '' }),
  });
  const clearedDraft = await (await fetch(`${base}/api/v1/partners-portal/products/${reviewed.id}/preview`, { headers: brandHeaders })).json() as { draftDescriptionAr: string };
  assert.equal(clearedDraft.draftDescriptionAr, '');
  await fetch(`${base}/api/v1/partners-portal/products/${reviewed.id}/submit-review`, { method: 'POST', headers: brandHeaders });
  assert.equal((await fetch(`${base}/api/v1/admin/catalog-reviews/product/${reviewed.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'reject', revision: await revision('product', reviewed.id), note: 'أبقوا الوصف' }),
  })).status, 201);
  assert.equal(((await (await fetch(`${base}/api/v1/marketplace/catalog/product/${reviewed.id}`)).json()) as { descriptionAr: string }).descriptionAr, 'وصف جديد');
  await fetch(`${base}/api/v1/partners-portal/products/${reviewed.id}/submit-review`, { method: 'POST', headers: brandHeaders });
  assert.equal((await fetch(`${base}/api/v1/admin/catalog-reviews/product/${reviewed.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: await revision('product', reviewed.id) }),
  })).status, 201);
  assert.equal(((await (await fetch(`${base}/api/v1/marketplace/catalog/product/${reviewed.id}`)).json()) as { descriptionAr: string | null }).descriptionAr, null);
  const beforeOmit = await prisma.product.findUniqueOrThrow({ where: { id: reviewed.id } });
  await fetch(`${base}/api/v1/partners-portal/products/${reviewed.id}`, {
    method: 'PATCH', headers: brandHeaders, body: JSON.stringify({ nameAr: 'بلا وصف في الطلب' }),
  });
  const omitted = await prisma.product.findUniqueOrThrow({ where: { id: reviewed.id } });
  assert.equal(omitted.descriptionAr, beforeOmit.descriptionAr);
  assert.equal(omitted.draftDescriptionAr, null);
  assert.equal(omitted.nameEn, beforeOmit.nameEn);

  const serviceFields = await (await fetch(`${base}/api/v1/partners-portal/services`, {
    method: 'POST', headers: clinicHeaders,
    body: JSON.stringify({ nameAr: 'جلسة حقول', nameEn: 'Session fields', descriptionAr: 'وصف الجلسة', durationMin: 25, priceHalalas: 2600, concernTags: ['عناية'] }),
  })).json() as { id: string };
  await addImage('services', serviceFields.id, clinicHeaders);
  await fetch(`${base}/api/v1/partners-portal/services/${serviceFields.id}/submit-review`, { method: 'POST', headers: clinicHeaders });
  assert.equal((await fetch(`${base}/api/v1/admin/catalog-reviews/service/${serviceFields.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: await revision('service', serviceFields.id) }),
  })).status, 201);
  await fetch(`${base}/api/v1/partners-portal/services/${serviceFields.id}`, {
    method: 'PATCH', headers: clinicHeaders,
    body: JSON.stringify({ nameAr: 'جلسة معدلة', nameEn: 'Edited session', descriptionAr: '' }),
  });
  const serviceDraft = await (await fetch(`${base}/api/v1/partners-portal/services/${serviceFields.id}/preview`, { headers: clinicHeaders })).json() as { draftNameEn: string; draftDescriptionAr: string };
  assert.equal(serviceDraft.draftNameEn, 'Edited session');
  assert.equal(serviceDraft.draftDescriptionAr, '');
  await fetch(`${base}/api/v1/partners-portal/services/${serviceFields.id}/submit-review`, { method: 'POST', headers: clinicHeaders });
  assert.equal((await fetch(`${base}/api/v1/admin/catalog-reviews/service/${serviceFields.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: await revision('service', serviceFields.id) }),
  })).status, 201);
  const servicePublic = await (await fetch(`${base}/api/v1/marketplace/catalog/service/${serviceFields.id}`)).json() as { id: string; nameAr: string; nameEn: string; descriptionAr: string | null };
  assert.equal(servicePublic.id, serviceFields.id);
  assert.equal(servicePublic.nameAr, 'جلسة معدلة');
  assert.equal(servicePublic.nameEn, 'Edited session');
  assert.equal(servicePublic.descriptionAr, null);

  const failProduct = await (await fetch(`${base}/api/v1/partners-portal/products`, {
    method: 'POST', headers: brandHeaders,
    body: JSON.stringify({ nameAr: 'قبل الفشل', nameEn: 'Before fail', descriptionAr: 'وصف ثابت', priceHalalas: 1800, externalUrl: 'https://example.com/fail', concernTags: ['لون'] }),
  })).json() as { id: string };
  const failA = await addImage('products', failProduct.id, brandHeaders);
  const failB = await addImage('products', failProduct.id, brandHeaders);
  await fetch(`${base}/api/v1/partners-portal/products/${failProduct.id}/submit-review`, { method: 'POST', headers: brandHeaders });
  assert.equal((await fetch(`${base}/api/v1/admin/catalog-reviews/product/${failProduct.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: await revision('product', failProduct.id) }),
  })).status, 201);
  await fetch(`${base}/api/v1/partners-portal/products/${failProduct.id}`, {
    method: 'PATCH', headers: brandHeaders,
    body: JSON.stringify({ nameAr: 'لن يُنشر', nameEn: 'Not published', descriptionAr: 'لن يُنشر' }),
  });
  await fetch(`${base}/api/v1/partners-portal/products/${failProduct.id}/media/order`, {
    method: 'PATCH', headers: brandHeaders, body: JSON.stringify({ ids: [failB.id, failA.id] }),
  });
  await fetch(`${base}/api/v1/partners-portal/products/${failProduct.id}/submit-review`, { method: 'POST', headers: brandHeaders });
  const beforeFail = await prisma.catalogMedia.findMany({ where: { ownerId: failProduct.id }, orderBy: { sortOrder: 'asc' } });
  const logsBefore = await prisma.catalogReviewLog.count({ where: { ownerId: failProduct.id, action: 'approve' } });
  const notes: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    notes.push(args.map(String).join(' '));
    originalError(...args);
  };
  process.env.MIRA_CATALOG_FAIL_PUBLISH = '1';
  const failed = await fetch(`${base}/api/v1/admin/catalog-reviews/product/${failProduct.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: await revision('product', failProduct.id) }),
  });
  delete process.env.MIRA_CATALOG_FAIL_PUBLISH;
  assert.equal(failed.status, 500);
  assert.ok(notes.some((line) => line.includes('catalog-publish-failpoint-after-write')));
  const failedRow = await prisma.product.findUniqueOrThrow({ where: { id: failProduct.id } });
  assert.equal(failedRow.nameAr, 'قبل الفشل');
  assert.equal(failedRow.descriptionAr, 'وصف ثابت');
  assert.equal(failedRow.reviewStatus, 'in_review');
  const failedMedia = await prisma.catalogMedia.findMany({ where: { ownerId: failProduct.id }, orderBy: { sortOrder: 'asc' } });
  assert.deepEqual(failedMedia.map((row) => [row.id, row.sortOrder, row.isPrimary, row.publication]), beforeFail.map((row) => [row.id, row.sortOrder, row.isPrimary, row.publication]));
  for (const row of failedMedia) assert.ok(await readFile(join(dir, row.storageKey!)));
  assert.equal(await prisma.catalogReviewLog.count({ where: { ownerId: failProduct.id, action: 'approve' } }), logsBefore);
  assert.equal((await fetch(`${base}/api/v1/admin/catalog-reviews/product/${failProduct.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: await revision('product', failProduct.id) }),
  })).status, 201);
  assert.equal(((await (await fetch(`${base}/api/v1/marketplace/catalog/product/${failProduct.id}`)).json()) as { nameAr: string }).nameAr, 'لن يُنشر');
  const repeat = await fetch(`${base}/api/v1/admin/catalog-reviews/product/${failProduct.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: 0 }),
  });
  assert.equal(((await repeat.json()) as { alreadyApplied: boolean }).alreadyApplied, true);

  storage.failDelete = true;
  notes.length = 0;
  const cleanupOwner = await (await fetch(`${base}/api/v1/partners-portal/products`, {
    method: 'POST', headers: brandHeaders,
    body: JSON.stringify({ nameAr: 'تنظيف', nameEn: 'Cleanup', descriptionAr: 'يبقى', priceHalalas: 900, externalUrl: 'https://example.com/clean', concernTags: ['لون'] }),
  })).json() as { id: string };
  const keep = await addImage('products', cleanupOwner.id, brandHeaders);
  const drop = await addImage('products', cleanupOwner.id, brandHeaders);
  await fetch(`${base}/api/v1/partners-portal/products/${cleanupOwner.id}/submit-review`, { method: 'POST', headers: brandHeaders });
  assert.equal((await fetch(`${base}/api/v1/admin/catalog-reviews/product/${cleanupOwner.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: await revision('product', cleanupOwner.id) }),
  })).status, 201);
  await fetch(`${base}/api/v1/partners-portal/products/${cleanupOwner.id}/media/${drop.id}`, { method: 'DELETE', headers: brandHeaders });
  await fetch(`${base}/api/v1/partners-portal/products/${cleanupOwner.id}/submit-review`, { method: 'POST', headers: brandHeaders });
  const cleaned = await fetch(`${base}/api/v1/admin/catalog-reviews/product/${cleanupOwner.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: await revision('product', cleanupOwner.id) }),
  });
  const cleanedBody = await cleaned.json() as { cleanupPending: boolean; contentStatus: string };
  const cleanedText = JSON.stringify(cleanedBody);
  assert.equal(cleaned.status, 201);
  assert.equal(cleanedBody.contentStatus, 'published');
  assert.equal(cleanedBody.cleanupPending, true);
  assert.equal(cleanedText.includes(drop.storageKey), false);
  assert.ok(notes.some((line) => line.includes('catalog-media-cleanup-failed') && line.includes(drop.storageKey)));
  assert.equal((await prisma.catalogMedia.count({ where: { id: keep.id } })), 1);
  console.error = originalError;

  const previousEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  const blockedUpload = await fetch(`${base}/api/v1/partners-portal/products/${cleanupOwner.id}/media`, {
    method: 'POST', headers: brandHeaders, body: JSON.stringify({ mimeType: 'image/png', dataBase64: PNG }),
  });
  if (previousEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousEnv;
  assert.equal(blockedUpload.status, 503);
  const blockedText = await blockedUpload.text();
  assert.equal(blockedText.includes(dir), false);
  assert.equal(await prisma.catalogMedia.count({ where: { ownerId: cleanupOwner.id } }), 1);

  const duplicate = await fetch(`${base}/api/v1/partners-portal/products/${cleanupOwner.id}/media/order`, {
    method: 'PATCH', headers: brandHeaders, body: JSON.stringify({ ids: [keep.id, keep.id] }),
  });
  assert.equal(duplicate.status, 400);

  console.log('Firebase verifier in this run is a test double and does not prove a live Firebase connection');
  console.log('ph3 rc4 http passed');
  await app.close();
  await prisma.$disconnect();
  await rm(dir, { recursive: true, force: true });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
