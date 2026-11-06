/**
 * P5 HTTP catalog filters — real Nest parsing + error codes.
 * Run: DATABASE_URL=... npx tsx src/marketplace/p5-catalog-http.integration-tests.ts
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { INestApplication, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseIdTokenVerifier } from '../common/auth/firebase-id-token-verifier';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';

const run = `p5h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const outDir =
  process.env.MIRA_P5_OUT_DIR ||
  join(process.cwd(), '..', 'audit-out', 'p5', 'logs', `p5-http-${run}`);
mkdirSync(outDir, { recursive: true });

const steps: Array<{ id: string; ok: boolean; detail?: unknown }> = [];
function record(id: string, ok: boolean, detail?: unknown) {
  steps.push({ id, ok, detail });
  console.log(JSON.stringify({ id, ok, detail }));
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule],
  controllers: [MarketplaceController],
  providers: [
    {
      provide: MarketplaceService,
      useFactory: (prisma: PrismaService) => new MarketplaceService(prisma),
      inject: [PrismaService],
    },
    { provide: FirebaseIdTokenVerifier, useValue: { verify: async () => ({ uid: 'x' }) } },
  ],
})
class P5HttpModule {}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: DATABASE_URL must be local');
    process.exit(1);
  }
  const startedUtc = new Date().toISOString();
  const app: INestApplication = await NestFactory.create(P5HttpModule, { logger: ['error'] });
  app.setGlobalPrefix('api/v1');
  await app.listen(0);
  const server = app.getHttpServer();
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const base = `http://127.0.0.1:${port}`;
  const prisma = new PrismaClient();
  const partnerIds: string[] = [];
  const productIds: string[] = [];

  try {
    const partner = await prisma.partner.create({
      data: {
        type: 'brand',
        status: 'active',
        nameAr: `HTTP P5 ${run}`,
        nameEn: `http-${run}`,
        city: 'الرياض',
      },
    });
    partnerIds.push(partner.id);
    const dress = await prisma.product.create({
      data: {
        partnerId: partner.id,
        nameAr: `فستان HTTP ${run}`,
        nameEn: `dress-http-${run}`,
        priceHalalas: 10000,
        externalUrl: 'https://example.test/d',
        concernTags: ['texture'],
        category: 'clothes',
        active: true,
        contentStatus: 'published',
        catalogSource: 'catalog',
        purchaseMode: 'internal_cod',
        inventoryMode: 'product',
        stockQty: 5,
        optionsJson: [
          {
            id: 'color',
            labelAr: 'اللون',
            values: [
              { id: 'black', labelAr: 'أسود', swatchHex: '#111111' },
              { id: 'white', labelAr: 'أبيض', swatchHex: '#EEEEEE' },
            ],
          },
          {
            id: 'size',
            labelAr: 'المقاس',
            values: [
              { id: 's', labelAr: 'S' },
              { id: 'm', labelAr: 'M' },
            ],
          },
        ],
        variantsJson: [
          { id: `${run}-bs`, selections: { color: 'black', size: 's' }, priceHalalas: 10000, available: true },
          { id: `${run}-wm`, selections: { color: 'white', size: 'm' }, priceHalalas: 50000, available: true },
          { id: `${run}-bm`, selections: { color: 'black', size: 'm' }, priceHalalas: 11000, available: true },
        ],
      },
    });
    productIds.push(dress.id);
    for (let i = 0; i < 3; i += 1) {
      const extra = await prisma.product.create({
        data: {
          partnerId: partner.id,
          nameAr: `إضافي HTTP ${run}-${i}`,
          nameEn: `extra-http-${run}-${i}`,
          priceHalalas: 8000 + i * 1000,
          externalUrl: `https://example.test/e${i}`,
          concernTags: ['moisture'],
          category: 'face',
          active: true,
          contentStatus: 'published',
          catalogSource: 'catalog',
        },
      });
      productIds.push(extra.id);
    }

    const miss = await fetch(
      `${base}/api/v1/marketplace/catalog?partnerId=${partner.id}&variant.color=black&variant.size=m&facets=1&limit=8`,
    );
    const missBody = (await miss.json()) as {
      items: Array<{ id: string; matchedVariantIds?: string[]; priceHalalas?: number }>;
      totalMatched?: number;
      facets?: { 'variant.color'?: Array<{ id: string; count: number }> };
      nextCursor?: string | null;
      queryFingerprint?: string;
    };
    record(
      'P5_HTTP_BLACK_M_HIT',
      miss.status === 200 &&
        missBody.items.some(
          (i) => i.id === dress.id && i.matchedVariantIds?.[0] === `${run}-bm` && i.priceHalalas === 11000,
        ),
      { status: miss.status, body: missBody },
    );

    const cross = await fetch(
      `${base}/api/v1/marketplace/catalog?partnerId=${partner.id}&color=black&size=m&priceMax=20000&facets=1`,
    );
    const crossBody = (await cross.json()) as {
      facets?: { 'variant.color'?: Array<{ id: string; count: number }> };
      items: Array<{ id: string }>;
    };
    const whiteCount = crossBody.facets?.['variant.color']?.find((b) => b.id === 'white')?.count ?? 0;
    record('P5_HTTP_PRICE_FACET_EXCLUDES_WHITE', whiteCount === 0, { whiteCount, facets: crossBody.facets });

    const badLimit = await fetch(`${base}/api/v1/marketplace/catalog?limit=0&sort=price_asc`);
    record('P5_HTTP_LIMIT_0_400', badLimit.status === 400, { status: badLimit.status, text: await badLimit.text() });

    const badLimit25 = await fetch(`${base}/api/v1/marketplace/catalog?limit=25&sort=price_desc`);
    record('P5_HTTP_LIMIT_25_400', badLimit25.status === 400, { status: badLimit25.status });

    const page1 = await fetch(
      `${base}/api/v1/marketplace/catalog?partnerId=${partner.id}&sort=price_asc&limit=1&facets=1`,
    );
    const p1 = (await page1.json()) as { nextCursor?: string | null; queryFingerprint?: string; items: Array<{ id: string }> };
    assert.ok(p1.nextCursor, 'expected nextCursor with multiple products');
    const mismatch = await fetch(
      `${base}/api/v1/marketplace/catalog?partnerId=${partner.id}&sort=price_desc&limit=1&cursor=${encodeURIComponent(p1.nextCursor!)}`,
    );
    record('P5_HTTP_CURSOR_SORT_MISMATCH_400', mismatch.status === 400, {
      status: mismatch.status,
      text: await mismatch.text(),
    });

    const page2 = await fetch(
      `${base}/api/v1/marketplace/catalog?partnerId=${partner.id}&sort=price_asc&limit=1&cursor=${encodeURIComponent(p1.nextCursor!)}`,
    );
    const p2 = (await page2.json()) as { items: Array<{ id: string }> };
    record(
      'P5_HTTP_CURSOR_SAME_SET_OK',
      page2.status === 200 && p2.items.length === 1 && p2.items[0]?.id !== p1.items[0]?.id,
      { status: page2.status, p1: p1.items[0]?.id, p2: p2.items[0]?.id },
    );

    const badDate = await fetch(`${base}/api/v1/marketplace/catalog?availableOn=2026-02-30`);
    record('P5_HTTP_BAD_DATE_400', badDate.status === 400, { status: badDate.status, text: await badDate.text() });

    const visualMismatch = await fetch(
      `${base}/api/v1/marketplace/catalog?partnerId=${partner.id}&visual=1&sort=price_asc&limit=1&cursor=${encodeURIComponent(p1.nextCursor!)}`,
    );
    record('P5_HTTP_CURSOR_VISUAL_MISMATCH_400', visualMismatch.status === 400, {
      status: visualMismatch.status,
    });

    const partnerJeddah = await prisma.partner.create({
      data: {
        type: 'brand',
        status: 'active',
        nameAr: `جدة ${run}`,
        nameEn: `jed-${run}`,
        city: 'جدة',
      },
    });
    partnerIds.push(partnerJeddah.id);
    const jeddahProduct = await prisma.product.create({
      data: {
        partnerId: partnerJeddah.id,
        nameAr: `جدة ${run}`,
        nameEn: `jed-p-${run}`,
        priceHalalas: 15000,
        externalUrl: 'https://example.test/j',
        concernTags: ['texture'],
        category: 'clothes',
        active: true,
        contentStatus: 'published',
        catalogSource: 'catalog',
      },
    });
    productIds.push(jeddahProduct.id);

    const cityFacets = await fetch(
      `${base}/api/v1/marketplace/catalog?city=${encodeURIComponent('الرياض')}&facets=1&limit=24`,
    );
    const cityBody = (await cityFacets.json()) as {
      facets?: { city?: Array<{ id: string; count: number }> };
      items: Array<{ city?: string }>;
    };
    const hasJeddahFacet = (cityBody.facets?.city ?? []).some((b) => b.id === 'جدة' && b.count > 0);
    const onlyRiyadhResults = cityBody.items.every((i) => i.city === 'الرياض');
    record('P5_HTTP_CITY_FACET_KEEPS_ALTERNATES', cityFacets.status === 200 && hasJeddahFacet && onlyRiyadhResults, {
      hasJeddahFacet,
      onlyRiyadhResults,
      cities: cityBody.facets?.city,
    });

    const priceAsc = await fetch(
      `${base}/api/v1/marketplace/catalog?partnerId=${partner.id}&sort=price_asc&limit=24`,
    );
    const priceDesc = await fetch(
      `${base}/api/v1/marketplace/catalog?partnerId=${partner.id}&sort=price_desc&limit=24`,
    );
    const ascBody = (await priceAsc.json()) as {
      items: Array<{ id: string; priceHalalas: number | null; priceLabel: string }>;
    };
    const descBody = (await priceDesc.json()) as {
      items: Array<{ id: string; priceHalalas: number | null; priceLabel: string }>;
    };
    const dressAsc = ascBody.items.find((i) => i.id === dress.id);
    const dressDesc = descBody.items.find((i) => i.id === dress.id);
    record(
      'P5_HTTP_PRICE_DISPLAY_STABLE_ACROSS_SORT',
      Boolean(
        dressAsc &&
          dressDesc &&
          dressAsc.priceHalalas === dressDesc.priceHalalas &&
          dressAsc.priceLabel === dressDesc.priceLabel &&
          (dressAsc.priceLabel.includes('ابتداءً من') || dressAsc.priceHalalas === 10000),
      ),
      { dressAsc, dressDesc },
    );

    const dupColor = await fetch(
      `${base}/api/v1/marketplace/catalog?partnerId=${partner.id}&color=black&color=white&facets=1`,
    );
    record('P5_HTTP_DUP_COLOR_OK', dupColor.status === 200, { status: dupColor.status });
  } finally {
    await prisma.product.deleteMany({ where: { id: { in: productIds } } }).catch(() => undefined);
    await prisma.partner.deleteMany({ where: { id: { in: partnerIds } } }).catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
    await app.close().catch(() => undefined);
  }

  const failed = steps.filter((s) => !s.ok);
  const summary = {
    ok: failed.length === 0,
    id: 'P5_CATALOG_HTTP',
    commit: process.env.MIRA_P5_COMMIT || '',
    runId: process.env.MIRA_P5_RUN_ID || run,
    startedUtc,
    finishedUtc: new Date().toISOString(),
    steps,
    outDir,
  };
  writeFileSync(join(outDir, 'p5-catalog-http.json'), JSON.stringify(summary, null, 2));
  writeFileSync(join(outDir, 'verdict.txt'), summary.ok ? 'PASS\n' : 'FAIL\n');
  console.log(JSON.stringify({ ok: summary.ok, failed: failed.map((f) => f.id), outDir }));
  process.exit(summary.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  writeFileSync(join(outDir, 'verdict.txt'), 'FAIL\n');
  process.exit(2);
});
