/**
 * P2.2: general save must preserve variant.mediaIds (bind → persistListing path).
 * Run: node partners-portal/web/js/catalog-options-media-bind-tests.mjs
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

function hydrateWithMedia(mediaIds) {
  const published = {
    optionsJson: [
      { id: 'size', labelAr: 'المقاس', values: [{ id: 'M', labelAr: 'M' }] },
      { id: 'color', labelAr: 'اللون', values: [{ id: 'black', labelAr: 'أسود' }] },
    ],
    variantsJson: [
      {
        id: 'sku-m-black',
        selections: { size: 'M', color: 'black' },
        priceHalalas: 5500,
        available: true,
        mediaIds: mediaIds,
      },
    ],
  };
  const state = M.optionsStateFromServer(published);
  state._builtGroups = published.optionsJson;
  return { published, state };
}

// 1) Hydrate keeps mediaIds
{
  const { state } = hydrateWithMedia(['media-a', 'media-b']);
  assert.deepEqual(state.variants[0].mediaIds, ['media-a', 'media-b']);
}

// 2) structuredOptionsPayload must round-trip mediaIds (the general-save bug)
{
  const { state } = hydrateWithMedia(['media-a']);
  const again = M.structuredOptionsPayload(state, apparel);
  assert.equal(again.error, null);
  assert.ok(again.variantsJson && again.variantsJson[0], 'variantsJson present');
  assert.deepEqual(
    again.variantsJson[0].mediaIds,
    ['media-a'],
    'general save must keep mediaIds — was dropped before fix',
  );
}

// 3) Explicit empty mediaIds is a deliberate clear, not "omit"
{
  const { state } = hydrateWithMedia(['media-a']);
  state.variants[0].mediaIds = [];
  const cleared = M.structuredOptionsPayload(state, apparel);
  assert.deepEqual(cleared.variantsJson[0].mediaIds, []);
}

// 4) Two variants keep independent bindings
{
  const published = {
    optionsJson: [
      { id: 'size', labelAr: 'المقاس', values: [{ id: 'M', labelAr: 'M' }, { id: 'L', labelAr: 'L' }] },
      { id: 'color', labelAr: 'اللون', values: [{ id: 'black', labelAr: 'أسود' }] },
    ],
    variantsJson: [
      { id: 'm-black', selections: { size: 'M', color: 'black' }, available: true, mediaIds: ['img-1'] },
      { id: 'l-black', selections: { size: 'L', color: 'black' }, available: true, mediaIds: ['img-2'] },
    ],
  };
  const state = M.optionsStateFromServer(published);
  state._builtGroups = published.optionsJson;
  // Simulate bind update on one variant only
  state.variants[0].mediaIds = ['img-1', 'img-3'];
  const payload = M.structuredOptionsPayload(state, apparel);
  assert.deepEqual(payload.variantsJson.find((v) => v.id === 'm-black').mediaIds, ['img-1', 'img-3']);
  assert.deepEqual(payload.variantsJson.find((v) => v.id === 'l-black').mediaIds, ['img-2']);
}

// 5) Draft hydration path
{
  const draft = {
    draftOptionsSet: true,
    draftOptionsJson: [
      { id: 'size', labelAr: 'المقاس', values: [{ id: 'M', labelAr: 'M' }] },
    ],
    draftVariantsSet: true,
    draftVariantsJson: [
      { id: 'm-only', selections: { size: 'M' }, available: true, mediaIds: ['draft-media'] },
    ],
  };
  const state = M.optionsStateFromServer(draft);
  state._builtGroups = draft.draftOptionsJson;
  const payload = M.structuredOptionsPayload(state, apparel);
  assert.deepEqual(payload.variantsJson[0].mediaIds, ['draft-media']);
}

// 6) Delete strip: general save must not resurrect removed media id
{
  const { state } = hydrateWithMedia(['keep-me', 'delete-me']);
  M.stripMediaIdsFromOptionsState(state, ['delete-me']);
  assert.deepEqual(state.variants[0].mediaIds, ['keep-me']);
  const payload = M.structuredOptionsPayload(state, apparel);
  assert.deepEqual(payload.variantsJson[0].mediaIds, ['keep-me']);
}

// 7) Stale preview omitIds win over server row that still lists deleted id
{
  const { state } = hydrateWithMedia(['keep-me']);
  state.variants[0].mediaIds = ['keep-me', 'stale-deleted'];
  M.syncVariantMediaIdsFromServer(
    state,
    [{ id: 'sku-m-black', mediaIds: ['keep-me', 'stale-deleted'] }],
    new Set(['stale-deleted']),
  );
  assert.deepEqual(state.variants[0].mediaIds, ['keep-me']);
  // selections/price untouched
  assert.equal(state.variants[0].priceHalalas, 5500);
}

// 8) Two variants: strip one id from both when shared
{
  const published = {
    optionsJson: [
      { id: 'size', labelAr: 'المقاس', values: [{ id: 'M', labelAr: 'M' }, { id: 'L', labelAr: 'L' }] },
    ],
    variantsJson: [
      { id: 'm', selections: { size: 'M' }, available: true, mediaIds: ['shared', 'only-m'] },
      { id: 'l', selections: { size: 'L' }, available: true, mediaIds: ['shared', 'only-l'] },
    ],
  };
  const state = M.optionsStateFromServer(published);
  state._builtGroups = published.optionsJson;
  M.stripMediaIdsFromOptionsState(state, ['shared']);
  const payload = M.structuredOptionsPayload(state, apparel);
  assert.deepEqual(payload.variantsJson.find((v) => v.id === 'm').mediaIds, ['only-m']);
  assert.deepEqual(payload.variantsJson.find((v) => v.id === 'l').mediaIds, ['only-l']);
}

console.log('catalog-options-media-bind-tests passed');
