/**
 * FK-5 — Human review pack builder.
 */
import type { FashionKnowledgeReviewCandidate } from './review-candidate';
import { FK5_COLOR_REVIEW_CANDIDATES } from './review-candidates-color';
import { FK5_OCCASION_REVIEW_CANDIDATES } from './review-candidates-occasion';

export interface HumanReviewPackEntry {
  readonly ruleId: string;
  readonly normalizedPrinciple: string;
  readonly sourceId: string;
  readonly sourceType: string;
  readonly locator: string;
  readonly knowledgeType: string;
  readonly domain: string;
  readonly subjectivity: string;
  readonly confidence: string;
  readonly applicability: string;
  readonly exceptions: string;
  readonly rationale: string;
  readonly expectedAdviceEffect: string;
  readonly reviewerDecision: string;
  readonly reviewerNotes: string;
  readonly sourcingGap: boolean;
  readonly reviewStatus: string;
}

export function buildHumanReviewPack(
  candidates: readonly FashionKnowledgeReviewCandidate[] = [
    ...FK5_COLOR_REVIEW_CANDIDATES,
    ...FK5_OCCASION_REVIEW_CANDIDATES,
  ],
): readonly HumanReviewPackEntry[] {
  return Object.freeze(
    candidates.map((c) =>
      Object.freeze({
        ruleId: c.rule.ruleId,
        normalizedPrinciple: c.rule.recommendationPattern.structuredSuggestion,
        sourceId: c.rule.provenance.sourceId,
        sourceType: c.rule.provenance.sourceType,
        locator: c.rule.provenance.referenceLocator ?? '(none — sourcing gap)',
        knowledgeType: c.rule.knowledgeType,
        domain: c.rule.domain,
        subjectivity: c.rule.subjectivity,
        confidence: c.rule.confidence,
        applicability: c.rule.applicability.map((a) => a.applicabilityId).join(','),
        exceptions: c.rule.exceptions.map((e) => e.exceptionId).join(',') || '(none)',
        rationale: c.rule.rationale,
        expectedAdviceEffect: c.expectedAdviceEffect,
        reviewerDecision: c.reviewerDecision,
        reviewerNotes: c.reviewerNotes,
        sourcingGap: c.sourcingGap,
        reviewStatus: c.reviewStatus,
      }),
    ),
  );
}
