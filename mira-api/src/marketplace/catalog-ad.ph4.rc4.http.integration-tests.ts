import 'reflect-metadata';
import assert from 'node:assert/strict';
import { Module, UnauthorizedException, ValidationPipe } from '@nestjs/common';
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
import { CatalogAdAdminController, CatalogAdPartnerController, CatalogAdPublicController } from './catalog-ad.controller';
import { CatalogAdService } from './catalog-ad.service';
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
  controllers: [
    PartnersPortalController,
    CatalogMediaController,
    CatalogReviewAdminController,
    MarketplaceController,
    CatalogAdPartnerController,
    CatalogAdAdminController,
    CatalogAdPublicController,
  ],
  providers: [
    PartnersPortalService,
    PartnerTokenGuard,
    AdminApiKeyGuard,
    CatalogContentService,
    CatalogAdService,
    FirebaseAuthGuard,
    { provide: CatalogMediaStorage, useClass: MemoryCatalogMediaStorage },
    { provide: MarketplaceService, useFactory: (prisma: PrismaService) => new MarketplaceService(prisma), inject: [PrismaService] },
    { provide: FirebaseIdTokenVerifier, useClass: ScriptedIdTokenVerifier },
  ],
})
class Ph4Rc4MediaTestModule {}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) process.exit(1);
  process.env.ADMIN_API_KEY = 'ph4-rc4-admin';
  process.env.AUTH_SKIP = 'false';
  const prisma = new PrismaClient();
  const brand = await prisma.partner.create({ data: { type: 'brand', status: 'active', nameAr: 'ماركة الوسائط', nameEn: 'Media brand', city: 'الرياض' } });
  const clinic = await prisma.partner.create({ data: { type: 'clinic', status: 'active', nameAr: 'عيادة الوسائط', nameEn: 'Media clinic', city: 'الرياض' } });
  const salon = await prisma.partner.create({ data: { type: 'salon', status: 'active', nameAr: 'مشغل الوسائط', nameEn: 'Media salon', city: 'جدة' } });
  const celebrity = await prisma.partner.create({ data: { type: 'brand', status: 'active', nameAr: 'المعلن', nameEn: 'Advertiser', city: 'جدة' } });
  await prisma.partnerUser.create({ data: { partnerId: brand.id, email: 'ph4-rc4-brand@test.local', accessToken: 'token-ph4-rc4-brand' } });
  await prisma.partnerUser.create({ data: { partnerId: clinic.id, email: 'ph4-rc4-clinic@test.local', accessToken: 'token-ph4-rc4-clinic' } });
  await prisma.partnerUser.create({ data: { partnerId: salon.id, email: 'ph4-rc4-salon@test.local', accessToken: 'token-ph4-rc4-salon' } });
  await prisma.partnerUser.create({ data: { partnerId: celebrity.id, email: 'ph4-rc4-ad@test.local', accessToken: 'token-ph4-rc4-ad' } });

  const app = await NestFactory.create(Ph4Rc4MediaTestModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: false, transform: false }));
  await app.listen(0);
  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const base = `http://127.0.0.1:${port}`;
  const brandHeaders = { authorization: 'Bearer token-ph4-rc4-brand', 'content-type': 'application/json' };
  const clinicHeaders = { authorization: 'Bearer token-ph4-rc4-clinic', 'content-type': 'application/json' };
  const salonHeaders = { authorization: 'Bearer token-ph4-rc4-salon', 'content-type': 'application/json' };
  const adHeaders = { authorization: 'Bearer token-ph4-rc4-ad', 'content-type': 'application/json' };
  const adminHeaders = { 'x-admin-key': 'ph4-rc4-admin', 'content-type': 'application/json' };

  async function call(path: string, method: string, headers: Record<string, string>, body?: unknown) {
    return fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  }
  async function revision(kind: string, id: string) {
    const body = await (await call(`/api/v1/admin/catalog-reviews/${kind}/${id}`, 'GET', adminHeaders)).json() as { submittedRevision: number };
    return body.submittedRevision;
  }
  async function publish(kind: 'product' | 'service', id: string) {
    assert.equal((await call(`/api/v1/partners-portal/${kind}s/${id}/submit-review`, 'POST', kind === 'product' ? brandHeaders : kind === 'service' ? salonHeaders : brandHeaders)).status, 201);
    assert.equal((await call(`/api/v1/admin/catalog-reviews/${kind}/${id}/decision`, 'POST', adminHeaders, { decision: 'approve', revision: await revision(kind, id) })).status, 201);
  }
  function mediaKey(item: { id?: string; url?: string }) {
    if (item.id) return item.id;
    const match = String(item.url || '').match(/media\/([^/?]+)$/);
    return match ? match[1] : '';
  }
  async function mediaIds(kind: 'product' | 'service', id: string, adId: string) {
    const catalog = await (await call(`/api/v1/marketplace/catalog/${kind}/${id}`, 'GET', {})).json() as { media: Array<{ url: string }> };
    const ads = await (await call('/api/v1/marketplace/ads', 'GET', {})).json() as { items: Array<{ id: string; media: Array<{ id: string; url: string }> }> };
    const ad = ads.items.find((item) => item.id === adId);
    assert.ok(ad);
    return {
      catalog: catalog.media.map((item) => mediaKey(item)).sort(),
      ad: ad.media.map((item) => mediaKey(item)).sort(),
      urls: ad.media.map((item) => item.url),
    };
  }

  try {
    const productResponse = await call('/api/v1/partners-portal/products', 'POST', brandHeaders, {
      nameAr: 'فستان الوسائط', nameEn: 'Media dress', descriptionAr: 'وصف الفستان', priceHalalas: 6400, externalUrl: 'https://example.com/media-dress', concernTags: ['قماش'], active: true,
    });
    const product = await productResponse.json() as { id: string };
    assert.equal(productResponse.status, 201);
    await prisma.product.update({ where: { id: product.id }, data: { category: 'dresses' } });
    const keep = await (await call(`/api/v1/partners-portal/products/${product.id}/media`, 'POST', brandHeaders, { mimeType: 'image/png', dataBase64: PNG })).json() as { id: string };
    const drop = await (await call(`/api/v1/partners-portal/products/${product.id}/media`, 'POST', brandHeaders, { mimeType: 'image/png', dataBase64: PNG })).json() as { id: string };
    await publish('product', product.id);
    const adResponse = await call('/api/v1/partners-portal/ads', 'POST', adHeaders, { targetKind: 'product', targetId: product.id, captionAr: 'إعلان الفستان' });
    const ad = await adResponse.json() as { id: string };
    assert.equal(adResponse.status, 201);
    const seen = await (await call(`/api/v1/partners-portal/ads/${ad.id}`, 'GET', adHeaders)).json() as { submittedRevision: number };
    await call(`/api/v1/partners-portal/ads/${ad.id}/submit-review`, 'POST', adHeaders, {});
    const seenAfter = await (await call(`/api/v1/partners-portal/ads/${ad.id}`, 'GET', adHeaders)).json() as { submittedRevision: number };
    assert.equal((await call(`/api/v1/admin/catalog-ads/${ad.id}/decision`, 'POST', adminHeaders, { decision: 'approve', revision: seenAfter.submittedRevision ?? seen.submittedRevision })).status, 201);

    const before = await mediaIds('product', product.id, ad.id);
    assert.deepEqual(before.catalog, before.ad);
    assert.equal(before.ad.includes(drop.id), true);
    assert.equal(before.urls.every((item) => item.startsWith('/api/v1/marketplace/media/')), true);

    assert.equal((await call(`/api/v1/partners-portal/products/${product.id}/media/${drop.id}`, 'DELETE', brandHeaders)).status, 200);
    const pending = await mediaIds('product', product.id, ad.id);
    assert.deepEqual(pending.catalog, pending.ad);
    assert.equal(pending.ad.includes(drop.id), true);
    assert.equal((await call(`/api/v1/partners-portal/products/${product.id}/submit-review`, 'POST', brandHeaders)).status, 201);
    const reviewing = await mediaIds('product', product.id, ad.id);
    assert.equal(reviewing.ad.includes(drop.id), true);
    assert.equal((await call(`/api/v1/admin/catalog-reviews/product/${product.id}/decision`, 'POST', adminHeaders, { decision: 'reject', note: 'أبقوا الصورة', revision: await revision('product', product.id) })).status, 201);
    const rejected = await mediaIds('product', product.id, ad.id);
    assert.deepEqual(rejected.catalog, rejected.ad);
    assert.equal(rejected.ad.includes(drop.id), true);
    assert.equal((await call(`/api/v1/partners-portal/products/${product.id}/media/${drop.id}`, 'DELETE', brandHeaders)).status, 200);
    assert.equal((await call(`/api/v1/partners-portal/products/${product.id}/submit-review`, 'POST', brandHeaders)).status, 201);
    assert.equal((await call(`/api/v1/admin/catalog-reviews/product/${product.id}/decision`, 'POST', adminHeaders, { decision: 'approve', revision: await revision('product', product.id) })).status, 201);
    const removed = await mediaIds('product', product.id, ad.id);
    assert.deepEqual(removed.catalog, removed.ad);
    assert.equal(removed.ad.includes(drop.id), false);
    assert.equal(removed.ad.includes(keep.id), true);

    const productPublic = (await (await call('/api/v1/marketplace/ads', 'GET', {})).json() as { items: Array<Record<string, unknown>> }).items.find((item) => item.id === ad.id) as {
      seller: { type: string; city: string }; target: { category: string; priceHalalas: number; nameAr: string };
    };
    assert.equal(productPublic.target.category, 'dresses');
    assert.equal(productPublic.target.priceHalalas, 6400);
    assert.equal(productPublic.target.nameAr, 'فستان الوسائط');
    assert.equal(productPublic.seller.city, 'الرياض');

    for (const party of [
      { type: 'clinic', headers: clinicHeaders, city: 'الرياض', category: 'laser', name: 'جلسة ليزر' },
      { type: 'salon', headers: salonHeaders, city: 'جدة', category: 'makeup', name: 'مكياج سهرة' },
    ] as const) {
      const createdService = await call('/api/v1/partners-portal/services', 'POST', party.headers, {
        nameAr: party.name, nameEn: party.name, descriptionAr: 'تفاصيل الخدمة', durationMin: 45, priceHalalas: 9100, concernTags: ['عناية'], bookingEnabled: true, active: true,
      });
      const service = await createdService.json() as { id: string };
      assert.equal(createdService.status, 201, JSON.stringify(service));
      await prisma.service.update({ where: { id: service.id }, data: { category: party.category } });
      const image = await (await call(`/api/v1/partners-portal/services/${service.id}/media`, 'POST', party.headers, { mimeType: 'image/png', dataBase64: PNG })).json() as { id: string };
      const extra = await (await call(`/api/v1/partners-portal/services/${service.id}/media`, 'POST', party.headers, { mimeType: 'image/png', dataBase64: PNG })).json() as { id: string };
      assert.equal((await call(`/api/v1/partners-portal/services/${service.id}/submit-review`, 'POST', party.headers)).status, 201);
      assert.equal((await call(`/api/v1/admin/catalog-reviews/service/${service.id}/decision`, 'POST', adminHeaders, { decision: 'approve', revision: await revision('service', service.id) })).status, 201);
      const serviceAdResponse = await call('/api/v1/partners-portal/ads', 'POST', adHeaders, { targetKind: 'service', targetId: service.id, captionAr: `إعلان ${party.name}` });
      const serviceAd = await serviceAdResponse.json() as { id: string };
      await call(`/api/v1/partners-portal/ads/${serviceAd.id}/submit-review`, 'POST', adHeaders, {});
      const serviceSeen = await (await call(`/api/v1/partners-portal/ads/${serviceAd.id}`, 'GET', adHeaders)).json() as { submittedRevision: number };
      assert.equal((await call(`/api/v1/admin/catalog-ads/${serviceAd.id}/decision`, 'POST', adminHeaders, { decision: 'approve', revision: serviceSeen.submittedRevision })).status, 201);
      const body = (await (await call('/api/v1/marketplace/ads', 'GET', {})).json() as { items: Array<Record<string, any>> }).items.find((item) => item.id === serviceAd.id);
      assert.ok(body);
      assert.equal(body.seller.type, party.type);
      assert.equal(body.seller.city, party.city);
      assert.equal(body.target.durationMin, 45);
      assert.equal(body.target.category, party.category);
      assert.equal(body.target.priceHalalas, 9100);
      assert.equal(body.target.id, service.id);
      assert.equal(body.actions.appointmentOperational, false);
      assert.equal(body.actions.appointmentConfirmed, false);
      if (party.type === 'salon') {
        assert.equal((await call(`/api/v1/partners-portal/services/${service.id}/media/${extra.id}`, 'DELETE', party.headers)).status, 200);
        const still = await mediaIds('service', service.id, serviceAd.id);
        assert.equal(still.catalog.includes(extra.id), true);
        assert.deepEqual(still.catalog, still.ad);
        assert.equal((await call(`/api/v1/partners-portal/services/${service.id}/submit-review`, 'POST', party.headers)).status, 201);
        assert.equal((await call(`/api/v1/admin/catalog-reviews/service/${service.id}/decision`, 'POST', adminHeaders, { decision: 'reject', note: 'أبقوا الصورة', revision: await revision('service', service.id) })).status, 201);
        assert.equal((await mediaIds('service', service.id, serviceAd.id)).ad.includes(extra.id), true);
        assert.equal((await call(`/api/v1/partners-portal/services/${service.id}/media/${extra.id}`, 'DELETE', party.headers)).status, 200);
        assert.equal((await call(`/api/v1/partners-portal/services/${service.id}/submit-review`, 'POST', party.headers)).status, 201);
        assert.equal((await call(`/api/v1/admin/catalog-reviews/service/${service.id}/decision`, 'POST', adminHeaders, { decision: 'approve', revision: await revision('service', service.id) })).status, 201);
        const after = await mediaIds('service', service.id, serviceAd.id);
        assert.equal(after.ad.includes(extra.id), false);
        assert.equal(after.ad.includes(image.id), true);
        assert.deepEqual(after.catalog, after.ad);
      }
    }
    console.log('ph4 rc4 media and service facts passed');
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'ph4 rc4 test failed');
  process.exit(1);
});
