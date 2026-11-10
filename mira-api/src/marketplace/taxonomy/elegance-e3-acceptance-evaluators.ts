/** Pure E3 open-screen / filter transition checks. No HTTP and no UI mutation. */

export type OpenScreenRefreshEvidence = {
  ok?: boolean;
  definitionsVersionAtOpen?: string | number | null;
  definitionsVersionAfterRefresh?: string | number | null;
  screenSawUpdatedProduct?: boolean;
  refreshWhileOpenVerified?: boolean;
  filterUiTransitionVerified?: boolean;
  debugRefreshUsed?: boolean;
  searchFallbackUsed?: boolean;
  replaceForTestUsed?: boolean;
  cacheCleared?: boolean;
  appRelaunched?: boolean;
  knownOutOfScopeExceptions?: string[];
  unexpectedError?: string | null;
  nameArAfter?: string | null;
  oldNameAcceptedAlone?: boolean;
  cancelledFilterStillSelected?: boolean;
};

export function evaluateOpenScreenRefreshResult(
  r: OpenScreenRefreshEvidence,
): { ok: boolean; reason?: string } {
  if (r.ok !== true) return { ok: false, reason: 'journey marked not ok' };
  if (r.debugRefreshUsed === true) return { ok: false, reason: 'debug refresh used' };
  if (r.searchFallbackUsed === true) return { ok: false, reason: 'search fallback used' };
  if (r.replaceForTestUsed === true) return { ok: false, reason: 'replaceForTest used' };
  if (r.cacheCleared === true) return { ok: false, reason: 'cache cleared mid journey' };
  if (r.appRelaunched === true) return { ok: false, reason: 'app relaunched' };
  if (r.oldNameAcceptedAlone === true) {
    return { ok: false, reason: 'old product name accepted without updated name' };
  }
  if (r.cancelledFilterStillSelected === true) {
    return { ok: false, reason: 'cancelled subcategory filter still selected' };
  }
  if (r.unexpectedError) {
    return { ok: false, reason: `unexpected error: ${r.unexpectedError}` };
  }
  const open = String(r.definitionsVersionAtOpen ?? '');
  const after = String(r.definitionsVersionAfterRefresh ?? '');
  if (!open || !after || open === after) {
    return { ok: false, reason: 'definitions version did not transition while open' };
  }
  if (r.refreshWhileOpenVerified !== true) {
    return { ok: false, reason: 'refresh while open not verified' };
  }
  if (r.screenSawUpdatedProduct !== true) {
    return { ok: false, reason: 'updated product name not shown' };
  }
  if (r.filterUiTransitionVerified !== true) {
    return { ok: false, reason: 'filter UI transition not verified' };
  }
  if (!r.nameArAfter) {
    return { ok: false, reason: 'updated product name missing from evidence' };
  }
  return { ok: true };
}
