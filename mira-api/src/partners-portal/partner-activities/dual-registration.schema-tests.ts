/**
 * Dual registration paths: منشأة vs مختصّة مستقلة.
 * Place filter ≠ provider kind. Independent exclusive from facility identity.
 */
import assert from 'node:assert/strict';
import {
  FACILITY_IDENTITY_KINDS,
  IDENTITY_KINDS,
  providerKindFromIdentity,
  SERVICE_MODES,
} from './partner-activities.types';
import { placeModeMatchesFilter } from '../../marketplace/catalog-filters';
import { matchCatalogItem, type CatalogFilterItem } from '../../marketplace/catalog-filters';

assert.ok(IDENTITY_KINDS.independent);
assert.ok(SERVICE_MODES.client_home);
assert.ok((FACILITY_IDENTITY_KINDS as readonly string[]).includes('salon'));
assert.equal(providerKindFromIdentity(['independent']), 'independent');
assert.equal(providerKindFromIdentity(['salon']), 'facility');
assert.equal(providerKindFromIdentity(['clinic']), 'facility');
// Mixing independent + salon is treated as facility at the helper level;
// validateRequest rejects it with IDENTITY_PATH_CONFLICT (enforced in service).
assert.equal(providerKindFromIdentity(['independent', 'salon']), 'facility');

// placeMode either matches home and branch filters; never remote alone.
assert.equal(placeModeMatchesFilter('either', ['home']), true);
assert.equal(placeModeMatchesFilter('either', ['branch']), true);
assert.equal(placeModeMatchesFilter('either', ['remote']), false);
assert.equal(placeModeMatchesFilter('home', ['home']), true);
assert.equal(placeModeMatchesFilter('home', ['branch']), false);
assert.equal(placeModeMatchesFilter('branch', ['home']), false);

const nouraHome: CatalogFilterItem = {
  kind: 'service',
  id: 'svc-noura-bridal',
  partnerId: 'noura',
  partnerType: 'salon',
  providerKind: 'independent',
  partnerNameAr: 'نورة',
  city: 'الرياض',
  nameAr: 'مكياج عروس',
  nameEn: 'Bridal makeup',
  category: 'makeup',
  concernTags: [],
  priceHalalas: 50000,
  placeMode: 'home',
  inventoryMode: 'service',
  stockQty: null,
  stockAvailable: true,
};
const lamsaEither: CatalogFilterItem = {
  ...nouraHome,
  id: 'svc-lamsa-bridal',
  partnerId: 'lamsa',
  providerKind: 'facility',
  partnerNameAr: 'صالون لمسة',
  placeMode: 'either',
};

assert.ok(matchCatalogItem(nouraHome, { placeModes: ['home'], lane: 'beauty' }));
assert.ok(matchCatalogItem(lamsaEither, { placeModes: ['home'], lane: 'beauty' }));
assert.ok(matchCatalogItem(lamsaEither, { placeModes: ['branch'], lane: 'beauty' }));
assert.equal(
  matchCatalogItem(nouraHome, { placeModes: ['branch'], lane: 'beauty' }),
  null,
  'mobile-only independent must not appear under في المقر',
);

const clinicLaser: CatalogFilterItem = {
  ...nouraHome,
  id: 'svc-laser',
  partnerId: 'clinic-1',
  partnerType: 'clinic',
  providerKind: 'facility',
  partnerNameAr: 'عيادة',
  category: 'beauty.clinic.laser',
  placeMode: 'branch',
};
assert.equal(
  matchCatalogItem(clinicLaser, { placeModes: ['home'], lane: 'beauty' }),
  null,
  'medical must not appear under في موقعك',
);

// either: premises in Riyadh, coverage in Jeddah — home filter uses coverage only.
const eitherCrossCity: CatalogFilterItem = {
  ...lamsaEither,
  id: 'svc-either-cross',
  city: 'الرياض',
  coverageCityIds: ['sa-jeddah'],
  placeMode: 'either',
};
assert.ok(
  matchCatalogItem(eitherCrossCity, { placeModes: ['home'], city: 'جدة', lane: 'beauty' }),
  'في موقعك must match coverage city even when HQ is elsewhere',
);
assert.equal(
  matchCatalogItem(eitherCrossCity, { placeModes: ['branch'], city: 'جدة', lane: 'beauty' }),
  null,
  'في المقر must not match coverage-only city without a branch there',
);
assert.ok(
  matchCatalogItem(eitherCrossCity, { placeModes: ['branch'], city: 'الرياض', lane: 'beauty' }),
  'في المقر matches premises city',
);

console.log('OK dual-registration schema', {
  eitherHome: placeModeMatchesFilter('either', ['home']),
  nouraHome: !!matchCatalogItem(nouraHome, { placeModes: ['home'], lane: 'beauty' }),
  nouraBranch: matchCatalogItem(nouraHome, { placeModes: ['branch'], lane: 'beauty' }),
  eitherJeddahHome: !!matchCatalogItem(eitherCrossCity, {
    placeModes: ['home'],
    city: 'جدة',
    lane: 'beauty',
  }),
});
