/**
 * FK-8 — Cultural context models (context ≠ identity).
 */
export const CulturalContextSourceType = {
  EXPLICIT_USER_SELECTION: 'EXPLICIT_USER_SELECTION',
  EVENT_CONFIGURATION: 'EVENT_CONFIGURATION',
  VENUE_EVENT_METADATA: 'VENUE_EVENT_METADATA',
  STORED_PREFERENCE: 'STORED_PREFERENCE',
  APP_LOCALE_WEAK: 'APP_LOCALE_WEAK',
  CURATED_RULE_APPLICABILITY: 'CURATED_RULE_APPLICABILITY',
  UNKNOWN: 'UNKNOWN',
} as const;

export type CulturalContextSourceType =
  (typeof CulturalContextSourceType)[keyof typeof CulturalContextSourceType];

export const CulturalContextConfidence = {
  EXPLICIT: 'EXPLICIT',
  SUPPORTED: 'SUPPORTED',
  WEAK: 'WEAK',
  UNKNOWN: 'UNKNOWN',
} as const;

export type CulturalContextConfidence =
  (typeof CulturalContextConfidence)[keyof typeof CulturalContextConfidence];

export const RegionScope = {
  GLOBAL: 'GLOBAL',
  COUNTRY: 'COUNTRY',
  REGION: 'REGION',
  CITY: 'CITY',
  EVENT_SPECIFIC: 'EVENT_SPECIFIC',
  UNKNOWN: 'UNKNOWN',
} as const;

export type RegionScope = (typeof RegionScope)[keyof typeof RegionScope];

export const CulturalContextType = {
  SOCIAL: 'SOCIAL',
  EVENT: 'EVENT',
  FORMALITY: 'FORMALITY',
  MODESTY: 'MODESTY',
  TRADITIONAL: 'TRADITIONAL',
  REGIONAL_EVENT: 'REGIONAL_EVENT',
  UNKNOWN: 'UNKNOWN',
} as const;

export type CulturalContextType =
  (typeof CulturalContextType)[keyof typeof CulturalContextType];

/** User-declared only — never inferred from culture/locale/outfit. */
export const ModestyPreference = {
  MODEST: 'modest',
  HIGHLY_MODEST: 'highly_modest',
  NEUTRAL: 'neutral',
  UNRESTRICTED: 'unrestricted',
  UNKNOWN: 'unknown',
} as const;

export type ModestyPreference =
  (typeof ModestyPreference)[keyof typeof ModestyPreference];

export const TraditionalElementLabel = {
  TRADITIONAL: 'TRADITIONAL',
  CONTEMPORARY: 'CONTEMPORARY',
  FUSION: 'FUSION',
  UNKNOWN: 'UNKNOWN',
} as const;

export type TraditionalElementLabel =
  (typeof TraditionalElementLabel)[keyof typeof TraditionalElementLabel];

export const CulturalConstraintStrength = {
  HARD_EVENT_DRESS_REQUIREMENT: 'HARD_EVENT_DRESS_REQUIREMENT',
  SOFT_CULTURAL_CONVENTION: 'SOFT_CULTURAL_CONVENTION',
  USER_PREFERENCE: 'USER_PREFERENCE',
  UNKNOWN: 'UNKNOWN',
} as const;

export type CulturalConstraintStrength =
  (typeof CulturalConstraintStrength)[keyof typeof CulturalConstraintStrength];

export const CulturalEvaluationOutcome = {
  GENERIC_OCCASION_ONLY: 'GENERIC_OCCASION_ONLY',
  QUALIFIED_CULTURAL_CANDIDATE: 'QUALIFIED_CULTURAL_CANDIDATE',
  NEED_CLARIFICATION: 'NEED_CLARIFICATION',
  OUT_OF_SCOPE_RELIGION: 'OUT_OF_SCOPE_RELIGION',
  CONTEXT_CLEARED: 'CONTEXT_CLEARED',
  INSUFFICIENT_CONTEXT: 'INSUFFICIENT_CONTEXT',
} as const;

export type CulturalEvaluationOutcome =
  (typeof CulturalEvaluationOutcome)[keyof typeof CulturalEvaluationOutcome];
