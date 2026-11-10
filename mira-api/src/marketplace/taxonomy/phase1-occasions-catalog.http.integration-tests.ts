/**
 * Phase1 item1: occasions isolation + occasions.styling via real GET /marketplace/catalog.
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { INestApplication, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { FirebaseIdTokenVerifier } from '../../common/auth/firebase-id-token-verifier';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { MarketplaceController } from '../marketplace.controller';
import { MarketplaceService } from '../marketplace.service';
import { TaxonomyService } from './taxonomy.service';

// Must be a future Tuesday relative to "now" so past-slot filtering does not empty the day.
const DATE_OK = '2026-12-15'; // Tuesday
const DATE_BAD = '2026-12-16'; // Wednesday — no window

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
  controllers: [MarketplaceController],
  providers: [
    TaxonomyService,
    {
      provide: MarketplaceService,
      useFactory: (prisma: PrismaService, tax: TaxonomyService) => new MarketplaceService(prisma, tax),
      inject: [PrismaService, TaxonomyService],
    },
    { provide: FirebaseIdTokenVerifier, useValue: { verify: async () => ({ uid: 'x' }) } },
  ],
})
class Phase1OccasionsModule {}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: local DATABASE_URL required');
    process.exit(1);
  }
  const started = new Date().toISOString();
  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const app: INestApplication = await NestFactory.create(Phase1OccasionsModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  await app.listen(0);
  const port = (app.getHttpServer().address() as { port: number }).port;
  const root = `http://127.0.0.1:${port}`;

  const ids: { partners: string[]; services: string[]; products: string[]; branches: string[] } = {
    partners: [],
    services: [],
    products: [],
    branches: [],
  };

  try {
    const planner = await prisma.partner.create({
      data: {
        type: 'event_planner',
        status: 'active',
        nameAr: `منسّق ${suffix}`,
        nameEn: `planner-${suffix}`,
        city: 'الرياض',
        canSellProducts: true,
      },
    });
    ids.partners.push(planner.id);

    const salon = await prisma.partner.create({
      data: {
        type: 'salon',
        status: 'active',
        nameAr: `صالون ${suffix}`,
        nameEn: `salon-${suffix}`,
        city: 'الرياض',
      },
    });
    ids.partners.push(salon.id);

    const branchOk = await prisma.partnerBranch.create({
      data: {
        partnerId: planner.id,
        nameAr: `فرع صحيح ${suffix}`,
        cityId: 'sa-riyadh',
        cityNameAr: 'الرياض',
        lat: 24.7,
        lng: 46.7,
        active: true,
      },
    });
    ids.branches.push(branchOk.id);
    const branchBad = await prisma.partnerBranch.create({
      data: {
        partnerId: planner.id,
        nameAr: `فرع خاطئ ${suffix}`,
        cityId: 'sa-riyadh',
        cityNameAr: 'الرياض',
        lat: 24.8,
        lng: 46.8,
        active: true,
      },
    });
    ids.branches.push(branchBad.id);

    const weekly = [
      { weekday: 2, startMin: 9 * 60, endMin: 12 * 60, capacity: 2, resourceId: `room-${suffix}` },
    ];

    const styling = await prisma.service.create({
      data: {
        partnerId: planner.id,
        nameAr: `تنسيق مناسبة ${suffix}`,
        nameEn: `styling-${suffix}`,
        durationMin: 60,
        priceHalalas: 50000,
        concernTags: ['occasions'],
        category: 'occasions',
        profileId: 'service.occasions',
        active: true,
        contentStatus: 'published',
        catalogSource: 'catalog',
        bookingEnabled: true,
        placeMode: 'branch',
        branchId: branchOk.id,
        availabilityJson: { windows: weekly },
        serviceProfileJson: { answers: { placeMode: 'branch', branchId: branchOk.id } },
      },
    });
    ids.services.push(styling.id);

    const hair = await prisma.service.create({
      data: {
        partnerId: salon.id,
        nameAr: `قص شعر ${suffix}`,
        nameEn: `hair-${suffix}`,
        durationMin: 45,
        priceHalalas: 15000,
        concernTags: ['hair'],
        category: 'hair',
        active: true,
        contentStatus: 'published',
        catalogSource: 'catalog',
        bookingEnabled: true,
        placeMode: 'branch',
        availabilityJson: { windows: weekly },
        serviceProfileJson: { answers: { placeMode: 'branch' } },
      },
    });
    ids.services.push(hair.id);

    const favors = await prisma.product.create({
      data: {
        partnerId: planner.id,
        nameAr: `توزيعات ${suffix}`,
        nameEn: `favors-${suffix}`,
        priceHalalas: 2500,
        externalUrl: 'https://example.com/favors',
        concernTags: [],
        category: 'occasions',
        subcategory: 'occasions.favors',
        profileId: 'product.occasions_favors',
        active: true,
        contentStatus: 'published',
        catalogSource: 'catalog',
        inventoryMode: 'product',
        stockQty: 20,
      },
    });
    ids.products.push(favors.id);

    const catalog = async (qs: string) => {
      const res = await fetch(`${root}/api/v1/marketplace/catalog?${qs}`);
      const body = (await res.json()) as { items?: Array<{ id: string; kind: string }> };
      assert.equal(res.status, 200, JSON.stringify(body));
      return (body.items || []).map((i) => ({ id: i.id, kind: i.kind }));
    };

    const occasionsBrowse = await catalog(`lane=occasions`);
    const occIds = occasionsBrowse.map((i) => i.id);
    assert.ok(occIds.includes(styling.id), `occasions missing styling ${JSON.stringify(occIds)}`);
    assert.ok(occIds.includes(favors.id), `occasions missing favors`);
    assert.ok(!occIds.includes(hair.id), `hair leaked into occasions: ${JSON.stringify(occIds)}`);

    const buyTab = await catalog(`lane=occasions&kind=product`);
    assert.deepEqual(
      buyTab.map((i) => i.id).sort(),
      [favors.id].sort(),
      'buy tab must be favors only',
    );
    assert.ok(buyTab.every((i) => i.kind === 'product'));

    const bookTab = await catalog(`lane=occasions&kind=service`);
    assert.deepEqual(
      bookTab.map((i) => i.id).sort(),
      [styling.id].sort(),
      'book tab must be styling only',
    );

    const stylingOk = await catalog(
      `lane=occasions&subcategory=occasions.styling&branch=${branchOk.id}&availableOn=${DATE_OK}`,
    );
    assert.ok(
      stylingOk.map((i) => i.id).includes(styling.id),
      `styling+branch+date must keep service: ${JSON.stringify(stylingOk)}`,
    );
    assert.ok(!stylingOk.map((i) => i.id).includes(favors.id));
    assert.ok(!stylingOk.map((i) => i.id).includes(hair.id));

    const wrongBranch = await catalog(
      `lane=occasions&subcategory=occasions.styling&branch=${branchBad.id}&availableOn=${DATE_OK}`,
    );
    assert.ok(
      !wrongBranch.map((i) => i.id).includes(styling.id),
      `wrong branch must exclude styling: ${JSON.stringify(wrongBranch)}`,
    );

    const wrongDay = await catalog(
      `lane=occasions&subcategory=occasions.styling&branch=${branchOk.id}&availableOn=${DATE_BAD}`,
    );
    assert.ok(
      !wrongDay.map((i) => i.id).includes(styling.id),
      `wrong day must exclude styling: ${JSON.stringify(wrongDay)}`,
    );

    const beautyHair = await catalog(`lane=beauty&kind=service&category=hair`);
    assert.ok(
      beautyHair.map((i) => i.id).includes(hair.id),
      `hair must still appear in beauty: ${JSON.stringify(beautyHair.map((i) => i.id))}`,
    );

    const evidence = {
      id: 'P1-OCCASIONS-CATALOG',
      ok: true,
      started,
      finished: new Date().toISOString(),
      root,
      ids: {
        stylingId: styling.id,
        hairId: hair.id,
        favorsId: favors.id,
        branchOk: branchOk.id,
        branchBad: branchBad.id,
      },
      results: {
        occasionsBrowse: occIds,
        buyTab: buyTab.map((i) => i.id),
        bookTab: bookTab.map((i) => i.id),
        stylingOk: stylingOk.map((i) => i.id),
        wrongBranch: wrongBranch.map((i) => i.id),
        wrongDay: wrongDay.map((i) => i.id),
        beautyHair: beautyHair.map((i) => i.id),
      },
    };
    console.log(JSON.stringify(evidence, null, 2));
    console.log('PASS P1-OCCASIONS-CATALOG');
  } finally {
    await prisma.service.deleteMany({ where: { id: { in: ids.services } } }).catch(() => undefined);
    await prisma.product.deleteMany({ where: { id: { in: ids.products } } }).catch(() => undefined);
    await prisma.partnerBranch.deleteMany({ where: { id: { in: ids.branches } } }).catch(() => undefined);
    await prisma.partner.deleteMany({ where: { id: { in: ids.partners } } }).catch(() => undefined);
    await app.close();
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
