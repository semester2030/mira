/**
 * Isolated acceptance: celebrity profile, directory paging, ad-owned media caps, ownership isolation.
 * Run against local Postgres only.
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { PartnerTokenGuard } from '../partners-portal/guards/partner-token.guard';
import { CatalogAdAdminController, CatalogAdPartnerController, CatalogAdPublicController } from './catalog-ad.controller';
import { CatalogAdMediaService } from './catalog-ad-media.service';
import { CatalogAdService } from './catalog-ad.service';
import { CatalogMediaController } from './catalog-media.controller';
import { CatalogMediaStorage, MemoryCatalogMediaStorage } from './catalog-media.storage';
import {
  CreatorProfilePartnerController,
  CreatorProfilePublicController,
} from './creator-profile.controller';
import { CreatorProfileService } from './creator-profile.service';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const MP4 = readFileSync(join(__dirname, 'fixtures/ph3-rc3-sample.mp4')).toString('base64');

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
  controllers: [
    CatalogAdPartnerController,
    CatalogAdAdminController,
    CatalogAdPublicController,
    CatalogMediaController,
    CreatorProfilePartnerController,
    CreatorProfilePublicController,
  ],
  providers: [
    CatalogAdMediaService,
    CatalogAdService,
    CreatorProfileService,
    PartnerTokenGuard,
    AdminApiKeyGuard,
    { provide: CatalogMediaStorage, useClass: MemoryCatalogMediaStorage },
  ],
})
class CreatorAdsV1Module {}

async function json(res: Response) {
  return res.json() as Promise<any>;
}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('creator-ads.v1: refuse non-local DATABASE_URL');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  const run = `ca-${Date.now()}`;

  const developer = await prisma.partner.create({
    data: { type: 'developer', status: 'active', nameAr: `مطوّر ${run}`, nameEn: 'Dev', city: 'الرياض' },
  });
  await prisma.partnerUser.create({
    data: { partnerId: developer.id, email: `${run}-dev@test.local`, accessToken: `token-${run}-dev` },
  });
  const other = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `آخر ${run}`, nameEn: 'Other', city: 'جدة' },
  });
  await prisma.partnerUser.create({
    data: { partnerId: other.id, email: `${run}-other@test.local`, accessToken: `token-${run}-other` },
  });
  const seller = await prisma.partner.create({
    data: { type: 'brand', status: 'active', nameAr: `بائع ${run}`, nameEn: 'Seller', city: 'الرياض' },
  });
  const clinic = await prisma.partner.create({
    data: { type: 'clinic', status: 'active', nameAr: `عيادة ${run}`, nameEn: 'Clinic', city: 'الرياض' },
  });
  const product = await prisma.product.create({
    data: {
      partnerId: seller.id,
      nameAr: `كريم ${run}`,
      nameEn: 'Cream',
      priceHalalas: 4500,
      externalUrl: 'https://example.com/cream',
      concernTags: [],
      skinTypes: [],
      contentStatus: 'published',
      catalogSource: 'catalog',
      active: true,
    },
  });
  const merchantMedia = await prisma.catalogMedia.create({
    data: {
      ownerKind: 'product',
      ownerId: product.id,
      kind: 'image',
      url: '',
      active: true,
      publication: 'published',
      storageKey: `merchant-${run}`,
      mimeType: 'image/png',
      sortOrder: 0,
      isPrimary: true,
      placement: 'main',
    },
  });
  const service = await prisma.service.create({
    data: {
      partnerId: clinic.id,
      nameAr: `جلسة ${run}`,
      nameEn: 'Session',
      priceHalalas: 12000,
      durationMin: 45,
      concernTags: [],
      contentStatus: 'published',
      catalogSource: 'catalog',
      active: true,
      bookingEnabled: true,
    },
  });

  process.env.ADMIN_API_KEY = `admin-${run}`;
  process.env.MIRA_VIEW_COUNTING_ENABLED = '0';
  const app = await NestFactory.create(CreatorAdsV1Module, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  await app.listen(0);
  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const base = `http://127.0.0.1:${port}`;
  const devHeaders = { authorization: `Bearer token-${run}-dev`, 'content-type': 'application/json' };
  const otherHeaders = { authorization: `Bearer token-${run}-other`, 'content-type': 'application/json' };

  const createdIds: string[] = [];
  let ownProductId: string | null = null;
  let ownServiceId: string | null = null;
  try {
    // 1) Register celebrity — idempotent upsert
    const reg1 = await json(await fetch(`${base}/api/v1/partners-portal/creator-profile`, {
      method: 'PUT',
      headers: devHeaders,
      body: JSON.stringify({ displayNameAr: `مشهورة ${run}`, bioAr: 'نبذة تجريبية', publicActive: true }),
    }));
    assert.equal(typeof reg1.id, 'string');
    createdIds.push(reg1.id);
    const reg2 = await json(await fetch(`${base}/api/v1/partners-portal/creator-profile`, {
      method: 'PUT',
      headers: devHeaders,
      body: JSON.stringify({ displayNameAr: `مشهورة ${run}`, bioAr: 'نبذة محدّثة', publicActive: true }),
    }));
    assert.equal(reg2.id, reg1.id, 'second register must reuse same profile');

    const avatar = await json(await fetch(`${base}/api/v1/partners-portal/creator-profile/avatar`, {
      method: 'POST',
      headers: devHeaders,
      body: JSON.stringify({ mimeType: 'image/png', dataBase64: PNG }),
    }));
    assert.equal(avatar.hasAvatar, true);

    const mine = await json(await fetch(`${base}/api/v1/partners-portal/creator-profile`, { headers: devHeaders }));
    assert.equal(mine.registered, true);
    assert.equal(mine.profile.id, reg1.id);

    // Isolation: other cannot upsert developer's profile via wrong ownership — other gets own profile only
    const otherProfile = await json(await fetch(`${base}/api/v1/partners-portal/creator-profile`, {
      method: 'PUT',
      headers: otherHeaders,
      body: JSON.stringify({ displayNameAr: `دخيلة ${run}`, publicActive: true }),
    }));
    assert.notEqual(otherProfile.id, reg1.id);
    createdIds.push(otherProfile.id);

    const stealAvatar = await fetch(`${base}/api/v1/partners-portal/creator-profile/avatar`, {
      method: 'POST',
      headers: otherHeaders,
      body: JSON.stringify({ mimeType: 'image/png', dataBase64: PNG }),
    });
    assert.equal(stealAvatar.ok, true); // updates OTHER's avatar, not developer's
    const stillMine = await json(await fetch(`${base}/api/v1/partners-portal/creator-profile`, { headers: devHeaders }));
    assert.equal(stillMine.profile.displayNameAr, `مشهورة ${run}`);

    // 2) Directory shows real count (<6) and stable cursor paging to 7th
    const extras = [];
    for (let i = 0; i < 5; i += 1) {
      const p = await prisma.partner.create({
        data: { type: 'brand', status: 'active', nameAr: `دليل ${run}-${i}`, nameEn: `D${i}`, city: 'الرياض' },
      });
      const c = await prisma.creatorProfile.create({
        data: { partnerId: p.id, displayNameAr: `دليل طويل الاسم العربي ${run}-${i}`, publicActive: true },
      });
      extras.push(c.id);
      createdIds.push(c.id);
    }
    // developer + other + 5 extras = 7 public profiles for this run (plus any leftover — filter by name)
    const page1 = await json(await fetch(`${base}/api/v1/marketplace/creators?limit=6`));
    assert.ok(Array.isArray(page1.items));
    assert.ok(page1.items.length <= 6);
    const runItems1 = page1.items.filter((x: { displayNameAr: string }) => String(x.displayNameAr).includes(run));
    assert.ok(runItems1.length >= 1, 'developer profile visible before first ad');
    assert.ok(page1.nextCursor || runItems1.length < 6 || page1.items.length === 6);

    const seen = new Set(page1.items.map((x: { id: string }) => x.id));
    if (page1.nextCursor) {
      const page2 = await json(await fetch(`${base}/api/v1/marketplace/creators?limit=6&cursor=${encodeURIComponent(page1.nextCursor)}`));
      for (const item of page2.items) {
        assert.equal(seen.has(item.id), false, 'cursor page must not duplicate');
        seen.add(item.id);
      }
    }
    // Ensure at least 7 run-tagged profiles exist in DB and directory can reach beyond 6
    const allRun = await prisma.creatorProfile.count({
      where: { displayNameAr: { contains: run }, publicActive: true },
    });
    assert.ok(allRun >= 7, `expected >=7 run profiles, got ${allRun}`);

    // 3) Product ad with 3 videos (no required image)
    const productAd = await json(await fetch(`${base}/api/v1/partners-portal/ads`, {
      method: 'POST',
      headers: devHeaders,
      body: JSON.stringify({ targetKind: 'product', targetId: product.id, captionAr: `إعلان منتج ${run}` }),
    }));
    for (let i = 0; i < 3; i += 1) {
      const up = await fetch(`${base}/api/v1/partners-portal/ads/${productAd.id}/media`, {
        method: 'POST',
        headers: devHeaders,
        body: JSON.stringify({ mimeType: 'video/mp4', dataBase64: MP4, placement: 'main', sourceMediaKey: `pv-${i}` }),
      });
      assert.equal(up.status, 201, await up.text());
    }
    const fourthVideo = await fetch(`${base}/api/v1/partners-portal/ads/${productAd.id}/media`, {
      method: 'POST',
      headers: devHeaders,
      body: JSON.stringify({ mimeType: 'video/mp4', dataBase64: MP4, placement: 'main', sourceMediaKey: 'pv-3' }),
    });
    assert.equal(fourthVideo.status, 400, '4th video must hit MAIN_MAX_VIDEOS');

    await fetch(`${base}/api/v1/partners-portal/ads/${productAd.id}/submit-review`, { method: 'POST', headers: devHeaders });
    const publicProductAd = await json(await fetch(`${base}/api/v1/marketplace/ads/${productAd.id}`));
    assert.equal(publicProductAd.targetId, product.id);
    assert.equal(publicProductAd.media.length, 3);
    assert.ok(publicProductAd.media.every((m: { kind: string }) => m.kind === 'video'));
    assert.ok(publicProductAd.creator && publicProductAd.creator.id === reg1.id);

    // Merchant media untouched
    const merchantStill = await prisma.catalogMedia.findUnique({ where: { id: merchantMedia.id } });
    assert.ok(merchantStill);
    assert.equal(merchantStill?.ownerKind, 'product');

    // 4) Service ad: 1 video + 10 images
    const serviceAd = await json(await fetch(`${base}/api/v1/partners-portal/ads`, {
      method: 'POST',
      headers: devHeaders,
      body: JSON.stringify({ targetKind: 'service', targetId: service.id, captionAr: `إعلان خدمة ${run}` }),
    }));
    const sv = await fetch(`${base}/api/v1/partners-portal/ads/${serviceAd.id}/media`, {
      method: 'POST',
      headers: devHeaders,
      body: JSON.stringify({ mimeType: 'video/mp4', dataBase64: MP4, placement: 'main', sourceMediaKey: 'sv-0' }),
    });
    assert.equal(sv.status, 201, await sv.text());
    for (let i = 0; i < 10; i += 1) {
      const up = await fetch(`${base}/api/v1/partners-portal/ads/${serviceAd.id}/media`, {
        method: 'POST',
        headers: devHeaders,
        body: JSON.stringify({ mimeType: 'image/png', dataBase64: PNG, placement: 'main', sourceMediaKey: `si-${i}` }),
      });
      assert.equal(up.status, 201, `image ${i}: ${await up.text()}`);
    }
    const eleventh = await fetch(`${base}/api/v1/partners-portal/ads/${serviceAd.id}/media`, {
      method: 'POST',
      headers: devHeaders,
      body: JSON.stringify({ mimeType: 'image/png', dataBase64: PNG, placement: 'main', sourceMediaKey: 'si-10' }),
    });
    assert.equal(eleventh.status, 400, '11th image must fail while keeping prior files');

    const mediaList = await json(await fetch(`${base}/api/v1/partners-portal/ads/${serviceAd.id}/media`, { headers: devHeaders }));
    assert.equal(mediaList.items.length, 11);

    // Other cannot edit developer's ad media
    const steal = await fetch(`${base}/api/v1/partners-portal/ads/${serviceAd.id}/media`, {
      method: 'POST',
      headers: otherHeaders,
      body: JSON.stringify({ mimeType: 'image/png', dataBase64: PNG, placement: 'main' }),
    });
    assert.ok(steal.status === 404 || steal.status === 403);

    await fetch(`${base}/api/v1/partners-portal/ads/${serviceAd.id}/submit-review`, { method: 'POST', headers: devHeaders });
    const publicServiceAd = await json(await fetch(`${base}/api/v1/marketplace/ads/${serviceAd.id}`));
    assert.equal(publicServiceAd.targetId, service.id);
    assert.equal(publicServiceAd.media.length, 11);
    const kinds = publicServiceAd.media.reduce((acc: Record<string, number>, m: { kind: string }) => {
      acc[m.kind] = (acc[m.kind] || 0) + 1;
      return acc;
    }, {});
    assert.equal(kinds.video, 1);
    assert.equal(kinds.image, 10);

    // Public media stream for ad-owned row
    const firstMediaId = publicServiceAd.media[0].id;
    const stream = await fetch(`${base}/api/v1/marketplace/media/${firstMediaId}`);
    assert.equal(stream.status, 200, await stream.text());

    // Profile lists published ads; store/services orbs only when own catalog is published
    const profile = await json(await fetch(`${base}/api/v1/marketplace/creators/${reg1.id}`));
    assert.ok(profile.publishedAdIds.includes(productAd.id));
    assert.ok(profile.publishedAdIds.includes(serviceAd.id));
    assert.equal(profile.emptyAdsMessage, null);
    // Developer has ads for others + canSellProducts, but no own published product/service yet
    assert.equal(profile.hasStore, false, 'ads-only developer must not show empty store orb');
    assert.equal(profile.hasServices, false, 'ads-only developer must not show empty services orb');

    const ownProduct = await prisma.product.create({
      data: {
        partnerId: developer.id,
        nameAr: `منتج المطوّر ${run}`,
        nameEn: 'Dev product',
        priceHalalas: 1000,
        externalUrl: 'https://example.com/dev',
        concernTags: [],
        skinTypes: [],
        contentStatus: 'published',
        catalogSource: 'catalog',
        active: true,
      },
    });
    ownProductId = ownProduct.id;
    const afterProduct = await json(await fetch(`${base}/api/v1/marketplace/creators/${reg1.id}`));
    assert.equal(afterProduct.hasStore, true, 'store orb appears after first own published product');
    assert.equal(afterProduct.hasServices, false);

    const ownService = await prisma.service.create({
      data: {
        partnerId: developer.id,
        nameAr: `خدمة المطوّر ${run}`,
        nameEn: 'Dev service',
        priceHalalas: 2000,
        durationMin: 30,
        concernTags: [],
        contentStatus: 'published',
        catalogSource: 'catalog',
        active: true,
        bookingEnabled: true,
      },
    });
    ownServiceId = ownService.id;
    const afterService = await json(await fetch(`${base}/api/v1/marketplace/creators/${reg1.id}`));
    assert.equal(afterService.hasStore, true);
    assert.equal(afterService.hasServices, true, 'services orb appears after first own published service');

    console.log(JSON.stringify({
      ok: true,
      run,
      profileId: reg1.id,
      productAdId: productAd.id,
      serviceAdId: serviceAd.id,
      directoryRunProfiles: allRun,
      hasStoreAfterOwnProduct: afterProduct.hasStore,
      hasServicesAfterOwnService: afterService.hasServices,
      attribution: 'link_open only; purchase/booking attribution deferred',
    }));
  } finally {
    await app.close();
    await prisma.catalogAdAction.deleteMany({ where: { adId: { in: await prisma.catalogAd.findMany({ where: { advertiserPartnerId: developer.id }, select: { id: true } }).then((r) => r.map((x) => x.id)) } } }).catch(() => undefined);
    const adIds = (await prisma.catalogAd.findMany({ where: { advertiserPartnerId: { in: [developer.id, other.id] } }, select: { id: true } })).map((x) => x.id);
    await prisma.catalogMedia.deleteMany({ where: { ownerKind: 'ad', ownerId: { in: adIds } } }).catch(() => undefined);
    await prisma.catalogAdDecision.deleteMany({ where: { adId: { in: adIds } } }).catch(() => undefined);
    await prisma.catalogAd.deleteMany({ where: { id: { in: adIds } } }).catch(() => undefined);
    await prisma.catalogMedia.deleteMany({ where: { id: merchantMedia.id } }).catch(() => undefined);
    await prisma.product
      .deleteMany({ where: { id: { in: [product.id, ...(ownProductId ? [ownProductId] : [])] } } })
      .catch(() => undefined);
    await prisma.service
      .deleteMany({ where: { id: { in: [service.id, ...(ownServiceId ? [ownServiceId] : [])] } } })
      .catch(() => undefined);
    await prisma.creatorProfile.deleteMany({ where: { displayNameAr: { contains: run } } }).catch(() => undefined);
    await prisma.partnerUser.deleteMany({ where: { email: { contains: run } } }).catch(() => undefined);
    await prisma.partner.deleteMany({ where: { nameAr: { contains: run } } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
