/**
 * FK-5A — Evidence class requirements per candidate (no rewriting).
 */
export const EvidenceClass = {
  COLOR_MATH_REFERENCE: 'COLOR_MATH_REFERENCE',
  COLOR_THEORY_REFERENCE: 'COLOR_THEORY_REFERENCE',
  FASHION_STYLING_REFERENCE: 'FASHION_STYLING_REFERENCE',
  FORMALITY_REFERENCE: 'FORMALITY_REFERENCE',
  DRESS_CODE_REFERENCE: 'DRESS_CODE_REFERENCE',
  OCCASION_REFERENCE: 'OCCASION_REFERENCE',
  DAY_EVENING_REFERENCE: 'DAY_EVENING_REFERENCE',
} as const;

export type EvidenceClass =
  (typeof EvidenceClass)[keyof typeof EvidenceClass];

export interface CandidateSourceRequirement {
  readonly ruleId: string;
  readonly domain: string;
  readonly normalizedPrinciple: string;
  readonly knowledgeType: string;
  readonly subjectivity: string;
  readonly currentConfidence: string;
  readonly applicabilityIds: readonly string[];
  readonly exceptionIds: readonly string[];
  readonly currentSourcingState: 'SOURCING_GAP' | string;
  readonly requiredEvidenceClasses: readonly EvidenceClass[];
  readonly notes: string;
}

import { FK5_COLOR_REVIEW_CANDIDATES } from '../curated/review-candidates-color';
import { FK5_OCCASION_REVIEW_CANDIDATES } from '../curated/review-candidates-occasion';
import { ColorKnowledgeLayer } from '../curated/color-theory-vs-styling';
import { FASHION_KNOWLEDGE_SOURCING_GAP } from '../versioning/release';

function fromCandidate(
  ruleId: string,
  domain: string,
  principle: string,
  knowledgeType: string,
  subjectivity: string,
  confidence: string,
  applicabilityIds: readonly string[],
  exceptionIds: readonly string[],
  requiredEvidenceClasses: readonly EvidenceClass[],
  notes: string,
): CandidateSourceRequirement {
  return Object.freeze({
    ruleId,
    domain,
    normalizedPrinciple: principle,
    knowledgeType,
    subjectivity,
    currentConfidence: confidence,
    applicabilityIds: Object.freeze([...applicabilityIds]),
    exceptionIds: Object.freeze([...exceptionIds]),
    currentSourcingState: FASHION_KNOWLEDGE_SOURCING_GAP,
    requiredEvidenceClasses: Object.freeze([...requiredEvidenceClasses]),
    notes,
  });
}

/** Inventory of all 17 FK-5 candidates with required evidence classes. */
export function buildFk5aCandidateInventory(): readonly CandidateSourceRequirement[] {
  const color = FK5_COLOR_REVIEW_CANDIDATES.map((c) => {
    const classes: EvidenceClass[] =
      c.colorLayer === ColorKnowledgeLayer.COLOR_THEORY_FACT
        ? [EvidenceClass.COLOR_MATH_REFERENCE, EvidenceClass.COLOR_THEORY_REFERENCE]
        : [
            EvidenceClass.FASHION_STYLING_REFERENCE,
            EvidenceClass.COLOR_THEORY_REFERENCE,
          ];
    return fromCandidate(
      c.rule.ruleId,
      c.rule.domain,
      c.rule.recommendationPattern.structuredSuggestion,
      c.rule.knowledgeType,
      c.rule.subjectivity,
      c.rule.confidence,
      c.rule.applicability.map((a) => a.applicabilityId),
      c.rule.exceptions.map((e) => e.exceptionId),
      classes,
      `FK-5A requirement for ${c.category}; colorLayer=${c.colorLayer ?? 'n/a'}`,
    );
  });

  const occasion = FK5_OCCASION_REVIEW_CANDIDATES.map((c) => {
    let classes: EvidenceClass[] = [EvidenceClass.OCCASION_REFERENCE];
    if (c.category === 'DRESS_CODE_EXPECTATION') {
      classes = [EvidenceClass.DRESS_CODE_REFERENCE, EvidenceClass.FORMALITY_REFERENCE];
    } else if (c.category === 'DAY_VS_EVENING') {
      classes = [
        EvidenceClass.DAY_EVENING_REFERENCE,
        EvidenceClass.OCCASION_REFERENCE,
      ];
    } else if (c.category === 'COLOR_INTENSITY_CONTEXT') {
      classes = [
        EvidenceClass.OCCASION_REFERENCE,
        EvidenceClass.FORMALITY_REFERENCE,
        EvidenceClass.FASHION_STYLING_REFERENCE,
      ];
    } else if (c.category === 'OCCASION_FORMALITY') {
      classes = [
        EvidenceClass.OCCASION_REFERENCE,
        EvidenceClass.FORMALITY_REFERENCE,
      ];
    }
    return fromCandidate(
      c.rule.ruleId,
      c.rule.domain,
      c.rule.recommendationPattern.structuredSuggestion,
      c.rule.knowledgeType,
      c.rule.subjectivity,
      c.rule.confidence,
      c.rule.applicability.map((a) => a.applicabilityId),
      c.rule.exceptions.map((e) => e.exceptionId),
      classes,
      `FK-5A requirement for ${c.category}`,
    );
  });

  return Object.freeze([...color, ...occasion]);
}
