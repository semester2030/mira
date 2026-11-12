/**
 * Prove «صبغة وجذور» break: portal saves category=hair + leaf attributes,
 * Flutter historically asked category=beauty.hair + subcategory=beauty.hair.color.
 * Before fix → miss; after fix → hit; pedicure filter must not return color offer.
 */
import assert from 'node:assert/strict';
import { matchCatalogItem, type CatalogFilterItem } from '../catalog-filters';
import { beautyCategoriesEquivalent, legacyBeautyCategoryFor } from './beauty-id-compat';

const colorOffer: CatalogFilterItem = {
  kind: 'service',
  id: 'offer-color-1',
  partnerId: 'salon-1',
  partnerType: 'salon',
  partnerNameAr: 'صالون اختبار',
  city: 'الرياض',
  nameAr: 'صبغة وجذور',
  nameEn: 'Color',
  category: 'hair', // portal materialize legacy
  concernTags: [],
  priceHalalas: 15000,
  placeMode: 'branch',
  profileId: 'service.salon_hair_color',
  attributesJson: {
    subcategory: 'beauty.hair.color',
    taxonomyLeaf: 'beauty.hair.color',
  },
  inventoryMode: 'service',
  stockQty: null,
  stockAvailable: true,
};

const pedicureOffer: CatalogFilterItem = {
  ...colorOffer,
  id: 'offer-pedi-1',
  nameAr: 'بديكير',
  category: 'nails',
  profileId: 'service.salon_nails',
  attributesJson: {
    subcategory: 'beauty.nails.pedicure',
    taxonomyLeaf: 'beauty.nails.pedicure',
  },
};

assert.equal(legacyBeautyCategoryFor('beauty.hair.color'), 'hair');
assert.equal(legacyBeautyCategoryFor('beauty.hair'), 'hair');
assert.ok(beautyCategoriesEquivalent('hair', 'beauty.hair'));
assert.ok(beautyCategoriesEquivalent('beauty.hair', 'hair'));

// Historical Flutter request shape (the break).
const flutterBrokenShape = {
  lane: 'beauty',
  category: 'beauty.hair',
  subcategory: 'beauty.hair.color',
  taxonomyNode: {
    id: 'beauty.hair.color',
    lane: 'beauty',
    category: 'beauty.hair',
    profileId: 'service.salon_hair_color',
    offerKind: 'service' as const,
  },
};

const hit = matchCatalogItem(colorOffer, flutterBrokenShape);
assert.ok(hit, 'color offer MUST match Flutter leaf query after beauty category alias fix');
assert.equal(hit!.item.id, 'offer-color-1');

const wrong = matchCatalogItem(colorOffer, {
  lane: 'beauty',
  category: 'nails',
  subcategory: 'beauty.nails.pedicure',
  taxonomyNode: {
    id: 'beauty.nails.pedicure',
    lane: 'beauty',
    category: 'beauty.nails',
    profileId: 'service.salon_nails',
    offerKind: 'service',
  },
});
assert.equal(wrong, null, 'color offer must NOT appear under pedicure');

const pediHit = matchCatalogItem(pedicureOffer, {
  lane: 'beauty',
  category: 'beauty.nails',
  subcategory: 'beauty.nails.pedicure',
  taxonomyNode: {
    id: 'beauty.nails.pedicure',
    lane: 'beauty',
    category: 'beauty.nails',
    profileId: 'service.salon_nails',
    offerKind: 'service',
  },
});
assert.ok(pediHit);

// Mid-only legacy filter (portal category without leaf yet).
assert.ok(matchCatalogItem(colorOffer, { lane: 'beauty', category: 'hair' }));
assert.ok(matchCatalogItem(colorOffer, { lane: 'beauty', category: 'beauty.hair' }));

console.log('OK beauty-color-binding', {
  breakPoint: 'category equality hair !== beauty.hair before alias',
  offerId: colorOffer.id,
  leaf: 'beauty.hair.color',
});
