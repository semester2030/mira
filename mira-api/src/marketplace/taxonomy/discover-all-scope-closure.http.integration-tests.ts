/**
 * Closure: Discover «الكل» across lanes + playing-offer identity helpers.
 * Seeds via partner+published catalog rows (same fields the editor persists).
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const API = (process.env.MIRA_API_BASE || 'http://127.0.0.1:3011/api/v1').replace(/\/$/, '');
const runId = `all-close-${Date.now().toString(36)}-${randomUUID().slice(0, 4)}`;
const evidenceDir = join(process.cwd(), '..', 'docs', 'jamalak-dual-reg', 'evidence', runId);

async function api(path: string) {
  const res = await fetch(`${API}${path}`);
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* ignore */
  }
  return { status: res.status, json };
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const prisma = new PrismaClient();
  const brand = await prisma.partner.create({
    data: {
      type: 'brand',
      status: 'active',
      nameAr: `إغلاق الكل ${runId}`,
      nameEn: `all-close-${runId}`,
      city: 'جدة',
    },
  });
  const salon = await prisma.partner.create({
    data: {
      type: 'salon',
      status: 'active',
      nameAr: `صالون إغلاق ${runId}`,
      nameEn: `salon-${runId}`,
      city: 'جدة',
    },
  });

  async function product(opts: {
    nameAr: string;
    category: string;
    subcategory: string;
    price: number;
    profileId: string;
  }) {
    const row = await prisma.product.create({
      data: {
        partnerId: brand.id,
        nameAr: opts.nameAr,
        nameEn: opts.nameAr,
        category: opts.category,
        subcategory: opts.subcategory,
        priceHalalas: opts.price,
        active: true,
        contentStatus: 'published',
        catalogSource: 'catalog',
        externalUrl: `https://example.test/${randomUUID()}`,
        profileId: opts.profileId,
      },
    });
    await prisma.catalogMedia.create({
      data: {
        ownerKind: 'product',
        ownerId: row.id,
        kind: 'video',
        url: `https://example.test/media/${row.id}.mp4`,
        active: true,
        publication: 'published',
        pendingRemoval: false,
        sortOrder: 0,
        isPrimary: true,
      },
    });
    return row.id;
  }

  async function service(opts: {
    nameAr: string;
    category: string;
    leaf: string;
    price: number;
  }) {
    const row = await prisma.service.create({
      data: {
        partnerId: salon.id,
        nameAr: opts.nameAr,
        nameEn: opts.nameAr,
        durationMin: 45,
        priceHalalas: opts.price,
        category: opts.category,
        placeMode: 'either',
        active: true,
        contentStatus: 'published',
        catalogSource: 'catalog',
        attributesJson: { subcategory: opts.leaf, taxonomyLeaf: opts.leaf },
      },
    });
    await prisma.catalogMedia.create({
      data: {
        ownerKind: 'service',
        ownerId: row.id,
        kind: 'video',
        url: `https://example.test/media/${row.id}.mp4`,
        active: true,
        publication: 'published',
        pendingRemoval: false,
        sortOrder: 0,
        isPrimary: true,
      },
    });
    return row.id;
  }

  const clothesId = await product({
    nameAr: 'ملابس أطفال إغلاق',
    category: 'children',
    subcategory: 'children.clothes',
    price: 9000,
    profileId: 'product.kids',
  });
  const shoesId = await product({
    nameAr: 'أحذية أطفال إغلاق',
    category: 'children',
    subcategory: 'children.shoes',
    price: 6000,
    profileId: 'product.kids',
  });
  const makeupId = await product({
    nameAr: 'طقم مكياج',
    category: 'face',
    subcategory: 'face.kit',
    price: 40000,
    profileId: 'product.skin',
  });
  const ringId = await product({
    nameAr: 'خاتم اختبار',
    category: 'jewelry',
    subcategory: 'jewelry.rings',
    price: 120000,
    profileId: 'product.jewelry',
  });
  const giftId = await product({
    nameAr: 'هدية اختبار',
    category: 'gifts',
    subcategory: 'gifts.boxes',
    price: 15000,
    profileId: 'product.gifts',
  });
  const colorId = await service({
    nameAr: 'صبغة إغلاق',
    category: 'hair',
    leaf: 'beauty.hair.color',
    price: 20000,
  });
  const blowId = await service({
    nameAr: 'استشوار إغلاق',
    category: 'hair',
    leaf: 'beauty.hair.blowdry',
    price: 15000,
  });

  const rows: Array<Record<string, unknown>> = [];

  function playingFrom(items: any[]): string {
    // Screen binds player to the first visible slide after a section replace.
    return items[0]?.id ? String(items[0].id) : '';
  }

  // Lane membership matrix (no parallel name lists — taxonomy prefixes only).
  for (const [lane, must, mustNot] of [
    ['children', [clothesId, shoesId], [makeupId, ringId]],
    ['jewelry', [ringId], [clothesId, makeupId]],
    ['gifts', [giftId], [clothesId, ringId]],
    ['elegance', [], [clothesId, ringId, giftId]],
  ] as const) {
    const res = await api(
      `/marketplace/catalog?lane=${lane}&partnerId=${encodeURIComponent(brand.id)}&visual=1&limit=20`,
    );
    if (res.status !== 200) {
      console.error('lane fail', lane, res.status, JSON.stringify(res.json).slice(0, 300));
    }
    assert(res.status === 200, `${lane} status=${res.status}`);
    const ids = new Set((res.json?.items || []).map((i: any) => i.id));
    for (const id of must) assert(ids.has(id), `${lane} missing ${id}`);
    for (const id of mustNot) assert(!ids.has(id), `${lane} leaked ${id}`);
    rows.push({
      path: `${lane} ← الكل (lane membership)`,
      litCircle: 'all',
      filters: {},
      request: `lane=${lane}&partnerId=${brand.id}`,
      resultIds: [...ids].filter((id) => [...must, ...mustNot].includes(id as string)),
      playingOfferId: playingFrom((res.json?.items || []).filter((i: any) => must.includes(i.id))),
      status: 'PASS',
    });
  }

  const kidsAll = await api(
    `/marketplace/catalog?lane=children&category=children&partnerId=${encodeURIComponent(brand.id)}&visual=1&limit=20`,
  );
  const kidsIds = (kidsAll.json?.items || []).map((i: any) => i.id);
  assert(kidsIds.includes(clothesId) && kidsIds.includes(shoesId), 'children section');
  assert(!kidsIds.includes(makeupId), 'no makeup in children');
  rows.push({
    path: 'الأطفال ← الكل',
    litCircle: 'all',
    filters: {},
    request: `lane=children&category=children&partnerId=${brand.id}`,
    resultIds: kidsIds.filter((id: string) => [clothesId, shoesId, makeupId].includes(id)),
    playingOfferId: playingFrom((kidsAll.json?.items || []).filter((i: any) => i.id === clothesId || i.id === shoesId)),
    status: 'PASS',
  });

  const shoes = await api(
    `/marketplace/catalog?lane=children&category=children&subcategory=children.shoes&partnerId=${encodeURIComponent(brand.id)}&visual=1&limit=20`,
  );
  const shoeIds = (shoes.json?.items || []).map((i: any) => i.id);
  assert(shoeIds.includes(shoesId) && !shoeIds.includes(clothesId), 'shoes leaf');
  rows.push({
    path: 'الأطفال ← أحذية أطفال',
    litCircle: 'children.shoes',
    filters: {},
    request: 'lane=children&category=children&subcategory=children.shoes',
    resultIds: shoeIds.filter((id: string) => [clothesId, shoesId, makeupId].includes(id)),
    playingOfferId: shoeIds.includes(shoesId) ? shoesId : '',
    status: 'PASS',
  });

  const hairAll = await api(
    `/marketplace/catalog?lane=beauty&category=hair&partnerId=${encodeURIComponent(salon.id)}&visual=1&limit=20`,
  );
  assert(hairAll.status === 200, `hair all status=${hairAll.status}`);
  const hairIds = new Set((hairAll.json?.items || []).map((i: any) => i.id));
  assert(hairIds.has(colorId) && hairIds.has(blowId), 'hair الكل must include color+blowdry');
  rows.push({
    path: 'الشعر ← الكل',
    litCircle: 'all',
    filters: {},
    request: `lane=beauty&category=hair&partnerId=${salon.id}`,
    resultIds: [colorId, blowId].filter((id) => hairIds.has(id)),
    playingOfferId: playingFrom((hairAll.json?.items || []).filter((i: any) => i.id === colorId || i.id === blowId)),
    status: 'PASS',
  });

  const colorOnly = await api(
    `/marketplace/catalog?lane=beauty&category=hair&subcategory=beauty.hair.color&partnerId=${encodeURIComponent(salon.id)}&visual=1&limit=20`,
  );
  const colorIds = new Set((colorOnly.json?.items || []).map((i: any) => i.id));
  assert(colorIds.has(colorId) && !colorIds.has(blowId), 'color leaf');
  rows.push({
    path: 'الشعر ← صبغة',
    litCircle: 'beauty.hair.color',
    filters: {},
    request: `lane=beauty&category=hair&subcategory=beauty.hair.color&partnerId=${salon.id}`,
    resultIds: [...colorIds].filter((id) => id === colorId || id === blowId),
    playingOfferId: colorIds.has(colorId) ? colorId : '',
    status: 'PASS',
  });

  const blowOnly = await api(
    `/marketplace/catalog?lane=beauty&category=hair&subcategory=beauty.hair.blowdry&partnerId=${encodeURIComponent(salon.id)}&visual=1&limit=20`,
  );
  const blowIds = new Set((blowOnly.json?.items || []).map((i: any) => i.id));
  assert(blowIds.has(blowId) && !blowIds.has(colorId), 'blowdry leaf');
  rows.push({
    path: 'الشعر ← استشوار',
    litCircle: 'beauty.hair.blowdry',
    filters: {},
    request: `lane=beauty&category=hair&subcategory=beauty.hair.blowdry&partnerId=${salon.id}`,
    resultIds: [...blowIds].filter((id) => id === colorId || id === blowId),
    playingOfferId: blowIds.has(blowId) ? blowId : '',
    status: 'PASS',
  });

  const homeMakeup = await api(
    `/marketplace/catalog?lane=beauty&category=makeup&placeMode=home&partnerId=${encodeURIComponent(salon.id)}&visual=1&limit=20`,
  );
  assert(homeMakeup.status === 200, 'home makeup');
  const homeIds = (homeMakeup.json?.items || []).map((i: any) => i.id);
  assert(!homeIds.includes(makeupId), 'product makeup kit must not appear under beauty services');
  rows.push({
    path: 'خدمات المكياج + في موقعك',
    litCircle: 'all',
    filters: { placeMode: 'home' },
    request: 'lane=beauty&category=makeup&placeMode=home',
    resultIds: homeIds.slice(0, 5),
    playingOfferId: homeIds[0] ? String(homeIds[0]) : '',
    status: 'PASS',
  });

  // Empty section: no bleed from prior — request children with impossible subcategory.
  const empty = await api(
    `/marketplace/catalog?lane=children&category=children&subcategory=children.__empty_test__&visual=1&limit=5`,
  );
  const emptyIds = (empty.json?.items || []).map((i: any) => i.id);
  assert(emptyIds.length === 0, 'empty section must be empty');
  rows.push({
    path: 'قسم فارغ (children.__empty_test__)',
    litCircle: 'children.__empty_test__',
    filters: {},
    request: 'lane=children&category=children&subcategory=children.__empty_test__',
    resultIds: [],
    playingOfferId: '',
    status: 'PASS',
  });

  mkdirSync(evidenceDir, { recursive: true });
  const summary = {
    runId,
    gitHead: process.env.GIT_HEAD || 'pending',
    apiBase: API,
    verdict: 'PASS_ALL_SCOPE_CLOSURE_HTTP',
    seeded: { clothesId, shoesId, makeupId, ringId, giftId, colorId, blowId },
    rows,
    note: 'playingOfferId = first item the UI would bind after section replace; empty stays empty.',
  };
  writeFileSync(join(evidenceDir, 'CLOSURE_SUMMARY.json'), JSON.stringify(summary, null, 2));
  writeFileSync(join(evidenceDir, 'ACCEPTANCE_TABLE.md'), [
    '# Discover «الكل» closure table',
    '',
    `| runId | ${runId} |`,
    `| gitHead | ${summary.gitHead} |`,
    '',
    '| المسار | الدائرة | الفلاتر | الطلب | النتائج | المشغّل | الحالة |',
    '|---|---|---|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${r.path} | ${r.litCircle} | ${JSON.stringify(r.filters)} | \`${r.request}\` | ${(r.resultIds as string[]).join(', ') || '∅'} | ${r.playingOfferId || '∅'} | ${r.status} |`,
    ),
    '',
  ].join('\n'));
  console.log(JSON.stringify({ verdict: summary.verdict, runId, evidenceDir, rowCount: rows.length }, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
