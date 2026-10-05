/**
 * RC8 clear/restore + save-payload contract tests.
 * Run: node partners-portal/web/js/catalog-options-rc8-tests.mjs
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
const M = sandbox.MiraCatalogOptions;

const apparel = [
  { id: 'size', label: 'المقاس', kind: 'size', presets: ['XS', 'S', 'M', 'L', 'XL'] },
  { id: 'color', label: 'اللون', kind: 'color', presets: [] },
];

function baseState() {
  return {
    selected: { size: ['M', 'L'], color: ['أسود'] },
    customs: { size: 'XXL-draft' },
    variants: [
      {
        id: 'sku-m-black',
        selections: { size: 'm', color: 'black' },
        labels: { size: 'M', color: 'أسود' },
        priceHalalas: 5000,
        available: true,
      },
    ],
    valueIds: { size: { M: 'm', L: 'l', 'XXL-draft': 'xxl-draft' }, color: { أسود: 'black' } },
    clearingOptions: false,
    clearingVariants: false,
  };
}

// 1) Snapshot clone round-trip preserves ids/prices
const before = baseState();
const snap = JSON.parse(JSON.stringify(before));
assert.equal(snap.variants[0].id, 'sku-m-black');
assert.equal(snap.valueIds.size['XXL-draft'], 'xxl-draft');

// 2) Explicit clear → null payload
const cleared = { ...baseState(), clearingOptions: true, selected: {}, customs: {}, variants: [], valueIds: {} };
const clearPayload = M.structuredOptionsPayload(cleared, apparel);
assert.equal(clearPayload.clearing, true);
assert.equal(clearPayload.optionsJson, null);
assert.equal(clearPayload.variantsJson, null);

// 3) After clear, UI must clear clearingOptions before save when XXL entered
const afterXxl = {
  selected: {},
  customs: { size: 'XXL' },
  variants: [],
  valueIds: {},
  clearingOptions: false, // UI abandonClearIfValuesEntered
  clearingVariants: false,
};
afterXxl._builtGroups = M.buildOptionGroups(apparel, afterXxl);
const rebuilt = M.structuredOptionsPayload(afterXxl, apparel);
assert.notEqual(rebuilt.clearing, true);
assert.ok(rebuilt.optionsJson.some((g) => g.id === 'size'));
const sizeGroup = rebuilt.optionsJson.find((g) => g.id === 'size');
assert.ok(sizeGroup.values.some((v) => v.labelAr === 'XXL'));
assert.equal(rebuilt.variantsJson.length, 0, 'must not invent deleted variants');

// 3b) If clearingOptions left true with empty values → null
const stillClear = { selected: {}, customs: {}, variants: [], valueIds: {}, clearingOptions: true };
assert.equal(M.structuredOptionsPayload(stillClear, apparel).optionsJson, null);

// 4) buildCommercePayload after UI cleared the flag
const afterPreset = {
  selected: { size: ['M'] },
  customs: {},
  variants: [],
  valueIds: { size: { M: 'm' } },
  clearingOptions: false,
};
const commerce = M.buildCommercePayload(afterPreset, M.buildOptionGroups(apparel, afterPreset), apparel);
assert.ok(commerce.optionsJson && commerce.optionsJson.length);
assert.notEqual(commerce.optionsJson, null);

// 5) Empty with clearingOptions still clears
const emptyClear = { selected: {}, customs: {}, variants: [], valueIds: {}, clearingOptions: true };
assert.equal(M.structuredOptionsPayload(emptyClear, apparel).clearing, true);
assert.equal(M.buildCommercePayload(emptyClear, [], apparel).optionsJson, null);

// 6) stateHasOptionLabels
assert.equal(M.stateHasOptionLabels({ selected: {}, customs: {}, variants: [] }), false);
assert.equal(M.stateHasOptionLabels({ selected: { size: ['M'] }, customs: {}, variants: [] }), true);
assert.equal(M.stateHasOptionLabels({ selected: {}, customs: { size: ' XXL ' }, variants: [] }), true);

// 7) Category conflict still retains data without SKUs
const vol = M.optionsStateFromServer(null);
vol.selected = { volume: ['50 مل'] };
vol.valueIds = { volume: { '50 مل': 'v50' } };
vol._builtGroups = M.buildOptionGroups([{ id: 'volume', label: 'الحجم', kind: 'volume' }], vol);
const cat = M.structuredOptionsPayload(vol, apparel);
assert.ok(cat.conflicts.some((c) => c.kind === 'category_incompatible'));
assert.ok(cat.optionsJson.length > 0);

console.log('catalog-options-rc8-tests passed');
