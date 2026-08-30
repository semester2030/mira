/**
 * FK-3 — Caching decision (deferred).
 *
 * Identical deterministic fashion context *could* cache drafts keyed by:
 * model + prompt version + locale + context hash + knowledge policy version.
 *
 * Deferred because:
 * 1. Mode B LLM variance still requires Claim Lock on every candidate.
 * 2. Preference context must never share cache across users/goals.
 * 3. No production rule registry yet — premature optimization risk.
 * 4. FK-3 proves safety of generation path first.
 *
 * Decision: NO draft cache in FK-3.
 */
export const FK3_LLM_DRAFT_CACHING = Object.freeze({
  enabled: false,
  reason:
    'Deferred until FK-4+ registry stability and preference-isolated cache keys exist',
  requiredKeyParts: [
    'model',
    'promptVersion',
    'locale',
    'contextHash',
    'policyVersion',
    'preferenceHash',
  ] as const,
});
