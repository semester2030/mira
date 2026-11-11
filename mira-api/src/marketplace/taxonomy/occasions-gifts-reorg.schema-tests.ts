import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  filterCatalogItems,
  parseCatalogFilterQuery,
  type CatalogFilterItem,
} from '../catalog-filters';

const HERE = __dirname;

function load(name: string) {
  return JSON.parse(readFileSync(join(HERE, name), 'utf8'));
}

const occasions = load('occasions-taxonomy.v1.json');
const gifts = load('gifts-taxonomy.v1.json');
const phrases = load('description-phrases.v1.json');

assert.equal(occasions.definitionsVersion, 4);
assert.equal(gifts.definitionsVersion, 3);

const byId = new Map(occasions.nodes.map((n: { id: string }) => [n.id, n]));
for (const id of [
  'occasions.packages',
  'occasions.arches',
  'occasions.tables_decor',
  'occasions.hospitality',
  'occasions.buffet',
  'occasions.perfume_corner',
  'occasions.furniture_rental',
  'occasions.photography',
  'occasions.favors',
  'occasions.decor',
]) {
  assert.ok(byId.has(id), `missing ${id}`);
}

const decor = byId.get('occasions.decor') as { offerKind?: string; profileId?: string; labelAr?: string };
assert.equal(decor.offerKind, 'product');
assert.equal(decor.profileId, 'product.occasions_favors');
assert.match(String(decor.labelAr), /ضيافة/);

const tables = byId.get('occasions.tables_decor') as { offerKind?: string };
assert.equal(tables.offerKind, 'service');

assert.ok(byId.has('occasions.type.engagement'));
assert.ok(byId.has('occasions.type.milka'));
assert.notEqual(
  (byId.get('occasions.type.engagement') as { labelAr: string }).labelAr,
  (byId.get('occasions.type.milka') as { labelAr: string }).labelAr,
);

for (const id of [
  'gifts.flowers',
  'gifts.boxes',
  'gifts.chocolate',
  'gifts.perfume_incense',
  'gifts.personalized',
  'gifts.balloons',
]) {
  const n = gifts.nodes.find((x: { id: string }) => x.id === id);
  assert.ok(n, id);
  assert.equal(n.offerKind, 'product');
}

assert.ok((phrases.bySubcategory['occasions.hospitality'] || []).length >= 2);
assert.ok((phrases.bySubcategory['gifts.flowers'] || []).length >= 1);

const base: CatalogFilterItem = {
  kind: 'service',
  id: 's1',
  partnerId: 'p1',
  partnerType: 'event_planner',
  partnerNameAr: 'منسّق',
  city: 'الرياض',
  nameAr: 'صبّابات',
  nameEn: 'hostess',
  concernTags: [],
  priceHalalas: 10000,
  category: 'occasions',
  profileId: 'service.occasions',
  attributesJson: {
    subcategory: 'occasions.hospitality',
    taxonomyLeaf: 'occasions.hospitality',
    occasionTypeIds: ['milka'],
    hostessCount: 2,
  },
  bookingEnabled: true,
  availableOnDay: true,
};

const packageItem: CatalogFilterItem = {
  ...base,
  id: 's2',
  nameAr: 'باقة تخرج',
  attributesJson: {
    subcategory: 'occasions.packages',
    taxonomyLeaf: 'occasions.packages',
    occasionTypeIds: ['graduation'],
    guestsMin: 30,
    guestsMax: 50,
    packageIncludes: 'كوشة + ضيافة',
  },
};

const giftItem: CatalogFilterItem = {
  kind: 'product',
  id: 'g1',
  partnerId: 'p2',
  partnerType: 'brand',
  partnerNameAr: 'متجر',
  city: 'الرياض',
  nameAr: 'ورد وشوكولاتة',
  nameEn: 'flowers',
  concernTags: [],
  priceHalalas: 15000,
  category: 'gifts',
  subcategory: 'gifts.flowers',
  profileId: 'product.gifts',
  attributesJson: { sameDayDelivery: true, occasionTypeIds: ['baby_shower'] },
  stockQty: 5,
};

const hospitalityNode = {
  id: 'occasions.hospitality',
  lane: 'occasions',
  category: 'occasions',
  profileId: 'service.occasions',
  offerKind: 'service' as const,
};

const hitsHosp = filterCatalogItems(
  [base, packageItem],
  {
    lane: 'occasions',
    subcategory: 'occasions.hospitality',
    taxonomyNode: hospitalityNode,
    attributeSelections: { occasionTypeIds: ['milka'] },
    hostessCountMin: 2,
    city: 'الرياض',
  },
);
assert.equal(hitsHosp.length, 1);
assert.equal(hitsHosp[0].item.id, 's1');

const hitsPkg = filterCatalogItems(
  [base, packageItem],
  {
    lane: 'occasions',
    subcategory: 'occasions.packages',
    taxonomyNode: {
      id: 'occasions.packages',
      lane: 'occasions',
      category: 'occasions',
      profileId: 'service.occasions',
      offerKind: 'service',
    },
    guestsCount: 40,
  },
);
assert.equal(hitsPkg.length, 1);
assert.equal(hitsPkg[0].item.id, 's2');

const parsed = parseCatalogFilterQuery({
  lane: 'gifts',
  subcategory: 'gifts.flowers',
  sameDayDelivery: '1',
  occasionType: 'baby_shower',
  inStock: '1',
});
assert.equal(parsed.ok, true);
if (parsed.ok) {
  const giftsHits = filterCatalogItems([giftItem, base as unknown as CatalogFilterItem], {
    ...parsed.filter,
    taxonomyNode: {
      id: 'gifts.flowers',
      lane: 'gifts',
      category: 'gifts',
      profileId: 'product.gifts',
      offerKind: 'product',
    },
  });
  assert.equal(giftsHits.length, 1);
  assert.equal(giftsHits[0].item.id, 'g1');
}

console.log('occasions-gifts-reorg.schema-tests: ok');
