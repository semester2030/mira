/**
 * Portal options tests call the same MiraCatalogOptions implementation as the UI.
 * Run: node partners-portal/web/js/catalog-options-rc2-tests.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const dir = dirname(fileURLToPath(import.meta.url));
const sandbox = { console };
sandbox.globalThis = sandbox;
runInNewContext(readFileSync(join(dir, 'catalog-options-core.js'), 'utf8'), sandbox);
const { optionsStateFromServer, buildCommercePayload, isDuplicateVariant } = sandbox.MiraCatalogOptions;

const published = {
  optionsJson: [{ id: 'size', labelAr: 'المقاس', values: [{ id: 'm', labelAr: 'M' }] }],
  variantsJson: [{ id: 'sku-M', selections: { size: 'm' }, priceHalalas: 9900, available: false }],
  draftOptionsSet: false,
  draftVariantsSet: false,
};

// Save without change must keep id/price/availability.
const hydrated = optionsStateFromServer(published);
const again = buildCommercePayload(hydrated, published.optionsJson);
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
const clearPayload = buildCommercePayload(clearing, []);
assert.equal(clearPayload.optionsJson, null);
assert.equal(clearPayload.variantsJson, null);

// Duplicate detection uses unambiguous selection keys (pipe-safe).
assert.equal(isDuplicateVariant([{ selections: { size: 'm', color: 'pink' } }], { size: 'm', color: 'pink' }), true);
assert.equal(isDuplicateVariant([{ selections: { a: 'x|b=y' } }], { a: 'x' }), false);

console.log('catalog-options-rc2-tests passed');
