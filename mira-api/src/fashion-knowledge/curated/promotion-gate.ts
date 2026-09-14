/**
 * FK-5 — Promotion gate: never fake ACTIVE from LLM / gaps / missing review.
 */
import type { FashionKnowledgeRule } from '../knowledge/fashion-knowledge-rule';
import { RuleLifecycleStatus } from '../knowledge/fashion-knowledge-rule';
import {
  ProvenanceApprovalStatus,
  ProvenanceSourceType,
} from '../contracts/provenance';
import {
  canIndependentlyActivateTier,
  defaultTierForSourceType,
} from './source-authority';
import {
  isActiveEligibleCandidate,
  type FashionKnowledgeReviewCandidate,
} from './review-candidate';

export interface PromotionDecision {
  readonly allowed: boolean;
  readonly reasons: readonly string[];
}

export function evaluatePromotionToActive(
  rule: FashionKnowledgeRule,
  opts?: { readonly humanApprovalProven?: boolean },
): PromotionDecision {
  const reasons: string[] = [];
  const tier = defaultTierForSourceType(rule.provenance.sourceType);

  if (!canIndependentlyActivateTier(tier)) {
    reasons.push(`tier_${tier}_cannot_independently_activate`);
  }
  if (rule.provenance.sourceType === ProvenanceSourceType.LLM_GENERAL_KNOWLEDGE) {
    reasons.push('llm_cannot_activate');
  }
  if (rule.provenance.sourceType === ProvenanceSourceType.UNKNOWN) {
    reasons.push('unknown_source_cannot_activate');
  }
  if (
    rule.provenance.approvalStatus !== ProvenanceApprovalStatus.APPROVED &&
    rule.provenance.approvalStatus !== ProvenanceApprovalStatus.ACTIVE
  ) {
    reasons.push('provenance_not_approved');
  }
  if (!rule.provenance.reviewer) {
    reasons.push('missing_reviewer');
  }
  if (opts?.humanApprovalProven !== true) {
    reasons.push('human_approval_not_proven');
  }
  if (rule.testOnly === true) {
    reasons.push('test_only_forbidden');
  }
  if (
    rule.status === RuleLifecycleStatus.ACTIVE ||
    rule.lifecycle === RuleLifecycleStatus.ACTIVE
  ) {
    // Evaluating whether ACTIVE is allowed — if already ACTIVE without gate, flag
  }

  return {
    allowed: reasons.length === 0,
    reasons: Object.freeze(reasons),
  };
}

export function filterReleaseEligibleCandidates(
  candidates: readonly FashionKnowledgeReviewCandidate[],
  opts?: { readonly humanApprovalProven?: boolean },
): readonly FashionKnowledgeReviewCandidate[] {
  if (opts?.humanApprovalProven !== true) return [];
  return candidates.filter((c) => {
    if (!isActiveEligibleCandidate(c)) return false;
    return evaluatePromotionToActive(c.rule, {
      humanApprovalProven: true,
    }).allowed;
  });
}
