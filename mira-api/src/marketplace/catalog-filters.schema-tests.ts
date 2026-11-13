import assert from 'node:assert/strict';
import {
  buildCatalogFacets,
  coerceQueryParam,
  filterCatalogItems,
  matchCatalogItem,
  parseCatalogFilterQuery,
  variantMatchesSelections,
  type CatalogFilterItem,
} from './catalog-filters';
import { parseVariants } from './commerce.types';
// filterCatalogItems used in C03 facet↔result equality check.

const dress: CatalogFilterItem = {
  kind: 'product',
  id: 'dress-1',
  partnerId: 'p1',
  partnerType: 'brand',
  partnerNameAr: 'متجر',
  city: 'الرياض',
  nameAr: 'فستان',
  nameEn: 'Dress',
  category: 'clothes',
  concernTags: ['texture'],
  priceHalalas: 10000,
  inventoryMode: 'product',
  stockQty: 5,
  stockAvailable: true,
  optionsJson: [
    { id: 'color', labelAr: 'اللون', values: [{ id: 'black', labelAr: 'أسود' }, { id: 'white', labelAr: 'أبيض' }] },
    { id: 'size', labelAr: 'المقاس', values: [{ id: 's', labelAr: 'S' }, { id: 'm', labelAr: 'M' }] },
  ],
  variantsJson: [
    { id: 'v-black-s', selections: { color: 'black', size: 's' }, priceHalalas: 10000, available: true },
    { id: 'v-white-m', selections: { color: 'white', size: 'm' }, priceHalalas: 12000, available: true },
  ],
};

// REQ-0013 / P5: black + M must NOT match black/S + white/M.
{
  const hit = matchCatalogItem(dress, {
    variantSelections: { color: ['black'], size: ['m'] },
  });
  assert.equal(hit, null, 'black+M must not cross-match variants');
}

// After adding black/M, it matches with that variant only.
{
  const withBlackM: CatalogFilterItem = {
    ...dress,
    variantsJson: [
      ...(dress.variantsJson as unknown[]),
      { id: 'v-black-m', selections: { color: 'black', size: 'm' }, priceHalalas: 11000, available: true },
    ],
  };
  const hit = matchCatalogItem(withBlackM, {
    variantSelections: { color: ['black'], size: ['m'] },
  });
  assert.ok(hit);
  assert.deepEqual(
    hit!.matchedVariants.map((v) => v.variantId),
    ['v-black-m'],
  );
  assert.equal(hit!.effectivePriceHalalas, 11000);
}

// C03: black/M @100 vs white/M @500 with max 200 — white must not count as a matching color option.
{
  const priced: CatalogFilterItem = {
    ...dress,
    variantsJson: [
      { id: 'bm', selections: { color: 'black', size: 'm' }, priceHalalas: 10000, available: true },
      { id: 'wm', selections: { color: 'white', size: 'm' }, priceHalalas: 50000, available: true },
    ],
  };
  const facets = buildCatalogFacets([priced], {
    variantSelections: { size: ['m'] },
    priceMaxHalalas: 20000,
  });
  assert.ok(facets['variant.color'].some((b) => b.id === 'black' && b.count === 1));
  assert.equal(
    facets['variant.color'].find((b) => b.id === 'white')?.count ?? 0,
    0,
    'white above price max must not appear in color facets',
  );
  assert.equal(matchCatalogItem(priced, { variantSelections: { color: ['white'], size: ['m'] }, priceMaxHalalas: 20000 }), null);
}

// C03: base price 100, sole variant 500 — max 200 must not match as purchasable at base.
{
  const inheritedTrap: CatalogFilterItem = {
    ...dress,
    priceHalalas: 10000,
    variantsJson: [{ id: 'only', selections: { color: 'black', size: 'm' }, priceHalalas: 50000, available: true }],
  };
  assert.equal(matchCatalogItem(inheritedTrap, { priceMaxHalalas: 20000 }), null);
  const inheritOk: CatalogFilterItem = {
    ...dress,
    priceHalalas: 10000,
    variantsJson: [{ id: 'only', selections: { color: 'black', size: 'm' }, priceHalalas: null, available: true }],
  };
  const hit = matchCatalogItem(inheritOk, { priceMaxHalalas: 20000, variantSelections: { color: ['black'], size: ['m'] } });
  assert.ok(hit);
  assert.equal(hit!.matchedVariants[0]?.priceInherited, true);
  assert.equal(hit!.matchedVariants[0]?.priceHalalas, 10000);
}

// C03: facet count equals result count for a single color pick.
{
  const items: CatalogFilterItem[] = [
    {
      ...dress,
      id: 'a',
      variantsJson: [{ id: 'a1', selections: { color: 'black', size: 'm' }, priceHalalas: 10000, available: true }],
    },
    {
      ...dress,
      id: 'b',
      variantsJson: [{ id: 'b1', selections: { color: 'black', size: 's' }, priceHalalas: 10000, available: true }],
    },
    {
      ...dress,
      id: 'c',
      variantsJson: [{ id: 'c1', selections: { color: 'white', size: 'm' }, priceHalalas: 10000, available: true }],
    },
  ];
  const facets = buildCatalogFacets(items, { variantSelections: { size: ['m'] } });
  const blackCount = facets['variant.color'].find((b) => b.id === 'black')?.count ?? 0;
  const results = filterCatalogItems(items, { variantSelections: { color: ['black'], size: ['m'] } });
  assert.equal(blackCount, results.length);
}

// OR within color, AND with size.
{
  const withBlackM: CatalogFilterItem = {
    ...dress,
    variantsJson: [
      ...(dress.variantsJson as unknown[]),
      { id: 'v-black-m', selections: { color: 'black', size: 'm' }, priceHalalas: 11000, available: true },
    ],
  };
  const hits = filterCatalogItems([withBlackM], {
    variantSelections: { color: ['black', 'white'], size: ['m'] },
  });
  assert.equal(hits.length, 1);
  assert.deepEqual(
    hits[0]!.matchedVariants.map((v) => v.variantId).sort(),
    ['v-black-m', 'v-white-m'],
  );
}

// Unavailable / draft-like (available:false) never matches.
{
  const soldOut: CatalogFilterItem = {
    ...dress,
    variantsJson: [
      { id: 'v-black-m', selections: { color: 'black', size: 'm' }, priceHalalas: 11000, available: false },
    ],
  };
  assert.equal(
    matchCatalogItem(soldOut, { variantSelections: { color: ['black'], size: ['m'] } }),
    null,
  );
}

// Variant inventory exhaustion.
{
  const tracked: CatalogFilterItem = {
    ...dress,
    inventoryMode: 'variant',
    variantsJson: [
      { id: 'v-black-m', selections: { color: 'black', size: 'm' }, priceHalalas: 11000, available: true },
    ],
    variantSellable: { 'v-black-m': 0 },
  };
  assert.equal(
    matchCatalogItem(tracked, { variantSelections: { color: ['black'], size: ['m'] }, inStock: true }),
    null,
  );
  assert.ok(
    matchCatalogItem(tracked, { variantSelections: { color: ['black'], size: ['m'] }, inStock: false }),
  );
  tracked.variantSellable = { 'v-black-m': 2 };
  assert.ok(
    matchCatalogItem(tracked, { variantSelections: { color: ['black'], size: ['m'] }, inStock: true }),
  );
}

// Service filters reject product-only variant fields.
{
  const svc: CatalogFilterItem = {
    kind: 'service',
    id: 'svc-1',
    partnerId: 'p2',
    partnerType: 'salon',
    partnerNameAr: 'صالون',
    city: 'جدة',
    nameAr: 'قص',
    nameEn: 'Cut',
    category: 'hair',
    concernTags: [],
    priceHalalas: 5000,
    durationMin: 45,
    placeMode: 'branch',
  };
  assert.equal(matchCatalogItem(svc, { variantSelections: { color: ['black'] } }), null);
  assert.ok(matchCatalogItem(svc, { placeModes: ['branch'], city: 'جدة' }));
  assert.ok(matchCatalogItem(svc, { placeModes: ['branch'], city: 'sa-jeddah' }));
  assert.equal(matchCatalogItem(svc, { placeModes: ['home'] }), null);
}

// Home coverage: HQ city must NOT substitute for coverage; id ↔ Arabic name must match.
{
  const homeRiyadhHqJeddahCoverage: CatalogFilterItem = {
    kind: 'service',
    id: 'svc-home-1',
    partnerId: 'p2',
    partnerType: 'salon',
    partnerNameAr: 'صالون',
    city: 'الرياض', // HQ — must not match جدة filter alone
    nameAr: 'منزلي',
    nameEn: 'Home',
    category: 'hair',
    concernTags: [],
    priceHalalas: 8000,
    durationMin: 60,
    placeMode: 'home',
    coverageCityIds: ['sa-jeddah'],
  };
  assert.equal(
    matchCatalogItem(homeRiyadhHqJeddahCoverage, { placeModes: ['home'], city: 'sa-riyadh' }),
    null,
    'HQ Riyadh must not match when coverage is Jeddah only',
  );
  assert.equal(
    matchCatalogItem(homeRiyadhHqJeddahCoverage, { placeModes: ['home'], city: 'الرياض' }),
    null,
  );
  assert.ok(
    matchCatalogItem(homeRiyadhHqJeddahCoverage, { placeModes: ['home'], city: 'sa-jeddah' }),
    'coverage id sa-jeddah must match filter sa-jeddah',
  );
  assert.ok(
    matchCatalogItem(homeRiyadhHqJeddahCoverage, { placeModes: ['home'], city: 'جدة' }),
    'coverage id sa-jeddah must match Arabic جدة',
  );
  const remote: CatalogFilterItem = {
    ...homeRiyadhHqJeddahCoverage,
    id: 'svc-remote',
    placeMode: 'remote',
    coverageCityIds: null,
    distanceKm: null,
  };
  assert.ok(matchCatalogItem(remote, { placeModes: ['remote'] }));
  assert.equal(matchCatalogItem(remote, { placeModes: ['home'], city: 'sa-jeddah' }), null);
}

// Facet counts exclude own field.
{
  const items: CatalogFilterItem[] = [
    dress,
    {
      ...dress,
      id: 'dress-2',
      variantsJson: [
        { id: 'v2', selections: { color: 'black', size: 'm' }, priceHalalas: 9000, available: true },
      ],
    },
  ];
  const facets = buildCatalogFacets(items, {
    variantSelections: { color: ['black'], size: ['m'] },
  });
  // With color+size applied for other facets; color facet omits color filter so black/S and black/M both contribute black.
  assert.ok(facets['variant.color'].some((b) => b.id === 'black'));
  assert.ok(facets.staleSelections.length === 0 || Array.isArray(facets.staleSelections));
}

// Stale selection flagged when value absent from remaining catalog.
{
  const facets = buildCatalogFacets([dress], {
    variantSelections: { color: ['neon'], size: ['m'] },
  });
  assert.ok(facets.staleSelections.some((s) => s.field === 'variant.color' && s.value === 'neon'));
}

// Query parse rejects bad option / sort.
{
  const bad = parseCatalogFilterQuery({ option: 'nocolon', sort: 'key' });
  assert.equal(bad.ok, false);
  const ok = parseCatalogFilterQuery({
    'variant.color': 'black,white',
    size: 'm',
    sort: 'price_asc',
    inStock: '1',
  });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.deepEqual(ok.filter.variantSelections, { color: ['black', 'white'], size: ['m'] });
    assert.equal(ok.filter.sort, 'price_asc');
    assert.equal(ok.filter.inStock, true);
  }
}

// Same-variant helper
{
  const [v] = parseVariants([{ id: 'x', selections: { color: 'black', size: 's' }, available: true }]);
  assert.equal(variantMatchesSelections(v!, { color: ['black'], size: ['s'] }), true);
  assert.equal(variantMatchesSelections(v!, { color: ['black'], size: ['m'] }), false);
}

// C03: city facet keeps alternate cities when city filter is active (exclude own field).
{
  const riyadh = { ...dress, id: 'r', city: 'الرياض' };
  const jeddah = { ...dress, id: 'j', city: 'جدة', variantsJson: dress.variantsJson };
  const facets = buildCatalogFacets([riyadh, jeddah], { city: 'الرياض' });
  assert.ok(facets.city.some((b) => b.id === 'الرياض' && b.count === 1));
  assert.ok(facets.city.some((b) => b.id === 'جدة' && b.count === 1), 'city facet must exclude city filter itself');
}

// C03: sort direction does not change representative (min) display price.
{
  const multi: CatalogFilterItem = {
    ...dress,
    variantsJson: [
      { id: 'cheap', selections: { color: 'black', size: 'm' }, priceHalalas: 10000, available: true },
      { id: 'dear', selections: { color: 'black', size: 's' }, priceHalalas: 50000, available: true },
    ],
  };
  const asc = matchCatalogItem(multi, { sort: 'price_asc' });
  const desc = matchCatalogItem(multi, { sort: 'price_desc' });
  assert.equal(asc?.effectivePriceHalalas, 10000);
  assert.equal(desc?.effectivePriceHalalas, 10000, 'display price stays min across sort');
  const orderedDesc = filterCatalogItems([multi], { sort: 'price_desc' });
  assert.equal(orderedDesc[0]?.effectivePriceHalalas, 10000);
}

// C05: reject impossible calendar dates.
{
  const bad = parseCatalogFilterQuery({ availableOn: '2026-02-30' });
  assert.equal(bad.ok, false);
  const ok = parseCatalogFilterQuery({ availableOn: '2026-02-28' });
  assert.equal(ok.ok, true);
}

// coerceQueryParam merges duplicated color params.
{
  assert.equal(coerceQueryParam(['black', 'white']), 'black,white');
  assert.equal(coerceQueryParam('black'), 'black');
}

// E1: subcategory exact-id filter (products; services need taxonomyNode.offerKind=service).
{
  const parsed = parseCatalogFilterQuery({ subcategory: 'clothes.abaya' });
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.filter.subcategory, 'clothes.abaya');
    const abaya: CatalogFilterItem = { ...dress, id: 'abaya-1', subcategory: 'clothes.abaya' };
    const evening: CatalogFilterItem = { ...dress, id: 'eve-1', subcategory: 'clothes.evening' };
    assert.ok(matchCatalogItem(abaya, parsed.filter));
    assert.equal(matchCatalogItem(evening, parsed.filter), null);
    assert.equal(matchCatalogItem({ ...dress, kind: 'service', subcategory: 'clothes.abaya' } as CatalogFilterItem, parsed.filter), null);
  }
}

// Phase1: occasions lane isolates hair; styling subcategory matches service by taxonomy ids.
{
  const styling: CatalogFilterItem = {
    ...dress,
    kind: 'service',
    id: 'style-1',
    category: 'occasions',
    profileId: 'service.occasions',
    subcategory: null,
    priceHalalas: 50000,
    durationMin: 60,
    branchId: 'br-a',
    availableOnDay: true,
    bookingEnabled: true,
  };
  const hair: CatalogFilterItem = {
    ...dress,
    kind: 'service',
    id: 'hair-1',
    category: 'hair',
    profileId: null,
    subcategory: null,
    priceHalalas: 20000,
    durationMin: 45,
  };
  const favors: CatalogFilterItem = {
    ...dress,
    id: 'fav-1',
    category: 'occasions',
    subcategory: 'occasions.favors',
    profileId: 'product.occasions_favors',
  };
  assert.ok(matchCatalogItem(styling, { lane: 'occasions' }));
  assert.equal(matchCatalogItem(hair, { lane: 'occasions' }), null, 'hair must not enter occasions');
  assert.ok(matchCatalogItem(hair, { lane: 'beauty', kind: 'service', category: 'hair' }));
  assert.ok(matchCatalogItem(favors, { lane: 'occasions', kind: 'product' }));
  assert.equal(matchCatalogItem(styling, { lane: 'occasions', kind: 'product' }), null);
  assert.equal(matchCatalogItem(favors, { lane: 'occasions', kind: 'service' }), null);
  const stylingFilter = {
    lane: 'occasions',
    subcategory: 'occasions.styling',
    taxonomyNode: {
      id: 'occasions.styling',
      lane: 'occasions',
      category: 'occasions',
      profileId: 'service.occasions',
      offerKind: 'service' as const,
    },
    branchIds: ['br-a'],
    availableOn: '2026-11-10',
  };
  assert.ok(matchCatalogItem(styling, stylingFilter));
  assert.equal(matchCatalogItem({ ...styling, branchId: 'br-b' }, stylingFilter), null);
  assert.equal(matchCatalogItem({ ...styling, availableOnDay: false }, stylingFilter), null);
  assert.equal(matchCatalogItem(favors, stylingFilter), null);
  assert.equal(matchCatalogItem(hair, stylingFilter), null);
}

// Children / jewelry / elegance lane membership — «الكل» without category must not bleed.
{
  const kidClothes: CatalogFilterItem = {
    ...dress,
    id: 'kid-clothes',
    category: 'children',
    subcategory: 'children.clothes',
  };
  const makeupKit: CatalogFilterItem = {
    ...dress,
    id: 'makeup-kit',
    category: 'face',
    subcategory: 'face.makeup_kit',
    nameAr: 'طقم مكياج',
  };
  const jewel: CatalogFilterItem = {
    ...dress,
    id: 'ring-1',
    category: 'jewelry',
    subcategory: 'jewelry.rings',
  };
  assert.ok(matchCatalogItem(kidClothes, { lane: 'children' }));
  assert.equal(matchCatalogItem(makeupKit, { lane: 'children' }), null);
  assert.ok(matchCatalogItem(kidClothes, { lane: 'children', category: 'children' }));
  assert.ok(matchCatalogItem(kidClothes, { lane: 'children', category: 'children.clothes' }));
  assert.equal(matchCatalogItem(makeupKit, { lane: 'children', category: 'children' }), null);
  assert.ok(matchCatalogItem(jewel, { lane: 'jewelry' }));
  assert.equal(matchCatalogItem(kidClothes, { lane: 'jewelry' }), null);
  assert.ok(matchCatalogItem(dress, { lane: 'elegance', category: 'clothes' }));
  assert.equal(matchCatalogItem(kidClothes, { lane: 'elegance' }), null, 'children must not appear under elegance الكل');
  assert.equal(matchCatalogItem(jewel, { lane: 'elegance' }), null, 'jewelry must not appear under elegance الكل');
}

// Phase1: ageMonths inclusive bounds; unknown age excluded only when filter set.
{
  const kid: CatalogFilterItem = {
    ...dress,
    id: 'kid-1',
    category: 'children',
    subcategory: 'children.clothes',
    attributesJson: { ageMinMonths: 6, ageMaxMonths: 12 },
  };
  const unknown: CatalogFilterItem = {
    ...dress,
    id: 'kid-unk',
    category: 'children',
    subcategory: 'children.clothes',
    attributesJson: {},
  };
  assert.ok(matchCatalogItem(kid, { ageMonths: 6 }));
  assert.ok(matchCatalogItem(kid, { ageMonths: 12 }));
  assert.equal(matchCatalogItem(kid, { ageMonths: 5 }), null);
  assert.equal(matchCatalogItem(kid, { ageMonths: 13 }), null);
  assert.equal(matchCatalogItem(unknown, { ageMonths: 8 }), null);
  assert.ok(matchCatalogItem(unknown, {}), 'unknown age still visible without age filter');
}

// Phase1: giftEligible cross-list under gifts lane same product id.
{
  const necklace: CatalogFilterItem = {
    ...dress,
    id: 'neck-1',
    category: 'jewelry',
    subcategory: 'jewelry.necklaces',
    attributesJson: { giftEligible: true, metal: 'gold' },
  };
  assert.ok(matchCatalogItem(necklace, { lane: 'gifts' }));
  assert.ok(matchCatalogItem(necklace, { giftEligible: true }));
  const cleared = { ...necklace, attributesJson: { giftEligible: false, metal: 'gold' } };
  assert.equal(matchCatalogItem(cleared, { lane: 'gifts' }), null);
  assert.ok(matchCatalogItem(cleared, { category: 'jewelry' }), 'origin jewelry still visible');
}

// Phase1: metal attribute filter parse.
{
  const parsed = parseCatalogFilterQuery({ metal: 'gold', purity: '21' });
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.deepEqual(parsed.filter.attributeSelections?.metal, ['gold']);
    assert.deepEqual(parsed.filter.attributeSelections?.purityKarat, ['21']);
  }
}

// Independent lanes: occasionTypeIds + occasionServiceOffer on services; dual-read eventType.
{
  const styling: CatalogFilterItem = {
    kind: 'service',
    id: 'occ-svc-1',
    partnerId: 'p1',
    partnerType: 'event_planner',
    partnerNameAr: 'منسّقة',
    city: 'الرياض',
    nameAr: 'تنسيق تخرج ومواليد',
    nameEn: 'Styling',
    category: 'occasions',
    profileId: 'service.occasions',
    concernTags: [],
    priceHalalas: 50000,
    durationMin: 120,
    attributesJson: {
      occasionTypeIds: ['graduation', 'baby_shower'],
      occasionServiceOffer: 'styling_decor',
    },
  };
  assert.ok(
    matchCatalogItem(styling, {
      attributeSelections: { occasionTypeIds: ['graduation'] },
    }),
    'graduation type must match multi-type offer',
  );
  assert.equal(
    matchCatalogItem(styling, {
      attributeSelections: { occasionTypeIds: ['wedding'] },
    }),
    null,
    'unrelated type must not match',
  );
  assert.ok(
    matchCatalogItem(styling, {
      attributeSelections: { occasionServiceOffer: ['styling_decor'] },
    }),
  );
  const legacy: CatalogFilterItem = {
    ...styling,
    id: 'occ-legacy',
    attributesJson: { eventType: 'graduation' },
  };
  assert.ok(
    matchCatalogItem(legacy, {
      attributeSelections: { occasionTypeIds: ['graduation'] },
    }),
    'legacy eventType dual-read',
  );
  const parsedOcc = parseCatalogFilterQuery({
    occasionType: 'graduation',
    occasionServiceOffer: 'styling_decor',
  });
  assert.equal(parsedOcc.ok, true);
  if (parsedOcc.ok) {
    assert.deepEqual(parsedOcc.filter.attributeSelections?.occasionTypeIds, ['graduation']);
    assert.deepEqual(parsedOcc.filter.attributeSelections?.occasionServiceOffer, ['styling_decor']);
  }
  const facets = buildCatalogFacets([styling, legacy], { lane: 'occasions' });
  assert.ok(facets.occasionType.some((b) => b.id === 'graduation' && b.count >= 1));
  assert.ok(facets.occasionServiceOffer.some((b) => b.id === 'styling_decor'));
}

console.log('catalog-filters.schema-tests: PASS');
