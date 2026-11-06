/**
 * P5-C06 performance measure (local, not a PASS gate).
 * Seeds N products with variants, times browse with multi-filter + facets.
 * Run: DATABASE_URL=... npx tsx src/marketplace/p5-catalog-perf.measure.ts
 */
import 'reflect-metadata';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MarketplaceService } from './marketplace.service';

const N = Number(process.env.MIRA_P5_PERF_N || 120);
const run = `p5perf${Date.now().toString(36)}`;
const outDir =
  process.env.MIRA_P5_OUT_DIR ||
  join(process.cwd(), '..', 'audit-out', 'p5', 'logs', `p5-perf-${run}`);
mkdirSync(outDir, { recursive: true });

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
    console.error('REFUSE: local DB only');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  const marketplace = new MarketplaceService(prisma as unknown as PrismaService);
  const partnerIds: string[] = [];
  const productIds: string[] = [];
  const startedUtc = new Date().toISOString();
  const memBefore = process.memoryUsage();

  try {
    const partner = await prisma.partner.create({
      data: {
        type: 'brand',
        status: 'active',
        nameAr: `أداء ${run}`,
        nameEn: `perf-${run}`,
        city: 'الرياض',
      },
    });
    partnerIds.push(partner.id);

    for (let i = 0; i < N; i += 1) {
      const p = await prisma.product.create({
        data: {
          partnerId: partner.id,
          nameAr: `منتج أداء ${i}`,
          nameEn: `perf-${i}`,
          priceHalalas: 5000 + (i % 40) * 250,
          externalUrl: `https://example.test/p${i}`,
          concernTags: i % 2 === 0 ? ['texture'] : ['moisture'],
          category: i % 3 === 0 ? 'clothes' : 'face',
          active: true,
          contentStatus: 'published',
          catalogSource: 'catalog',
          ...(i % 3 === 0
            ? {
                optionsJson: [
                  {
                    id: 'color',
                    labelAr: 'اللون',
                    values: [
                      { id: 'black', labelAr: 'أسود', swatchHex: '#111' },
                      { id: 'white', labelAr: 'أبيض', swatchHex: '#eee' },
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
                  {
                    id: `v-${i}-bs`,
                    selections: { color: 'black', size: 's' },
                    priceHalalas: 5000 + i,
                    available: true,
                  },
                  {
                    id: `v-${i}-bm`,
                    selections: { color: 'black', size: 'm' },
                    priceHalalas: 6000 + i,
                    available: true,
                  },
                  {
                    id: `v-${i}-wm`,
                    selections: { color: 'white', size: 'm' },
                    priceHalalas: 7000 + i,
                    available: true,
                  },
                ],
              }
            : {}),
        },
      });
      productIds.push(p.id);
    }

    const t0 = Date.now();
    const res = await marketplace.browse({
      partnerId: partner.id,
      color: 'black',
      size: 'm',
      priceMax: '20000',
      facets: '1',
      sort: 'price_asc',
      limit: '12',
    });
    const elapsedMs = Date.now() - t0;
    const memAfter = process.memoryUsage();
    const payload = JSON.stringify(res);
    const report = {
      id: 'P5_C06_PERF_MEASURE',
      startedUtc,
      finishedUtc: new Date().toISOString(),
      env: { node: process.version, nProducts: N, clothesShareApprox: Math.ceil(N / 3) },
      browse: {
        elapsedMs,
        totalMatched: res.totalMatched,
        pageItems: res.items.length,
        responseBytes: Buffer.byteLength(payload),
        facetKeys: res.facets ? Object.keys(res.facets) : [],
      },
      memory: {
        rssBefore: memBefore.rss,
        rssAfter: memAfter.rss,
        heapUsedBefore: memBefore.heapUsed,
        heapUsedAfter: memAfter.heapUsed,
      },
      notesAr: [
        'القياس محلي على مسار in-memory الحالي بعد جلب الكتالوج المنشور للشريك.',
        'ليس معيار PASS؛ لا اختراع نسبة تحسن بلا خط أساس سابق.',
        'لا تحميل وسائط أثناء حساب الفلاتر؛ الوسائط تُجلب لصفحة النتائج فقط.',
      ],
    };
    writeFileSync(join(outDir, 'p5-perf.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally {
    await prisma.product.deleteMany({ where: { id: { in: productIds } } }).catch(() => undefined);
    await prisma.partner.deleteMany({ where: { id: { in: partnerIds } } }).catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
