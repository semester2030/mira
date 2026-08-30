/**
 * FK-7 — Future sourcing REVIEW_CANDIDATES (DRAFT / NEEDS_SOURCE).
 * ACTIVE = 0. No fabricated sources or human approvals.
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

export const FK7_FORM_REVIEW_CANDIDATES: readonly FashionKnowledgeReviewCandidate[] =
  Object.freeze([
    pack({
      candidateId: 'FK7_RC_FABRIC_FORMALITY_CONTEXT',
      category: 'FABRIC_FORMALITY',
      authorityTierCeiling: SourceAuthorityTier.TIER_D,
      reviewStatus: ReviewCandidateStatus.PENDING_SOURCE,
      multiSourceNotes: [],
      expectedAdviceEffect:
        'Material/formality relationship is contextual — Mode B only until sourced',
      reviewerDecision: 'NEEDS_SOURCE',
      reviewerNotes: 'FK-7 capability placeholder — no ACTIVE',
      rule: draftRule({
        ruleId: 'FK7_RC_FABRIC_FORMALITY_CONTEXT',
        knowledgeType: KnowledgeType.CONVENTION,
        domain: FashionRuleDomain.FABRIC,
        provenanceSourceId: 'fk7_gap_fabric',
        subjectivity: SubjectivityLevel.MEDIUM_SUBJECTIVITY,
        confidence: KnowledgeConfidence.UNVERIFIED,
        conditions: [
          {
            field: ConditionField.MATERIAL,
            operator: ConditionOperator.EXISTS,
          },
        ],
        pattern: {
          patternId: 'pat_fabric_formality',
          adviceTypeHint: FashionAdviceType.FABRIC_DIRECTION,
          structuredSuggestion:
            'Fabric formality depends on garment type, finish, construction, occasion, and dress code',
          allowsMultipleAlternatives: true,
        },
        rationale:
          'Fabric formality is contextual — reserved pending Tier A/B sources',
        applicability: [
          {
            applicabilityId: 'app_material_present',
            notes: 'Requires supported material evidence',
          },
        ],
      }),
    }),
    pack({
      candidateId: 'FK7_RC_TEXTURE_BALANCE',
      category: 'TEXTURE_RELATIONSHIP',
      authorityTierCeiling: SourceAuthorityTier.TIER_D,
      reviewStatus: ReviewCandidateStatus.PENDING_SOURCE,
      multiSourceNotes: [],
      expectedAdviceEffect: 'Texture relationships are descriptive not good/bad',
      reviewerDecision: 'NEEDS_SOURCE',
      reviewerNotes: 'No ACTIVE',
      rule: draftRule({
        ruleId: 'FK7_RC_TEXTURE_BALANCE',
        knowledgeType: KnowledgeType.CONVENTION,
        domain: FashionRuleDomain.TEXTURE,
        provenanceSourceId: 'fk7_gap_texture',
        subjectivity: SubjectivityLevel.HIGH_SUBJECTIVITY,
        confidence: KnowledgeConfidence.UNVERIFIED,
        conditions: [
          {
            field: ConditionField.MATERIAL,
            operator: ConditionOperator.EXISTS,
          },
        ],
        pattern: {
          patternId: 'pat_texture_balance',
          adviceTypeHint: FashionAdviceType.SIMPLIFY_TEXTURE,
          structuredSuggestion:
            'Texture competition may be preserved or simplified depending on style goal',
          allowsMultipleAlternatives: true,
        },
        rationale: 'Texture balance is preference-dependent',
        applicability: [],
      }),
    }),
    pack({
      candidateId: 'FK7_RC_VOLUME_PROPORTION',
      category: 'PROPORTION',
      authorityTierCeiling: SourceAuthorityTier.TIER_D,
      reviewStatus: ReviewCandidateStatus.PENDING_SOURCE,
      multiSourceNotes: [],
      expectedAdviceEffect:
        'Volume proportion is garment-to-garment — Law #37 forbids body judgment',
      reviewerDecision: 'NEEDS_SOURCE',
      reviewerNotes: 'Law #37 binding',
      rule: draftRule({
        ruleId: 'FK7_RC_VOLUME_PROPORTION',
        knowledgeType: KnowledgeType.CONVENTION,
        domain: FashionRuleDomain.PROPORTION,
        provenanceSourceId: 'fk7_gap_proportion',
        subjectivity: SubjectivityLevel.HIGH_SUBJECTIVITY,
        confidence: KnowledgeConfidence.UNVERIFIED,
        conditions: [
          {
            field: ConditionField.SILHOUETTE,
            operator: ConditionOperator.EXISTS,
          },
        ],
        pattern: {
          patternId: 'pat_volume_proportion',
          adviceTypeHint: FashionAdviceType.BALANCE_VOLUME,
          structuredSuggestion:
            'Upper/lower visual volume relationships may be preserved or adjusted by style goal',
          allowsMultipleAlternatives: true,
        },
        rationale: 'Proportion describes garments — never body worth',
        applicability: [],
      }),
    }),
    pack({
      candidateId: 'FK7_RC_LAYERING_CONVENTION',
      category: 'LAYERING_KNOWLEDGE',
      authorityTierCeiling: SourceAuthorityTier.TIER_D,
      reviewStatus: ReviewCandidateStatus.PENDING_SOURCE,
      multiSourceNotes: [],
      expectedAdviceEffect:
        'FKL interprets styling knowledge; OI owns structural layering validity',
      reviewerDecision: 'NEEDS_SOURCE',
      reviewerNotes: 'CONSUME_ONLY OI layering',
      rule: draftRule({
        ruleId: 'FK7_RC_LAYERING_CONVENTION',
        knowledgeType: KnowledgeType.CONVENTION,
        domain: FashionRuleDomain.LAYERING,
        provenanceSourceId: 'fk7_gap_layering',
        subjectivity: SubjectivityLevel.MEDIUM_SUBJECTIVITY,
        confidence: KnowledgeConfidence.UNVERIFIED,
        conditions: [
          {
            field: ConditionField.OUTFIT_EVALUATION_EVIDENCE,
            operator: ConditionOperator.EXISTS,
          },
        ],
        pattern: {
          patternId: 'pat_layering_direction',
          adviceTypeHint: FashionAdviceType.ADJUST_LAYERING_DIRECTION,
          structuredSuggestion:
            'Given a structurally valid stack, styling knowledge may suggest directional alternatives',
          allowsMultipleAlternatives: true,
        },
        rationale: 'Does not duplicate OI Layering Engine',
        applicability: [],
      }),
    }),
  ]);

export function fk7ActiveFormRuleCount(): number {
  // Review candidates are DRAFT / NEEDS_SOURCE — never ACTIVE in FK-7
  return 0;
}
