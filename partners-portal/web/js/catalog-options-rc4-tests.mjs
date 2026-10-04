/**
 * RC4-01: tests call the same MiraCatalogOptions helpers the save path uses.
 * Run: node partners-portal/web/js/catalog-options-rc4-tests.mjs
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
  { id: 'size', label: 'المقاس', kind: 'size', presets: ['S', 'M', 'L'] },
  { id: 'color', label: 'اللون', kind: 'color', presets: ['أسود', 'وردي'] },
];

// 1) Apparel: M+L + two colors → two variants via shared builders
const state = {
  selected: { size: ['M', 'L'], color: ['أسود', 'وردي'] },
  customs: {},
  traits: {},
  variants: [],
  valueIds: {},
  clearingOptions: false,
  clearingVariants: false,
};
const groups = M.buildOptionGroups(apparel, state);
assert.equal(groups.length, 2);
assert.equal(groups[0].values.length, 2);
assert.equal(groups[1].values.length, 2);
const m = groups[0].values.find((v) => v.labelAr === 'M');
const l = groups[0].values.find((v) => v.labelAr === 'L');
const black = groups[1].values.find((v) => v.labelAr === 'أسود');
const pink = groups[1].values.find((v) => v.labelAr === 'وردي');
state.variants.push({
  id: 'sku-m-black',
  selections: { size: m.id, color: black.id },
  labels: { size: 'M', color: 'أسود' },
  priceHalalas: 5000,
  available: true,
});
state.variants.push({
  id: 'sku-l-pink',
  selections: { size: l.id, color: pink.id },
  labels: { size: 'L', color: 'وردي' },
  priceHalalas: 5500,
  available: true,
});
state._builtGroups = groups;
let payload = M.structuredOptionsPayload(state);
assert.equal(payload.error, null);
assert.equal(payload.variantsJson.length, 2);

// 2) Add value after groups exist — appears in next build
state.selected.size.push('XL');
const groups2 = M.buildOptionGroups(apparel, state);
assert.ok(groups2[0].values.some((v) => v.labelAr === 'XL'));

// 3) Remove used value → conflict, no silent drop of variant row
state.selected.size = ['L', 'XL'];
const groups3 = M.buildOptionGroups(apparel, state);
state._builtGroups = groups3;
payload = M.structuredOptionsPayload(state);
assert.ok(payload.error);
assert.ok(payload.conflicts.length >= 1);
assert.equal(state.variants.length, 2);

// 4) Volume product 50ml / 100ml
const volumePreset = [{ id: 'volume', label: 'الحجم', kind: 'volume', presets: ['50 مل', '100 مل'] }];
const volState = {
  selected: { volume: ['50 مل', '100 مل'] },
  customs: {},
  traits: {},
  variants: [],
  valueIds: {},
  clearingOptions: false,
};
const volGroups = M.buildOptionGroups(volumePreset, volState);
assert.equal(volGroups[0].values.length, 2);
const v50 = volGroups[0].values.find((v) => v.labelAr === '50 مل');
volState.variants.push({
  id: 'sku-50',
  selections: { volume: v50.id },
  labels: { volume: '50 مل' },
  priceHalalas: 3000,
  available: true,
});
volState._builtGroups = volGroups;
assert.equal(M.structuredOptionsPayload(volState).variantsJson.length, 1);

// 5) Reject duplicate combination
assert.equal(
  M.isDuplicateVariant(volState.variants, { volume: v50.id }),
  true,
);

// 6) Reopen sku-M price/availability unchanged
const published = {
  optionsJson: [{ id: 'size', labelAr: 'المقاس', values: [{ id: 'm', labelAr: 'M' }] }],
  variantsJson: [{ id: 'sku-M', selections: { size: 'm' }, priceHalalas: 9900, available: false }],
};
const hydrated = M.optionsStateFromServer(published);
const again = M.buildCommercePayload(hydrated, published.optionsJson);
assert.equal(again.variantsJson[0].id, 'sku-M');
assert.equal(again.variantsJson[0].priceHalalas, 9900);
assert.equal(again.variantsJson[0].available, false);

// 7) Clear options draft
const clearing = M.optionsStateFromServer({
  ...published,
  draftOptionsSet: true,
  draftOptionsJson: null,
  draftVariantsSet: true,
  draftVariantsJson: null,
});
assert.equal(clearing.clearingOptions, true);
const clearPayload = M.structuredOptionsPayload(clearing);
assert.equal(clearPayload.optionsJson, null);
assert.equal(clearPayload.variantsJson, null);

console.log('catalog-options-rc4-tests passed');
