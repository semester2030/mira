/**
 * P4/P5 geo helpers — distance sort + cities catalog (no DB).
 * Run: npx tsx scripts/p4-geo-distance.unit.ts
 */
import assert from 'node:assert/strict';
import { haversineKm, listSaudiCities, resolveSaudiCity } from '../src/geo/saudi-cities';
import { sortCatalogMatches, type CatalogFilterMatch } from '../src/marketplace/catalog-filters';

const riyadh = resolveSaudiCity('sa-riyadh');
const jeddah = resolveSaudiCity('جدة');
assert.ok(riyadh && jeddah);
const d = haversineKm(riyadh.lat, riyadh.lng, jeddah.lat, jeddah.lng);
assert.ok(d > 700 && d < 1000, `unexpected Riyadh–Jeddah km ${d}`);

const cities = listSaudiCities('دم');
assert.ok(cities.some((c) => c.id === 'sa-dammam'));

const matches: CatalogFilterMatch[] = [
  {
    item: {
      kind: 'service',
      id: 'far',
      partnerId: 'p',
      partnerType: 'salon',
      partnerNameAr: 'أ',
      city: 'جدة',
      nameAr: 'بعيد',
      nameEn: 'far',
      concernTags: [],
      priceHalalas: 100,
      distanceKm: 80,
      placeMode: 'branch',
    },
    matchedVariants: [],
    effectivePriceHalalas: 100,
  },
  {
    item: {
      kind: 'service',
      id: 'near',
      partnerId: 'p',
      partnerType: 'salon',
      partnerNameAr: 'أ',
      city: 'الرياض',
      nameAr: 'قريب',
      nameEn: 'near',
      concernTags: [],
      priceHalalas: 100,
      distanceKm: 3,
      placeMode: 'branch',
    },
    matchedVariants: [],
    effectivePriceHalalas: 100,
  },
  {
    item: {
      kind: 'service',
      id: 'remote',
      partnerId: 'p',
      partnerType: 'salon',
      partnerNameAr: 'أ',
      city: 'الرياض',
      nameAr: 'عن بعد',
      nameEn: 'remote',
      concernTags: [],
      priceHalalas: 100,
      distanceKm: null,
      placeMode: 'remote',
    },
    matchedVariants: [],
    effectivePriceHalalas: 100,
  },
];

const sorted = sortCatalogMatches(matches, 'distance');
assert.equal(sorted[0]!.item.id, 'near');
assert.equal(sorted[1]!.item.id, 'far');
assert.equal(sorted[2]!.item.id, 'remote');

console.log(JSON.stringify({ ok: true, id: 'P4_GEO_DISTANCE_UNIT', riyadhJeddahKm: Math.round(d) }));
