/**
 * FK-2 — Preference + cultural conflict representation + rule relation model.
 */
export const ConflictState = {
  NO_CONFLICT: 'NO_CONFLICT',
  POSSIBLE_CONFLICT: 'POSSIBLE_CONFLICT',
  DIRECT_CONFLICT: 'DIRECT_CONFLICT',
  UNKNOWN: 'UNKNOWN',
} as const;

export type ConflictState = (typeof ConflictState)[keyof typeof ConflictState];

export const ALL_CONFLICT_STATES: readonly ConflictState[] = Object.freeze(
  Object.values(ConflictState),
);

export function isConflictState(value: unknown): value is ConflictState {
  return (
    typeof value === 'string' &&
    (ALL_CONFLICT_STATES as readonly string[]).includes(value)
  );
}

export const RuleRelationType = {
  SUPPORTS: 'SUPPORTS',
  CONFLICTS: 'CONFLICTS',
  SUPERSEDES: 'SUPERSEDES',
  SPECIALIZES: 'SPECIALIZES',
  EXCEPTION_TO: 'EXCEPTION_TO',
} as const;

export type RuleRelationType =
  (typeof RuleRelationType)[keyof typeof RuleRelationType];

export interface FashionRuleRelation {
  readonly relationId: string;
  readonly fromRuleId: string;
  readonly toRuleId: string;
  readonly type: RuleRelationType;
  readonly notes?: string;
}

export interface PreferenceConflictRecord {
  readonly state: ConflictState;
  readonly preferenceTokens: readonly string[];
  readonly conflictingGuidance?: string;
  readonly notes?: string;
}

export interface CulturalConflictRecord {
  readonly state: ConflictState;
  readonly culturalContextTokens: readonly string[];
  readonly conflictingGuidance?: string;
  readonly notes?: string;
}

/**
 * Deterministic preference conflict detection from token overlap heuristics.
 * Convention "reduce contrast" vs preference "bold/statement" → POSSIBLE_CONFLICT.
 */
export function evaluatePreferenceConflict(input: {
  readonly guidanceTokens: readonly string[];
  readonly preferenceTokens: readonly string[];
}): PreferenceConflictRecord {
  const prefs = new Set(
    input.preferenceTokens.map((t) => t.toLowerCase().trim()).filter(Boolean),
  );
  const guides = new Set(
    input.guidanceTokens.map((t) => t.toLowerCase().trim()).filter(Boolean),
  );
  if (prefs.size === 0) {
    return {
      state: ConflictState.UNKNOWN,
      preferenceTokens: input.preferenceTokens,
      notes: 'No preference tokens provided',
    };
  }
  const boldish = ['bold', 'statement', 'dramatic', 'high_contrast', 'جريء'];
  const calmish = [
    'reduce_contrast',
    'calm',
    'restrained',
    'neutral',
    'elegant_restraint',
    'تهدئة',
  ];
  const prefBold = boldish.some((t) => prefs.has(t));
  const guideCalm = calmish.some((t) => guides.has(t));
  const prefCalm = calmish.some((t) => prefs.has(t));
  const guideBold = boldish.some((t) => guides.has(t));

  if ((prefBold && guideCalm) || (prefCalm && guideBold)) {
    return {
      state: ConflictState.POSSIBLE_CONFLICT,
      preferenceTokens: input.preferenceTokens,
      conflictingGuidance: [...guides].join(','),
      notes: 'Preference direction differs from guidance direction',
    };
  }
  return {
    state: ConflictState.NO_CONFLICT,
    preferenceTokens: input.preferenceTokens,
  };
}
