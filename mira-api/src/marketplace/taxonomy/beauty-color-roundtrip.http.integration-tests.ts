/**
 * Beauty binding closure: portal-shaped color row must appear under Flutter leaf query
 * and must not appear under pedicure. Local DB only.
 *
 *   set -a; source .env.rc7; set +a
 *   npx tsx src/marketplace/taxonomy/beauty-color-roundtrip.http.integration-tests.ts
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { INestApplication, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { FirebaseIdTokenVerifier } from '../../common/auth/firebase-id-token-verifier';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { MarketplaceController } from '../marketplace.controller';
import { MarketplaceService } from '../marketplace.service';
import { TaxonomyService } from './taxonomy.service';

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
class BeautyColorModule {}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: local DATABASE_URL required');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const app: INestApplication = await NestFactory.create(BeautyColorModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  await app.listen(0);
  const port = (app.getHttpServer().address() as { port: number }).port;
  const root = `http://127.0.0.1:${port}`;
  const partnerIds: string[] = [];
  const serviceIds: string[] = [];

  try {
    const salon = await prisma.partner.create({
      data: {
        type: 'salon',
        status: 'active',
        nameAr: `صالون صبغة ${suffix}`,
        nameEn: `color-salon-${suffix}`,
        city: 'الرياض',
      },
    });
    partnerIds.push(salon.id);

    const clinic = await prisma.partner.create({
      data: {
        type: 'clinic',
        status: 'active',
        nameAr: `عيادة ${suffix}`,
        nameEn: `clinic-${suffix}`,
        city: 'الرياض',
      },
    });
    partnerIds.push(clinic.id);

    // Portal materialize shape: legacy category + leaf in attributes.
    const color = await prisma.service.create({
      data: {
        partnerId: salon.id,
        nameAr: `صبغة وجذور ${suffix}`,
        nameEn: `color-${suffix}`,
        durationMin: 90,
        priceHalalas: 25000,
        category: 'hair',
        contentStatus: 'published',
        catalogSource: 'catalog',
        active: true,
        bookingEnabled: true,
        placeMode: 'branch',
        profileId: 'service.salon_hair_color',
        attributesJson: {
          subcategory: 'beauty.hair.color',
          taxonomyLeaf: 'beauty.hair.color',
        },
      },
    });
    serviceIds.push(color.id);

    const pedi = await prisma.service.create({
      data: {
        partnerId: salon.id,
        nameAr: `بديكير ${suffix}`,
        nameEn: `pedi-${suffix}`,
        durationMin: 45,
        priceHalalas: 12000,
        category: 'nails',
        contentStatus: 'published',
        catalogSource: 'catalog',
        active: true,
        bookingEnabled: true,
        placeMode: 'branch',
        profileId: 'service.salon_nails',
        attributesJson: {
          subcategory: 'beauty.nails.pedicure',
          taxonomyLeaf: 'beauty.nails.pedicure',
        },
      },
    });
    serviceIds.push(pedi.id);

    const homeColor = await prisma.service.create({
      data: {
        partnerId: salon.id,
        nameAr: `صبغة منزلية ${suffix}`,
        nameEn: `home-color-${suffix}`,
        durationMin: 90,
        priceHalalas: 30000,
        category: 'hair',
        contentStatus: 'published',
        catalogSource: 'catalog',
        active: true,
        bookingEnabled: true,
        placeMode: 'home',
        profileId: 'service.salon_hair_color',
        attributesJson: {
          subcategory: 'beauty.hair.color',
          taxonomyLeaf: 'beauty.hair.color',
        },
      },
    });
    serviceIds.push(homeColor.id);

    const laser = await prisma.service.create({
      data: {
        partnerId: clinic.id,
        nameAr: `ليزر ${suffix}`,
        nameEn: `laser-${suffix}`,
        durationMin: 30,
        priceHalalas: 40000,
        category: 'laser',
        contentStatus: 'published',
        catalogSource: 'catalog',
        active: true,
        bookingEnabled: true,
        placeMode: 'branch',
        profileId: 'service.clinic_laser',
        attributesJson: {
          subcategory: 'beauty.clinic.laser.hair',
          taxonomyLeaf: 'beauty.clinic.laser.hair',
        },
      },
    });
    serviceIds.push(laser.id);

    async function catalog(qs: string) {
      const res = await fetch(`${root}/api/v1/marketplace/catalog?${qs}`);
      const body = await res.text();
      assert.equal(res.status, 200, body.slice(0, 500));
      return JSON.parse(body) as { items: Array<{ id: string; nameAr?: string }>; totalMatched?: number };
    }

    // Historical Flutter shape (break): category=beauty.hair + leaf.
    const flutterBroken = await catalog(
      `lane=beauty&kind=service&category=beauty.hair&subcategory=beauty.hair.color&limit=20`,
    );
    assert.ok(
      flutterBroken.items.some((i) => i.id === color.id),
      `color offerId must return under beauty.hair+leaf; got ${flutterBroken.items.map((i) => i.id)}`,
    );
    assert.ok(!flutterBroken.items.some((i) => i.id === pedi.id), 'pedicure must not appear under color leaf');

    // Fixed Flutter shape: legacy hair + leaf.
    const flutterFixed = await catalog(
      `lane=beauty&kind=service&category=hair&subcategory=beauty.hair.color&limit=20`,
    );
    assert.ok(flutterFixed.items.some((i) => i.id === color.id));
    assert.ok(!flutterFixed.items.some((i) => i.id === pedi.id));

    const pediQ = await catalog(
      `lane=beauty&kind=service&category=nails&subcategory=beauty.nails.pedicure&limit=20`,
    );
    assert.ok(pediQ.items.some((i) => i.id === pedi.id));
    assert.ok(!pediQ.items.some((i) => i.id === color.id), 'color must not appear under pedicure');

    const homeQ = await catalog(`lane=beauty&kind=service&placeMode=home&limit=20`);
    assert.ok(homeQ.items.some((i) => i.id === homeColor.id));
    assert.ok(!homeQ.items.some((i) => i.id === laser.id), 'clinic laser must not appear under home');

    const salonType = await catalog(`lane=beauty&kind=service&type=salon&limit=20`);
    assert.ok(salonType.items.some((i) => i.id === color.id));
    // Clinic laser may still appear if partner filter includes developer OR — require not from clinic partner when type=salon
    assert.ok(
      !salonType.items.some((i) => i.id === laser.id),
      'clinic laser must not appear when type=salon',
    );

    const clinicType = await catalog(`lane=beauty&kind=service&type=clinic&limit=20`);
    assert.ok(clinicType.items.some((i) => i.id === laser.id));
    assert.ok(!clinicType.items.some((i) => i.id === color.id));

    console.log(
      JSON.stringify(
        {
          ok: true,
          offerId: color.id,
          breakPointWas: 'category hair !== beauty.hair',
          flutterBrokenMatched: true,
          flutterFixedMatched: true,
          pedicureExcluded: true,
          homeOk: true,
          typeSalonExcludesLaser: true,
        },
        null,
        2,
      ),
    );
  } finally {
    if (serviceIds.length) await prisma.service.deleteMany({ where: { id: { in: serviceIds } } });
    if (partnerIds.length) await prisma.partner.deleteMany({ where: { id: { in: partnerIds } } });
    await app.close();
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
