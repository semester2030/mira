/**
 * Beauty Phase A acceptance — id/name/image consistency + home-visit medical exclusion.
 * No false closure: cut ≠ color; laser never under salons or home filter.
 */
import assert from 'node:assert/strict';
import { matchCatalogItem, type CatalogFilterItem } from '../catalog-filters';
import { resolveBeautyIcon, resetBeautyIconCacheForTests } from './beauty-icon-assets';
import { loadLaneTaxonomyDoc } from './taxonomy.load';

resetBeautyIconCacheForTests();
const { doc } = loadLaneTaxonomyDoc('beauty');
assert.equal(doc.lane, 'beauty');
assert.equal(doc.publicBrowse, true);

const byId = new Map(doc.nodes.map((n) => [n.id, n]));

function requireNode(id: string) {
  const n = byId.get(id);
  assert.ok(n, `missing node ${id}`);
  return n!;
}

// Cut ≠ color — distinct ids, labels, imageKeys, and resolved icons.
const cut = requireNode('beauty.hair.cut');
const color = requireNode('beauty.hair.color');
assert.notEqual(cut.id, color.id);
assert.notEqual(cut.labelAr, color.labelAr);
assert.notEqual(cut.imageKey, color.imageKey);
assert.equal(cut.profileId, 'service.salon_hair_cut');
assert.ok(color.profileId);

const cutIcon = resolveBeautyIcon(cut.imageKey);
const colorIcon = resolveBeautyIcon(color.imageKey);
assert.ok(cutIcon, `icon missing for ${cut.imageKey}`);
assert.ok(colorIcon, `icon missing for ${color.imageKey}`);
assert.notEqual(cutIcon!.smallUrl, colorIcon!.smallUrl);
assert.notEqual(cutIcon!.version, colorIcon!.version);

// Every write leaf has imageKey + resolvable unique icon (no silent parent reuse).
const writeLeaves = doc.nodes.filter(
  (n) => n.writeEnabled !== false && n.browseOnly !== true && (!n.children || n.children.length === 0),
);
assert.ok(writeLeaves.length >= 40, `expected many write leaves, got ${writeLeaves.length}`);
const iconVersions = new Set<string>();
for (const leaf of writeLeaves) {
  assert.ok(leaf.imageKey, `write leaf ${leaf.id} missing imageKey`);
  assert.ok(leaf.profileId, `write leaf ${leaf.id} missing profileId`);
  const icon = resolveBeautyIcon(leaf.imageKey);
  assert.ok(icon, `enabled leaf ${leaf.id} imageKey=${leaf.imageKey} has no icon file`);
  iconVersions.add(icon!.version);
  if (leaf.medicalOnly) {
    assert.deepEqual(leaf.placeModesAllowed, ['clinic_only']);
  } else {
    assert.ok(
      Array.isArray(leaf.placeModesAllowed) && leaf.placeModesAllowed.length > 0,
      `non-medical leaf ${leaf.id} needs placeModesAllowed`,
    );
    assert.ok(!leaf.placeModesAllowed!.includes('clinic_only') || leaf.placeModesAllowed!.length > 1);
  }
}

// Salon tree must not contain laser/teeth medical parents.
const salons = requireNode('beauty.salons');
assert.ok(!salons.children.includes('beauty.clinic.laser'));
assert.ok(!salons.children.includes('beauty.clinic.teeth'));
assert.ok(salons.children.includes('beauty.hair'));

const clinics = requireNode('beauty.clinics');
assert.equal(clinics.medicalOnly, true);
assert.ok(clinics.children.includes('beauty.clinic.laser'));
assert.ok(clinics.children.includes('beauty.clinic.teeth'));

const laser = requireNode('beauty.clinic.laser');
assert.equal(laser.medicalOnly, true);
assert.ok(!salons.children.includes(laser.id));

// Clinic hair eval must not reuse skin procedure profile (orb/name/fields stay aligned).
const hairEval = requireNode('beauty.clinic.derm.hair_eval');
assert.equal(hairEval.profileId, 'service.clinic_consult');
assert.notEqual(hairEval.imageKey, requireNode('beauty.clinic.derm.skin_eval').imageKey);

// No write leaf reuses a parent imageKey (false closure on the rail).
for (const leaf of writeLeaves) {
  let pid = leaf.parentId;
  while (pid) {
    const parent = byId.get(pid);
    if (!parent) break;
    assert.notEqual(
      leaf.imageKey,
      parent.imageKey,
      `${leaf.id} must not reuse parent ${pid} imageKey`,
    );
    pid = parent.parentId;
  }
}

// Home-visit is a browse filter chip, not a third copy of hair services.
const homeVisit = requireNode('beauty.home_visit');
assert.equal(homeVisit.browseOnly, true);
assert.deepEqual(homeVisit.children || [], []);

// Catalog filter: home placeMode excludes clinic/laser/teeth.
const homeMakeup: CatalogFilterItem = {
  kind: 'service',
  id: 'svc-home-makeup',
  partnerId: 'salon-1',
  partnerType: 'salon',
  partnerNameAr: 'مشغل',
  city: 'الرياض',
  nameAr: 'مكياج منزلي',
  nameEn: 'Home makeup',
  category: 'makeup',
  concernTags: [],
  priceHalalas: 20000,
  placeMode: 'home',
  inventoryMode: 'service',
  stockQty: null,
  stockAvailable: true,
};
const laserClinic: CatalogFilterItem = {
  ...homeMakeup,
  id: 'svc-laser',
  partnerId: 'clinic-1',
  partnerType: 'clinic',
  nameAr: 'ليزر',
  category: 'laser',
  placeMode: 'home',
};
const clinicLeaf: CatalogFilterItem = {
  ...laserClinic,
  id: 'svc-clinic-leaf',
  category: 'beauty.clinic.laser',
  subcategory: 'beauty.clinic.laser.hair',
  placeMode: 'home',
};

assert.ok(matchCatalogItem(homeMakeup, { placeModes: ['home'], lane: 'beauty' }));
assert.equal(
  matchCatalogItem(laserClinic, { placeModes: ['home'], lane: 'beauty' }),
  null,
  'clinic laser must not appear under home-visit',
);
assert.equal(
  matchCatalogItem(clinicLeaf, { placeModes: ['home'], lane: 'beauty' }),
  null,
  'beauty.clinic.* must not appear under home-visit',
);

// Branch laser still matches branch filter (medical exclusion only when home is selected).
const laserBranch: CatalogFilterItem = { ...laserClinic, placeMode: 'branch' };
assert.ok(matchCatalogItem(laserBranch, { placeModes: ['branch'], lane: 'beauty' }));

console.log('OK beauty-a acceptance', {
  writeLeaves: writeLeaves.length,
  distinctIconFiles: iconVersions.size,
  cutImageKey: cut.imageKey,
  colorImageKey: color.imageKey,
});
