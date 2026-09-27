import 'reflect-metadata';
import assert from 'node:assert/strict';
import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { PartnerTokenGuard } from '../partners-portal/guards/partner-token.guard';
import { CatalogAdAdminController, CatalogAdPartnerController, CatalogAdPublicController } from './catalog-ad.controller';
import { CatalogAdService } from './catalog-ad.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
  controllers: [CatalogAdPartnerController, CatalogAdAdminController, CatalogAdPublicController],
  providers: [CatalogAdService, PartnerTokenGuard, AdminApiKeyGuard],
})
class Ph4Rc3AdTestModule {}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) process.exit(1);
  const prisma = new PrismaClient();
  const seller = await prisma.partner.create({ data: { type: 'brand', status: 'active', nameAr: 'جهة ب', nameEn: 'Seller B', city: 'الرياض' } });
  const celebrity = await prisma.partner.create({ data: { type: 'brand', status: 'active', nameAr: 'المعلن أ', nameEn: 'Advertiser A', city: 'جدة' } });
  await prisma.partnerUser.create({ data: { partnerId: celebrity.id, email: 'ph4-rc3-a@test.local', accessToken: 'token-ph4-rc3-a' } });
  await prisma.partnerUser.create({ data: { partnerId: seller.id, email: 'ph4-rc3-b@test.local', accessToken: 'token-ph4-rc3-b' } });
  const secretProduct = await prisma.product.create({
    data: { partnerId: seller.id, nameAr: 'سرّ المنتج', nameEn: 'Secret', priceHalalas: 999, externalUrl: 'https://secret.example/product', concernTags: [], skinTypes: [], contentStatus: 'draft', catalogSource: 'catalog', active: true },
  });
  const secretService = await prisma.service.create({
    data: { partnerId: seller.id, nameAr: 'سرّ الخدمة', nameEn: 'Secret service', durationMin: 20, priceHalalas: 777, concernTags: [], contentStatus: 'draft', catalogSource: 'catalog', active: true, bookingEnabled: true },
  });
  const product = await prisma.product.create({
    data: { partnerId: seller.id, nameAr: 'فستان منشور', nameEn: 'Dress', priceHalalas: 1500, externalUrl: 'https://example.com/dress', concernTags: [], skinTypes: [], contentStatus: 'published', catalogSource: 'catalog', active: true },
  });
  const second = await prisma.product.create({
    data: { partnerId: seller.id, nameAr: 'حذاء منشور', nameEn: 'Shoe', priceHalalas: 2200, externalUrl: 'https://example.com/shoe', concernTags: [], skinTypes: [], contentStatus: 'published', catalogSource: 'catalog', active: true },
  });
  const broken = await prisma.product.create({
    data: { partnerId: seller.id, nameAr: 'رابط غير صالح', nameEn: 'Broken', priceHalalas: 100, externalUrl: 'not a url', concernTags: [], skinTypes: [], contentStatus: 'published', catalogSource: 'catalog', active: true },
  });
  const service = await prisma.service.create({
    data: { partnerId: seller.id, nameAr: 'جلسة منشورة', nameEn: 'Session', durationMin: 30, priceHalalas: 4500, concernTags: [], contentStatus: 'published', catalogSource: 'catalog', active: true, bookingEnabled: true },
  });
  await prisma.catalogMedia.create({
    data: { ownerKind: 'product', ownerId: product.id, kind: 'image', url: 'https://example.com/published-dress.jpg', publication: 'published', active: true, pendingRemoval: false },
  });
  process.env.ADMIN_API_KEY = 'ph4-rc3-admin';
  const app = await NestFactory.create(Ph4Rc3AdTestModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: false, transform: false }));
  await app.listen(0);
  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const base = `http://127.0.0.1:${port}`;
  const aHeaders = { authorization: 'Bearer token-ph4-rc3-a', 'content-type': 'application/json' };
  const bHeaders = { authorization: 'Bearer token-ph4-rc3-b', 'content-type': 'application/json' };
  const adminHeaders = { 'x-admin-key': 'ph4-rc3-admin', 'content-type': 'application/json' };

  async function call(path: string, method: string, headers: Record<string, string>, body?: unknown) {
    return fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  }
  function noSecret(text: string) {
    assert.equal(text.includes('سرّ'), false);
    assert.equal(text.includes('secret.example'), false);
    assert.equal(text.includes('999'), false);
    assert.equal(text.includes('777'), false);
  }

  try {
    const rowsBefore = await prisma.catalogAdAction.count();
    const productLeak = await call('/api/v1/partners-portal/ads', 'POST', aHeaders, { targetKind: 'product', targetId: secretProduct.id, captionAr: 'تسريب' });
    const productText = await productLeak.text();
    assert.equal(productLeak.status, 404);
    noSecret(productText);
    assert.equal(await prisma.catalogAd.count({ where: { targetId: secretProduct.id } }), 0);
    const serviceLeak = await call('/api/v1/partners-portal/ads', 'POST', aHeaders, { targetKind: 'service', targetId: secretService.id, captionAr: 'تسريب' });
    noSecret(await serviceLeak.text());
    assert.equal(serviceLeak.status, 404);
    assert.equal(await prisma.catalogAd.count({ where: { targetId: secretService.id } }), 0);

    const ownerDraft = await call('/api/v1/partners-portal/ads', 'POST', bHeaders, { targetKind: 'product', targetId: secretProduct.id, captionAr: 'مسودة المالك' });
    assert.equal(ownerDraft.status, 201);
    const ownerBody = await ownerDraft.json() as { id: string };
    const ownerPreview = await (await call(`/api/v1/partners-portal/ads/${ownerBody.id}`, 'GET', bHeaders)).text();
    assert.equal(ownerPreview.includes('سرّ المنتج'), true);

    const createdResponse = await call('/api/v1/partners-portal/ads', 'POST', aHeaders, { targetKind: 'product', targetId: product.id, captionAr: 'إعلان الفستان' });
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json() as { id: string; reviewRevision: number };
    const relink = await call(`/api/v1/partners-portal/ads/${created.id}`, 'PATCH', aHeaders, { targetKind: 'product', targetId: secretProduct.id });
    noSecret(await relink.text());
    assert.equal(relink.status, 404);
    assert.equal((await prisma.catalogAd.findUniqueOrThrow({ where: { id: created.id } })).targetId, product.id);

    const serviceAdResponse = await call('/api/v1/partners-portal/ads', 'POST', aHeaders, { targetKind: 'service', targetId: service.id, captionAr: 'إعلان الجلسة' });
    const serviceAd = await serviceAdResponse.json() as { id: string };
    const secondAdResponse = await call('/api/v1/partners-portal/ads', 'POST', aHeaders, { targetKind: 'product', targetId: second.id, captionAr: 'إعلان الحذاء' });
    const secondAd = await secondAdResponse.json() as { id: string };
    const brokenResponse = await call('/api/v1/partners-portal/ads', 'POST', aHeaders, { targetKind: 'product', targetId: broken.id, captionAr: 'رابط مكسور' });
    const brokenAd = await brokenResponse.json() as { id: string };
    for (const id of [created.id, serviceAd.id, brokenAd.id, secondAd.id]) {
      await call(`/api/v1/partners-portal/ads/${id}/submit-review`, 'POST', aHeaders, {});
      const seen = await (await call(`/api/v1/partners-portal/ads/${id}`, 'GET', aHeaders)).json() as { submittedRevision: number };
      assert.equal((await call(`/api/v1/admin/catalog-ads/${id}/decision`, 'POST', adminHeaders, { decision: 'approve', revision: seen.submittedRevision })).status, 201);
    }

    const listed = await (await call('/api/v1/marketplace/ads', 'GET', {})).json() as { items: Array<{ id: string; targetId: string; media: Array<{ url: string }> }> };
    const productPublic = listed.items.find((item) => item.id === created.id);
    const servicePublic = listed.items.find((item) => item.id === serviceAd.id);
    assert.ok(productPublic);
    assert.ok(servicePublic);
    assert.notEqual(productPublic.id, productPublic.targetId);
    assert.equal(productPublic.media[0]?.url.includes('/api/v1/marketplace/media/'), true);
    assert.equal(servicePublic.targetId, service.id);

    const beforeValid = await prisma.catalogAdAction.count();
    const opened = await call(`/api/v1/marketplace/ads/${created.id}/link-open`, 'POST', { 'content-type': 'application/json' }, { eventId: 'evt-valid' });
    assert.equal(opened.status, 201);
    assert.equal(await prisma.catalogAdAction.count(), beforeValid + 1);
    const replay = await call(`/api/v1/marketplace/ads/${created.id}/link-open`, 'POST', { 'content-type': 'application/json' }, { eventId: 'evt-valid' });
    assert.equal(replay.status, 201);
    assert.equal(await prisma.catalogAdAction.count(), beforeValid + 1);
    const otherAd = await call(`/api/v1/marketplace/ads/${secondAd.id}/link-open`, 'POST', { 'content-type': 'application/json' }, { eventId: 'evt-valid' });
    assert.equal(otherAd.status, 409);
    assert.equal(await prisma.catalogAdAction.count(), beforeValid + 1);

    const beforeMissing = await prisma.catalogAdAction.count();
    assert.equal((await call(`/api/v1/marketplace/ads/${serviceAd.id}/link-open`, 'POST', { 'content-type': 'application/json' }, { eventId: 'evt-service' })).status, 404);
    assert.equal((await call(`/api/v1/marketplace/ads/${brokenAd.id}/link-open`, 'POST', { 'content-type': 'application/json' }, { eventId: 'evt-broken' })).status, 404);
    assert.equal(await prisma.catalogAdAction.count(), beforeMissing);

    await prisma.product.update({ where: { id: product.id }, data: { contentStatus: 'draft' } });
    const beforeWithdrawnTarget = await prisma.catalogAdAction.count();
    const hiddenOpen = await call(`/api/v1/marketplace/ads/${created.id}/link-open`, 'POST', { 'content-type': 'application/json' }, { eventId: 'evt-hidden' });
    assert.equal(hiddenOpen.status, 404);
    assert.equal(await prisma.catalogAdAction.count(), beforeWithdrawnTarget);
    const publicAfter = await (await call('/api/v1/marketplace/ads', 'GET', {})).text();
    noSecret(publicAfter);
    assert.equal(publicAfter.includes(created.id), false);
    const previewAfter = await (await call(`/api/v1/partners-portal/ads/${created.id}`, 'GET', aHeaders)).text();
    noSecret(previewAfter);
    assert.equal(previewAfter.includes('فستان منشور'), false);
    assert.equal(previewAfter.includes('example.com/dress'), false);
    const adminPreview = await (await call(`/api/v1/admin/catalog-ads/${created.id}`, 'GET', adminHeaders)).text();
    assert.equal(adminPreview.includes('فستان منشور'), true);

    const seenAgain = await (await call(`/api/v1/partners-portal/ads/${serviceAd.id}`, 'GET', aHeaders)).json() as { reviewRevision: number };
    await call(`/api/v1/admin/catalog-ads/${serviceAd.id}/decision`, 'POST', adminHeaders, { decision: 'withdraw', revision: seenAgain.reviewRevision });
    const beforeAdWithdraw = await prisma.catalogAdAction.count();
    assert.equal((await call(`/api/v1/marketplace/ads/${serviceAd.id}/link-open`, 'POST', { 'content-type': 'application/json' }, { eventId: 'evt-withdrawn-ad' })).status, 404);
    assert.equal(await prisma.catalogAdAction.count(), beforeAdWithdraw);
    assert.equal(rowsBefore >= 0, true);
    console.log('ph4 rc3 privacy and link events passed');
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}

void main();
