/**
 * FK-2 — Evaluation context + explicit clock (no wall-clock inside Claim Lock).
 */
export interface FashionKnowledgeClock {
  /** ISO-8601 instant provided by caller — required for trend validity. */
  readonly nowIso: string;
}

export interface FashionClaimLockContext {
  readonly clock: FashionKnowledgeClock;
  /** Evidence ids that resolve in the current evaluation scope. */
  readonly resolvedEvidenceIds: ReadonlySet<string>;
  /** Registered provenance source ids (curated registry — empty in FK-2 prod). */
  readonly registeredSourceIds: ReadonlySet<string>;
  /** Applicable ACTIVE rules (TEST_ONLY fixtures allowed in tests). */
  readonly applicableRuleIds: ReadonlySet<string>;
  /** Occasion tokens known for this evaluation. */
  readonly occasionTokens: ReadonlySet<string>;
  /** Preference tokens (e.g. bold, statement). */
  readonly preferenceTokens: ReadonlySet<string>;
  /** Cultural context tokens. */
  readonly culturalTokens: ReadonlySet<string>;
  /** Fact tokens for exception matching (colors, garment types, etc.). */
  readonly factTokens: ReadonlySet<string>;
  /** Whether dress-code detail is known when required. */
  readonly dressCodeKnown: boolean;
  /** Trace id for determinism / telemetry later. */
  readonly traceId: string;
  /**
   * Optional rule exception payloads keyed by rule id.
   * Used when candidate references knowledgeRuleIds.
   */
  readonly ruleExceptionsByRuleId?: ReadonlyMap<
    string,
    readonly { exceptionId: string; whenValues?: readonly string[]; blocksAdvice: boolean }[]
  >;
  /**
   * Rules that require occasion — if candidate advice needs them.
   */
  readonly rulesRequiringOccasion?: ReadonlySet<string>;
}

export function emptyLockContext(
  overrides: Partial<FashionClaimLockContext> & {
    clock: FashionKnowledgeClock;
    traceId: string;
  },
): FashionClaimLockContext {
  return {
    clock: overrides.clock,
    resolvedEvidenceIds: overrides.resolvedEvidenceIds ?? new Set(),
    registeredSourceIds: overrides.registeredSourceIds ?? new Set(),
    applicableRuleIds: overrides.applicableRuleIds ?? new Set(),
    occasionTokens: overrides.occasionTokens ?? new Set(),
    preferenceTokens: overrides.preferenceTokens ?? new Set(),
    culturalTokens: overrides.culturalTokens ?? new Set(),
    factTokens: overrides.factTokens ?? new Set(),
    dressCodeKnown: overrides.dressCodeKnown ?? false,
    traceId: overrides.traceId,
    ruleExceptionsByRuleId: overrides.ruleExceptionsByRuleId,
    rulesRequiringOccasion: overrides.rulesRequiringOccasion,
  };
}
