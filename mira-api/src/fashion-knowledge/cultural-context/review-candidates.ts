/**
 * FK-8 — Future cultural REVIEW_CANDIDATES (DRAFT / NEEDS_SOURCE / NEEDS_CULTURAL_REVIEW).
 * ACTIVE = 0. No fabricated Saudi/Gulf rules or reviewers.
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
  > & { readonly needsCulturalReview?: true },
): FashionKnowledgeReviewCandidate & { readonly needsCulturalReview: true } {
  return Object.freeze({
    ...partial,
    schemaVersion: FASHION_KNOWLEDGE_REVIEW_CANDIDATE_VERSION,
    sourcingGap: true,
    sourcingGapCode: FASHION_KNOWLEDGE_SOURCING_GAP,
    copyrightSafe: true,
    needsCulturalReview: true as const,
  });
}

export const FK8_CULTURAL_SOURCE_REQUIREMENTS = Object.freeze({
  activationRequires: Object.freeze([
    'tier_a_or_b_source',
    'regional_scope',
    'cultural_reviewer',
    'reviewed_at',
    'applicability',
    'exceptions',
    'language_review',
    'sensitivity_review',
  ]),
  llmOnlyCannotActivate: true,
  activeCulturalRulesDefault: 0,
});

export const FK8_CULTURAL_REVIEW_CANDIDATES: readonly (FashionKnowledgeReviewCandidate & {
  readonly needsCulturalReview: true;
})[] = Object.freeze([
  pack({
    candidateId: 'FK8_RC_SAUDI_WEDDING_READINESS',
    category: 'CULTURAL_EVENT_CONTEXT',
    authorityTierCeiling: SourceAuthorityTier.TIER_D,
    reviewStatus: ReviewCandidateStatus.PENDING_SOURCE,
    multiSourceNotes: [],
    expectedAdviceEffect:
      'Saudi wedding styling knowledge — sourcing + cultural review required before ACTIVE',
    reviewerDecision: 'NEEDS_SOURCE',
    reviewerNotes: 'NEEDS_CULTURAL_REVIEW — no ACTIVE; no fake reviewer',
    rule: draftRule({
      ruleId: 'FK8_RC_SAUDI_WEDDING_READINESS',
      knowledgeType: KnowledgeType.CULTURAL_CONVENTION,
      domain: FashionRuleDomain.CULTURAL_CONTEXT,
      provenanceSourceId: 'fk8_gap_saudi_wedding',
      subjectivity: SubjectivityLevel.HIGH_SUBJECTIVITY,
      confidence: KnowledgeConfidence.UNVERIFIED,
      culturalContext: ['saudi_wedding'],
      conditions: [
        {
          field: ConditionField.OCCASION,
          operator: ConditionOperator.EQUALS,
          value: 'wedding',
        },
        {
          field: ConditionField.CULTURAL_CONTEXT,
          operator: ConditionOperator.EXISTS,
        },
      ],
      pattern: {
        patternId: 'pat_saudi_wedding_readiness',
        adviceTypeHint: FashionAdviceType.OCCASION_ADJUSTMENT,
        structuredSuggestion:
          'When explicit Saudi wedding context exists, future curated guidance may offer traditional / contemporary / fusion directions — never moral ranking',
        allowsMultipleAlternatives: true,
      },
      rationale:
        'Placeholder for future Tier A/B + cultural reviewer — LLM cannot activate',
      applicability: [
        {
          applicabilityId: 'app_explicit_saudi_wedding',
          notes: 'Requires EXPLICIT user/event cultural context',
        },
      ],
    }),
  }),
  pack({
    candidateId: 'FK8_RC_GULF_WEDDING_READINESS',
    category: 'CULTURAL_EVENT_CONTEXT',
    authorityTierCeiling: SourceAuthorityTier.TIER_D,
    reviewStatus: ReviewCandidateStatus.PENDING_SOURCE,
    multiSourceNotes: [],
    expectedAdviceEffect: 'Gulf wedding readiness — NEEDS_SOURCE',
    reviewerDecision: 'NEEDS_SOURCE',
    reviewerNotes: 'NEEDS_CULTURAL_REVIEW',
    rule: draftRule({
      ruleId: 'FK8_RC_GULF_WEDDING_READINESS',
      knowledgeType: KnowledgeType.CULTURAL_CONVENTION,
      domain: FashionRuleDomain.CULTURAL_CONTEXT,
      provenanceSourceId: 'fk8_gap_gulf_wedding',
      subjectivity: SubjectivityLevel.HIGH_SUBJECTIVITY,
      confidence: KnowledgeConfidence.UNVERIFIED,
      culturalContext: ['gulf_wedding'],
      conditions: [
        {
          field: ConditionField.OCCASION,
          operator: ConditionOperator.EQUALS,
          value: 'wedding',
        },
      ],
      pattern: {
        patternId: 'pat_gulf_wedding_readiness',
        adviceTypeHint: FashionAdviceType.OCCASION_ADJUSTMENT,
        structuredSuggestion:
          'Gulf wedding contexts require scoped provenance before any ACTIVE convention',
        allowsMultipleAlternatives: true,
      },
      rationale: 'Sourcing gap — no fabricated Gulf rule',
      applicability: [],
    }),
  }),
  pack({
    candidateId: 'FK8_RC_MODEST_FASHION_CONTEXT',
    category: 'MODESTY_PREFERENCE_CONTEXT',
    authorityTierCeiling: SourceAuthorityTier.TIER_D,
    reviewStatus: ReviewCandidateStatus.PENDING_SOURCE,
    multiSourceNotes: [],
    expectedAdviceEffect:
      'Modest fashion is preference/context — not inferred identity',
    reviewerDecision: 'NEEDS_SOURCE',
    reviewerNotes: 'NEEDS_CULTURAL_REVIEW; OI modesty CONSUME_ONLY',
    rule: draftRule({
      ruleId: 'FK8_RC_MODEST_FASHION_CONTEXT',
      knowledgeType: KnowledgeType.CULTURAL_CONVENTION,
      domain: FashionRuleDomain.CULTURAL_CONTEXT,
      provenanceSourceId: 'fk8_gap_modest',
      subjectivity: SubjectivityLevel.MEDIUM_SUBJECTIVITY,
      confidence: KnowledgeConfidence.UNVERIFIED,
      culturalContext: ['modest_fashion'],
      conditions: [
        {
          field: ConditionField.PREFERENCE,
          operator: ConditionOperator.EXISTS,
        },
      ],
      pattern: {
        patternId: 'pat_modest_preference',
        adviceTypeHint: FashionAdviceType.PRESERVE_LOOK,
        structuredSuggestion:
          'User-declared modest preference may guide direction without religious adjudication',
        allowsMultipleAlternatives: true,
      },
      rationale: 'Modesty preference ≠ religious ruling',
      applicability: [],
    }),
  }),
  pack({
    candidateId: 'FK8_RC_EID_GATHERING_READINESS',
    category: 'CULTURAL_EVENT_CONTEXT',
    authorityTierCeiling: SourceAuthorityTier.TIER_D,
    reviewStatus: ReviewCandidateStatus.PENDING_SOURCE,
    multiSourceNotes: [],
    expectedAdviceEffect: 'Eid gathering readiness — NEEDS_SOURCE',
    reviewerDecision: 'NEEDS_SOURCE',
    reviewerNotes: 'NEEDS_CULTURAL_REVIEW',
    rule: draftRule({
      ruleId: 'FK8_RC_EID_GATHERING_READINESS',
      knowledgeType: KnowledgeType.CULTURAL_CONVENTION,
      domain: FashionRuleDomain.CULTURAL_CONTEXT,
      provenanceSourceId: 'fk8_gap_eid',
      subjectivity: SubjectivityLevel.HIGH_SUBJECTIVITY,
      confidence: KnowledgeConfidence.UNVERIFIED,
      culturalContext: ['eid_gathering'],
      conditions: [
        {
          field: ConditionField.OCCASION,
          operator: ConditionOperator.EXISTS,
        },
      ],
      pattern: {
        patternId: 'pat_eid_readiness',
        adviceTypeHint: FashionAdviceType.OCCASION_ADJUSTMENT,
        structuredSuggestion:
          'Eid gathering styling knowledge reserved pending sources + cultural review',
        allowsMultipleAlternatives: true,
      },
      rationale: 'No ACTIVE without provenance',
      applicability: [],
    }),
  }),
]);

export function fk8ActiveCulturalRuleCount(): number {
  return 0;
}
