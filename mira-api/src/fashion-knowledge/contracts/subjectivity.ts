/**
 * FK-2 — Subjectivity contract + policy.
 */
export const SubjectivityLevel = {
  LOW_SUBJECTIVITY: 'LOW_SUBJECTIVITY',
  MEDIUM_SUBJECTIVITY: 'MEDIUM_SUBJECTIVITY',
  HIGH_SUBJECTIVITY: 'HIGH_SUBJECTIVITY',
  TREND_DEPENDENT: 'TREND_DEPENDENT',
  USER_DEPENDENT: 'USER_DEPENDENT',
} as const;

export type SubjectivityLevel =
  (typeof SubjectivityLevel)[keyof typeof SubjectivityLevel];

export const ALL_SUBJECTIVITY_LEVELS: readonly SubjectivityLevel[] =
  Object.freeze(Object.values(SubjectivityLevel));

export type AllowedClaimStrength =
  | 'FACTUAL_RELATIONSHIP'
  | 'ESTABLISHED_GUIDANCE'
  | 'CONVENTIONAL_GUIDANCE'
  | 'QUALIFIED_SUGGESTION'
  | 'PREFERENCE_DEPENDENT_OPTION'
  | 'UNAVAILABLE';

export interface SubjectivityPolicy {
  readonly level: SubjectivityLevel;
  readonly allowedClaimStrength: AllowedClaimStrength;
  readonly requiresQualification: boolean;
  readonly preferAlternatives: boolean;
  readonly userPreferenceMayOverride: boolean;
  readonly absoluteWordingForbidden: boolean;
}

export const SUBJECTIVITY_POLICIES: Readonly<
  Record<SubjectivityLevel, SubjectivityPolicy>
> = Object.freeze({
  LOW_SUBJECTIVITY: {
    level: SubjectivityLevel.LOW_SUBJECTIVITY,
    allowedClaimStrength: 'FACTUAL_RELATIONSHIP',
    requiresQualification: false,
    preferAlternatives: false,
    userPreferenceMayOverride: false,
    absoluteWordingForbidden: false,
  },
  MEDIUM_SUBJECTIVITY: {
    level: SubjectivityLevel.MEDIUM_SUBJECTIVITY,
    allowedClaimStrength: 'CONVENTIONAL_GUIDANCE',
    requiresQualification: true,
    preferAlternatives: true,
    userPreferenceMayOverride: true,
    absoluteWordingForbidden: true,
  },
  HIGH_SUBJECTIVITY: {
    level: SubjectivityLevel.HIGH_SUBJECTIVITY,
    allowedClaimStrength: 'QUALIFIED_SUGGESTION',
    requiresQualification: true,
    preferAlternatives: true,
    userPreferenceMayOverride: true,
    absoluteWordingForbidden: true,
  },
  TREND_DEPENDENT: {
    level: SubjectivityLevel.TREND_DEPENDENT,
    allowedClaimStrength: 'QUALIFIED_SUGGESTION',
    requiresQualification: true,
    preferAlternatives: true,
    userPreferenceMayOverride: true,
    absoluteWordingForbidden: true,
  },
  USER_DEPENDENT: {
    level: SubjectivityLevel.USER_DEPENDENT,
    allowedClaimStrength: 'PREFERENCE_DEPENDENT_OPTION',
    requiresQualification: true,
    preferAlternatives: true,
    userPreferenceMayOverride: true,
    absoluteWordingForbidden: true,
  },
});

export function subjectivityPolicy(
  level: SubjectivityLevel,
): SubjectivityPolicy {
  return SUBJECTIVITY_POLICIES[level];
}

export function isSubjectivityLevel(
  value: unknown,
): value is SubjectivityLevel {
  return (
    typeof value === 'string' &&
    (ALL_SUBJECTIVITY_LEVELS as readonly string[]).includes(value)
  );
}

/**
 * HIGH_SUBJECTIVITY must never receive ESTABLISHED_GUIDANCE.
 * Cap claim strength to subjectivity ceiling.
 */
export function capClaimStrengthBySubjectivity(
  requested: AllowedClaimStrength,
  level: SubjectivityLevel,
): AllowedClaimStrength {
  const ceiling = SUBJECTIVITY_POLICIES[level].allowedClaimStrength;
  const order: AllowedClaimStrength[] = [
    'UNAVAILABLE',
    'PREFERENCE_DEPENDENT_OPTION',
    'QUALIFIED_SUGGESTION',
    'CONVENTIONAL_GUIDANCE',
    'ESTABLISHED_GUIDANCE',
    'FACTUAL_RELATIONSHIP',
  ];
  const reqIdx = order.indexOf(requested);
  const ceilIdx = order.indexOf(ceiling);
  if (reqIdx < 0 || ceilIdx < 0) return 'QUALIFIED_SUGGESTION';
  return order[Math.min(reqIdx, ceilIdx)]!;
}
