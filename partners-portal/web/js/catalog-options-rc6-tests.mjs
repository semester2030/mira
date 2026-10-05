/**
 * RC6-01: category change must not silently null options (with or without SKUs).
 * Exercises structuredOptionsPayload / buildCommercePayload used by readCommerce/save.
 * Run: node partners-portal/web/js/catalog-options-rc6-tests.mjs
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

const care = [{ id: 'volume', label: 'الحجم', kind: 'volume', presets: ['50 مل', '100 مل'] }];
const apparel = [
  { id: 'size', label: 'المقاس', kind: 'size', presets: ['M', 'L', 'XL'] },
  { id: 'color', label: 'اللون', kind: 'color', presets: ['أسود', 'أبيض'] },
];

function careState() {
  const state = {
    selected: { volume: ['50 مل', '100 مل'] },
    customs: {},
    traits: {},
    variants: [],
    valueIds: {},
    clearingOptions: false,
  };
  state._builtGroups = M.buildOptionGroups(care, state);
  return state;
}

// 1) Category change with options but NO variants → conflict, not null
{
  const state = careState();
  // Simulate clothes preset after category change (volume not in apparel).
  state._builtGroups = M.buildOptionGroups(apparel, state);
  const payload = M.structuredOptionsPayload(state, apparel);
  assert.ok(payload.conflicts.some((c) => c.kind === 'category_incompatible'));
  assert.ok(payload.error);
  assert.notEqual(payload.optionsJson, null);
  assert.ok(payload.optionsJson.some((g) => g.id === 'volume'));
  const commerce = M.buildCommercePayload(state, state._builtGroups, apparel);
  assert.ok(commerce.error);
  assert.notEqual(commerce.optionsJson, null);
}

// 2) Category change WITH variants → still conflicts (RC5 + RC6)
{
  const state = careState();
  const vol = state._builtGroups[0].values[0];
  state.variants.push({
    id: 'sku-50',
    selections: { volume: vol.id },
    labels: { volume: '50 مل' },
    priceHalalas: 5200,
    available: true,
  });
  state._builtGroups = M.buildOptionGroups(apparel, state);
  const payload = M.structuredOptionsPayload(state, apparel);
  assert.ok(payload.conflicts.some((c) => c.kind === 'category_incompatible'));
  assert.equal(payload.variantsJson.length, 0);
}

// 3) New product: set options then change category before save
{
  const state = {
    selected: { size: ['M', 'L'], color: ['أسود'] },
    customs: {},
    variants: [],
    valueIds: {},
    clearingOptions: false,
  };
  state._builtGroups = M.buildOptionGroups(apparel, state);
  // Switch to care category presets
  state._builtGroups = M.buildOptionGroups(care, state);
  const payload = M.structuredOptionsPayload(state, care);
  assert.ok(payload.conflicts.some((c) => c.kind === 'category_incompatible'));
  assert.ok(payload.optionsJson.some((g) => g.id === 'size' || g.id === 'color'));
}

// 4) Revert category: apparel again → no conflict, options preserved
{
  const state = {
    selected: { size: ['M', 'L'], color: ['أسود'] },
    customs: {},
    variants: [],
    valueIds: {},
    clearingOptions: false,
  };
  state._builtGroups = M.buildOptionGroups(care, state);
  assert.ok(M.incompatibleGroupIds(state, care).length);
  state._builtGroups = M.buildOptionGroups(apparel, state);
  const payload = M.structuredOptionsPayload(state, apparel);
  assert.equal(payload.conflicts.filter((c) => c.kind === 'category_incompatible').length, 0);
  assert.equal(payload.error, null);
  assert.equal(payload.optionsJson.length, 2);
}

// 5) Name/price-only: same category, options unchanged
{
  const state = careState();
  const again = M.structuredOptionsPayload(state, care);
  assert.equal(again.error, null);
  assert.equal(again.optionsJson.length, 1);
  assert.deepEqual(
    again.optionsJson[0].values.map((v) => v.labelAr).sort(),
    ['100 مل', '50 مل'],
  );
}

// 6) Explicit clear still works
{
  const state = careState();
  state.clearingOptions = true;
  const payload = M.structuredOptionsPayload(state, apparel);
  assert.equal(payload.optionsJson, null);
  assert.equal(payload.clearing, true);
}

// 7) RC5: delete last value of group used by variant still conflicts
{
  const state = {
    selected: { size: ['M'], color: ['أسود'] },
    customs: {},
    variants: [],
    valueIds: {},
    clearingOptions: false,
  };
  const groups = M.buildOptionGroups(apparel, state);
  const m = groups[0].values[0];
  const black = groups[1].values[0];
  state.variants.push({
    id: 'sku-m-black',
    selections: { size: m.id, color: black.id },
    labels: { size: 'M', color: 'أسود' },
    priceHalalas: 9900,
    available: true,
  });
  state.selected.color = [];
  state._builtGroups = M.buildOptionGroups(apparel, state);
  const payload = M.structuredOptionsPayload(state, apparel);
  assert.ok(payload.conflicts.some((c) => c.kind === 'group_removed'));
}

// 8) Hydrate → category switch → must not buildCommercePayload null
{
  const published = {
    optionsJson: [
      {
        id: 'volume',
        labelAr: 'الحجم',
        kind: 'volume',
        values: [
          { id: '50-ml', labelAr: '50 مل' },
          { id: '100-ml', labelAr: '100 مل' },
        ],
      },
    ],
    variantsJson: [],
  };
  const hydrated = M.optionsStateFromServer(published);
  hydrated._builtGroups = M.buildOptionGroups(apparel, hydrated);
  const commerce = M.buildCommercePayload(hydrated, hydrated._builtGroups, apparel);
  assert.ok(commerce.error, 'save path must block');
  assert.notEqual(commerce.optionsJson, null);
}

console.log('catalog-options-rc6-tests passed');
