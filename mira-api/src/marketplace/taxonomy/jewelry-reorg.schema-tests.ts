import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  filterCatalogItems,
  parseCatalogFilterQuery,
  type CatalogFilterItem,
} from '../catalog-filters';
import {
  assertJewelryMaterialPolicy,
  resolveJewelryCapabilityActivity,
  metalMatchesGoldFilter,
  defaultJewelryAdminFlags,
} from './jewelry-material.policy';

const HERE = __dirname;
const jewelry = JSON.parse(readFileSync(join(HERE, 'jewelry-taxonomy.v1.json'), 'utf8'));
assert.equal(jewelry.definitionsVersion, 2);

const byId = new Map(jewelry.nodes.map((n: { id: string }) => [n.id, n]));
for (const id of [
  'jewelry.rings',
  'jewelry.bracelets',
  'jewelry.necklaces',
  'jewelry.earrings',
  'jewelry.pendants',
  'jewelry.sets',
  'jewelry.hand_chains',
  'jewelry.anklets',
  'jewelry.nose',
  'jewelry.brooches',
  'jewelry.cap.silver',
  'jewelry.cap.gold',
  'jewelry.cap.gold_set',
  'jewelry.metal.gold',
  'jewelry.stone.diamond',
  'jewelry.trait.newborn',
]) {
  assert.ok(byId.has(id), `missing ${id}`);
}

assert.equal((byId.get('jewelry.cap.gold') as { grantOnly?: boolean }).grantOnly, true);
assert.equal((byId.get('jewelry.metal.gold') as { browseOnly?: boolean }).browseOnly, true);

// Material policy
assert.ok(assertJewelryMaterialPolicy({ metal: 'steel' }).some((v) => v.code === 'JEWELRY_METAL_REJECTED'));
assert.ok(assertJewelryMaterialPolicy({ metal: 'brass' }).length >= 1);
assert.equal(assertJewelryMaterialPolicy({ metal: 'gold', purityKarat: '21' }).length, 0);
assert.ok(
  assertJewelryMaterialPolicy({ metal: 'silver_gold_plated' }, { ...defaultJewelryAdminFlags(), allowSilverGoldPlated: false })
    .some((v) => v.code === 'JEWELRY_PLATED_SILVER_DISABLED'),
);
assert.ok(
  assertJewelryMaterialPolicy(
    { metal: 'gold', stoneTypes: ['diamond'], diamondOrigin: 'lab' },
    { ...defaultJewelryAdminFlags(), allowLabDiamond: false },
  ).some((v) => v.code === 'JEWELRY_LAB_DIAMOND_DISABLED'),
);
assert.equal(metalMatchesGoldFilter('silver_gold_plated'), false);
assert.equal(metalMatchesGoldFilter('gold'), true);
assert.equal(resolveJewelryCapabilityActivity({ metal: 'silver' }), 'jewelry.cap.silver');
assert.equal(
  resolveJewelryCapabilityActivity({ metal: 'gold', stoneTypes: ['diamond', 'emerald'] }),
  'jewelry.cap.gold_set',
);
assert.equal(resolveJewelryCapabilityActivity({ metal: 'gold' }), 'jewelry.cap.gold');

const bangle: CatalogFilterItem = {
  kind: 'product',
  id: 'b1',
  partnerId: 'p1',
  partnerType: 'brand',
  partnerNameAr: 'متجر ذهب',
  city: 'الرياض',
  nameAr: 'بنجرة 21',
  nameEn: 'bangle',
  concernTags: [],
  priceHalalas: 90000,
  category: 'jewelry',
  subcategory: 'jewelry.bracelets',
  profileId: 'product.jewelry',
  attributesJson: {
    metal: 'gold',
    metalColor: 'yellow',
    purityKarat: '21',
    sellUnit: 'piece',
    pieceStyle: 'bangle',
    weightG: 12,
  },
  stockQty: 3,
};

const plated: CatalogFilterItem = {
  ...bangle,
  id: 'b2',
  nameAr: 'فضة مطلية',
  attributesJson: { metal: 'silver_gold_plated', sellUnit: 'piece', purityKarat: '925' },
};

const setSold: CatalogFilterItem = {
  ...bangle,
  id: 'b3',
  nameAr: 'طقم بناجر',
  subcategory: 'jewelry.sets',
  attributesJson: { metal: 'gold', sellUnit: 'set', purityKarat: '21' },
};

const ring40: CatalogFilterItem = {
  kind: 'product',
  id: 'r40',
  partnerId: 'p1',
  partnerType: 'brand',
  partnerNameAr: 'متجر',
  city: 'الرياض',
  nameAr: 'خاتم 0.40',
  nameEn: 'ring40',
  concernTags: [],
  priceHalalas: 120000,
  category: 'jewelry',
  subcategory: 'jewelry.rings',
  profileId: 'product.jewelry',
  attributesJson: {
    metal: 'gold',
    metalColor: 'white',
    stoneTypes: ['diamond', 'emerald'],
    diamondOrigin: 'natural',
    diamondRole: 'center',
    diamondCenterCarat: 0.4,
    diamondTotalCarat: 1.0,
  },
  stockQty: 1,
};

const ring50: CatalogFilterItem = {
  ...ring40,
  id: 'r50',
  nameAr: 'خاتم 0.50',
  attributesJson: {
    ...ring40.attributesJson,
    diamondCenterCarat: 0.5,
    diamondTotalCarat: 0.8,
  },
};

const namedSilver: CatalogFilterItem = {
  kind: 'product',
  id: 's1',
  partnerId: 'p2',
  partnerType: 'brand',
  partnerNameAr: 'فضة',
  city: 'الرياض',
  nameAr: 'إسورة مولودة',
  nameEn: 'named',
  concernTags: [],
  priceHalalas: 25000,
  category: 'jewelry',
  subcategory: 'jewelry.bracelets',
  profileId: 'product.jewelry',
  attributesJson: {
    metal: 'silver',
    purityKarat: '925',
    discoveryTraits: ['newborn', 'named', 'gift'],
    engravingText: 'نورة',
    engravingLeadDays: 5,
    giftEligible: true,
  },
  stockQty: 2,
};

// Journey 1: yellow gold 21 bangle by piece — exclude plated + set
{
  const parsed = parseCatalogFilterQuery({
    lane: 'jewelry',
    subcategory: 'jewelry.bracelets',
    metal: 'gold',
    purity: '21',
    sellUnit: 'piece',
  });
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    const hits = filterCatalogItems([bangle, plated, setSold], {
      ...parsed.filter,
      taxonomyNode: {
        id: 'jewelry.bracelets',
        lane: 'jewelry',
        category: 'jewelry',
        profileId: 'product.jewelry',
        offerKind: 'product',
      },
      excludeMetals: ['silver_gold_plated', 'silver'],
    });
    assert.equal(hits.length, 1);
    assert.equal(hits[0].item.id, 'b1');
  }
}

// Journey 2: natural diamond center >= 0.50 — exclude 0.40 even if total 1.00
{
  const hits = filterCatalogItems([ring40, ring50], {
    lane: 'jewelry',
    subcategory: 'jewelry.rings',
    taxonomyNode: {
      id: 'jewelry.rings',
      lane: 'jewelry',
      category: 'jewelry',
      profileId: 'product.jewelry',
      offerKind: 'product',
    },
    attributeSelections: { stoneTypes: ['diamond'], diamondOrigin: ['natural'] },
    diamondCenterCaratMin: 0.5,
  });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].item.id, 'r50');
}

// Same product id from metal + stone + piece filters
{
  const byPiece = filterCatalogItems([ring50], {
    subcategory: 'jewelry.rings',
    taxonomyNode: {
      id: 'jewelry.rings',
      lane: 'jewelry',
      category: 'jewelry',
      profileId: 'product.jewelry',
      offerKind: 'product',
    },
  });
  const byStone = filterCatalogItems([ring50], {
    lane: 'jewelry',
    category: 'jewelry',
    attributeSelections: { stoneTypes: ['emerald'] },
  });
  const byMetal = filterCatalogItems([ring50], {
    lane: 'jewelry',
    category: 'jewelry',
    attributeSelections: { metal: ['gold'], metalColor: ['white'] },
  });
  assert.equal(byPiece[0].item.id, byStone[0].item.id);
  assert.equal(byPiece[0].item.id, byMetal[0].item.id);
}

// Named silver gift-eligible
{
  const hits = filterCatalogItems([namedSilver, bangle], {
    lane: 'gifts',
    giftEligible: true,
    attributeSelections: { discoveryTraits: ['newborn'] },
  });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].item.id, 's1');
}

console.log('jewelry-reorg.schema-tests: ok');
