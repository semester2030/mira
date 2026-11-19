/**
 * Catalog guide — single source for 22 providers / 74 services + journey1 mapping.
 * Run: npx tsx src/marketplace/taxonomy/catalog-guide.schema-tests.ts
 */
import assert from 'node:assert/strict';
import { CatalogGuideService, BLOCKED_SERVICE_TEMPLATE_IDS } from './catalog-guide.service';

const guide = new CatalogGuideService();
guide.onModuleInit();

const summary = guide.summary();
assert.equal(summary.providerCount, 22, '22 provider types');
assert.equal(summary.serviceCount, 74, '74 services');
assert.ok(summary.hash.length === 64);

const s042 = guide.getService('S042');
const s043 = guide.getService('S043');
const s044 = guide.getService('S044');
const s098 = guide.getService('S098');
assert.ok(s042 && s043 && s044 && s098);
assert.equal(s042!.taxonomyLeafId, 'beauty.face_care.cleanse');
assert.equal(s043!.taxonomyLeafId, 'beauty.face_care.hydrate');
assert.equal(s044!.taxonomyLeafId, 'beauty.face_care.pre_makeup');
assert.equal(s098!.taxonomyLeafId, 'beauty.face_care.peel');
assert.equal(s044!.nameAr, 'عناية قبل المكياج');
assert.equal(s098!.nameAr, 'تقشير تجميلي سطحي للوجه');
assert.ok(s042!.suggestedPhrasesAr.length >= 1);
assert.ok(s043!.suggestedPhrasesAr.length >= 1);
assert.ok(s044!.suggestedPhrasesAr.some((p) => /مكياج/.test(p)));
assert.ok(s098!.suggestedPhrasesAr.some((p) => /تقشير/.test(p)));

const bc = guide.getProvider('BC');
assert.ok(bc);
assert.ok(bc!.partnerTypes.includes('salon') || bc!.partnerTypes.includes('clinic'));

const forBc = guide.listServices({ providerTypeId: 'BC' });
assert.ok(forBc.some((s) => s.id === 'S042'));
assert.ok(forBc.some((s) => s.id === 'S043'));

const j1 = guide.journey1();
assert.ok(j1);
assert.equal(j1!.providerTypeId, 'BC');
assert.deepEqual(j1!.serviceIds, ['S042', 'S043']);

assert.ok(guide.isTemplateBlocked('clinic_teeth'));
assert.ok(guide.isTemplateBlocked('clinic_laser'));
assert.ok(!guide.isTemplateBlocked('salon_care'));
assert.ok(BLOCKED_SERVICE_TEMPLATE_IDS.has('clinic_teeth'));

// reload is idempotent
guide.reload();
assert.equal(guide.getService('S042')?.nameAr, 'تنظيف تجميلي سطحي');

console.log('OK catalog-guide', {
  providers: summary.providerCount,
  services: summary.serviceCount,
  journey1: j1,
  mapped: summary.mappedTaxonomyLeaves,
});
