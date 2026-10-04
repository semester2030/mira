/**
 * RC5-01: silent group-drop must conflict; save-path helpers only.
 * Run: node partners-portal/web/js/catalog-options-rc5-tests.mjs
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
  { id: 'size', label: 'المقاس', kind: 'size', presets: ['S', 'M', 'L', 'XL'] },
  { id: 'color', label: 'اللون', kind: 'color', presets: ['أسود', 'وردي'] },
];

function baseState() {
  const state = {
    selected: { size: ['M', 'L'], color: ['أسود', 'وردي'] },
    customs: {},
    traits: {},
    variants: [],
    valueIds: {},
    clearingOptions: false,
  };
  const groups = M.buildOptionGroups(apparel, state);
  const m = groups[0].values.find((v) => v.labelAr === 'M');
  const black = groups[1].values.find((v) => v.labelAr === 'أسود');
  state.variants.push({
    id: 'sku-m-black',
    selections: { size: m.id, color: black.id },
    labels: { size: 'M', color: 'أسود' },
    priceHalalas: 9900,
    available: false,
  });
  state._builtGroups = groups;
  return state;
}

// 1) Delete used value while other color values remain → conflict
{
  const state = baseState();
  state.selected.color = ['وردي'];
  state._builtGroups = M.buildOptionGroups(apparel, state);
  const payload = M.structuredOptionsPayload(state, apparel);
  assert.ok(payload.error, 'missing used color value must error');
  assert.ok(payload.conflicts.length >= 1);
  assert.equal(state.variants[0].id, 'sku-m-black');
  assert.ok(state.variants[0].selections.color, 'must not strip color selection silently');
  assert.equal(state.variants[0].labels.color, 'أسود');
}

// 2) Delete last color value while size remains → conflict, not size-only SKU
{
  const state = baseState();
  state.selected.color = [];
  state._builtGroups = M.buildOptionGroups(apparel, state);
  assert.equal(state._builtGroups.length, 1);
  const payload = M.structuredOptionsPayload(state, apparel);
  assert.ok(payload.error);
  assert.ok(payload.conflicts.some((c) => c.kind === 'group_removed'));
  assert.equal(payload.variantsJson.length, 0);
  assert.ok(state.variants[0].selections.color, 'SKU selections preserved in memory');
}

// 3) Clear all values without explicit clearingOptions → conflict
{
  const state = baseState();
  state.selected = { size: [], color: [] };
  state._builtGroups = M.buildOptionGroups(apparel, state);
  const payload = M.structuredOptionsPayload(state, apparel);
  assert.ok(payload.error);
  assert.ok(payload.conflicts.some((c) => c.kind === 'all_values_cleared' || c.kind === 'group_removed'));
}

// 4) Explicit clear path still works
{
  const state = baseState();
  state.clearingOptions = true;
  const payload = M.structuredOptionsPayload(state, apparel);
  assert.equal(payload.optionsJson, null);
  assert.equal(payload.variantsJson, null);
  assert.equal(payload.clearing, true);
}

// 5) Add XL without reopening
{
  const state = baseState();
  state.selected.size.push('XL');
  const groups = M.buildOptionGroups(apparel, state);
  assert.ok(groups[0].values.some((v) => v.labelAr === 'XL'));
}

// 6) Reopen preserves price/availability
{
  const published = {
    optionsJson: [
      { id: 'size', labelAr: 'المقاس', values: [{ id: 'm', labelAr: 'M' }] },
      { id: 'color', labelAr: 'اللون', values: [{ id: 'black', labelAr: 'أسود' }] },
    ],
    variantsJson: [{ id: 'sku-m-black', selections: { size: 'm', color: 'black' }, priceHalalas: 9900, available: false }],
  };
  const hydrated = M.optionsStateFromServer(published);
  assert.equal(hydrated.variants[0].priceHalalas, 9900);
  assert.equal(hydrated.variants[0].available, false);
  hydrated._builtGroups = published.optionsJson;
  const again = M.structuredOptionsPayload(hydrated, apparel);
  assert.equal(again.error, null);
  assert.equal(again.variantsJson[0].priceHalalas, 9900);
  assert.equal(again.variantsJson[0].available, false);
}

// 7) Volume 50/100
{
  const volume = [{ id: 'volume', label: 'الحجم', kind: 'volume', presets: ['50 مل', '100 مل'] }];
  const state = { selected: { volume: ['50 مل', '100 مل'] }, customs: {}, variants: [], valueIds: {}, clearingOptions: false };
  const groups = M.buildOptionGroups(volume, state);
  assert.equal(groups[0].values.length, 2);
}

// 8) Duplicate rejected
{
  const state = baseState();
  assert.equal(M.isDuplicateVariant(state.variants, state.variants[0].selections), true);
}

console.log('catalog-options-rc5-tests passed');
