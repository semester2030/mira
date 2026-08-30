/**
 * FK-2 — Applicability + exception contracts.
 */
export interface RuleApplicability {
  readonly applicabilityId: string;
  readonly requiredOccasions?: readonly string[];
  readonly optionalOccasions?: readonly string[];
  readonly culturalRestrictions?: readonly string[];
  readonly userGoalRestrictions?: readonly string[];
  readonly minConfidence?: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNVERIFIED';
  readonly trendValidityRequired?: boolean;
  readonly notes?: string;
}

export interface RuleException {
  readonly exceptionId: string;
  readonly description: string;
  /** Condition fields that trigger the exception when matched. */
  readonly whenFields?: readonly string[];
  readonly whenValues?: readonly string[];
  readonly blocksAdvice: boolean;
  readonly notes?: string;
}

export interface TrendValidity {
  readonly validFrom: string;
  readonly validTo: string;
  readonly region?: string;
  readonly notes?: string;
}

/**
 * Check whether a known exception applies given context fact tokens.
 * Deterministic — same tokens → same result.
 */
export function matchingExceptions(
  exceptions: readonly RuleException[],
  contextTokens: ReadonlySet<string>,
): RuleException[] {
  return exceptions.filter((ex) => {
    if (!ex.whenValues || ex.whenValues.length === 0) return false;
    return ex.whenValues.some((v) => contextTokens.has(v.toLowerCase()));
  });
}
