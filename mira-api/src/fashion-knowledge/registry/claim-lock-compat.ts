/**
 * FK-4 — Claim Lock compatibility check for registry rules.
 */
import type { FashionKnowledgeRule } from '../knowledge/fashion-knowledge-rule';
import { isKnowledgeType } from '../contracts/knowledge-types';
import { isSubjectivityLevel } from '../contracts/subjectivity';
import { isKnowledgeConfidence } from '../contracts/confidence';
import {
  isProvenanceApprovalStatus,
  isProvenanceSourceType,
} from '../contracts/provenance';

export interface ClaimLockCompatResult {
  readonly ok: boolean;
  readonly missing: readonly string[];
}

/** Verify a registry rule carries metadata FK-2 Claim Lock requires. */
export function checkRuleClaimLockCompatibility(
  rule: FashionKnowledgeRule,
): ClaimLockCompatResult {
  const missing: string[] = [];
  if (!isKnowledgeType(rule.knowledgeType)) missing.push('knowledgeType');
  if (!rule.provenance || !isProvenanceSourceType(rule.provenance.sourceType)) {
    missing.push('provenance');
  }
  if (
    !rule.provenance ||
    !isProvenanceApprovalStatus(rule.provenance.approvalStatus)
  ) {
    missing.push('provenance.approvalStatus');
  }
  if (!isSubjectivityLevel(rule.subjectivity)) missing.push('subjectivity');
  if (!isKnowledgeConfidence(rule.confidence)) missing.push('confidence');
  if (!rule.applicability) missing.push('applicability');
  if (!rule.exceptions) missing.push('exceptions');
  if (!rule.culturalContext) missing.push('culturalContext');
  if (!rule.occasionContext) missing.push('occasionContext');
  if (!rule.status || !rule.lifecycle) missing.push('lifecycle');
  return { ok: missing.length === 0, missing };
}
