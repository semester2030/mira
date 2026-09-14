/**
 * FK-5A — Review outcomes (no forced approvals).
 */
import type { RuleSourceEvidenceMap } from './evidence-map';
import { EvidenceStrength, SourceCoverage } from './evidence-map';

export const ReviewOutcome = {
  APPROVE: 'APPROVE',
  APPROVE_WITH_NARROWER_SCOPE: 'APPROVE_WITH_NARROWER_SCOPE',
  MERGE: 'MERGE',
  RESEARCH_MORE: 'RESEARCH_MORE',
  REJECT: 'REJECT',
} as const;

export type ReviewOutcome =
  (typeof ReviewOutcome)[keyof typeof ReviewOutcome];

export interface CandidateReviewDecision {
  readonly ruleId: string;
  readonly outcome: ReviewOutcome;
  readonly reason: string;
  readonly narrowedPrinciple?: string;
  readonly mergeTargetRuleId?: string;
  readonly systemReviewState: 'RESEARCHED' | 'REVIEWED_BY_SYSTEM' | 'PENDING';
  /** Never true unless a real authorized human reviewer is recorded. */
  readonly humanApproved: boolean;
}

export interface HumanReviewRecord {
  readonly reviewerRef: string;
  readonly reviewerRole: string;
  readonly reviewedAt: string;
  readonly decision: ReviewOutcome;
  readonly notes: string;
  /** Must be proven externally — never invent. */
  readonly authorizationProven: boolean;
}

export function decideReviewOutcome(
  map: RuleSourceEvidenceMap,
  opts?: {
    readonly human?: HumanReviewRecord;
    readonly rejectReason?: string;
    readonly mergeTargetRuleId?: string;
  },
): CandidateReviewDecision {
  if (opts?.rejectReason) {
    return {
      ruleId: map.ruleId,
      outcome: ReviewOutcome.REJECT,
      reason: opts.rejectReason,
      systemReviewState: 'REVIEWED_BY_SYSTEM',
      humanApproved: false,
    };
  }
  if (opts?.mergeTargetRuleId) {
    return {
      ruleId: map.ruleId,
      outcome: ReviewOutcome.MERGE,
      reason: `Merge into ${opts.mergeTargetRuleId}`,
      mergeTargetRuleId: opts.mergeTargetRuleId,
      systemReviewState: 'REVIEWED_BY_SYSTEM',
      humanApproved: false,
    };
  }

  if (map.sourceCoverage === SourceCoverage.NONE) {
    return {
      ruleId: map.ruleId,
      outcome: ReviewOutcome.RESEARCH_MORE,
      reason: 'SOURCING_REQUIRED — zero supporting sources',
      systemReviewState: 'RESEARCHED',
      humanApproved: false,
    };
  }

  if (map.sourceCoverage === SourceCoverage.PARTIAL) {
    return {
      ruleId: map.ruleId,
      outcome: ReviewOutcome.RESEARCH_MORE,
      reason:
        'PARTIAL source coverage — narrow only after human confirms; SOURCING_REQUIRED for missing classes',
      systemReviewState: 'RESEARCHED',
      humanApproved: false,
    };
  }

  // FULL coverage still needs human if governance requires it
  if (
    opts?.human?.authorizationProven === true &&
    (opts.human.decision === ReviewOutcome.APPROVE ||
      opts.human.decision === ReviewOutcome.APPROVE_WITH_NARROWER_SCOPE)
  ) {
    return {
      ruleId: map.ruleId,
      outcome: opts.human.decision,
      reason: opts.human.notes,
      narrowedPrinciple:
        opts.human.decision === ReviewOutcome.APPROVE_WITH_NARROWER_SCOPE
          ? opts.human.notes
          : undefined,
      systemReviewState: 'REVIEWED_BY_SYSTEM',
      humanApproved: true,
    };
  }

  if (map.evidenceStrength === EvidenceStrength.STRONG || map.evidenceStrength === EvidenceStrength.MODERATE) {
    return {
      ruleId: map.ruleId,
      outcome: ReviewOutcome.RESEARCH_MORE,
      reason:
        'Sources present but human approval not proven — cannot APPROVE',
      systemReviewState: 'RESEARCHED',
      humanApproved: false,
    };
  }

  return {
    ruleId: map.ruleId,
    outcome: ReviewOutcome.RESEARCH_MORE,
    reason: 'Insufficient evidence strength',
    systemReviewState: 'RESEARCHED',
    humanApproved: false,
  };
}

/** Detect fake human review attempts. */
export function validateHumanReviewRecord(
  record: HumanReviewRecord,
): { ok: boolean; issues: readonly string[] } {
  const issues: string[] = [];
  if (!record.authorizationProven) {
    issues.push('authorization_not_proven');
  }
  const blob = `${record.reviewerRef} ${record.notes}`.toLowerCase();
  for (const m of ['fake', 'chatgpt', 'auto-approve', 'placeholder reviewer']) {
    if (blob.includes(m)) issues.push(`fabricated_reviewer_marker:${m}`);
  }
  if (!record.reviewerRef || record.reviewerRef.length < 2) {
    issues.push('missing_reviewer_ref');
  }
  if (!record.reviewedAt) issues.push('missing_reviewed_at');
  return { ok: issues.length === 0, issues: Object.freeze(issues) };
}
