/**
 * P5 catalog filters: same-variant AND, OR within field, publish gate, paging, facets.
 * Run: npx tsx src/marketplace/p5-catalog-filters.integration-tests.ts
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MarketplaceService } from './marketplace.service';

const run = `p5f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const outDir =
  process.env.MIRA_P5_OUT_DIR ||
  join(process.cwd(), '..', 'audit-out', 'p5', 'logs', `p5-filters-${run}`);
mkdirSync(outDir, { recursive: true });

const steps: Array<{ id: string; ok: boolean; detail?: unknown }> = [];
function record(id: string, ok: boolean, detail?: unknown) {
  steps.push({ id, ok, detail });
  console.log(JSON.stringify({ id, ok, detail }));
}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: DATABASE_URL must be local');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  const marketplace = new MarketplaceService(prisma as unknown as PrismaService);
  const startedUtc = new Date().toISOString();
  const partnerIds: string[] = [];
  const productIds: string[] = [];
  const serviceIds: string[] = [];

  try {
    const partner = await prisma.partner.create({
      data: {
        type: 'brand',
        status: 'active',
        nameAr: `علامة P5 ${run}`,
        nameEn: `p5-${run}`,
        city: 'الرياض',
      },
    });
    partnerIds.push(partner.id);

    const salon = await prisma.partner.create({
      data: {
        type: 'salon',
        status: 'active',
        nameAr: `صالون P5 ${run}`,
        nameEn: `p5s-${run}`,
        city: 'جدة',
      },
    });
    partnerIds.push(salon.id);

    const optionsJson = [
      {
        id: 'color',
        labelAr: 'اللون',
        values: [
          { id: 'black', labelAr: 'أسود' },
          { id: 'white', labelAr: 'أبيض' },
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
    ];

    const dress = await prisma.product.create({
      data: {
        partnerId: partner.id,
        nameAr: `فستان ${run}`,
        nameEn: `dress-${run}`,
        priceHalalas: 10000,
        externalUrl: 'https://example.test/dress',
        concernTags: ['texture'],
        category: 'clothes',
        active: true,
        contentStatus: 'published',
        catalogSource: 'catalog',
        purchaseMode: 'internal_cod',
        inventoryMode: 'variant',
        stockQty: null,
        optionsJson,
        variantsJson: [
          { id: `${run}-bs`, selections: { color: 'black', size: 's' }, priceHalalas: 10000, available: true },
          { id: `${run}-wm`, selections: { color: 'white', size: 'm' }, priceHalalas: 12000, available: true },
        ],
      },
    });
    productIds.push(dress.id);

    await prisma.productVariantInventory.createMany({
      data: [
        {
          productId: dress.id,
          variantId: `${run}-bs`,
          variantKey: 'color=black|size=s',
          stockMode: 'tracked',
          stockQty: 3,
          reservedQty: 0,
        },
        {
          productId: dress.id,
          variantId: `${run}-wm`,
          variantKey: 'color=white|size=m',
          stockMode: 'tracked',
          stockQty: 2,
          reservedQty: 0,
        },
      ],
    });

    const draft = await prisma.product.create({
      data: {
        partnerId: partner.id,
        nameAr: `مسودة ${run}`,
        nameEn: `draft-${run}`,
        priceHalalas: 5000,
        externalUrl: 'https://example.test/draft',
        concernTags: ['texture'],
        category: 'clothes',
        active: true,
        contentStatus: 'draft',
        catalogSource: 'catalog',
        optionsJson,
        variantsJson: [
          { id: `${run}-draft`, selections: { color: 'black', size: 'm' }, priceHalalas: 5000, available: true },
        ],
      },
    });
    productIds.push(draft.id);

    // Extra products for multi-page (limit 2).
    for (let i = 0; i < 5; i += 1) {
      const p = await prisma.product.create({
        data: {
          partnerId: partner.id,
          nameAr: `Extra ${run}-${i}`,
          nameEn: `extra-${run}-${i}`,
          priceHalalas: 2000 + i,
          externalUrl: `https://example.test/e${i}`,
          concernTags: ['moisture'],
          category: 'face',
          active: true,
          contentStatus: 'published',
          catalogSource: 'catalog',
        },
      });
      productIds.push(p.id);
    }

    const svc = await prisma.service.create({
      data: {
        partnerId: salon.id,
        nameAr: `قص ${run}`,
        nameEn: `cut-${run}`,
        durationMin: 45,
        priceHalalas: 7000,
        concernTags: ['texture'],
        category: 'hair',
        bookingEnabled: true,
        active: true,
        contentStatus: 'published',
        catalogSource: 'catalog',
        serviceProfileJson: {
          templateId: 'salon_hair_cut',
          templateVersion: 1,
          priceMode: 'fixed',
          answers: { placeMode: 'branch' },
        },
      },
    });
    serviceIds.push(svc.id);

    // --- black + M must not match ---
    {
      const res = await marketplace.browse({
        partnerId: partner.id,
        color: 'black',
        size: 'm',
        facets: '1',
        limit: '24',
      });
      const ids = res.items.map((i: { id: string }) => i.id);
      record('P5_VARIANT_BLACK_M_NO_CROSS', !ids.includes(dress.id), { ids, total: res.totalMatched });
    }

    // --- add black/M and retest ---
    await prisma.product.update({
      where: { id: dress.id },
      data: {
        variantsJson: [
          { id: `${run}-bs`, selections: { color: 'black', size: 's' }, priceHalalas: 10000, available: true },
          { id: `${run}-wm`, selections: { color: 'white', size: 'm' }, priceHalalas: 12000, available: true },
          { id: `${run}-bm`, selections: { color: 'black', size: 'm' }, priceHalalas: 11000, available: true },
        ],
      },
    });
    await prisma.productVariantInventory.create({
      data: {
        productId: dress.id,
        variantId: `${run}-bm`,
        variantKey: 'color=black|size=m',
        stockMode: 'tracked',
        stockQty: 4,
        reservedQty: 0,
      },
    });

    {
      const res = await marketplace.browse({
        partnerId: partner.id,
        'variant.color': 'black',
        'variant.size': 'm',
        inStock: '1',
        facets: '1',
        limit: '24',
      });
      const row = res.items.find((i: { id: string }) => i.id === dress.id) as
        | {
            id: string;
            matchedVariantIds?: string[];
            priceHalalas?: number;
          }
        | undefined;
      record(
        'P5_VARIANT_BLACK_M_HIT',
        Boolean(row) &&
          Array.isArray(row!.matchedVariantIds) &&
          row!.matchedVariantIds!.length === 1 &&
          row!.matchedVariantIds![0] === `${run}-bm` &&
          row!.priceHalalas === 11000,
        { row },
      );
      record('P5_DRAFT_EXCLUDED', !res.items.some((i: { id: string }) => i.id === draft.id), {
        ids: res.items.map((i: { id: string }) => i.id),
      });
    }

    // Exhaust black/M stock
    await prisma.productVariantInventory.update({
      where: { productId_variantId: { productId: dress.id, variantId: `${run}-bm` } },
      data: { stockQty: 0 },
    });
    {
      const res = await marketplace.browse({
        partnerId: partner.id,
        color: 'black',
        size: 'm',
        inStock: '1',
        limit: '24',
      });
      record(
        'P5_VARIANT_STOCK_EXHAUSTED',
        !res.items.some((i: { id: string }) => i.id === dress.id),
        { total: res.totalMatched },
      );
    }

    // Service placeMode + city
    {
      const res = await marketplace.browse({
        partnerId: salon.id,
        placeMode: 'branch',
        city: 'جدة',
        kind: 'service',
        limit: '24',
      });
      record(
        'P5_SERVICE_PLACE_CITY',
        res.items.some((i: { id: string }) => i.id === svc.id),
        { ids: res.items.map((i: { id: string }) => i.id) },
      );
      const bad = await marketplace.browse({
        partnerId: salon.id,
        placeMode: 'home',
        kind: 'service',
        limit: '24',
      });
      record('P5_SERVICE_PLACE_REJECT', !bad.items.some((i: { id: string }) => i.id === svc.id), {
        total: bad.totalMatched,
      });
    }

    // Product-only filter must not return service with clothes size
    {
      const res = await marketplace.browse({
        partnerId: salon.id,
        size: 'm',
        limit: '24',
      });
      record(
        'P5_NO_PRODUCT_FILTER_ON_SERVICE',
        !res.items.some((i: { id: string; kind: string }) => i.kind === 'service'),
        { items: res.items.map((i: { id: string; kind: string }) => `${i.kind}:${i.id}`) },
      );
    }

    // Paging: no dup/loss across pages (partner products only, stable key sort)
    {
      const page1 = await marketplace.browse({ partnerId: partner.id, kind: 'product', limit: '2', sort: 'key' });
      const page2 = await marketplace.browse({
        partnerId: partner.id,
        kind: 'product',
        limit: '2',
        sort: 'key',
        cursor: page1.nextCursor ?? undefined,
      });
      const page3 = await marketplace.browse({
        partnerId: partner.id,
        kind: 'product',
        limit: '2',
        sort: 'key',
        cursor: page2.nextCursor ?? undefined,
      });
      const all = [...page1.items, ...page2.items, ...page3.items].map((i: { id: string }) => i.id);
      const uniq = new Set(all);
      record(
        'P5_PAGING_NO_DUP',
        all.length === uniq.size && page1.nextCursor != null && page2.nextCursor != null,
        { all, next: [page1.nextCursor, page2.nextCursor, page3.nextCursor] },
      );
    }

    // Invalid filter → 400, not empty success
    {
      let ok = false;
      try {
        await marketplace.browse({ partnerId: partner.id, option: 'bad', limit: '8' });
      } catch (e) {
        ok = e instanceof Error && /خيار التركيبة|غير صالح/.test(String((e as { message?: string }).message ?? e));
      }
      record('P5_INVALID_FILTER_400', ok, {});
    }

    // Facets present when requested
    {
      const res = await marketplace.browse({ partnerId: partner.id, facets: '1', limit: '8' });
      record('P5_FACETS_PRESENT', Boolean(res.facets && res.activeFilters), {
        facetKeys: res.facets ? Object.keys(res.facets) : [],
      });
    }
  } finally {
    await prisma.productVariantInventory.deleteMany({ where: { productId: { in: productIds } } }).catch(() => undefined);
    await prisma.product.deleteMany({ where: { id: { in: productIds } } }).catch(() => undefined);
    await prisma.service.deleteMany({ where: { id: { in: serviceIds } } }).catch(() => undefined);
    await prisma.partner.deleteMany({ where: { id: { in: partnerIds } } }).catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
  }

  const failed = steps.filter((s) => !s.ok);
  const summary = {
    ok: failed.length === 0,
    id: 'P5_CATALOG_FILTERS',
    commit: process.env.MIRA_P5_COMMIT || '',
    runId: process.env.MIRA_P5_RUN_ID || run,
    startedUtc,
    finishedUtc: new Date().toISOString(),
    steps,
    outDir,
  };
  writeFileSync(join(outDir, 'p5-catalog-filters.json'), JSON.stringify(summary, null, 2));
  writeFileSync(join(outDir, 'verdict.txt'), summary.ok ? 'PASS\n' : 'FAIL\n');
  console.log(JSON.stringify({ ok: summary.ok, failed: failed.map((f) => f.id), outDir }));
  process.exit(summary.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  writeFileSync(join(outDir, 'verdict.txt'), 'FAIL\n');
  process.exit(2);
});
