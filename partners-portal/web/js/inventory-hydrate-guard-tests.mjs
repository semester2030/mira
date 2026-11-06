/**
 * T1 — hydrate/persist guards call MiraInventoryEditor (same module catalog-journey uses).
 * Sequence/product-switch rules are exercised against that shared API, not a copied createGuard().
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, 'inventory-editor-state.js'), 'utf8');
const sandbox = { console };
vm.runInNewContext(src, sandbox);
const M = sandbox.MiraInventoryEditor;
assert.ok(M && typeof M.applyInventoryHydrate === 'function');
assert.ok(typeof M.buildInventoryPersistPayload === 'function');

// 1) Failed GET → persist blocked; local qty preserved.
{
  const state = {
    inventoryLoadState: 'failed',
    inventoryMode: 'variant',
    variants: [{ id: 'v1', stockQty: 10, _inventoryRevision: 1, _inventoryRowExists: true }],
  };
  const p = M.buildInventoryPersistPayload(state);
  assert.equal(p.ok, false);
  assert.equal(p.code, 'INVENTORY_NOT_READY');
  assert.equal(state.variants[0].stockQty, 10);
}

// 2) Late GET after local edit 10→7: keep 7 and bind revision (D3).
{
  const state = {
    inventoryLoadState: 'loading',
    inventoryMode: 'variant',
    variants: [
      {
        id: 'v1',
        stockQty: 7,
        _stockDirty: true,
        _inventoryRevision: null,
        _inventoryRowExists: false,
      },
    ],
  };
  const r = M.applyInventoryHydrate(
    state,
    { inventoryMode: 'variant', rows: [{ variantId: 'v1', stockQty: 10, revision: 2, stockMode: 'tracked' }] },
    { preserveLocalQty: true },
  );
  assert.equal(r.ok, true);
  assert.equal(state.variants[0].stockQty, 7);
  assert.equal(state.variants[0]._inventoryRevision, 2);
  assert.equal(state.variants[0]._inventoryRowExists, true);
  state.inventoryLoadState = 'loaded';
  const p = M.buildInventoryPersistPayload(state);
  assert.equal(p.ok, true);
  assert.equal(p.body.rows[0].stockQty, 7);
  assert.equal(p.body.rows[0].expectedRevision, 2);
}

// 3) Dirty existing row without revision → blocked (does not invent expectedRevision).
{
  const state = {
    inventoryLoadState: 'loaded',
    inventoryMode: 'variant',
    variants: [
      {
        id: 'v1',
        stockQty: 7,
        _stockDirty: true,
        _inventoryRowExists: true,
        _inventoryRevision: null,
      },
    ],
  };
  const p = M.buildInventoryPersistPayload(state);
  assert.equal(p.ok, false);
  assert.equal(p.code, 'INVENTORY_REVISION_MISSING');
  assert.equal(state.variants[0].stockQty, 7);
}

// 4) Invalid qty must not silently become null / persist.
{
  const state = {
    inventoryLoadState: 'loaded',
    inventoryMode: 'variant',
    variants: [
      {
        id: 'v1',
        stockQty: 10,
        _stockInvalid: true,
        _stockRaw: '12x',
        _inventoryRevision: 1,
        _inventoryRowExists: true,
      },
    ],
  };
  const p = M.buildInventoryPersistPayload(state);
  assert.equal(p.ok, false);
  assert.equal(p.code, 'INVENTORY_INVALID_QTY');
  assert.equal(state.variants[0].stockQty, 10);
}

// 5) Empty hydrate body → not applied; prior qty kept.
{
  const state = {
    inventoryLoadState: 'loading',
    inventoryMode: 'variant',
    variants: [{ id: 'v1', stockQty: 10 }],
  };
  const r = M.applyInventoryHydrate(state, null);
  assert.equal(r.ok, false);
  assert.equal(state.variants[0].stockQty, 10);
}

console.log(JSON.stringify({ ok: true, id: 'P31_INVENTORY_HYDRATE_GUARD' }));
