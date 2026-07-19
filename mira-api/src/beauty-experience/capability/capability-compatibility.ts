import { BeautyCapabilityId } from './capability-ids';

/**
 * Official capability groups (catalog freeze).
 */
export const BEAUTY_CAPABILITY_GROUPS = [
  'makeup',
  'hair',
  'accessories',
  'beauty_effects',
  'comparison',
  'history',
  'collections',
  'session',
  'legacy',
  'future',
] as const;

export type CompatibilityRelation =
  | 'compatible'
  | 'mutually_exclusive'
  | 'sequential'
  | 'parallel_ok';

export interface CapabilityCompatibilityRule {
  a: BeautyCapabilityId | '*';
  b: BeautyCapabilityId | '*';
  relation: CompatibilityRelation;
  note: string;
}

/**
 * Compatibility matrix — explicit, never inferred.
 */
export const CAPABILITY_COMPATIBILITY_RULES: CapabilityCompatibilityRule[] = [
  {
    a: 'lip',
    b: 'foundation',
    relation: 'parallel_ok',
    note: 'May run as separate attempts in one session',
  },
  {
    a: 'lip',
    b: 'blush',
    relation: 'parallel_ok',
    note: 'Makeup stack parallel attempts OK',
  },
  {
    a: 'lip',
    b: 'eyeshadow',
    relation: 'parallel_ok',
    note: 'Makeup stack parallel attempts OK',
  },
  {
    a: 'lip',
    b: 'contour',
    relation: 'parallel_ok',
    note: 'Makeup stack parallel attempts OK',
  },
  {
    a: 'hair_color',
    b: 'hair_style',
    relation: 'sequential',
    note: 'Prefer color then style when both requested',
  },
  {
    a: 'look',
    b: 'lip',
    relation: 'sequential',
    note: 'Look may compose after component capabilities',
  },
  {
    a: 'look',
    b: 'foundation',
    relation: 'sequential',
    note: 'Look may compose after component capabilities',
  },
  {
    a: 'makeup_vto',
    b: 'lip',
    relation: 'mutually_exclusive',
    note: 'Legacy makeup_vto vs modern lip — prefer lip',
  },
  {
    a: 'makeup_vto',
    b: 'foundation',
    relation: 'mutually_exclusive',
    note: 'Legacy vs modern makeup capabilities',
  },
  {
    a: 'glasses',
    b: 'look',
    relation: 'compatible',
    note: 'Eyewear can layer after look attempt',
  },
  {
    a: '*',
    b: '*',
    relation: 'compatible',
    note: 'Default: compatible unless a specific rule applies',
  },
];

export function compatibilityBetween(
  a: BeautyCapabilityId,
  b: BeautyCapabilityId,
): CapabilityCompatibilityRule {
  const specific = CAPABILITY_COMPATIBILITY_RULES.find(
    (r) =>
      (r.a === a && r.b === b) ||
      (r.a === b && r.b === a),
  );
  if (specific) return specific;
  return CAPABILITY_COMPATIBILITY_RULES.find((r) => r.a === '*' && r.b === '*')!;
}
