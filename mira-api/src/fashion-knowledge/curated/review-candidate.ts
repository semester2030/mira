/**
 * FK-5 — Review candidate contract.
 * Candidates are NOT production ACTIVE knowledge.
 */
import type { FashionKnowledgeRule } from '../knowledge/fashion-knowledge-rule';
import type { ColorKnowledgeLayer } from './color-theory-vs-styling';
import type { SourceAuthorityTier } from './source-authority';
import {
  FASHION_KNOWLEDGE_REVIEW_CANDIDATE_VERSION,
  FASHION_KNOWLEDGE_SOURCING_GAP,
} from '../versioning/release';

export const ReviewCandidateStatus = {
  DRAFT: 'DRAFT',
  RESEARCHED: 'RESEARCHED',
  REVIEWED: 'REVIEWED',
  PENDING_SOURCE: 'PENDING_SOURCE',
  PENDING_HUMAN_APPROVAL: 'PENDING_HUMAN_APPROVAL',
  REJECTED: 'REJECTED',
  /** Never auto-set to ACTIVE without Tier A/B + proven human approval. */
  APPROVED_PENDING_RELEASE: 'APPROVED_PENDING_RELEASE',
} as const;

export type ReviewCandidateStatus =
  (typeof ReviewCandidateStatus)[keyof typeof ReviewCandidateStatus];

export interface MultiSourceSupportNote {
  readonly sourceId: string;
  readonly relation: 'independently_supports' | 'specializes' | 'qualifies' | 'conflicts';
  readonly notes: string;
}

export interface FashionKnowledgeReviewCandidate {
  readonly schemaVersion: typeof FASHION_KNOWLEDGE_REVIEW_CANDIDATE_VERSION | string;
  readonly candidateId: string;
  readonly category:
    | 'COLOR_RELATIONSHIP'
    | 'COLOR_BALANCE'
    | 'NEUTRAL_SUPPORT'
    | 'COLOR_DOMINANCE'
    | 'SATURATION_BALANCE'
    | 'VALUE_CONTRAST'
    | 'METALLIC_ACCENT'
    | 'OCCASION_FORMALITY'
    | 'DRESS_CODE_EXPECTATION'
    | 'DAY_VS_EVENING'
    | 'COLOR_INTENSITY_CONTEXT'
    | 'GARMENT_FORMALITY_CONTEXT'
    | 'FABRIC_FORMALITY'
    | 'TEXTURE_RELATIONSHIP'
    | 'PROPORTION'
    | 'LAYERING_KNOWLEDGE'
    | 'SILHOUETTE_RELATIONSHIP'
    | 'VOLUME_BALANCE'
    | 'CULTURAL_EVENT_CONTEXT'
    | 'MODESTY_PREFERENCE_CONTEXT'
    | 'CULTURAL_CONVENTION_CANDIDATE';
  readonly colorLayer?: ColorKnowledgeLayer;
  readonly rule: FashionKnowledgeRule;
  readonly reviewStatus: ReviewCandidateStatus;
  readonly authorityTierCeiling: SourceAuthorityTier;
  readonly sourcingGap: boolean;
  readonly sourcingGapCode: typeof FASHION_KNOWLEDGE_SOURCING_GAP | string;
  readonly multiSourceNotes: readonly MultiSourceSupportNote[];
  readonly expectedAdviceEffect: string;
  readonly reviewerDecision: 'PENDING' | 'APPROVE' | 'REJECT' | 'NEEDS_SOURCE';
  readonly reviewerNotes: string;
  readonly copyrightSafe: boolean;
}

export function isActiveEligibleCandidate(
  c: FashionKnowledgeReviewCandidate,
): boolean {
  return (
    !c.sourcingGap &&
    c.reviewerDecision === 'APPROVE' &&
    (c.reviewStatus === ReviewCandidateStatus.APPROVED_PENDING_RELEASE ||
      c.reviewStatus === ReviewCandidateStatus.REVIEWED) &&
    (c.authorityTierCeiling === 'TIER_A' ||
      c.authorityTierCeiling === 'TIER_B')
  );
}
