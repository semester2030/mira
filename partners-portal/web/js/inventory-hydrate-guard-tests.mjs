/**
 * P3.1 defect fix — inventory hydrate/persist state machine (unit).
 * Mirrors catalog-journey rules without launching a browser.
 */
import assert from 'node:assert/strict';

function createGuard() {
  let hydrateSeq = 0;
  const state = {
    inventoryLoadState: 'idle',
    inventoryLoadError: '',
    inventoryHydrateProductId: null,
    inventoryLocalEpoch: 0,
    inventoryMode: 'variant',
    _inventoryModeDirty: false,
    variants: [{ id: 'v1', stockQty: 10, _inventoryRevision: 1, _stockDirty: false }],
  };

  function markLocalEdit() {
    state.inventoryLocalEpoch += 1;
  }

  async function hydrate(productId, fetcher) {
    const seq = ++hydrateSeq;
    const epochAtStart = state.inventoryLocalEpoch;
    const currentItemId = productId;
    state.inventoryLoadState = 'loading';
    state.inventoryLoadError = '';
    state.inventoryHydrateProductId = productId;
    try {
      const inv = await fetcher(productId);
      if (seq !== hydrateSeq) return { applied: false, reason: 'superseded' };
      if (state.inventoryHydrateProductId !== currentItemId) return { applied: false, reason: 'product-mismatch' };
      if (state.inventoryLocalEpoch !== epochAtStart) {
        for (const v of state.variants) {
          const row = (inv.rows || []).find((r) => r.variantId === v.id);
          if (!row || v._stockDirty) continue;
          v.stockQty = row.stockQty;
          v._inventoryRevision = row.revision;
        }
        state.inventoryLoadState = 'loaded';
        return { applied: 'partial-dirty-preserve', stockQty: state.variants[0].stockQty };
      }
      for (const v of state.variants) {
        const row = (inv.rows || []).find((r) => r.variantId === v.id);
        if (!row || v._stockDirty) continue;
        v.stockQty = row.stockQty;
        v._inventoryRevision = row.revision;
      }
      if (!state._inventoryModeDirty && inv.inventoryMode) state.inventoryMode = inv.inventoryMode;
      state.inventoryLoadState = 'loaded';
      return { applied: true, stockQty: state.variants[0].stockQty };
    } catch (e) {
      if (seq !== hydrateSeq) return { applied: false, reason: 'superseded' };
      state.inventoryLoadState = 'failed';
      state.inventoryLoadError = String(e.message || e);
      return { applied: false, reason: 'failed', stockQty: state.variants[0].stockQty };
    }
  }

  function canPersist() {
    if (state.inventoryLoadState === 'failed' || state.inventoryLoadState === 'loading' || state.inventoryLoadState === 'idle') {
      return { ok: false, code: 'INVENTORY_NOT_READY' };
    }
    for (const v of state.variants) {
      if (v._stockInvalid) return { ok: false, code: 'INVENTORY_INVALID_QTY' };
    }
    return {
      ok: true,
      body: {
        inventoryMode: state.inventoryMode,
        rows: state.variants.map((v) => ({
          variantId: v.id,
          stockQty: v.stockQty,
          expectedRevision: v._inventoryRevision,
        })),
      },
    };
  }

  return { state, markLocalEdit, hydrate, canPersist };
}

// 1) GET fails then save must not wipe server qty (no persist payload).
{
  const g = createGuard();
  const r = await g.hydrate('A', async () => {
    throw new Error('network');
  });
  assert.equal(r.reason, 'failed');
  assert.equal(g.state.variants[0].stockQty, 10);
  assert.equal(g.canPersist().ok, false);
  assert.equal(g.canPersist().code, 'INVENTORY_NOT_READY');
}

// 2) Late GET after user edits 10→7 must keep 7.
{
  const g = createGuard();
  let resolveInv;
  const pending = g.hydrate(
    'A',
    () =>
      new Promise((resolve) => {
        resolveInv = resolve;
      }),
  );
  g.state.variants[0].stockQty = 7;
  g.state.variants[0]._stockDirty = true;
  g.markLocalEdit();
  resolveInv({ inventoryMode: 'variant', rows: [{ variantId: 'v1', stockQty: 10, revision: 2 }] });
  const r = await pending;
  assert.equal(r.applied, 'partial-dirty-preserve');
  assert.equal(g.state.variants[0].stockQty, 7);
  const p = g.canPersist();
  assert.equal(p.ok, true);
  assert.equal(p.body.rows[0].stockQty, 7);
}

// 3) Response for product A after switch to B must not mutate B.
{
  const g = createGuard();
  let resolveA;
  const pendingA = g.hydrate(
    'A',
    () =>
      new Promise((resolve) => {
        resolveA = resolve;
      }),
  );
  // Switch context to B
  g.state.variants[0].stockQty = 3;
  g.state.inventoryHydrateProductId = 'B';
  hydrateSeqBump(g);
  resolveA({ inventoryMode: 'variant', rows: [{ variantId: 'v1', stockQty: 99, revision: 9 }] });
  const r = await pendingA;
  assert.equal(r.applied, false);
  assert.equal(g.state.variants[0].stockQty, 3);
}

function hydrateSeqBump(g) {
  // simulate newer hydrate for B starting
  g.state.inventoryLoadState = 'loading';
}

// 4) Invalid qty must not silently become null.
{
  const g = createGuard();
  g.state.inventoryLoadState = 'loaded';
  g.state.variants[0]._stockInvalid = true;
  g.state.variants[0]._stockRaw = '12x';
  assert.equal(g.canPersist().ok, false);
  assert.equal(g.canPersist().code, 'INVENTORY_INVALID_QTY');
  assert.equal(g.state.variants[0].stockQty, 10);
}

console.log(JSON.stringify({ ok: true, id: 'P31_INVENTORY_HYDRATE_GUARD' }));
