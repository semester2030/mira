/**
 * FK-5 — Occasion / dress-code review candidates (DRAFT / PENDING_SOURCE).
 * No Saudi/Gulf cultural claims. Occasion ≠ dress code.
 */
import { draftRule } from './candidate-helpers';
import { FashionAdviceType } from '../contracts/advice-types';
import {
  ConditionField,
  ConditionOperator,
} from '../contracts/conditions';
import { KnowledgeType } from '../contracts/knowledge-types';
import { FashionRuleDomain } from '../contracts/rule-domains';
import { SubjectivityLevel } from '../contracts/subjectivity';
import { KnowledgeConfidence } from '../contracts/confidence';
import { SourceAuthorityTier } from './source-authority';
import {
  ReviewCandidateStatus,
  type FashionKnowledgeReviewCandidate,
} from './review-candidate';
import {
  FASHION_KNOWLEDGE_REVIEW_CANDIDATE_VERSION,
  FASHION_KNOWLEDGE_SOURCING_GAP,
} from '../versioning/release';
import { FashionOccasionId } from './occasion-model';
import { FashionDressCodeId } from './dress-code-model';

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

export const FK5_OCCASION_REVIEW_CANDIDATES: readonly FashionKnowledgeReviewCandidate[] =
  Object.freeze([
    pack({
      candidateId: 'FK5_RC_OCC_WEDDING_GENERIC',
      category: 'OCCASION_FORMALITY',
      authorityTierCeiling: SourceAuthorityTier.TIER_D,
      reviewStatus: ReviewCandidateStatus.PENDING_SOURCE,
      multiSourceNotes: [],
      expectedAdviceEffect:
        'Qualify wedding styling; clarify dress code when unknown; do not invent cultural law',
      reviewerDecision: 'NEEDS_SOURCE',
      reviewerNotes: 'Generic wedding only — cultural localization deferred to later phase',
      rule: draftRule({
        ruleId: 'FK5_RC_OCC_WEDDING_GENERIC',
        knowledgeType: KnowledgeType.CONVENTION,
        domain: FashionRuleDomain.OCCASION,
        provenanceSourceId: 'fk5_gap_occasion_wedding',
        subjectivity: SubjectivityLevel.MEDIUM_SUBJECTIVITY,
        confidence: KnowledgeConfidence.UNVERIFIED,
        occasionContext: [FashionOccasionId.WEDDING],
        conditions: [
          {
            field: ConditionField.OCCASION,
            operator: ConditionOperator.EQUALS,
            value: FashionOccasionId.WEDDING,
          },
        ],
        pattern: {
          patternId: 'pat_wedding_qualify',
          adviceTypeHint: FashionAdviceType.OCCASION_ADJUSTMENT,
          structuredSuggestion:
            'For a wedding occasion, consider formality and visual dominance relative to the event; clarify dress code when unknown',
          allowsMultipleAlternatives: true,
        },
        rationale:
          'Wedding is an occasion that often carries elevated formality expectations, but the specific dress code is not identical to the occasion itself',
        applicability: [
          {
            applicabilityId: 'app_wedding',
            requiredOccasions: [FashionOccasionId.WEDDING],
            notes: 'Generic wedding — not culturally localized',
          },
        ],
        exceptions: [
          {
            exceptionId: 'ex_creative_dress_code',
            description: 'Dress code explicitly encourages creative/statement styling',
            whenValues: [
              FashionDressCodeId.CREATIVE_BLACK_TIE,
              'creative',
              'statement',
            ],
            blocksAdvice: false,
            notes: 'Qualify rather than force restraint',
          },
        ],
      }),
    }),
    pack({
      candidateId: 'FK5_RC_OCC_DRESS_CODE_DISTINCT',
      category: 'DRESS_CODE_EXPECTATION',
      authorityTierCeiling: SourceAuthorityTier.TIER_D,
      reviewStatus: ReviewCandidateStatus.PENDING_SOURCE,
      multiSourceNotes: [],
      expectedAdviceEffect:
        'Treat black_tie as dress code expectation, not as synonym for wedding',
      reviewerDecision: 'NEEDS_SOURCE',
      reviewerNotes: 'Concept separation is structural — still needs authority for ACTIVE claims',
      rule: draftRule({
        ruleId: 'FK5_RC_OCC_DRESS_CODE_DISTINCT',
        knowledgeType: KnowledgeType.DRESS_CODE_RULE,
        domain: FashionRuleDomain.DRESS_CODE,
        provenanceSourceId: 'fk5_gap_dress_code_black_tie',
        subjectivity: SubjectivityLevel.MEDIUM_SUBJECTIVITY,
        conditions: [
          {
            field: ConditionField.FORMALITY,
            operator: ConditionOperator.EQUALS,
            value: FashionDressCodeId.BLACK_TIE,
          },
        ],
        pattern: {
          patternId: 'pat_black_tie_expectation',
          adviceTypeHint: FashionAdviceType.INCREASE_FORMALITY,
          structuredSuggestion:
            'Black tie is a dress-code expectation that typically implies elevated formality, independent of which occasion applies it',
          allowsMultipleAlternatives: true,
        },
        rationale:
          'Dress codes encode expectation bands; occasions may select among dress codes — they are not the same concept',
        applicability: [
          {
            applicabilityId: 'app_black_tie_code',
            notes: 'Applies when dress code is black_tie',
          },
        ],
      }),
    }),
    pack({
      candidateId: 'FK5_RC_OCC_MISSING_DRESS_CODE',
      category: 'DRESS_CODE_EXPECTATION',
      authorityTierCeiling: SourceAuthorityTier.TIER_D,
      reviewStatus: ReviewCandidateStatus.PENDING_SOURCE,
      multiSourceNotes: [],
      expectedAdviceEffect: 'NEED_CLARIFICATION path when occasion known but dress code unknown',
      reviewerDecision: 'NEEDS_SOURCE',
      reviewerNotes: 'Aligns with Claim Lock clarification — still not ACTIVE without source',
      rule: draftRule({
        ruleId: 'FK5_RC_OCC_MISSING_DRESS_CODE',
        knowledgeType: KnowledgeType.DRESS_CODE_RULE,
        domain: FashionRuleDomain.DRESS_CODE,
        provenanceSourceId: 'fk5_gap_dress_code_unknown',
        subjectivity: SubjectivityLevel.MEDIUM_SUBJECTIVITY,
        conditions: [
          {
            field: ConditionField.OCCASION,
            operator: ConditionOperator.EXISTS,
          },
          {
            field: ConditionField.FORMALITY,
            operator: ConditionOperator.EQUALS,
            value: FashionDressCodeId.UNKNOWN,
          },
        ],
        pattern: {
          patternId: 'pat_clarify_dress_code',
          adviceTypeHint: FashionAdviceType.CLARIFICATION_REQUIRED,
          structuredSuggestion:
            'Occasion is known but dress code is unknown — clarify dress code before strong formality claims',
          allowsMultipleAlternatives: false,
        },
        rationale:
          'Occasion alone does not determine dress-code expectation; missing dress code warrants clarification',
        applicability: [
          {
            applicabilityId: 'app_occasion_without_dress_code',
            notes: 'Occasion present; dress code unknown',
          },
        ],
      }),
    }),
    pack({
      candidateId: 'FK5_RC_OCC_DAYTIME_WEDDING',
      category: 'DAY_VS_EVENING',
      authorityTierCeiling: SourceAuthorityTier.TIER_D,
      reviewStatus: ReviewCandidateStatus.PENDING_SOURCE,
      multiSourceNotes: [],
      expectedAdviceEffect: 'Daytime wedding may differ from evening wedding expectations',
      reviewerDecision: 'NEEDS_SOURCE',
      reviewerNotes: 'Needs formal dress-code authority; no cultural overclaim',
      rule: draftRule({
        ruleId: 'FK5_RC_OCC_DAYTIME_WEDDING',
        knowledgeType: KnowledgeType.CONVENTION,
        domain: FashionRuleDomain.OCCASION,
        provenanceSourceId: 'fk5_gap_daytime_wedding',
        subjectivity: SubjectivityLevel.MEDIUM_SUBJECTIVITY,
        occasionContext: [FashionOccasionId.DAYTIME_WEDDING],
        conditions: [
          {
            field: ConditionField.OCCASION,
            operator: ConditionOperator.EQUALS,
            value: FashionOccasionId.DAYTIME_WEDDING,
          },
        ],
        pattern: {
          patternId: 'pat_daytime_wedding',
          adviceTypeHint: FashionAdviceType.OCCASION_ADJUSTMENT,
          structuredSuggestion:
            'Daytime wedding context may favor different formality/intensity choices than evening wedding — still contingent on dress code',
          allowsMultipleAlternatives: true,
        },
        rationale:
          'Day vs evening timing can shift conventional formality and color intensity expectations within the same occasion family',
        applicability: [
          {
            applicabilityId: 'app_daytime_wedding',
            requiredOccasions: [FashionOccasionId.DAYTIME_WEDDING],
          },
        ],
      }),
    }),
    pack({
      candidateId: 'FK5_RC_OCC_EVENING_WEDDING',
      category: 'DAY_VS_EVENING',
      authorityTierCeiling: SourceAuthorityTier.TIER_D,
      reviewStatus: ReviewCandidateStatus.PENDING_SOURCE,
      multiSourceNotes: [],
      expectedAdviceEffect: 'Evening wedding context may lean more formal — still dress-code dependent',
      reviewerDecision: 'NEEDS_SOURCE',
      reviewerNotes: 'Await authority',
      rule: draftRule({
        ruleId: 'FK5_RC_OCC_EVENING_WEDDING',
        knowledgeType: KnowledgeType.CONVENTION,
        domain: FashionRuleDomain.OCCASION,
        provenanceSourceId: 'fk5_gap_evening_wedding',
        subjectivity: SubjectivityLevel.MEDIUM_SUBJECTIVITY,
        occasionContext: [FashionOccasionId.EVENING_WEDDING],
        conditions: [
          {
            field: ConditionField.OCCASION,
            operator: ConditionOperator.EQUALS,
            value: FashionOccasionId.EVENING_WEDDING,
          },
        ],
        pattern: {
          patternId: 'pat_evening_wedding',
          adviceTypeHint: FashionAdviceType.OCCASION_ADJUSTMENT,
          structuredSuggestion:
            'Evening wedding context often pairs with higher formality dress codes than daytime — verify dress code',
          allowsMultipleAlternatives: true,
        },
        rationale:
          'Evening timing commonly correlates with higher formality bands, but dress code remains the binding expectation when known',
        applicability: [
          {
            applicabilityId: 'app_evening_wedding',
            requiredOccasions: [FashionOccasionId.EVENING_WEDDING],
          },
        ],
      }),
    }),
    pack({
      candidateId: 'FK5_RC_OCC_COLOR_INTENSITY_FORMAL',
      category: 'COLOR_INTENSITY_CONTEXT',
      authorityTierCeiling: SourceAuthorityTier.TIER_D,
      reviewStatus: ReviewCandidateStatus.PENDING_SOURCE,
      multiSourceNotes: [
        {
          sourceId: 'fk5_gap_color_dominance_convention',
          relation: 'specializes',
          notes: 'Specializes high-saturation dominance under formal occasion context',
        },
      ],
      expectedAdviceEffect:
        'Intersect color intensity with formal occasion — offer restraint OR preserve-bold paths; never ban hue pairs',
      reviewerDecision: 'NEEDS_SOURCE',
      reviewerNotes: 'Intersection principle for red/yellow/wedding — no pair ban',
      rule: draftRule({
        ruleId: 'FK5_RC_OCC_COLOR_INTENSITY_FORMAL',
        knowledgeType: KnowledgeType.CONVENTION,
        domain: FashionRuleDomain.OCCASION,
        provenanceSourceId: 'fk5_gap_color_intensity_formal',
        subjectivity: SubjectivityLevel.MEDIUM_SUBJECTIVITY,
        occasionContext: [
          FashionOccasionId.WEDDING,
          FashionOccasionId.FORMAL_EVENING,
          FashionOccasionId.EVENING_WEDDING,
        ],
        conditions: [
          {
            field: ConditionField.OCCASION,
            operator: ConditionOperator.IN,
            value: [
              FashionOccasionId.WEDDING,
              FashionOccasionId.FORMAL_EVENING,
              FashionOccasionId.EVENING_WEDDING,
            ],
          },
          {
            field: ConditionField.OUTFIT_EVALUATION_EVIDENCE,
            operator: ConditionOperator.CONTAINS,
            value: 'two_high_saturation_dominant_colors',
          },
        ],
        pattern: {
          patternId: 'pat_formal_color_intensity',
          adviceTypeHint: FashionAdviceType.OCCASION_ADJUSTMENT,
          structuredSuggestion:
            'Under formal occasion context, a more restrained direction may prefer reduced competing visual dominance depending on dress code and style goal; bold preference remains a valid qualified path',
          allowsMultipleAlternatives: true,
        },
        rationale:
          'Formal occasions often conventionally prefer clearer visual hierarchy; strong saturation competition increases visual energy — advise from principles, not arbitrary color-pair bans',
        applicability: [
          {
            applicabilityId: 'app_formal_plus_high_sat',
            requiredOccasions: [
              FashionOccasionId.WEDDING,
              FashionOccasionId.FORMAL_EVENING,
              FashionOccasionId.EVENING_WEDDING,
            ],
            notes: 'Color intensity × formal occasion intersection',
          },
        ],
        exceptions: [
          {
            exceptionId: 'ex_bold_or_creative_code',
            description: 'Bold preference or creative dress code',
            whenValues: [
              'bold',
              'statement',
              'experimental',
              FashionDressCodeId.CREATIVE_BLACK_TIE,
            ],
            blocksAdvice: false,
            notes: 'PASS_WITH_QUALIFICATION / preserve alternatives',
          },
        ],
      }),
    }),
    pack({
      candidateId: 'FK5_RC_OCC_BUSINESS_FORMAL',
      category: 'DRESS_CODE_EXPECTATION',
      authorityTierCeiling: SourceAuthorityTier.TIER_D,
      reviewStatus: ReviewCandidateStatus.PENDING_SOURCE,
      multiSourceNotes: [],
      expectedAdviceEffect: 'Business formal dress code expectations',
      reviewerDecision: 'NEEDS_SOURCE',
      reviewerNotes: 'Await authority',
      rule: draftRule({
        ruleId: 'FK5_RC_OCC_BUSINESS_FORMAL',
        knowledgeType: KnowledgeType.DRESS_CODE_RULE,
        domain: FashionRuleDomain.DRESS_CODE,
        provenanceSourceId: 'fk5_gap_business_formal',
        subjectivity: SubjectivityLevel.MEDIUM_SUBJECTIVITY,
        conditions: [
          {
            field: ConditionField.FORMALITY,
            operator: ConditionOperator.EQUALS,
            value: FashionDressCodeId.BUSINESS_FORMAL,
          },
        ],
        pattern: {
          patternId: 'pat_business_formal',
          adviceTypeHint: FashionAdviceType.INCREASE_FORMALITY,
          structuredSuggestion:
            'Business formal dress code typically expects elevated professional formality',
          allowsMultipleAlternatives: true,
        },
        rationale:
          'Business formal is a dress-code band with elevated workplace formality expectations',
        applicability: [
          { applicabilityId: 'app_biz_formal', notes: 'Dress code business_formal' },
        ],
      }),
    }),
    pack({
      candidateId: 'FK5_RC_OCC_SMART_CASUAL',
      category: 'DRESS_CODE_EXPECTATION',
      authorityTierCeiling: SourceAuthorityTier.TIER_D,
      reviewStatus: ReviewCandidateStatus.PENDING_SOURCE,
      multiSourceNotes: [],
      expectedAdviceEffect: 'Smart casual allows broader intensity than black tie',
      reviewerDecision: 'NEEDS_SOURCE',
      reviewerNotes: 'Await authority',
      rule: draftRule({
        ruleId: 'FK5_RC_OCC_SMART_CASUAL',
        knowledgeType: KnowledgeType.DRESS_CODE_RULE,
        domain: FashionRuleDomain.DRESS_CODE,
        provenanceSourceId: 'fk5_gap_smart_casual',
        subjectivity: SubjectivityLevel.MEDIUM_SUBJECTIVITY,
        conditions: [
          {
            field: ConditionField.FORMALITY,
            operator: ConditionOperator.EQUALS,
            value: FashionDressCodeId.SMART_CASUAL,
          },
        ],
        pattern: {
          patternId: 'pat_smart_casual',
          adviceTypeHint: FashionAdviceType.OCCASION_ADJUSTMENT,
          structuredSuggestion:
            'Smart casual dress code typically allows more flexibility in color intensity than black-tie formality',
          allowsMultipleAlternatives: true,
        },
        rationale:
          'Lower formality dress codes conventionally tolerate broader visual energy than top-tier formal codes',
        applicability: [
          { applicabilityId: 'app_smart_casual', notes: 'Dress code smart_casual' },
        ],
      }),
    }),
    pack({
      candidateId: 'FK5_RC_OCC_COCKTAIL_CODE',
      category: 'DRESS_CODE_EXPECTATION',
      authorityTierCeiling: SourceAuthorityTier.TIER_D,
      reviewStatus: ReviewCandidateStatus.PENDING_SOURCE,
      multiSourceNotes: [],
      expectedAdviceEffect: 'Cocktail dress code mid-formality band',
      reviewerDecision: 'NEEDS_SOURCE',
      reviewerNotes: 'Keep distinct from cocktail occasion',
      rule: draftRule({
        ruleId: 'FK5_RC_OCC_COCKTAIL_CODE',
        knowledgeType: KnowledgeType.DRESS_CODE_RULE,
        domain: FashionRuleDomain.DRESS_CODE,
        provenanceSourceId: 'fk5_gap_cocktail_code',
        subjectivity: SubjectivityLevel.MEDIUM_SUBJECTIVITY,
        conditions: [
          {
            field: ConditionField.FORMALITY,
            operator: ConditionOperator.EQUALS,
            value: FashionDressCodeId.COCKTAIL,
          },
        ],
        pattern: {
          patternId: 'pat_cocktail_code',
          adviceTypeHint: FashionAdviceType.OCCASION_ADJUSTMENT,
          structuredSuggestion:
            'Cocktail dress code sits in a mid-to-elevated formality band — distinct from labeling an event as a cocktail occasion',
          allowsMultipleAlternatives: true,
        },
        rationale:
          'Cocktail as dress code is an expectation band; cocktail as occasion is an event type — do not collapse',
        applicability: [
          { applicabilityId: 'app_cocktail_code', notes: 'Dress code cocktail' },
        ],
      }),
    }),
  ]);
