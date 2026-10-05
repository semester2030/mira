/**
 * RC7 options/clear + regression contract tests.
 * Run: node partners-portal/web/js/catalog-options-rc7-tests.mjs
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
  { id: 'size', label: 'المقاس', kind: 'size' },
  { id: 'color', label: 'اللون', kind: 'color' },
];

// 1) presetGroups omitted → no category_incompatible (RC2/RC4 contract)
const state = {
  selected: { size: ['M'], color: ['أسود'] },
  customs: {},
  variants: [
    {
      id: 'sku-m-black',
      selections: { size: 'm', color: 'black' },
      labels: { size: 'M', color: 'أسود' },
      priceHalalas: 5000,
      available: true,
    },
  ],
  valueIds: { size: { M: 'm' }, color: { أسود: 'black' } },
  clearingOptions: false,
};
state._builtGroups = M.buildOptionGroups(apparel, state);
const noPreset = M.structuredOptionsPayload(state);
assert.equal(noPreset.error, null, 'omit presetGroups must not invent category conflict');
assert.equal(noPreset.variantsJson.length, 1);

// 2) explicit empty preset → category_incompatible
const emptyPreset = M.structuredOptionsPayload(state, []);
assert.ok(emptyPreset.conflicts.some((c) => c.kind === 'category_incompatible'));

// 3) explicit apparel preset → ok
const withApparel = M.structuredOptionsPayload(state, apparel);
assert.equal(withApparel.error, null);
assert.equal(withApparel.variantsJson.length, 1);

// 4) explicit clear via clearingOptions (UI sets this after confirm)
state.clearingOptions = true;
const cleared = M.structuredOptionsPayload(state, apparel);
assert.equal(cleared.clearing, true);
assert.equal(cleared.optionsJson, null);
assert.equal(cleared.variantsJson, null);

// 5) buildCommercePayload omit presetGroups (RC2 reopen)
const published = {
  optionsJson: [{ id: 'size', labelAr: 'المقاس', values: [{ id: 'm', labelAr: 'M' }] }],
  variantsJson: [{ id: 'sku-M', selections: { size: 'm' }, priceHalalas: 9900, available: false }],
};
const hydrated = M.optionsStateFromServer(published);
const again = M.buildCommercePayload(hydrated, published.optionsJson);
assert.equal(again.variantsJson[0].id, 'sku-M');
assert.equal(again.variantsJson[0].priceHalalas, 9900);

// 6) Unrelated name/price path: empty selection without clearing must not null
const emptyUi = M.optionsStateFromServer(null);
emptyUi._builtGroups = [];
const omit = M.structuredOptionsPayload(emptyUi, apparel);
assert.notEqual(omit.clearing, true);
assert.ok(Array.isArray(omit.optionsJson));
assert.equal(omit.optionsJson.length, 0);

// 7) Category change face volumes → clothes without SKUs still conflicts when preset passed
const vol = M.optionsStateFromServer(null);
vol.selected = { volume: ['50 مل', '100 مل'] };
vol.valueIds = { volume: { '50 مل': 'v50', '100 مل': 'v100' } };
vol._builtGroups = M.buildOptionGroups([{ id: 'volume', label: 'الحجم', kind: 'volume' }], vol);
const cat = M.structuredOptionsPayload(vol, apparel);
assert.ok(cat.conflicts.some((c) => c.kind === 'category_incompatible'));
assert.ok(cat.optionsJson && cat.optionsJson.length > 0, 'must retain options under conflict');

console.log('catalog-options-rc7-tests passed');
