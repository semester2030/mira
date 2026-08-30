/**
 * FK-2 — Public claim strength semantics (policy patterns, not Advisor copy).
 */
export const PublicClaimStrength = {
  FACTUAL_RELATIONSHIP: 'FACTUAL_RELATIONSHIP',
  ESTABLISHED_GUIDANCE: 'ESTABLISHED_GUIDANCE',
  CONVENTIONAL_GUIDANCE: 'CONVENTIONAL_GUIDANCE',
  QUALIFIED_SUGGESTION: 'QUALIFIED_SUGGESTION',
  PREFERENCE_DEPENDENT_OPTION: 'PREFERENCE_DEPENDENT_OPTION',
  UNAVAILABLE: 'UNAVAILABLE',
} as const;

export type PublicClaimStrength =
  (typeof PublicClaimStrength)[keyof typeof PublicClaimStrength];

export const ALL_PUBLIC_CLAIM_STRENGTHS: readonly PublicClaimStrength[] =
  Object.freeze(Object.values(PublicClaimStrength));

/** Documented narration pattern examples — not final Advisor prose. */
export const CLAIM_STRENGTH_NARRATION_PATTERNS: Readonly<
  Record<PublicClaimStrength, string>
> = Object.freeze({
  FACTUAL_RELATIONSHIP:
    'Observational: colors form a high-contrast pair (relationship, not taste judgment).',
  ESTABLISHED_GUIDANCE:
    'Mira curated principle applies when ACTIVE APPROVED rule is attached.',
  CONVENTIONAL_GUIDANCE:
    'Common occasion/dress-code convention — contextual, not universal taste.',
  QUALIFIED_SUGGESTION:
    'Conditional option: "one direction some people choose is…" — never definitive truth.',
  PREFERENCE_DEPENDENT_OPTION:
    'Offer alternatives aligned to stated preference; do not override silently.',
  UNAVAILABLE: 'No public claim permitted for this candidate.',
});

export function isPublicClaimStrength(
  value: unknown,
): value is PublicClaimStrength {
  return (
    typeof value === 'string' &&
    (ALL_PUBLIC_CLAIM_STRENGTHS as readonly string[]).includes(value)
  );
}
