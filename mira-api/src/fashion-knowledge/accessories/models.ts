/**
 * FK-6 — Accessory presence / role / dominance / metallic models.
 */
export const AccessoryPresence = {
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  UNKNOWN: 'UNKNOWN',
} as const;

export type AccessoryPresence =
  (typeof AccessoryPresence)[keyof typeof AccessoryPresence];

/** UNKNOWN must never be coerced to ABSENT. */
export function isUnknownPresence(p: AccessoryPresence): boolean {
  return p === AccessoryPresence.UNKNOWN;
}

export function presenceAllowsInventedAddClaim(
  p: AccessoryPresence,
): boolean {
  // Cannot claim "add because you are not carrying one" when UNKNOWN
  return p === AccessoryPresence.ABSENT;
}

export const AccessoryRole = {
  PRIMARY_STATEMENT: 'PRIMARY_STATEMENT',
  SECONDARY_STATEMENT: 'SECONDARY_STATEMENT',
  SUPPORTING: 'SUPPORTING',
  NEUTRAL_SUPPORT: 'NEUTRAL_SUPPORT',
  FUNCTIONAL: 'FUNCTIONAL',
  UNKNOWN: 'UNKNOWN',
} as const;

export type AccessoryRole =
  (typeof AccessoryRole)[keyof typeof AccessoryRole];

export const VisualDominance = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  UNKNOWN: 'UNKNOWN',
} as const;

export type VisualDominance =
  (typeof VisualDominance)[keyof typeof VisualDominance];

export const MetallicFamily = {
  GOLD: 'GOLD',
  SILVER: 'SILVER',
  ROSE_GOLD: 'ROSE_GOLD',
  MIXED: 'MIXED',
  OTHER: 'OTHER',
  UNKNOWN: 'UNKNOWN',
} as const;

export type MetallicFamily =
  (typeof MetallicFamily)[keyof typeof MetallicFamily];

export const AccessoryCategory = {
  SHOES: 'shoes',
  BAGS: 'bags',
  JEWELRY: 'jewelry',
  BELT: 'belt',
  SCARF: 'scarf',
  WATCH: 'watch',
  EYEWEAR: 'eyewear',
  HEADWEAR: 'headwear',
  ACCESSORY: 'accessory',
} as const;

export type AccessoryCategory =
  (typeof AccessoryCategory)[keyof typeof AccessoryCategory];

export const AdviceQualification = {
  CONVENTIONAL_DIRECTION: 'CONVENTIONAL_DIRECTION',
  STYLE_OPTION: 'STYLE_OPTION',
  PREFERENCE_DEPENDENT: 'PREFERENCE_DEPENDENT',
  CONTEXT_DEPENDENT: 'CONTEXT_DEPENDENT',
  UNCURATED_MODEL_GUIDANCE: 'UNCURATED_MODEL_GUIDANCE',
} as const;

export type AdviceQualification =
  (typeof AdviceQualification)[keyof typeof AdviceQualification];

export const StyleGoalToken = {
  BOLD: 'bold',
  CLASSIC: 'classic',
  MINIMAL: 'minimal',
  FORMAL: 'formal',
  RELAXED: 'relaxed',
  STATEMENT: 'statement',
  UNDERSTATED: 'understated',
} as const;
