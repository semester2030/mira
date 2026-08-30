/**
 * FK-12 — G8 exception gate decision for Mode B (FK-11 residual).
 * G8 is NOT_APPLICABLE when candidate has no curated ruleIds (typical Mode B).
 * This is correct semantics, not a false "exception-safe" claim.
 */
export const FK12_G8_EXCEPTION_DECISION = Object.freeze({
  decision: 'A_CORRECT_NOT_APPLICABLE_MODE_B' as const,
  summary:
    'When knowledgeRuleIds is empty (Mode B LLM path), G8 cannot evaluate curated exceptions and returns pass as NOT_APPLICABLE. Mode B remains UNCURATED + qualified via G15/G5 — it does not claim curated exception clearance.',
  modeBLimitationCode: 'G8_NOT_APPLICABLE_NO_CURATED_RULE_REFS',
  doesNotMean: 'Mode B advice is exception-validated against Mira curated rules',
});
