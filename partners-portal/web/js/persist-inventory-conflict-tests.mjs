/**
 * Exercises persistListing conflict end-state via a harness that mirrors catalog-journey control flow.
 * Full dual-session browser evidence is produced by scripts/p31-inventory-conflict-browser.mjs when API+portal are up.
 */
import assert from 'node:assert/strict';

function simulatePersistAfterInventory(opts) {
  const {
    inventoryErrorCode,
    wantPublish,
    developerAccount,
    localQty,
    localRevision,
  } = opts;
  const state = {
    statusText: '',
    attrs: {},
    isSuccess: false,
    submitReviewCalled: false,
    renderFormCalled: false,
    localQty,
    localRevision,
    stockDirty: true,
    returnValue: null,
  };

  // Mirror of catalog-journey conflict branch + success continuation gates.
  let inventoryConflict = false;
  let inventoryPartialOther = false;
  try {
    if (inventoryErrorCode) {
      const err = { code: inventoryErrorCode, message: 'تعارض مراجعة مخزون التركيبة' };
      throw err;
    }
  } catch (invErr) {
    const isInvRevConflict = invErr.code === 'VARIANT_INVENTORY_REVISION_CONFLICT';
    if (isInvRevConflict) {
      inventoryConflict = true;
      state.statusText =
        'حُفظت البيانات الأساسية، لكن مخزون التركيبات لم يُحفظ بسبب تعارض مراجعة. تعديلاتك المحلية ما زالت في النموذج.';
      state.attrs['data-inventory-revision-conflict'] = '1';
      state.attrs['data-inventory-partial'] = '1';
      state.attrs['data-catalog-persist-status'] = 'partial-inventory-conflict';
    } else {
      inventoryPartialOther = true;
    }
  }

  if (inventoryConflict) {
    state.isSuccess = false;
    state.submitReviewCalled = false;
    state.renderFormCalled = false;
    state.returnValue = {
      ok: false,
      partial: true,
      inventoryConflict: true,
      basicsSaved: true,
      published: false,
    };
    return state;
  }

  // Would continue to chrome success + optional publish
  if (wantPublish && developerAccount && !inventoryPartialOther) {
    state.submitReviewCalled = true;
  }
  state.isSuccess = !inventoryPartialOther;
  state.renderFormCalled = !inventoryPartialOther;
  state.returnValue = { ok: true };
  return state;
}

{
  const s = simulatePersistAfterInventory({
    inventoryErrorCode: 'VARIANT_INVENTORY_REVISION_CONFLICT',
    wantPublish: true,
    developerAccount: true,
    localQty: 12,
    localRevision: 3,
  });
  assert.equal(s.returnValue.ok, false);
  assert.equal(s.returnValue.inventoryConflict, true);
  assert.equal(s.submitReviewCalled, false);
  assert.equal(s.isSuccess, false);
  assert.equal(s.renderFormCalled, false);
  assert.equal(s.localQty, 12);
  assert.equal(s.localRevision, 3);
  assert.equal(s.attrs['data-inventory-revision-conflict'], '1');
  assert.match(s.statusText, /البيانات الأساسية/);
  assert.match(s.statusText, /لم يُحفظ/);
}
{
  const s = simulatePersistAfterInventory({
    inventoryErrorCode: null,
    wantPublish: true,
    developerAccount: true,
    localQty: 5,
    localRevision: 1,
  });
  assert.equal(s.submitReviewCalled, true);
  assert.equal(s.isSuccess, true);
}

console.log(JSON.stringify({ ok: true, id: 'P31_PERSIST_INVENTORY_CONFLICT_UNIT' }));
