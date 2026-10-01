/**
 * Pure checks for MC-FIX-04/05 portal options state (no browser DOM).
 * Run: node partners-portal/web/js/catalog-options-rc2-tests.mjs
 */
import assert from 'node:assert/strict';

function optionsStateFromServer(row) {
  const empty = {
    selected: {},
    customs: {},
    traits: {},
    variants: [],
    valueIds: {},
    clearingOptions: false,
    clearingVariants: false,
  };
  if (!row) return empty;
  let groups = [];
  let clearingOptions = false;
  if (row.draftOptionsSet) {
    if (row.draftOptionsJson == null) clearingOptions = true;
    else groups = Array.isArray(row.draftOptionsJson) ? row.draftOptionsJson : [];
  } else if (Array.isArray(row.optionsJson)) {
    groups = row.optionsJson;
  }
  let variants = [];
  let clearingVariants = false;
  if (row.draftVariantsSet) {
    if (row.draftVariantsJson == null) clearingVariants = true;
    else variants = Array.isArray(row.draftVariantsJson) ? row.draftVariantsJson : [];
  } else if (Array.isArray(row.variantsJson)) {
    variants = row.variantsJson;
  }
  if (clearingOptions) {
    clearingVariants = true;
    variants = [];
    groups = [];
  }
  const selected = {};
  const valueIds = {};
  groups.forEach((group) => {
    selected[group.id] = (group.values || []).map((v) => v.labelAr || v.id);
    valueIds[group.id] = {};
    (group.values || []).forEach((v) => {
      if (v?.labelAr) valueIds[group.id][v.labelAr] = v.id;
    });
  });
  const variantRows = variants.map((variant) => ({
    id: variant.id,
    selections: { ...variant.selections },
    labels: Object.fromEntries(
      groups.map((g) => {
        const valueId = variant.selections[g.id];
        const value = (g.values || []).find((v) => v.id === valueId);
        return [g.id, value ? value.labelAr : valueId];
      }),
    ),
    priceHalalas: typeof variant.priceHalalas === 'number' ? variant.priceHalalas : null,
    available: variant.available !== false,
  }));
  return { selected, valueIds, variants: variantRows, clearingOptions, clearingVariants };
}

function buildPayload(state, groups) {
  if (state.clearingOptions) return { optionsJson: null, variantsJson: null };
  const variants = state.variants.map((v) => ({
    id: v.id,
    selections: v.selections,
    priceHalalas: v.priceHalalas,
    available: v.available !== false,
  }));
  return { optionsJson: groups, variantsJson: variants };
}

const published = {
  optionsJson: [{ id: 'size', labelAr: 'المقاس', values: [{ id: 'm', labelAr: 'M' }] }],
  variantsJson: [{ id: 'sku-M', selections: { size: 'm' }, priceHalalas: 9900, available: false }],
  draftOptionsSet: false,
  draftVariantsSet: false,
};

// Save without change must keep id/price/availability.
const hydrated = optionsStateFromServer(published);
const again = buildPayload(hydrated, published.optionsJson);
assert.equal(again.variantsJson[0].id, 'sku-M');
assert.equal(again.variantsJson[0].priceHalalas, 9900);
assert.equal(again.variantsJson[0].available, false);

// Clear draft must not resurrect published options.
const clearing = optionsStateFromServer({
  ...published,
  draftOptionsSet: true,
  draftOptionsJson: null,
  draftVariantsSet: true,
  draftVariantsJson: null,
});
assert.equal(clearing.clearingOptions, true);
assert.equal(clearing.variants.length, 0);
assert.deepEqual(Object.keys(clearing.selected), []);
const clearPayload = buildPayload(clearing, []);
assert.equal(clearPayload.optionsJson, null);
assert.equal(clearPayload.variantsJson, null);

console.log('catalog-options-rc2-tests passed');
