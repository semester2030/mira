import 'reflect-metadata';
import assert from 'node:assert/strict';
import { INestApplication, Module, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { FirebaseAuthGuard } from '../common/guards/firebase-auth.guard';
import { FirebaseIdTokenVerifier, VerifiedFirebaseIdentity } from '../common/auth/firebase-id-token-verifier';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { PartnerTokenGuard } from '../partners-portal/guards/partner-token.guard';
import { PartnersPortalController } from '../partners-portal/partners-portal.controller';
import { PartnersPortalService } from '../partners-portal/partners-portal.service';
import { CatalogContentService } from './catalog-content.service';
import { CatalogMediaController } from './catalog-media.controller';
import { CatalogMediaStorage, MemoryCatalogMediaStorage } from './catalog-media.storage';
import { CatalogReviewAdminController } from './catalog-review.admin.controller';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

class ScriptedIdTokenVerifier extends FirebaseIdTokenVerifier {
  async verify(token: string): Promise<VerifiedFirebaseIdentity> {
    if (token !== 'unused') throw new UnauthorizedException('Invalid token');
    return { uid: 'unused', email: 'unused@test.local' };
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
    FirebaseAuthGuard,
    { provide: CatalogMediaStorage, useClass: MemoryCatalogMediaStorage },
    { provide: MarketplaceService, useFactory: (prisma: PrismaService) => new MarketplaceService(prisma), inject: [PrismaService] },
    { provide: FirebaseIdTokenVerifier, useClass: ScriptedIdTokenVerifier },
  ],
})
class CatalogContentHttpTestModule {}

async function baseUrl(app: INestApplication): Promise<string> {
  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return `http://127.0.0.1:${port}`;
}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: DATABASE_URL must be a local test database');
    process.exit(1);
  }
  process.env.ADMIN_API_KEY = 'ph3-admin-test-key';
  process.env.AUTH_SKIP = 'false';
  const prisma = new PrismaClient();
  const brand = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: 'ماركة المحتوى', nameEn: 'Content brand', city: 'الرياض' },
  });
  const other = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: 'ماركة أخرى', nameEn: 'Other brand', city: 'جدة' },
  });
  const clinic = await prisma.partner.create({
    data: { type: 'clinic', status: 'active', nameAr: 'عيادة المحتوى', nameEn: 'Content clinic', city: 'الرياض' },
  });
  await prisma.partnerUser.create({ data: { partnerId: brand.id, email: 'brand-ph3@test.local', accessToken: 'token-brand-ph3' } });
  await prisma.partnerUser.create({ data: { partnerId: other.id, email: 'other-ph3@test.local', accessToken: 'token-other-ph3' } });
  await prisma.partnerUser.create({ data: { partnerId: clinic.id, email: 'clinic-ph3@test.local', accessToken: 'token-clinic-ph3' } });

  const app = await NestFactory.create(CatalogContentHttpTestModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  await app.listen(0);
  const base = await baseUrl(app);

  const brandHeaders = { authorization: 'Bearer token-brand-ph3', 'content-type': 'application/json' };
  const otherHeaders = { authorization: 'Bearer token-other-ph3', 'content-type': 'application/json' };
  const clinicHeaders = { authorization: 'Bearer token-clinic-ph3', 'content-type': 'application/json' };
  const adminHeaders = { 'x-admin-key': 'ph3-admin-test-key', 'content-type': 'application/json' };
  async function submittedRevision(kind: string, id: string) {
    const body = await (await fetch(`${base}/api/v1/admin/catalog-reviews/${kind}/${id}`, { headers: adminHeaders })).json() as { submittedRevision: number };
    return body.submittedRevision;
  }

  const created = await fetch(`${base}/api/v1/partners-portal/products`, {
    method: 'POST',
    headers: brandHeaders,
    body: JSON.stringify({
      nameAr: 'فستان المراجعة',
      nameEn: 'Review dress',
      descriptionAr: 'وصف منشور لاحقًا',
      priceHalalas: 8900,
      externalUrl: 'https://example.com/dress',
      concernTags: ['لون'],
      active: true,
    }),
  });
  const product = await created.json() as { id: string; contentStatus: string; active: boolean };
  assert.equal(created.status, 201, JSON.stringify(product));
  assert.equal(product.contentStatus, 'draft');
  assert.equal(product.active, false);

  const hidden = await fetch(`${base}/api/v1/marketplace/catalog/${encodeURIComponent('product')}/${product.id}`);
  assert.equal(hidden.status, 404);

  const badMedia = await fetch(`${base}/api/v1/partners-portal/products/${product.id}/media`, {
    method: 'POST',
    headers: brandHeaders,
    body: JSON.stringify({ mimeType: 'image/png', dataBase64: Buffer.from('not-a-png').toString('base64') }),
  });
  assert.equal(badMedia.status, 400);
  assert.equal(await prisma.catalogMedia.count({ where: { ownerId: product.id } }), 0);

  const first = await fetch(`${base}/api/v1/partners-portal/products/${product.id}/media`, {
    method: 'POST',
    headers: brandHeaders,
    body: JSON.stringify({ mimeType: 'image/png', dataBase64: PNG }),
  });
  const firstMedia = await first.json() as { id: string };
  assert.equal(first.status, 201, JSON.stringify(firstMedia));
  const second = await fetch(`${base}/api/v1/partners-portal/products/${product.id}/media`, {
    method: 'POST',
    headers: brandHeaders,
    body: JSON.stringify({ mimeType: 'image/png', dataBase64: PNG }),
  });
  const secondMedia = await second.json() as { id: string };
  assert.equal(second.status, 201);
  const ordered = await fetch(`${base}/api/v1/partners-portal/products/${product.id}/media/order`, {
    method: 'PATCH',
    headers: brandHeaders,
    body: JSON.stringify({ ids: [secondMedia.id, firstMedia.id] }),
  });
  assert.equal(ordered.status, 200);
  const primary = await fetch(`${base}/api/v1/partners-portal/products/${product.id}/media/${secondMedia.id}/primary`, {
    method: 'PATCH',
    headers: brandHeaders,
  });
  assert.equal(primary.status, 200);

  const publicMedia = await fetch(`${base}/api/v1/marketplace/media/${firstMedia.id}`);
  assert.equal(publicMedia.status, 404);
  const ownerMedia = await fetch(`${base}/api/v1/partners-portal/media/${firstMedia.id}`, { headers: brandHeaders });
  assert.equal(ownerMedia.status, 200);
  const stolen = await fetch(`${base}/api/v1/partners-portal/media/${firstMedia.id}`, { headers: otherHeaders });
  assert.equal(stolen.status, 404);

  const bare = await (await fetch(`${base}/api/v1/partners-portal/products`, {
    method: 'POST', headers: brandHeaders,
    body: JSON.stringify({ nameAr: 'بلا صورة', nameEn: 'No image', priceHalalas: 100, externalUrl: 'https://example.com/none', concernTags: ['لون'] }),
  })).json() as { id: string };
  await prisma.product.update({ where: { id: bare.id }, data: { reviewStatus: 'in_review', submittedRevision: 0, reviewRevision: 0 } });
  const noMedia = await fetch(`${base}/api/v1/admin/catalog-reviews/product/${bare.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: 0 }),
  });
  assert.equal(noMedia.status, 400);
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: bare.id } })).contentStatus, 'draft');
  const submitted = await fetch(`${base}/api/v1/partners-portal/products/${product.id}/submit-review`, { method: 'POST', headers: brandHeaders });
  assert.equal(submitted.status, 201);
  const stillHidden = await fetch(`${base}/api/v1/marketplace/catalog/product/${product.id}`);
  assert.equal(stillHidden.status, 404);

  const emptyDecision = await fetch(`${base}/api/v1/admin/catalog-reviews/product/${product.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({}),
  });
  assert.equal(emptyDecision.status, 400);
  const unknownDecision = await fetch(`${base}/api/v1/admin/catalog-reviews/product/${product.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'publish' }),
  });
  assert.equal(unknownDecision.status, 400);
  const earlyApprove = await fetch(`${base}/api/v1/admin/catalog-reviews/product/${product.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: 0 }),
  });
  assert.equal(earlyApprove.status, 409);
  assert.equal((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).contentStatus, 'draft');
  const selfApprove = await fetch(`${base}/api/v1/admin/catalog-reviews/product/${product.id}/decision`, {
    method: 'POST',
    headers: brandHeaders,
    body: JSON.stringify({ decision: 'approve' }),
  });
  assert.equal(selfApprove.status, 401);
  const rejected = await fetch(`${base}/api/v1/admin/catalog-reviews/product/${product.id}/decision`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ decision: 'reject', note: 'الصورة تحتاج وضوحًا', revision: await submittedRevision('product', product.id) }),
  });
  assert.equal(rejected.status, 201);
  const preview = await fetch(`${base}/api/v1/partners-portal/products/${product.id}/preview`, { headers: brandHeaders });
  const previewBody = await preview.json() as { reviewNote: string; contentStatus: string; reviewStatus: string };
  assert.equal(previewBody.contentStatus, 'draft');
  assert.equal(previewBody.reviewStatus, 'rejected');
  assert.equal(previewBody.reviewNote, 'الصورة تحتاج وضوحًا');
  const otherPreview = await fetch(`${base}/api/v1/partners-portal/products/${product.id}/preview`, { headers: otherHeaders });
  assert.equal(otherPreview.status, 404);

  const resubmit = await fetch(`${base}/api/v1/partners-portal/products/${product.id}/submit-review`, { method: 'POST', headers: brandHeaders });
  assert.equal(resubmit.status, 201);
  const approved = await fetch(`${base}/api/v1/admin/catalog-reviews/product/${product.id}/decision`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ decision: 'approve', revision: await submittedRevision('product', product.id) }),
  });
  assert.equal(approved.status, 201);
  const detail = await fetch(`${base}/api/v1/marketplace/catalog/product/${product.id}`);
  const detailBody = await detail.json() as { id: string; priceHalalas: number; nameAr: string };
  assert.equal(detail.status, 200);
  assert.equal(detailBody.id, product.id);
  assert.equal(detailBody.priceHalalas, 8900);
  const feed = await (await fetch(`${base}/api/v1/marketplace/catalog?partnerId=${brand.id}&limit=24`)).json() as { items: { id: string }[] };
  assert.ok(feed.items.some((item) => item.id === product.id));
  const store = await fetch(`${base}/api/v1/marketplace/partners/${brand.id}`);
  const storeBody = await store.json() as { products: { id: string }[] };
  assert.ok(storeBody.products.some((item) => item.id === product.id));
  const publishedMedia = await fetch(`${base}/api/v1/marketplace/media/${firstMedia.id}`);
  assert.equal(publishedMedia.status, 200);

  const edited = await fetch(`${base}/api/v1/partners-portal/products/${product.id}`, {
    method: 'PATCH',
    headers: brandHeaders,
    body: JSON.stringify({
      nameAr: 'اسم مسودة جديد',
      nameEn: 'Review dress',
      descriptionAr: 'وصف مسودة',
      priceHalalas: 9100,
      externalUrl: 'https://example.com/dress',
      concernTags: ['لون'],
      active: true,
    }),
  });
  const editedBody = await edited.json() as { nameAr: string; priceHalalas: number; draftNameAr: string; contentStatus: string };
  assert.equal(edited.status, 200, JSON.stringify(editedBody));
  assert.equal(editedBody.nameAr, 'فستان المراجعة');
  assert.equal(editedBody.draftNameAr, 'اسم مسودة جديد');
  assert.equal(editedBody.priceHalalas, 9100);
  assert.equal(editedBody.contentStatus, 'published');
  const liveAfterEdit = await (await fetch(`${base}/api/v1/marketplace/catalog/product/${product.id}`)).json() as { nameAr: string; priceHalalas: number; media: { id: string; sortOrder: number; isPrimary: boolean }[] };
  assert.equal(liveAfterEdit.nameAr, 'فستان المراجعة');
  assert.equal(liveAfterEdit.priceHalalas, 9100);
  const liveOrder = liveAfterEdit.media.map((item) => item.id).join(',');
  const reorderedLive = await fetch(`${base}/api/v1/partners-portal/products/${product.id}/media/order`, {
    method: 'PATCH', headers: brandHeaders, body: JSON.stringify({ ids: [firstMedia.id, secondMedia.id] }),
  });
  assert.equal(reorderedLive.status, 200);
  const duringDraft = await (await fetch(`${base}/api/v1/marketplace/catalog/product/${product.id}`)).json() as { nameAr: string; media: { id: string }[] };
  assert.equal(duringDraft.nameAr, 'فستان المراجعة');
  assert.equal(duringDraft.media.map((item) => item.id).join(','), liveOrder);
  const removal = await fetch(`${base}/api/v1/partners-portal/products/${product.id}/media/${firstMedia.id}`, { method: 'DELETE', headers: brandHeaders });
  assert.equal(removal.status, 200);
  assert.equal((await fetch(`${base}/api/v1/marketplace/media/${firstMedia.id}`)).status, 200);
  const submittedEdit = await fetch(`${base}/api/v1/partners-portal/products/${product.id}/submit-review`, { method: 'POST', headers: brandHeaders });
  assert.equal(submittedEdit.status, 201);
  const whileReview = await (await fetch(`${base}/api/v1/marketplace/catalog/product/${product.id}`)).json() as { nameAr: string };
  assert.equal(whileReview.nameAr, 'فستان المراجعة');
  const rejectEdit = await fetch(`${base}/api/v1/admin/catalog-reviews/product/${product.id}/decision`, {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ decision: 'reject', note: 'أبقوا الاسم المنشور', revision: await submittedRevision('product', product.id) }),
  });
  assert.equal(rejectEdit.status, 201);
  const afterReject = await (await fetch(`${base}/api/v1/marketplace/catalog/product/${product.id}`)).json() as { nameAr: string };
  assert.equal(afterReject.nameAr, 'فستان المراجعة');
  assert.equal((await fetch(`${base}/api/v1/marketplace/media/${firstMedia.id}`)).status, 200);
  const partnerPreview = await (await fetch(`${base}/api/v1/partners-portal/products/${product.id}/preview`, { headers: brandHeaders })).json() as { reviewNote: string; contentStatus: string };
  assert.equal(partnerPreview.reviewNote, 'أبقوا الاسم المنشور');
  assert.equal(partnerPreview.contentStatus, 'published');
  await fetch(`${base}/api/v1/partners-portal/products/${product.id}/submit-review`, { method: 'POST', headers: brandHeaders });
  const stale = await submittedRevision('product', product.id);
  await fetch(`${base}/api/v1/partners-portal/products/${product.id}`, {
    method: 'PATCH', headers: brandHeaders,
    body: JSON.stringify({ nameAr: 'تعديل أثناء المراجعة', nameEn: 'Review dress', descriptionAr: 'وصف', priceHalalas: 9100, externalUrl: 'https://example.com/dress', concernTags: ['لون'] }),
  });
  const conflict = await fetch(`${base}/api/v1/admin/catalog-reviews/product/${product.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: stale }),
  });
  assert.equal(conflict.status, 409);
  assert.equal(((await (await fetch(`${base}/api/v1/marketplace/catalog/product/${product.id}`)).json()) as { nameAr: string }).nameAr, 'فستان المراجعة');
  await fetch(`${base}/api/v1/partners-portal/products/${product.id}/submit-review`, { method: 'POST', headers: brandHeaders });
  const applied = await fetch(`${base}/api/v1/admin/catalog-reviews/product/${product.id}/decision`, {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ decision: 'approve', revision: await submittedRevision('product', product.id) }),
  });
  assert.equal(applied.status, 201, await applied.clone().text());
  const afterApply = await (await fetch(`${base}/api/v1/marketplace/catalog/product/${product.id}`)).json() as { nameAr: string; id: string; media: { id: string }[] };
  assert.equal(afterApply.nameAr, 'تعديل أثناء المراجعة');
  assert.equal(afterApply.id, product.id);
  assert.equal(afterApply.media.some((item) => item.id === firstMedia.id), false);
  assert.equal((await fetch(`${base}/api/v1/marketplace/media/${firstMedia.id}`)).status, 404);
  const repeat = await fetch(`${base}/api/v1/admin/catalog-reviews/product/${product.id}/decision`, {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ decision: 'approve', revision: 0 }),
  });
  assert.equal(repeat.status, 201);
  assert.equal(((await repeat.json()) as { alreadyApplied: boolean }).alreadyApplied, true);
  const feedAfterEdit = await (await fetch(`${base}/api/v1/marketplace/catalog?partnerId=${brand.id}&limit=24`)).json() as { items: { id: string; nameAr: string }[] };
  const feedRow = feedAfterEdit.items.find((item) => item.id === product.id);
  assert.ok(feedRow);
  assert.equal(feedRow.nameAr, 'تعديل أثناء المراجعة');

  const withdrawn = await fetch(`${base}/api/v1/admin/catalog-reviews/product/${product.id}/decision`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ decision: 'withdraw', note: 'سحب من النشر' }),
  });
  assert.equal(withdrawn.status, 201);
  assert.equal((await fetch(`${base}/api/v1/marketplace/catalog/product/${product.id}`)).status, 404);
  const storeAfter = await (await fetch(`${base}/api/v1/marketplace/partners/${brand.id}`)).json() as { products: { id: string }[] };
  assert.equal(storeAfter.products.some((item) => item.id === product.id), false);

  const serviceRes = await fetch(`${base}/api/v1/partners-portal/services`, {
    method: 'POST',
    headers: clinicHeaders,
    body: JSON.stringify({ nameAr: 'جلسة مراجعة', nameEn: 'Review session', durationMin: 30, priceHalalas: 4500, concernTags: ['عناية'], active: true }),
  });
  const service = await serviceRes.json() as { id: string; contentStatus: string };
  assert.equal(serviceRes.status, 201, JSON.stringify(service));
  assert.equal(service.contentStatus, 'draft');
  const serviceMedia = await fetch(`${base}/api/v1/partners-portal/services/${service.id}/media`, {
    method: 'POST',
    headers: clinicHeaders,
    body: JSON.stringify({ mimeType: 'image/png', dataBase64: PNG }),
  });
  assert.equal(serviceMedia.status, 201);
  assert.equal((await fetch(`${base}/api/v1/partners-portal/services/${service.id}/submit-review`, { method: 'POST', headers: clinicHeaders })).status, 201);
  const serviceReject = await fetch(`${base}/api/v1/admin/catalog-reviews/service/${service.id}/decision`, {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ decision: 'reject', note: 'توضيح الخدمة', revision: await submittedRevision('service', service.id) }),
  });
  assert.equal(serviceReject.status, 201);
  assert.equal((await fetch(`${base}/api/v1/marketplace/catalog/service/${service.id}`)).status, 404);
  await fetch(`${base}/api/v1/partners-portal/services/${service.id}/submit-review`, { method: 'POST', headers: clinicHeaders });
  assert.equal((await fetch(`${base}/api/v1/admin/catalog-reviews/service/${service.id}/decision`, {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ decision: 'approve', revision: await submittedRevision('service', service.id) }),
  })).status, 201);
  const serviceDetail = await fetch(`${base}/api/v1/marketplace/catalog/service/${service.id}`);
  assert.equal(serviceDetail.status, 200);
  assert.equal(((await serviceDetail.json()) as { id: string }).id, service.id);
  await fetch(`${base}/api/v1/partners-portal/services/${service.id}`, {
    method: 'PATCH', headers: clinicHeaders,
    body: JSON.stringify({ nameAr: 'مسودة الجلسة', nameEn: 'Review session', durationMin: 30, priceHalalas: 4500, concernTags: ['عناية'] }),
  });
  assert.equal(((await (await fetch(`${base}/api/v1/marketplace/catalog/service/${service.id}`)).json()) as { nameAr: string }).nameAr, 'جلسة مراجعة');
  await fetch(`${base}/api/v1/partners-portal/services/${service.id}/submit-review`, { method: 'POST', headers: clinicHeaders });
  await fetch(`${base}/api/v1/admin/catalog-reviews/service/${service.id}/decision`, {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ decision: 'reject', note: 'أبقوا اسم الخدمة', revision: await submittedRevision('service', service.id) }),
  });
  assert.equal(((await (await fetch(`${base}/api/v1/marketplace/catalog/service/${service.id}`)).json()) as { nameAr: string }).nameAr, 'جلسة مراجعة');
  await fetch(`${base}/api/v1/partners-portal/services/${service.id}/submit-review`, { method: 'POST', headers: clinicHeaders });
  assert.equal((await fetch(`${base}/api/v1/admin/catalog-reviews/service/${service.id}/decision`, {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ decision: 'approve', revision: await submittedRevision('service', service.id) }),
  })).status, 201);
  assert.equal(((await (await fetch(`${base}/api/v1/marketplace/catalog/service/${service.id}`)).json()) as { nameAr: string; id: string }).nameAr, 'مسودة الجلسة');

  const batch = (count: number, prefix: string) => Array.from({ length: count }, (_, index) => ({
    externalId: `${prefix}-${index}`,
    nameAr: `مستورد ${prefix} ${index}`,
    priceHalalas: 1000 + index,
    available: true,
  }));
  const imported = await fetch(`${base}/api/v1/partners-portal/import/simulated`, {
    method: 'POST',
    headers: brandHeaders,
    body: JSON.stringify({ items: batch(50, 'b50') }),
  });
  const importedBody = await imported.json() as { mode: string; connected: boolean; created: number };
  assert.equal(imported.status, 201, JSON.stringify(importedBody));
  assert.equal(importedBody.mode, 'simulated');
  assert.equal(importedBody.connected, false);
  assert.equal(importedBody.created, 50);
  const again = await (await fetch(`${base}/api/v1/partners-portal/import/simulated`, {
    method: 'POST', headers: brandHeaders, body: JSON.stringify({ items: batch(50, 'b50').map((item) => ({ ...item, priceHalalas: 2222 })) }),
  })).json() as { created: number; updated: number };
  assert.equal(again.created, 0);
  assert.equal(again.updated, 50);
  assert.equal(await prisma.catalogSourceLink.count({ where: { partnerId: brand.id, externalId: { startsWith: 'b50-' } } }), 50);
  await fetch(`${base}/api/v1/partners-portal/import/simulated/b50-0/mira-note`, {
    method: 'PATCH', headers: brandHeaders, body: JSON.stringify({ note: 'إضافة ميرا' }),
  });
  const synced = await (await fetch(`${base}/api/v1/partners-portal/import/simulated`, {
    method: 'POST',
    headers: brandHeaders,
    body: JSON.stringify({ items: [{ externalId: 'b50-0', nameAr: 'اسم مصدر', priceHalalas: 3333, available: true }] }),
  })).json() as { updated: number };
  assert.equal(synced.updated, 1);
  const link = await prisma.catalogSourceLink.findUniqueOrThrow({
    where: { partnerId_source_externalId: { partnerId: brand.id, source: 'simulated', externalId: 'b50-0' } },
  });
  assert.equal(link.miraNoteAr, 'إضافة ميرا');
  const linkedProduct = await prisma.product.findUniqueOrThrow({ where: { id: link.ownerId } });
  assert.equal(linkedProduct.priceHalalas, 3333);
  assert.notEqual(linkedProduct.nameAr, 'اسم مصدر');
  const beforeError = linkedProduct.priceHalalas;
  const errored = await (await fetch(`${base}/api/v1/partners-portal/import/simulated`, {
    method: 'POST',
    headers: brandHeaders,
    body: JSON.stringify({ items: [{ externalId: 'b50-0', nameAr: 'لن يُطبق', priceHalalas: 0, syncError: true }] }),
  })).json() as { errors: { message: string }[] };
  assert.equal(errored.errors.length, 1);
  const afterError = await prisma.product.findUniqueOrThrow({ where: { id: link.ownerId } });
  assert.equal(afterError.priceHalalas, beforeError);
  await prisma.product.update({ where: { id: link.ownerId }, data: { contentStatus: 'published', active: true, reviewStatus: 'none' } });
  const unavailable = await (await fetch(`${base}/api/v1/partners-portal/import/simulated`, {
    method: 'POST', headers: brandHeaders,
    body: JSON.stringify({ items: [{ externalId: 'b50-0', nameAr: 'اسم مصدر', priceHalalas: 1, available: false }] }),
  })).json() as { updated: number };
  assert.equal(unavailable.updated, 1);
  const hiddenRow = await prisma.product.findUniqueOrThrow({ where: { id: link.ownerId } });
  assert.equal(hiddenRow.active, false);
  assert.equal(hiddenRow.priceHalalas, beforeError);
  assert.equal(hiddenRow.contentStatus, 'published');
  const restored = await (await fetch(`${base}/api/v1/partners-portal/import/simulated`, {
    method: 'POST', headers: brandHeaders,
    body: JSON.stringify({ items: [{ externalId: 'b50-0', nameAr: 'اسم مصدر', priceHalalas: 4444, available: true }] }),
  })).json() as { updated: number };
  assert.equal(restored.updated, 1);
  const visible = await prisma.product.findUniqueOrThrow({ where: { id: link.ownerId } });
  assert.equal(visible.active, true);
  assert.equal(visible.priceHalalas, 4444);
  assert.equal(visible.contentStatus, 'published');
  await fetch(`${base}/api/v1/partners-portal/import/simulated`, {
    method: 'POST', headers: brandHeaders,
    body: JSON.stringify({ items: [{ externalId: 'b50-0', nameAr: 'محذوف', priceHalalas: 9, removed: true }] }),
  });
  const removed = await prisma.product.findUniqueOrThrow({ where: { id: link.ownerId } });
  assert.equal(removed.contentStatus, 'withdrawn');
  assert.equal(removed.active, false);
  assert.equal(removed.priceHalalas, 4444);
  const larger = await (await fetch(`${base}/api/v1/partners-portal/import/simulated`, {
    method: 'POST', headers: brandHeaders, body: JSON.stringify({ items: batch(200, 'b200') }),
  })).json() as { created: number; mode: string };
  assert.equal(larger.created, 200);
  assert.equal(larger.mode, 'simulated');
  assert.equal(await prisma.product.count({ where: { partnerId: brand.id, nameAr: { startsWith: 'مستورد b200' } } }), 200);
  const [raceOne, raceTwo] = await Promise.all([
    fetch(`${base}/api/v1/partners-portal/import/simulated`, { method: 'POST', headers: brandHeaders, body: JSON.stringify({ items: [{ externalId: 'same-ext', nameAr: 'متزامن', priceHalalas: 1500 }] }) }),
    fetch(`${base}/api/v1/partners-portal/import/simulated`, { method: 'POST', headers: brandHeaders, body: JSON.stringify({ items: [{ externalId: 'same-ext', nameAr: 'متزامن', priceHalalas: 1600 }] }) }),
  ]);
  assert.equal(raceOne.status, 201);
  assert.equal(raceTwo.status, 201);
  assert.equal(await prisma.catalogSourceLink.count({ where: { partnerId: brand.id, externalId: 'same-ext' } }), 1);
  const failedLink = await (await fetch(`${base}/api/v1/partners-portal/import/simulated`, {
    method: 'POST', headers: brandHeaders,
    body: JSON.stringify({ items: [{ externalId: 'orphan-ext', nameAr: 'يتيم', priceHalalas: 10, failBeforeLink: true }] }),
  })).json() as { errors: { message: string }[]; created: number };
  assert.equal(failedLink.created, 0);
  assert.equal(failedLink.errors.length, 1);
  assert.equal(await prisma.product.count({ where: { partnerId: brand.id, nameAr: 'يتيم' } }), 0);
  const partial = await (await fetch(`${base}/api/v1/partners-portal/import/simulated`, {
    method: 'POST', headers: brandHeaders,
    body: JSON.stringify({ items: [{ externalId: 'media-retry', nameAr: 'وسائط ناقصة', priceHalalas: 20, failMediaAt: 0, media: [{ mimeType: 'image/png', dataBase64: PNG }, { mimeType: 'image/png', dataBase64: PNG }] }] }),
  })).json() as { results: { mediaAdded: number }[] };
  assert.equal(partial.results[0].mediaAdded, 1);
  const retried = await (await fetch(`${base}/api/v1/partners-portal/import/simulated`, {
    method: 'POST', headers: brandHeaders,
    body: JSON.stringify({ items: [{ externalId: 'media-retry', nameAr: 'وسائط ناقصة', priceHalalas: 20, media: [{ mimeType: 'image/png', dataBase64: PNG }, { mimeType: 'image/png', dataBase64: PNG }] }] }),
  })).json() as { created: number; updated: number; results: { mediaAdded: number }[] };
  assert.equal(retried.created, 0);
  assert.equal(retried.updated, 1);
  assert.equal(retried.results[0].mediaAdded, 1);
  const linkRetry = await prisma.catalogSourceLink.findUniqueOrThrow({
    where: { partnerId_source_externalId: { partnerId: brand.id, source: 'simulated', externalId: 'media-retry' } },
  });
  assert.equal(await prisma.catalogMedia.count({ where: { ownerId: linkRetry.ownerId } }), 2);
  const logs = await prisma.catalogReviewLog.count({ where: { ownerId: product.id } });
  assert.ok(logs >= 3);

  console.log('ph3 content http passed');
  console.log('import source: simulated, connected false');
  await app.close();
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
