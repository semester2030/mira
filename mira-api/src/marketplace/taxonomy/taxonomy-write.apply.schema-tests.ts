/**
 * Pure regression for V01 profile-resolve-before-validate and N01 draft-null baseline.
 */
import assert from 'node:assert/strict';
import { loadEleganceTaxonomyDoc } from './taxonomy.load';
import { applyTaxonomyPatch, readTaxonomyBaseline } from './taxonomy-write.apply';
import type { AttributeFieldDef } from './product-taxonomy.validate';

function pass(name: string) {
  console.log(`PASS ${name}`);
}

const { doc } = loadEleganceTaxonomyDoc();
const defs = new Map<string, AttributeFieldDef>([
  ['material', { id: 'material', type: 'array', values: ['silk', 'cotton', 'linen'] }],
]);

const ctx = {
  doc,
  knownProfileIds: new Set(['product.abaya', 'product.clothes']),
  resolveAttributeFieldDefs: (profileId: string | null) =>
    profileId === 'product.abaya' || profileId === 'product.clothes' ? defs : undefined,
};

{
  const r = applyTaxonomyPatch(
    ctx,
    { category: null, subcategory: null, profileId: null, attributesJson: null },
    {
      category: 'clothes',
      subcategory: 'clothes.abaya',
      attributes: { material: 123 },
    },
  );
  assert.ok(r.errors.some((e) => e.fieldId === 'material' && e.code === 'ATTRIBUTE_TYPE'), JSON.stringify(r.errors));
  pass('V01-material-number-rejected-after-profile-resolve');
}

{
  const r = applyTaxonomyPatch(
    ctx,
    { category: null, subcategory: null, profileId: null, attributesJson: null },
    {
      category: 'clothes',
      subcategory: 'clothes.abaya',
      attributes: { material: ['silk', 'cotton'] },
    },
  );
  assert.equal(r.errors.length, 0, JSON.stringify(r.errors));
  assert.equal(r.next.profileId, 'product.abaya');
  assert.deepEqual(r.next.attributesJson, { material: ['silk', 'cotton'] });
  pass('V02-material-ok-profile-inferred');
}

{
  const r = applyTaxonomyPatch(
    ctx,
    { category: 'clothes', subcategory: 'clothes.abaya', profileId: 'product.abaya', attributesJson: { material: ['silk'] } },
    { attributes: { notAllowedField: 'x' } },
  );
  assert.ok(r.errors.some((e) => e.code === 'ATTRIBUTE_UNKNOWN'), JSON.stringify(r.errors));
  pass('V03-unknown-attribute-rejected');
}

{
  const baseline = readTaxonomyBaseline({
    draftTaxonomySet: true,
    draftCategory: 'clothes',
    draftSubcategory: null,
    draftProfileId: null,
    draftAttributesJson: { dimensionsCm: { w: 1 } },
    category: 'clothes',
    subcategory: 'clothes.abaya',
    profileId: 'product.abaya',
    attributesJson: { material: ['silk'] },
  });
  assert.equal(baseline.subcategory, null);
  assert.deepEqual(baseline.attributesJson, { dimensionsCm: { w: 1 } });
  const r = applyTaxonomyPatch(ctx, baseline, { attributes: { dimensionsCm: { w: 45 } } }, { published: true });
  assert.equal(r.errors.length, 0, JSON.stringify(r.errors));
  assert.equal(r.next.subcategory, null);
  assert.ok(!('material' in ((r.next.attributesJson as object) || {})));
  assert.deepEqual(r.next.attributesJson, { dimensionsCm: { w: 45 } });
  pass('N01-cleared-values-stay-cleared');
}

{
  const r = applyTaxonomyPatch(
    ctx,
    { category: null, subcategory: null, profileId: null, attributesJson: null },
    {
      category: 'clothes',
      subcategory: 'clothes.abaya',
      profileId: null,
      attributes: { material: 123, notAllowed: true },
    },
  );
  assert.equal(r.next.profileId, null, 'explicit null profile stays stored');
  assert.ok(r.errors.some((e) => e.fieldId === 'material' && e.code === 'ATTRIBUTE_TYPE'), JSON.stringify(r.errors));
  assert.ok(r.errors.some((e) => e.fieldId === 'notAllowed' && e.code === 'ATTRIBUTE_UNKNOWN'), JSON.stringify(r.errors));
  pass('V-null-profile-still-validates-via-subcategory');
}

{
  const r = applyTaxonomyPatch(
    ctx,
    { category: null, subcategory: null, profileId: null, attributesJson: null },
    {
      category: 'clothes',
      attributes: { material: 123, notAllowed: true },
    },
  );
  assert.ok(
    r.errors.some((e) => e.code === 'ATTRIBUTE_CONTEXT_REQUIRED' || e.code === 'ATTRIBUTE_TYPE' || e.code === 'ATTRIBUTE_UNKNOWN'),
    JSON.stringify(r.errors),
  );
  pass('V-no-profile-no-subcategory-rejects-bad-attrs');
}

{
  const r = applyTaxonomyPatch(
    ctx,
    {
      category: 'clothes',
      subcategory: 'clothes.abaya',
      profileId: 'product.abaya',
      attributesJson: { material: ['silk'], legacyUnknown: 'keep' },
    },
    { profileId: null, attributes: { material: 123 } },
  );
  assert.equal(r.next.profileId, null);
  assert.ok(r.errors.some((e) => e.fieldId === 'material' && e.code === 'ATTRIBUTE_TYPE'), JSON.stringify(r.errors));
  pass('V-clear-profile-with-bad-attrs-rejects');
}

{
  const r = applyTaxonomyPatch(
    ctx,
    {
      category: 'clothes',
      subcategory: 'clothes.abaya',
      profileId: 'product.abaya',
      attributesJson: { material: ['silk'], legacyUnknown: 'keep' },
    },
    { attributes: { material: null } },
  );
  assert.equal(r.errors.length, 0, JSON.stringify(r.errors));
  assert.deepEqual(r.next.attributesJson, { legacyUnknown: 'keep' });
  pass('V-explicit-clear-keeps-untouched-legacy');
}

{
  // Clear profile, then attributes-only must NOT restore stored profileId.
  const cleared = applyTaxonomyPatch(
    ctx,
    {
      category: 'clothes',
      subcategory: 'clothes.abaya',
      profileId: 'product.abaya',
      attributesJson: { material: ['silk'] },
    },
    { profileId: null },
    { published: true },
  );
  assert.equal(cleared.errors.length, 0, JSON.stringify(cleared.errors));
  assert.equal(cleared.next.profileId, null);
  assert.equal(cleared.draftData.draftProfileId, null);
  assert.equal(cleared.draftData.draftSubcategory, 'clothes.abaya');

  const baseline = readTaxonomyBaseline({
    draftTaxonomySet: true,
    draftCategory: 'clothes',
    draftSubcategory: 'clothes.abaya',
    draftProfileId: null,
    draftAttributesJson: { material: ['silk'] },
    category: 'clothes',
    subcategory: 'clothes.abaya',
    profileId: 'product.abaya',
    attributesJson: { material: ['silk'] },
  });
  const attrOnly = applyTaxonomyPatch(
    ctx,
    baseline,
    { attributes: { material: ['cotton'] } },
    { published: true },
  );
  assert.equal(attrOnly.errors.length, 0, JSON.stringify(attrOnly.errors));
  assert.equal(attrOnly.next.profileId, null, 'cleared profile must stay null after attributes patch');
  assert.equal(attrOnly.draftData.draftProfileId, null);
  assert.equal(attrOnly.draftData.draftSubcategory, 'clothes.abaya');
  assert.deepEqual(attrOnly.next.attributesJson, { material: ['cotton'] });
  pass('P-cleared-profile-stays-null-on-attributes-patch');
}

{
  // Re-sending the same subcategory must not undo an explicit profile clear.
  const baseline = readTaxonomyBaseline({
    draftTaxonomySet: true,
    draftCategory: 'clothes',
    draftSubcategory: 'clothes.abaya',
    draftProfileId: null,
    draftAttributesJson: { material: ['silk'] },
    category: 'clothes',
    subcategory: 'clothes.abaya',
    profileId: 'product.abaya',
    attributesJson: { material: ['silk'] },
  });
  const sameSub = applyTaxonomyPatch(
    ctx,
    baseline,
    { subcategory: 'clothes.abaya' },
    { published: true },
  );
  assert.equal(sameSub.next.profileId, null);
  pass('P-same-subcategory-does-not-restore-cleared-profile');
}

console.log('taxonomy-write.apply.schema-tests: PASS');