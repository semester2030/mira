/**
 * FK-2 — Rule domain taxonomy (vocabulary only — no populated knowledge).
 */
export const FashionRuleDomain = {
  COLOR: 'COLOR',
  OCCASION: 'OCCASION',
  DRESS_CODE: 'DRESS_CODE',
  ACCESSORY: 'ACCESSORY',
  SHOES: 'SHOES',
  BAGS: 'BAGS',
  JEWELRY: 'JEWELRY',
  FABRIC: 'FABRIC',
  TEXTURE: 'TEXTURE',
  SILHOUETTE: 'SILHOUETTE',
  PROPORTION: 'PROPORTION',
  LAYERING: 'LAYERING',
  FORMALITY: 'FORMALITY',
  SEASON: 'SEASON',
  CULTURAL_CONTEXT: 'CULTURAL_CONTEXT',
  GENERAL_STYLING: 'GENERAL_STYLING',
} as const;

export type FashionRuleDomain =
  (typeof FashionRuleDomain)[keyof typeof FashionRuleDomain];

export const ALL_FASHION_RULE_DOMAINS: readonly FashionRuleDomain[] =
  Object.freeze(Object.values(FashionRuleDomain));

export function isFashionRuleDomain(
  value: unknown,
): value is FashionRuleDomain {
  return (
    typeof value === 'string' &&
    (ALL_FASHION_RULE_DOMAINS as readonly string[]).includes(value)
  );
}
