/**
 * T1 — tests call MiraInventoryEditor (same module catalog-journey uses).
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

// Failed load → persist blocked (does not wipe).
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

// Late GET after local edit to 7: preserve 7 AND bind revision (D3).
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
    { inventoryMode: 'variant', rows: [{ variantId: 'v1', stockQty: 10, revision: 3, stockMode: 'tracked' }] },
    { preserveLocalQty: true },
  );
  assert.equal(r.ok, true);
  assert.equal(state.variants[0].stockQty, 7);
  assert.equal(state.variants[0]._inventoryRevision, 3);
  assert.equal(state.variants[0]._inventoryRowExists, true);
  state.inventoryLoadState = 'loaded';
  const p = M.buildInventoryPersistPayload(state);
  assert.equal(p.ok, true);
  assert.equal(p.body.rows[0].stockQty, 7);
  assert.equal(p.body.rows[0].expectedRevision, 3);
  assert.equal(Object.prototype.hasOwnProperty.call(p.body.rows[0], 'stockMode'), false);
}

// Dirty without revision → blocked.
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
}

// D2: untracked row — omit stockMode on clean persist.
{
  const state = {
    inventoryLoadState: 'loaded',
    inventoryMode: 'variant',
    variants: [
      {
        id: 'v1',
        stockQty: null,
        stockMode: 'untracked',
        _inventoryRevision: 2,
        _inventoryRowExists: true,
        _stockDirty: false,
      },
    ],
  };
  const p = M.buildInventoryPersistPayload(state);
  assert.equal(p.ok, true);
  assert.equal(Object.prototype.hasOwnProperty.call(p.body.rows[0], 'stockMode'), false);
  assert.equal(p.body.rows[0].expectedRevision, 2);
}

// Hydrate loads untracked.
{
  const state = {
    inventoryMode: 'product',
    variants: [{ id: 'v1', stockQty: null }],
  };
  M.applyInventoryHydrate(state, {
    inventoryMode: 'variant',
    rows: [{ variantId: 'v1', stockQty: null, revision: 1, stockMode: 'untracked' }],
  });
  assert.equal(state.inventoryMode, 'variant');
  assert.equal(state.variants[0].stockMode, 'untracked');
  assert.equal(state.variants[0]._inventoryRevision, 1);
}

console.log(JSON.stringify({ ok: true, id: 'P31_INVENTORY_EDITOR_STATE' }));
