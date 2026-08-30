/**
 * FK-6 — Future curated accessory REVIEW_CANDIDATES (DRAFT / NEEDS_SOURCE).
 * Zero ACTIVE. No fabricated books or human approvals.
 */
import { draftRule } from '../curated/candidate-helpers';
import { FashionAdviceType } from '../contracts/advice-types';
import { ConditionField, ConditionOperator } from '../contracts/conditions';
import { KnowledgeType } from '../contracts/knowledge-types';
import { FashionRuleDomain } from '../contracts/rule-domains';
import { SubjectivityLevel } from '../contracts/subjectivity';
import { KnowledgeConfidence } from '../contracts/confidence';
import { SourceAuthorityTier } from '../curated/source-authority';
import {
  ReviewCandidateStatus,
  type FashionKnowledgeReviewCandidate,
} from '../curated/review-candidate';
import {
  FASHION_KNOWLEDGE_REVIEW_CANDIDATE_VERSION,
  FASHION_KNOWLEDGE_SOURCING_GAP,
} from '../versioning/release';

function pack(
  partial: Omit<
    FashionKnowledgeReviewCandidate,
    'schemaVersion' | 'sourcingGap' | 'sourcingGapCode' | 'copyrightSafe'
  >,
): FashionKnowledgeReviewCandidate {
  return Object.freeze({
    ...partial,
    schemaVersion: FASHION_KNOWLEDGE_REVIEW_CANDIDATE_VERSION,
    sourcingGap: true,
    sourcingGapCode: FASHION_KNOWLEDGE_SOURCING_GAP,
    copyrightSafe: true,
  });
}

export const FK6_ACCESSORY_REVIEW_CANDIDATES: readonly FashionKnowledgeReviewCandidate[] =
  Object.freeze([
    pack({
      candidateId: 'FK6_RC_SHOES_SUPPORTING_ROLE',
      category: 'GARMENT_FORMALITY_CONTEXT',
      authorityTierCeiling: SourceAuthorityTier.TIER_D,
      reviewStatus: ReviewCandidateStatus.PENDING_SOURCE,
      multiSourceNotes: [],
      expectedAdviceEffect:
        'Shoes may act as supporting or statement elements — Mode B only until sourced',
      reviewerDecision: 'NEEDS_SOURCE',
      reviewerNotes: 'FK-6 capability placeholder — no ACTIVE',
      rule: draftRule({
        ruleId: 'FK6_RC_SHOES_SUPPORTING_ROLE',
        knowledgeType: KnowledgeType.CONVENTION,
        domain: FashionRuleDomain.SHOES,
        provenanceSourceId: 'fk6_gap_shoes',
        subjectivity: SubjectivityLevel.MEDIUM_SUBJECTIVITY,
        confidence: KnowledgeConfidence.UNVERIFIED,
        conditions: [
          {
            field: ConditionField.SHOE_TYPE,
            operator: ConditionOperator.EXISTS,
          },
        ],
        pattern: {
          patternId: 'pat_shoes_support',
          adviceTypeHint: FashionAdviceType.CHANGE_SHOE_DIRECTION,
          structuredSuggestion:
            'Shoe direction may support or compete with primary garments depending on color, formality, and style goal',
          allowsMultipleAlternatives: true,
        },
        rationale:
          'Shoes participate in visual hierarchy and formality — principle reserved pending Tier A/B sources',
        applicability: [
          {
            applicabilityId: 'app_shoes_present',
            notes: 'Requires shoe presence PRESENT with evidence',
          },
        ],
      }),
    }),
    pack({
      candidateId: 'FK6_RC_BAGS_VISUAL_DOMINANCE',
      category: 'COLOR_DOMINANCE',
      authorityTierCeiling: SourceAuthorityTier.TIER_D,
      reviewStatus: ReviewCandidateStatus.PENDING_SOURCE,
      multiSourceNotes: [],
      expectedAdviceEffect: 'Bags may increase supporting visual dominance',
      reviewerDecision: 'NEEDS_SOURCE',
      reviewerNotes: 'No ACTIVE',
      rule: draftRule({
        ruleId: 'FK6_RC_BAGS_VISUAL_DOMINANCE',
        knowledgeType: KnowledgeType.CONVENTION,
        domain: FashionRuleDomain.BAGS,
        provenanceSourceId: 'fk6_gap_bags',
        subjectivity: SubjectivityLevel.MEDIUM_SUBJECTIVITY,
        conditions: [
          {
            field: ConditionField.BAG_TYPE,
            operator: ConditionOperator.EXISTS,
          },
        ],
        pattern: {
          patternId: 'pat_bags_dominance',
          adviceTypeHint: FashionAdviceType.CHANGE_BAG_DIRECTION,
          structuredSuggestion:
            'A bag may act as a supporting or competing visual element relative to primary garments',
          allowsMultipleAlternatives: true,
        },
        rationale:
          'Bag visual dominance is context-dependent — awaiting authoritative sourcing',
        applicability: [
          { applicabilityId: 'app_bag_present', notes: 'Bag PRESENT only' },
        ],
      }),
    }),
    pack({
      candidateId: 'FK6_RC_JEWELRY_STATEMENT_VS_SUPPORT',
      category: 'METALLIC_ACCENT',
      authorityTierCeiling: SourceAuthorityTier.TIER_D,
      reviewStatus: ReviewCandidateStatus.PENDING_SOURCE,
      multiSourceNotes: [],
      expectedAdviceEffect:
        'Jewelry may be statement or supporting — no skin-tone metal matching as curated truth',
      reviewerDecision: 'NEEDS_SOURCE',
      reviewerNotes: 'No skin-tone suitability claim in FK-6',
      rule: draftRule({
        ruleId: 'FK6_RC_JEWELRY_STATEMENT_VS_SUPPORT',
        knowledgeType: KnowledgeType.CONVENTION,
        domain: FashionRuleDomain.JEWELRY,
        provenanceSourceId: 'fk6_gap_jewelry',
        subjectivity: SubjectivityLevel.HIGH_SUBJECTIVITY,
        conditions: [
          {
            field: ConditionField.JEWELRY_TYPE,
            operator: ConditionOperator.EXISTS,
          },
        ],
        pattern: {
          patternId: 'pat_jewelry_role',
          adviceTypeHint: FashionAdviceType.JEWELRY_DIRECTION,
          structuredSuggestion:
            'Jewelry may read as statement or supporting depending on prominence and garment details',
          allowsMultipleAlternatives: true,
        },
        rationale:
          'Jewelry role is interpretive — Mode B may suggest; Mode A blocked without sources',
        applicability: [
          {
            applicabilityId: 'app_jewelry_present',
            notes: 'Jewelry PRESENT; metallic only when evidenced',
          },
        ],
      }),
    }),
    pack({
      candidateId: 'FK6_RC_ACCESSORY_SIMPLIFY_COMPETITION',
      category: 'COLOR_BALANCE',
      authorityTierCeiling: SourceAuthorityTier.TIER_D,
      reviewStatus: ReviewCandidateStatus.PENDING_SOURCE,
      multiSourceNotes: [],
      expectedAdviceEffect:
        'When multiple supporting pieces compete, simplification is one qualified direction',
      reviewerDecision: 'NEEDS_SOURCE',
      reviewerNotes: 'Must not declare two statement pieces wrong as fact',
      rule: draftRule({
        ruleId: 'FK6_RC_ACCESSORY_SIMPLIFY_COMPETITION',
        knowledgeType: KnowledgeType.CONVENTION,
        domain: FashionRuleDomain.ACCESSORY,
        provenanceSourceId: 'fk6_gap_accessory_simplify',
        subjectivity: SubjectivityLevel.MEDIUM_SUBJECTIVITY,
        conditions: [
          {
            field: ConditionField.OUTFIT_EVALUATION_EVIDENCE,
            operator: ConditionOperator.CONTAINS,
            value: 'multiple_supporting_statement_pieces',
          },
        ],
        pattern: {
          patternId: 'pat_simplify_accessories',
          adviceTypeHint: FashionAdviceType.SIMPLIFY_ACCESSORIES,
          structuredSuggestion:
            'If the goal is a more restrained look, simplifying one supporting element is one option',
          allowsMultipleAlternatives: true,
        },
        rationale:
          'Competing supporting dominance is a styling control lever — not an absolute wrongness claim',
        applicability: [
          {
            applicabilityId: 'app_multi_statement_support',
            notes: 'Requires evidence of multiple competing supporting pieces',
          },
        ],
        exceptions: [
          {
            exceptionId: 'ex_bold_keep_statements',
            description: 'Bold/statement style goal',
            whenValues: ['bold', 'statement'],
            blocksAdvice: false,
            notes: 'Qualify preserve path',
          },
        ],
      }),
    }),
  ]);

export function fk6ActiveAccessoryRuleCount(): number {
  return 0;
}
