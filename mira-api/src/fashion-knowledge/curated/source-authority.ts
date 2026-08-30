/**
 * FK-5 — Source authority tiers.
 * Tier D cannot independently activate a production rule.
 */
import { ProvenanceSourceType } from '../contracts/provenance';
import { FASHION_KNOWLEDGE_SOURCE_AUTHORITY_VERSION } from '../versioning/release';

export const SourceAuthorityTier = {
  TIER_A: 'TIER_A',
  TIER_B: 'TIER_B',
  TIER_C: 'TIER_C',
  TIER_D: 'TIER_D',
} as const;

export type SourceAuthorityTier =
  (typeof SourceAuthorityTier)[keyof typeof SourceAuthorityTier];

export interface SourceAuthorityPolicy {
  readonly tier: SourceAuthorityTier;
  readonly mayIndependentlyActivate: boolean;
  readonly description: string;
}

export const SOURCE_AUTHORITY_POLICIES: Readonly<
  Record<SourceAuthorityTier, SourceAuthorityPolicy>
> = Object.freeze({
  TIER_A: {
    tier: SourceAuthorityTier.TIER_A,
    mayIndependentlyActivate: true,
    description:
      'High authority: recognized color theory, academic/educational fashion, fashion-school, formal dress-code refs',
  },
  TIER_B: {
    tier: SourceAuthorityTier.TIER_B,
    mayIndependentlyActivate: true,
    description:
      'Professional curated: established publication, experienced stylist, Mira editorial backed by multiple references',
  },
  TIER_C: {
    tier: SourceAuthorityTier.TIER_C,
    mayIndependentlyActivate: false,
    description: 'Supporting secondary professional references only',
  },
  TIER_D: {
    tier: SourceAuthorityTier.TIER_D,
    mayIndependentlyActivate: false,
    description:
      'Not authoritative for ACTIVE: LLM, influencer, unsourced web, social trend, developer opinion',
  },
});

/** Map provenance sourceType → default tier when no explicit override. */
export function defaultTierForSourceType(
  sourceType: ProvenanceSourceType,
): SourceAuthorityTier {
  switch (sourceType) {
    case ProvenanceSourceType.BOOK:
    case ProvenanceSourceType.ACADEMIC_REFERENCE:
    case ProvenanceSourceType.FASHION_SCHOOL_MATERIAL:
      return SourceAuthorityTier.TIER_A;
    case ProvenanceSourceType.PROFESSIONAL_STYLIST:
    case ProvenanceSourceType.FASHION_PUBLICATION:
    case ProvenanceSourceType.MIRA_EDITORIAL:
    case ProvenanceSourceType.CULTURAL_REVIEWER:
      return SourceAuthorityTier.TIER_B;
    case ProvenanceSourceType.USER_DATA_PATTERN:
      return SourceAuthorityTier.TIER_C;
    case ProvenanceSourceType.LLM_GENERAL_KNOWLEDGE:
    case ProvenanceSourceType.UNKNOWN:
    default:
      return SourceAuthorityTier.TIER_D;
  }
}

export function canIndependentlyActivateTier(
  tier: SourceAuthorityTier,
): boolean {
  return SOURCE_AUTHORITY_POLICIES[tier].mayIndependentlyActivate;
}

export const SOURCE_AUTHORITY_SCHEMA_VERSION =
  FASHION_KNOWLEDGE_SOURCE_AUTHORITY_VERSION;
