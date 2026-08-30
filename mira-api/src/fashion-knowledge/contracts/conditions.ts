/**
 * FK-2 — Structured rule condition contract.
 * References Mira-owned facts only — no provider-specific fields.
 */
export const ConditionField = {
  GARMENT_CATEGORY: 'garment_category',
  GARMENT_TYPE: 'garment_type',
  COLOR: 'color',
  COLOR_FAMILY: 'color_family',
  METALLIC: 'metallic',
  PATTERN: 'pattern',
  MATERIAL: 'material',
  SILHOUETTE: 'silhouette',
  FIT: 'fit',
  FORMALITY: 'formality',
  OCCASION: 'occasion',
  SEASON: 'season',
  ACCESSORY_TYPE: 'accessory_type',
  SHOE_TYPE: 'shoe_type',
  BAG_TYPE: 'bag_type',
  JEWELRY_TYPE: 'jewelry_type',
  CULTURAL_CONTEXT: 'cultural_context',
  STYLE_GOAL: 'style_goal',
  PREFERENCE: 'preference',
  OUTFIT_EVALUATION_EVIDENCE: 'outfit_evaluation_evidence',
} as const;

export type ConditionField =
  (typeof ConditionField)[keyof typeof ConditionField];

export const ALL_CONDITION_FIELDS: readonly ConditionField[] = Object.freeze(
  Object.values(ConditionField),
);

export const ConditionOperator = {
  EQUALS: 'EQUALS',
  NOT_EQUALS: 'NOT_EQUALS',
  IN: 'IN',
  NOT_IN: 'NOT_IN',
  EXISTS: 'EXISTS',
  NOT_EXISTS: 'NOT_EXISTS',
  CONTAINS: 'CONTAINS',
  ANY_OF: 'ANY_OF',
  ALL_OF: 'ALL_OF',
  RANGE: 'RANGE',
  GREATER_THAN: 'GREATER_THAN',
  LESS_THAN: 'LESS_THAN',
} as const;

export type ConditionOperator =
  (typeof ConditionOperator)[keyof typeof ConditionOperator];

export const ALL_CONDITION_OPERATORS: readonly ConditionOperator[] =
  Object.freeze(Object.values(ConditionOperator));

export type ConditionValue =
  | string
  | number
  | boolean
  | readonly string[]
  | readonly number[]
  | { readonly min: number; readonly max: number }
  | null;

export interface FashionRuleCondition {
  readonly field: ConditionField;
  readonly operator: ConditionOperator;
  readonly value?: ConditionValue;
  /** Optional target garment/outfit slot ref. */
  readonly targetRef?: string;
}

/** Forbidden tokens that would leak provider / frozen runtime details. */
export const FORBIDDEN_CONDITION_TOKENS = Object.freeze([
  'fashn',
  'openai',
  'provider_id',
  'providerId',
  'raw_provider',
  'vision_provider',
  'canonical_outfit_payload',
  'decision_ledger_raw',
] as const);

export function isConditionField(value: unknown): value is ConditionField {
  return (
    typeof value === 'string' &&
    (ALL_CONDITION_FIELDS as readonly string[]).includes(value)
  );
}

export function isConditionOperator(
  value: unknown,
): value is ConditionOperator {
  return (
    typeof value === 'string' &&
    (ALL_CONDITION_OPERATORS as readonly string[]).includes(value)
  );
}
