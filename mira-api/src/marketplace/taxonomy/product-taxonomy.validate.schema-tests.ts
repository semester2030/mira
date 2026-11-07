/**
 * E1-04 / E1-05: write validation — browseOnly, mismatch, attributes/dimensions types.
 */
import assert from 'node:assert/strict';
import { loadEleganceTaxonomyDoc } from './taxonomy.load';
import { validateProductTaxonomyWrite, resolveFromSubcategory } from './product-taxonomy.validate';

function pass(name: string) {
  console.log(`PASS ${name}`);
}

const { doc } = loadEleganceTaxonomyDoc();

assert.equal(
  validateProductTaxonomyWrite(doc, {
    category: 'clothes',
    subcategory: 'clothes.abaya',
    profileId: 'product.abaya',
  }).length,
  0,
);
pass('E1-04-valid-write');

const browse = validateProductTaxonomyWrite(doc, {
  category: 'clothes',
  subcategory: 'clothes.all',
  profileId: 'product.clothes',
});
assert.ok(browse.some((e) => e.code === 'SUBCATEGORY_BROWSE_ONLY'));
pass('E1-04-reject-browseOnly');

const rootAll = validateProductTaxonomyWrite(doc, { subcategory: 'elegance.all' });
assert.ok(rootAll.some((e) => e.code === 'SUBCATEGORY_BROWSE_ONLY'));
pass('E1-04-reject-elegance-all');

const mismatchCat = validateProductTaxonomyWrite(doc, {
  category: 'face',
  subcategory: 'clothes.abaya',
});
assert.ok(mismatchCat.some((e) => e.code === 'CATEGORY_SUBCATEGORY_MISMATCH'));
pass('E1-04-reject-category-mismatch');

const mismatchProfile = validateProductTaxonomyWrite(doc, {
  category: 'clothes',
  subcategory: 'clothes.abaya',
  profileId: 'product.clothes',
});
assert.ok(mismatchProfile.some((e) => e.code === 'PROFILE_SUBCATEGORY_MISMATCH'));
pass('E1-04-reject-profile-mismatch');

const bags = validateProductTaxonomyWrite(doc, {
  category: 'bags',
  subcategory: 'bags.hand',
  profileId: 'product.bags',
});
assert.ok(bags.some((e) => e.code === 'SUBCATEGORY_WRITE_DISABLED'));
pass('E1-04-reject-bags-write-disabled');

const unknown = validateProductTaxonomyWrite(doc, { subcategory: 'clothes.nope' });
assert.ok(unknown.some((e) => e.code === 'SUBCATEGORY_UNKNOWN'));
pass('E1-04-reject-unknown');

const attrsArr = validateProductTaxonomyWrite(doc, {
  allowOmittedSubcategory: true,
  attributes: ['silk'] as unknown as Record<string, unknown>,
});
assert.ok(attrsArr.some((e) => e.code === 'ATTRIBUTES_TYPE'));
pass('E1-05-reject-attributes-array');

const dimNull = validateProductTaxonomyWrite(doc, {
  allowOmittedSubcategory: true,
  attributes: { dimensionsCm: { w: null, h: 10, d: 5 } },
});
assert.ok(dimNull.some((e) => e.code === 'DIMENSIONS_NULL' && e.fieldId === 'dimensionsCm.w'));
pass('E1-05-reject-dimensions-null');

const dimNeg = validateProductTaxonomyWrite(doc, {
  allowOmittedSubcategory: true,
  attributes: { dimensionsCm: { w: -1 } },
});
assert.ok(dimNeg.some((e) => e.code === 'DIMENSIONS_MIN'));
pass('E1-05-reject-dimensions-negative');

const dimOk = validateProductTaxonomyWrite(doc, {
  category: 'clothes',
  subcategory: 'clothes.evening',
  attributes: { dimensionsCm: { w: 10, h: 20, d: 3 } },
});
assert.equal(dimOk.length, 0);
pass('E1-05-accept-dimensions-object');

const omitted = validateProductTaxonomyWrite(doc, {
  category: 'clothes',
  allowOmittedSubcategory: true,
});
assert.equal(omitted.length, 0);
pass('E1-05-allow-omitted-subcategory');

const resolved = resolveFromSubcategory(doc, 'clothes.abaya');
assert.deepEqual(resolved, { category: 'clothes', profileId: 'product.abaya' });
assert.equal(resolveFromSubcategory(doc, 'clothes.all'), null);
pass('E1-04-resolve-from-subcategory');

const faceClothes = validateProductTaxonomyWrite(doc, {
  category: 'face',
  subcategory: 'clothes',
  profileId: 'product.clothes',
});
assert.ok(faceClothes.some((e) => e.code === 'SUBCATEGORY_IS_CATEGORY'));
pass('E1-closure-reject-category-as-subcategory');

const unknownProfile = validateProductTaxonomyWrite(doc, {
  profileId: 'product.nope',
  allowOmittedSubcategory: true,
  knownProfileIds: new Set(['product.clothes', 'product.abaya']),
});
assert.ok(unknownProfile.some((e) => e.code === 'PROFILE_UNKNOWN'));
pass('E1-closure-reject-unknown-profile');

const materialBad = validateProductTaxonomyWrite(doc, {
  category: 'clothes',
  subcategory: 'clothes.abaya',
  profileId: 'product.abaya',
  attributes: { material: 123 },
  attributeFieldDefs: new Map([
    ['material', { id: 'material', type: 'array', values: ['silk', 'cotton'] }],
  ]),
});
assert.ok(materialBad.some((e) => e.code === 'ATTRIBUTE_TYPE' && e.fieldId === 'material'));
pass('E1-closure-reject-material-number');

const unknownAttr = validateProductTaxonomyWrite(doc, {
  allowOmittedSubcategory: true,
  attributes: { notAField: 'x' },
  attributeFieldDefs: new Map([['material', { id: 'material', type: 'array' }]]),
  allowUnknownAttributeKeys: false,
});
assert.ok(unknownAttr.some((e) => e.code === 'ATTRIBUTE_UNKNOWN'));
pass('E1-closure-reject-unknown-attribute');

const nullSub = validateProductTaxonomyWrite(doc, {
  category: 'clothes',
  subcategory: null,
  allowOmittedSubcategory: true,
});
assert.equal(nullSub.length, 0);
pass('E1-closure-null-subcategory-no-throw');

console.log('E1-04/05 ALL PASS');
