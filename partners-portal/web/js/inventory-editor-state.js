/**
 * Shared inventory editor state helpers (browser + Node tests).
 * catalog-journey must use these — tests call the same functions (T1).
 */
(function (global) {
  'use strict';

  function applyInventoryHydrate(state, inv, opts) {
    const options = opts || {};
    const preserveLocalQty = !!options.preserveLocalQty;
    if (!inv) {
      return { ok: false, reason: 'empty' };
    }
    if ((inv.inventoryMode === 'variant' || inv.inventoryMode === 'product') && !state._inventoryModeDirty) {
      state.inventoryMode = inv.inventoryMode;
    }
    const byId = {};
    (inv.rows || []).forEach((r) => {
      if (r && r.variantId) byId[r.variantId] = r;
    });
    (state.variants || []).forEach((v) => {
      const row = byId[v.id];
      if (!row) {
        v._inventoryRowExists = false;
        if (!v.stockMode) v.stockMode = 'tracked';
        return;
      }
      v._inventoryRowExists = true;
      // D3: always bind revision even when preserving local qty.
      v._inventoryRevision = row.revision;
      if (preserveLocalQty && v._stockDirty) {
        if (!v._stockModeDirty) {
          v.stockMode = row.stockMode === 'untracked' ? 'untracked' : 'tracked';
        }
        return;
      }
      if (!v._stockModeDirty) {
        v.stockMode = row.stockMode === 'untracked' ? 'untracked' : 'tracked';
      }
      if (!(preserveLocalQty && v._stockDirty)) {
        v.stockQty = row.stockQty == null ? null : row.stockQty;
      }
    });
    return { ok: true };
  }

  function buildInventoryPersistPayload(state) {
    const mode = state.inventoryMode === 'variant' ? 'variant' : 'product';
    if (state.inventoryLoadState === 'failed' || state.inventoryLoadState === 'loading' || state.inventoryLoadState === 'idle') {
      return { ok: false, code: 'INVENTORY_NOT_READY' };
    }
    for (const v of state.variants || []) {
      if (v && v._stockInvalid) return { ok: false, code: 'INVENTORY_INVALID_QTY' };
      if (
        mode === 'variant' &&
        v &&
        v._inventoryRowExists &&
        (v._stockDirty || v._stockModeDirty) &&
        v._inventoryRevision == null
      ) {
        return { ok: false, code: 'INVENTORY_REVISION_MISSING' };
      }
    }
    if (mode !== 'variant') {
      return { ok: true, body: { inventoryMode: mode, rows: [] } };
    }
    const rows = (state.variants || []).map((v) => {
      const row = {
        variantId: v.id,
        variantKey: v.id,
        stockQty: Object.prototype.hasOwnProperty.call(v, 'stockQty') ? (v.stockQty == null ? null : v.stockQty) : null,
        expectedRevision: v._inventoryRevision != null ? v._inventoryRevision : null,
      };
      if (!v._inventoryRowExists) {
        row.stockMode = v.stockMode === 'untracked' ? 'untracked' : 'tracked';
      } else if (v._stockModeDirty) {
        row.stockMode = v.stockMode === 'untracked' ? 'untracked' : 'tracked';
      }
      return row;
    });
    return { ok: true, body: { inventoryMode: mode, rows: rows } };
  }

  global.MiraInventoryEditor = {
    applyInventoryHydrate: applyInventoryHydrate,
    buildInventoryPersistPayload: buildInventoryPersistPayload,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
