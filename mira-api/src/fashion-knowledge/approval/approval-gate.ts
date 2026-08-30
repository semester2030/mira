/**
 * FK-5A — Approval / promotion gate to ACTIVE.
 */
import { KnowledgeConfidence } from '../contracts/confidence';
import type { FashionKnowledgeRule } from '../knowledge/fashion-knowledge-rule';
import { evaluatePromotionToActive } from '../curated/promotion-gate';
import type { IngestedFashionSource } from './source-ingest';
import { validateIngestedSource } from './source-ingest';
import type { RuleSourceEvidenceMap } from './evidence-map';
import { SourceCoverage } from './evidence-map';
import type { CandidateReviewDecision } from './review-outcomes';
import { ReviewOutcome, validateHumanReviewRecord, type HumanReviewRecord } from './review-outcomes';
import { FASHION_KNOWLEDGE_APPROVAL_GATE_VERSION } from '../versioning/release';

export interface ApprovalGateResult {
  readonly schemaVersion: typeof FASHION_KNOWLEDGE_APPROVAL_GATE_VERSION | string;
  readonly ruleId: string;
  readonly allowed: boolean;
  readonly reasons: readonly string[];
  readonly recalibratedConfidence: KnowledgeConfidence;
}

export function recalibrateConfidence(input: {
  readonly map: RuleSourceEvidenceMap;
  readonly humanApproved: boolean;
  readonly subjectivity: string;
}): KnowledgeConfidence {
  if (input.map.sourceCoverage === SourceCoverage.NONE) {
    return KnowledgeConfidence.UNVERIFIED;
  }
  if (input.map.sourceCoverage === SourceCoverage.PARTIAL) {
    return KnowledgeConfidence.LOW;
  }
  if (!input.humanApproved) {
    return KnowledgeConfidence.LOW;
  }
  if (
    input.subjectivity === 'HIGH_SUBJECTIVITY' ||
    input.subjectivity === 'TREND_DEPENDENT' ||
    input.subjectivity === 'USER_DEPENDENT'
  ) {
    return KnowledgeConfidence.MEDIUM;
  }
  if (input.map.supportingSourceIds.length >= 2) {
    return KnowledgeConfidence.HIGH;
  }
  return KnowledgeConfidence.MEDIUM;
}

export function evaluateApprovalGate(input: {
  readonly rule: FashionKnowledgeRule;
  readonly map: RuleSourceEvidenceMap;
  readonly decision: CandidateReviewDecision;
  readonly sources: readonly IngestedFashionSource[];
  readonly human?: HumanReviewRecord;
}): ApprovalGateResult {
  const reasons: string[] = [];

  if (
    input.decision.outcome !== ReviewOutcome.APPROVE &&
    input.decision.outcome !== ReviewOutcome.APPROVE_WITH_NARROWER_SCOPE
  ) {
    reasons.push(`outcome_${input.decision.outcome}_not_approvable`);
  }
  if (!input.decision.humanApproved) {
    reasons.push('human_approval_required');
  }
  if (input.human) {
    const hv = validateHumanReviewRecord(input.human);
    if (!hv.ok) reasons.push(...hv.issues.map((i) => `human:${i}`));
  } else {
    reasons.push('human_record_missing');
  }
  if (input.map.sourceCoverage === SourceCoverage.NONE) {
    reasons.push('source_coverage_none');
  }
  if (input.map.conflictingSourceIds.length > 0) {
    reasons.push('unresolved_source_conflict');
  }
  if (input.map.supportingSourceIds.length === 0) {
    reasons.push('no_supporting_sources');
  }

  for (const sid of input.map.supportingSourceIds) {
    const src = input.sources.find((s) => s.sourceId === sid);
    if (!src) {
      reasons.push(`missing_source:${sid}`);
      continue;
    }
    const v = validateIngestedSource(src);
    if (!v.maySupportActivation) {
      reasons.push(`source_cannot_activate:${sid}`);
    }
  }

  const promo = evaluatePromotionToActive(input.rule, {
    humanApprovalProven: input.decision.humanApproved === true,
  });
  if (!promo.allowed) {
    reasons.push(...promo.reasons.map((r) => `promo:${r}`));
  }

  const confidence = recalibrateConfidence({
    map: input.map,
    humanApproved: input.decision.humanApproved,
    subjectivity: input.rule.subjectivity,
  });

  return Object.freeze({
    schemaVersion: FASHION_KNOWLEDGE_APPROVAL_GATE_VERSION,
    ruleId: input.rule.ruleId,
    allowed: reasons.length === 0,
    reasons: Object.freeze(reasons),
    recalibratedConfidence: confidence,
  });
}
