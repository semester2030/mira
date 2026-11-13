/**
 * Discover «الكل» scope: children / shoes leaf / makeup bleed / beauty hair mid.
 * Run: MIRA_API_BASE=http://127.0.0.1:3011/api/v1 npx tsx src/marketplace/taxonomy/discover-all-scope.http.integration-tests.ts
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const API = (process.env.MIRA_API_BASE || 'http://127.0.0.1:3011/api/v1').replace(/\/$/, '');
const runId = `all-scope-${Date.now().toString(36)}-${randomUUID().slice(0, 4)}`;
const evidenceDir = join(
  process.cwd(),
  '..',
  'docs',
  'jamalak-dual-reg',
  'evidence',
  runId,
);

async function api(path: string) {
  const res = await fetch(`${API}${path}`);
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* ignore */
  }
  return { status: res.status, json, text };
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const prisma = new PrismaClient();
  const partner = await prisma.partner.create({
    data: {
      type: 'brand',
      status: 'active',
      nameAr: `شريك نطاق الكل ${runId}`,
      nameEn: `All-scope partner ${runId}`,
      city: 'جدة',
    },
  });

  const mkProduct = async (opts: {
    nameAr: string;
    category: string;
    subcategory: string;
    price: number;
  }) => {
    const product = await prisma.product.create({
      data: {
        partnerId: partner.id,
        nameAr: opts.nameAr,
        nameEn: opts.nameAr,
        category: opts.category,
        subcategory: opts.subcategory,
        priceHalalas: opts.price,
        active: true,
        contentStatus: 'published',
        catalogSource: 'catalog',
        externalUrl: `https://example.test/${randomUUID()}`,
        profileId: opts.category === 'children' ? 'product.kids' : 'product.skin',
      },
    });
    await prisma.catalogMedia.create({
      data: {
        ownerKind: 'product',
        ownerId: product.id,
        kind: 'video',
        url: `https://example.test/media/${product.id}.mp4`,
        active: true,
        publication: 'published',
        pendingRemoval: false,
        sortOrder: 0,
        isPrimary: true,
      },
    });
    return product.id;
  };

  const clothesId = await mkProduct({
    nameAr: 'فستان أطفال اختبار',
    category: 'children',
    subcategory: 'children.clothes',
    price: 8000,
  });
  const shoesId = await mkProduct({
    nameAr: 'حذاء أطفال اختبار',
    category: 'children',
    subcategory: 'children.shoes',
    price: 5000,
  });
  const makeupId = await mkProduct({
    nameAr: 'طقم مكياج',
    category: 'face',
    subcategory: 'face.kit',
    price: 40000,
  });

  const rows: Array<Record<string, unknown>> = [];

  const laneAll = await api(`/marketplace/catalog?kind=product&lane=children&visual=1&limit=20`);
  assert(laneAll.status === 200, `lane all status ${laneAll.status}`);
  const laneIds = new Set((laneAll.json?.items || []).map((i: any) => i.id));
  assert(laneIds.has(clothesId), 'lane children must include clothes');
  assert(laneIds.has(shoesId), 'lane children must include shoes');
  assert(!laneIds.has(makeupId), 'lane children must NOT include makeup kit');
  rows.push({
    path: 'الأطفال ← (بدون فئة / كل المسار)',
    request: 'GET .../catalog?lane=children',
    resultIds: [...laneIds].filter((id) => id === clothesId || id === shoesId || id === makeupId),
    videoOfferId: (laneAll.json?.items || []).find((i: any) => i.id === clothesId || i.id === shoesId)?.id ?? null,
    status: 'PASS',
  });

  const sectionAll = await api(
    `/marketplace/catalog?kind=product&lane=children&category=children&visual=1&limit=20`,
  );
  const sectionIds = new Set((sectionAll.json?.items || []).map((i: any) => i.id));
  assert(sectionIds.has(clothesId) && sectionIds.has(shoesId), 'category=children includes both leaves');
  assert(!sectionIds.has(makeupId), 'category=children excludes makeup');
  rows.push({
    path: 'الأطفال ← الكل',
    request: 'GET .../catalog?lane=children&category=children',
    resultIds: [...sectionIds].filter((id) => [clothesId, shoesId, makeupId].includes(id)),
    videoOfferId: clothesId,
    status: 'PASS',
  });

  const shoesOnly = await api(
    `/marketplace/catalog?kind=product&lane=children&category=children&subcategory=children.shoes&visual=1&limit=20`,
  );
  const shoeIds = new Set((shoesOnly.json?.items || []).map((i: any) => i.id));
  assert(shoeIds.has(shoesId), 'shoes leaf includes shoes');
  assert(!shoeIds.has(clothesId), 'shoes leaf excludes clothes');
  assert(!shoeIds.has(makeupId), 'shoes leaf excludes makeup');
  rows.push({
    path: 'الأطفال ← أحذية أطفال',
    request: 'GET .../catalog?lane=children&category=children&subcategory=children.shoes',
    resultIds: [...shoeIds].filter((id) => [clothesId, shoesId, makeupId].includes(id)),
    videoOfferId: shoesId,
    status: 'PASS',
  });

  const leafAsCategory = await api(
    `/marketplace/catalog?kind=product&lane=children&category=children.clothes&visual=1&limit=20`,
  );
  const leafCatIds = new Set((leafAsCategory.json?.items || []).map((i: any) => i.id));
  assert(leafCatIds.has(clothesId), 'category=children.clothes matches leaf subcategory row');
  assert(!leafCatIds.has(shoesId), 'category=children.clothes excludes shoes');
  rows.push({
    path: 'الأطفال ← ملابس أطفال (category=leaf)',
    request: 'GET .../catalog?lane=children&category=children.clothes',
    resultIds: [...leafCatIds].filter((id) => [clothesId, shoesId, makeupId].includes(id)),
    videoOfferId: clothesId,
    status: 'PASS',
  });

  mkdirSync(evidenceDir, { recursive: true });
  const summary = {
    runId,
    gitHead: process.env.GIT_HEAD || 'pending',
    apiBase: API,
    verdict: 'PASS_ALL_SCOPE',
    partnerId: partner.id,
    seeded: { clothesId, shoesId, makeupId },
    rows,
    note: 'HTTP proves server scope; Flutter widget proves الكل keeps category=children.',
  };
  writeFileSync(join(evidenceDir, 'ALL_SCOPE_SUMMARY.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ verdict: 'PASS_ALL_SCOPE', runId, evidenceDir, rows }, null, 2));
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
