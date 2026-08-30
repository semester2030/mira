/**
 * FK-5 — Color review candidates (DRAFT / PENDING_SOURCE).
 * Normalized principles only — no copied source prose.
 * NOT production ACTIVE.
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
import { ColorKnowledgeLayer } from './color-theory-vs-styling';
import { SourceAuthorityTier } from './source-authority';
import {
  ReviewCandidateStatus,
  type FashionKnowledgeReviewCandidate,
} from './review-candidate';
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

export const FK5_COLOR_REVIEW_CANDIDATES: readonly FashionKnowledgeReviewCandidate[] =
  Object.freeze([
    pack({
      candidateId: 'FK5_RC_COLOR_HUE_COMPLEMENTARY',
      category: 'COLOR_RELATIONSHIP',
      colorLayer: ColorKnowledgeLayer.COLOR_THEORY_FACT,
      authorityTierCeiling: SourceAuthorityTier.TIER_D,
      reviewStatus: ReviewCandidateStatus.PENDING_SOURCE,
      multiSourceNotes: [],
      expectedAdviceEffect:
        'Observe complementary hue geometry; do not auto-label outfit quality',
      reviewerDecision: 'NEEDS_SOURCE',
      reviewerNotes: 'Bind Tier A color-theory reference before ACTIVE',
      rule: draftRule({
        ruleId: 'FK5_RC_COLOR_HUE_COMPLEMENTARY',
        knowledgeType: KnowledgeType.ESTABLISHED_PRINCIPLE,
        domain: FashionRuleDomain.COLOR,
        provenanceSourceId: 'fk5_gap_color_theory_complementary',
        subjectivity: SubjectivityLevel.LOW_SUBJECTIVITY,
        confidence: KnowledgeConfidence.UNVERIFIED,
        conditions: [
          {
            field: ConditionField.OUTFIT_EVALUATION_EVIDENCE,
            operator: ConditionOperator.CONTAINS,
            value: 'hue_relationship_complementary',
          },
        ],
        pattern: {
          patternId: 'pat_observe_complementary',
          adviceTypeHint: FashionAdviceType.NO_CHANGE_NEEDED,
          structuredSuggestion:
            'Two hues near opposite positions on the hue circle form a complementary geometric relationship',
          allowsMultipleAlternatives: true,
        },
        rationale:
          'Hue opposition (~180°) is a geometric color-wheel relationship, independent of outfit taste judgments',
        applicability: [
          {
            applicabilityId: 'app_two_hues_present',
            notes: 'Requires two measurable garment/outfit hues',
          },
        ],
      }),
    }),
    pack({
      candidateId: 'FK5_RC_COLOR_ANALOGOUS',
      category: 'COLOR_RELATIONSHIP',
      colorLayer: ColorKnowledgeLayer.COLOR_THEORY_FACT,
      authorityTierCeiling: SourceAuthorityTier.TIER_D,
      reviewStatus: ReviewCandidateStatus.PENDING_SOURCE,
      multiSourceNotes: [],
      expectedAdviceEffect: 'Observe near-neighbor hue clustering',
      reviewerDecision: 'NEEDS_SOURCE',
      reviewerNotes: 'Await Tier A binding',
      rule: draftRule({
        ruleId: 'FK5_RC_COLOR_ANALOGOUS',
        knowledgeType: KnowledgeType.ESTABLISHED_PRINCIPLE,
        domain: FashionRuleDomain.COLOR,
        provenanceSourceId: 'fk5_gap_color_theory_analogous',
        subjectivity: SubjectivityLevel.LOW_SUBJECTIVITY,
        conditions: [
          {
            field: ConditionField.OUTFIT_EVALUATION_EVIDENCE,
            operator: ConditionOperator.CONTAINS,
            value: 'hue_relationship_analogous',
          },
        ],
        pattern: {
          patternId: 'pat_observe_analogous',
          adviceTypeHint: FashionAdviceType.NO_CHANGE_NEEDED,
          structuredSuggestion:
            'Hues close on the wheel form an analogous geometric relationship',
          allowsMultipleAlternatives: true,
        },
        rationale:
          'Small hue distance describes analogous geometry — not inherent fashion success',
        applicability: [
          {
            applicabilityId: 'app_near_hues',
            notes: 'Two hues with small angular separation',
          },
        ],
      }),
    }),
    pack({
      candidateId: 'FK5_RC_COLOR_MONOCHROMATIC',
      category: 'COLOR_RELATIONSHIP',
      colorLayer: ColorKnowledgeLayer.COLOR_THEORY_FACT,
      authorityTierCeiling: SourceAuthorityTier.TIER_D,
      reviewStatus: ReviewCandidateStatus.PENDING_SOURCE,
      multiSourceNotes: [],
      expectedAdviceEffect: 'Observe tonal/monochrome proximity',
      reviewerDecision: 'NEEDS_SOURCE',
      reviewerNotes: 'Await Tier A binding',
      rule: draftRule({
        ruleId: 'FK5_RC_COLOR_MONOCHROMATIC',
        knowledgeType: KnowledgeType.ESTABLISHED_PRINCIPLE,
        domain: FashionRuleDomain.COLOR,
        provenanceSourceId: 'fk5_gap_color_theory_mono',
        subjectivity: SubjectivityLevel.LOW_SUBJECTIVITY,
        conditions: [
          {
            field: ConditionField.OUTFIT_EVALUATION_EVIDENCE,
            operator: ConditionOperator.CONTAINS,
            value: 'hue_relationship_monochromatic',
          },
        ],
        pattern: {
          patternId: 'pat_observe_mono',
          adviceTypeHint: FashionAdviceType.BALANCE_COLOR,
          structuredSuggestion:
            'Near-identical hue with value/saturation variation is a monochromatic/tonal relationship',
          allowsMultipleAlternatives: true,
        },
        rationale:
          'Monochromatic geometry is hue proximity plus tonal variation — separate from taste',
        applicability: [
          { applicabilityId: 'app_mono', notes: 'Hue nearly shared' },
        ],
      }),
    }),
    pack({
      candidateId: 'FK5_RC_COLOR_HIGH_SAT_DOMINANCE',
      category: 'COLOR_DOMINANCE',
      colorLayer: ColorKnowledgeLayer.FASHION_STYLING_CONVENTION,
      authorityTierCeiling: SourceAuthorityTier.TIER_D,
      reviewStatus: ReviewCandidateStatus.PENDING_SOURCE,
      multiSourceNotes: [],
      expectedAdviceEffect:
        'Offer reduce-dominance / balance / preserve-bold alternatives when two saturated dominants compete',
      reviewerDecision: 'NEEDS_SOURCE',
      reviewerNotes: 'Convention candidate — not LOW_SUBJECTIVITY without evidence',
      rule: draftRule({
        ruleId: 'FK5_RC_COLOR_HIGH_SAT_DOMINANCE',
        knowledgeType: KnowledgeType.CONVENTION,
        domain: FashionRuleDomain.COLOR,
        provenanceSourceId: 'fk5_gap_color_dominance_convention',
        subjectivity: SubjectivityLevel.MEDIUM_SUBJECTIVITY,
        confidence: KnowledgeConfidence.UNVERIFIED,
        conditions: [
          {
            field: ConditionField.OUTFIT_EVALUATION_EVIDENCE,
            operator: ConditionOperator.CONTAINS,
            value: 'two_high_saturation_dominant_colors',
          },
        ],
        pattern: {
          patternId: 'pat_balance_or_preserve_dominance',
          adviceTypeHint: FashionAdviceType.BALANCE_COLOR,
          structuredSuggestion:
            'When two high-saturation colors both dominate, competing visual dominance may be reduced, neutralized, or preserved as a bold direction',
          allowsMultipleAlternatives: true,
        },
        rationale:
          'High saturation contrast between two dominant garments can create a visually bold / high-energy effect; convention may prefer clarifying dominance hierarchy',
        applicability: [
          {
            applicabilityId: 'app_two_saturated_dominants',
            notes: 'Two dominant garment colors present with high saturation',
            userGoalRestrictions: undefined,
          },
        ],
        exceptions: [
          {
            exceptionId: 'ex_bold_style_goal',
            description: 'User style goal is bold/statement/experimental',
            whenValues: ['bold', 'statement', 'experimental'],
            blocksAdvice: false,
            notes: 'Qualify and offer preserve-look path — do not override preference',
          },
        ],
      }),
    }),
    pack({
      candidateId: 'FK5_RC_COLOR_NEUTRAL_SUPPORT',
      category: 'NEUTRAL_SUPPORT',
      colorLayer: ColorKnowledgeLayer.FASHION_STYLING_CONVENTION,
      authorityTierCeiling: SourceAuthorityTier.TIER_D,
      reviewStatus: ReviewCandidateStatus.PENDING_SOURCE,
      multiSourceNotes: [],
      expectedAdviceEffect:
        'Suggest neutral supporting elements as one path to reduce competing dominance',
      reviewerDecision: 'NEEDS_SOURCE',
      reviewerNotes: 'Await professional/styling authority',
      rule: draftRule({
        ruleId: 'FK5_RC_COLOR_NEUTRAL_SUPPORT',
        knowledgeType: KnowledgeType.CONVENTION,
        domain: FashionRuleDomain.COLOR,
        provenanceSourceId: 'fk5_gap_neutral_support',
        subjectivity: SubjectivityLevel.MEDIUM_SUBJECTIVITY,
        conditions: [
          {
            field: ConditionField.OUTFIT_EVALUATION_EVIDENCE,
            operator: ConditionOperator.CONTAINS,
            value: 'high_chromatic_competition',
          },
          {
            field: ConditionField.OUTFIT_EVALUATION_EVIDENCE,
            operator: ConditionOperator.CONTAINS,
            value: 'neutral_supporting_absent',
          },
        ],
        pattern: {
          patternId: 'pat_add_neutral_support',
          adviceTypeHint: FashionAdviceType.BALANCE_COLOR,
          structuredSuggestion:
            'Neutral supporting elements can reduce competing chromatic dominance without banning either hue',
          allowsMultipleAlternatives: true,
        },
        rationale:
          'Neutrals can mediate saturation competition by lowering visual rivalry between chromatic dominants',
        applicability: [
          {
            applicabilityId: 'app_chromatic_competition_no_neutral',
            notes: 'High chromatic competition and neutrals absent',
          },
        ],
        exceptions: [
          {
            exceptionId: 'ex_preserve_bold',
            description: 'User prefers bold unmediated contrast',
            whenValues: ['bold', 'statement'],
            blocksAdvice: false,
            notes: 'Preference may keep look',
          },
        ],
      }),
    }),
    pack({
      candidateId: 'FK5_RC_COLOR_VALUE_CONTRAST',
      category: 'VALUE_CONTRAST',
      colorLayer: ColorKnowledgeLayer.COLOR_THEORY_FACT,
      authorityTierCeiling: SourceAuthorityTier.TIER_D,
      reviewStatus: ReviewCandidateStatus.PENDING_SOURCE,
      multiSourceNotes: [],
      expectedAdviceEffect: 'Observe lightness contrast category',
      reviewerDecision: 'NEEDS_SOURCE',
      reviewerNotes: 'Await Tier A',
      rule: draftRule({
        ruleId: 'FK5_RC_COLOR_VALUE_CONTRAST',
        knowledgeType: KnowledgeType.ESTABLISHED_PRINCIPLE,
        domain: FashionRuleDomain.COLOR,
        provenanceSourceId: 'fk5_gap_value_contrast',
        subjectivity: SubjectivityLevel.LOW_SUBJECTIVITY,
        conditions: [
          {
            field: ConditionField.OUTFIT_EVALUATION_EVIDENCE,
            operator: ConditionOperator.CONTAINS,
            value: 'value_contrast_high',
          },
        ],
        pattern: {
          patternId: 'pat_observe_value_contrast',
          adviceTypeHint: FashionAdviceType.INCREASE_CONTRAST,
          structuredSuggestion:
            'Large lightness (value) difference between garments creates strong value contrast',
          allowsMultipleAlternatives: true,
        },
        rationale:
          'Value contrast is a measurable lightness relationship — separate from hue harmony taste',
        applicability: [
          { applicabilityId: 'app_value', notes: 'Two garments with measurable value delta' },
        ],
      }),
    }),
    pack({
      candidateId: 'FK5_RC_COLOR_SATURATION_BALANCE',
      category: 'SATURATION_BALANCE',
      colorLayer: ColorKnowledgeLayer.FASHION_STYLING_CONVENTION,
      authorityTierCeiling: SourceAuthorityTier.TIER_D,
      reviewStatus: ReviewCandidateStatus.PENDING_SOURCE,
      multiSourceNotes: [],
      expectedAdviceEffect: 'Offer saturation-balance alternatives when both pieces are highly saturated',
      reviewerDecision: 'NEEDS_SOURCE',
      reviewerNotes: 'Convention — qualify',
      rule: draftRule({
        ruleId: 'FK5_RC_COLOR_SATURATION_BALANCE',
        knowledgeType: KnowledgeType.CONVENTION,
        domain: FashionRuleDomain.COLOR,
        provenanceSourceId: 'fk5_gap_saturation_balance',
        subjectivity: SubjectivityLevel.MEDIUM_SUBJECTIVITY,
        conditions: [
          {
            field: ConditionField.OUTFIT_EVALUATION_EVIDENCE,
            operator: ConditionOperator.CONTAINS,
            value: 'saturation_both_high',
          },
        ],
        pattern: {
          patternId: 'pat_saturation_balance',
          adviceTypeHint: FashionAdviceType.REDUCE_CONTRAST,
          structuredSuggestion:
            'Reducing saturation on one dominant piece is one path to lower chromatic competition',
          allowsMultipleAlternatives: true,
        },
        rationale:
          'Paired high saturation increases chromatic energy; balancing saturation is a conventional control lever',
        applicability: [
          {
            applicabilityId: 'app_sat_both_high',
            notes: 'Both dominant colors high saturation',
          },
        ],
        exceptions: [
          {
            exceptionId: 'ex_bold_keep_sat',
            description: 'Bold preference keeps both saturations',
            whenValues: ['bold', 'statement'],
            blocksAdvice: false,
            notes: 'Do not override preference',
          },
        ],
      }),
    }),
    pack({
      candidateId: 'FK5_RC_COLOR_METALLIC_ACCENT',
      category: 'METALLIC_ACCENT',
      colorLayer: ColorKnowledgeLayer.FASHION_STYLING_CONVENTION,
      authorityTierCeiling: SourceAuthorityTier.TIER_D,
      reviewStatus: ReviewCandidateStatus.PENDING_SOURCE,
      multiSourceNotes: [],
      expectedAdviceEffect: 'Treat metallic as supporting accent, not third dominant hue by default',
      reviewerDecision: 'NEEDS_SOURCE',
      reviewerNotes: 'Placeholder convention — accessories domain deferred to FK-6',
      rule: draftRule({
        ruleId: 'FK5_RC_COLOR_METALLIC_ACCENT',
        knowledgeType: KnowledgeType.CONVENTION,
        domain: FashionRuleDomain.COLOR,
        provenanceSourceId: 'fk5_gap_metallic_accent',
        subjectivity: SubjectivityLevel.MEDIUM_SUBJECTIVITY,
        conditions: [
          {
            field: ConditionField.METALLIC,
            operator: ConditionOperator.EXISTS,
          },
        ],
        pattern: {
          patternId: 'pat_metallic_support',
          adviceTypeHint: FashionAdviceType.BALANCE_COLOR,
          structuredSuggestion:
            'Metallic elements often function as supporting accents rather than a third competing dominant hue',
          allowsMultipleAlternatives: true,
        },
        rationale:
          'Metallics commonly read as accent/support relative to chromatic garment dominants',
        applicability: [
          {
            applicabilityId: 'app_metallic_present',
            notes: 'Metallic attribute present — not full accessory rules (FK-6)',
          },
        ],
      }),
    }),
  ]);
