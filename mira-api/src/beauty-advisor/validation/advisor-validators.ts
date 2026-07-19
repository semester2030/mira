import type { AdvisorEvidenceEnvelope } from '../contracts/advisor-evidence-envelope';
import type { ConversationPlan } from '../contracts/planner-contracts';
import type { GroundedAdvisorResponse } from '../response/grounded-response-engine';
import { ADVISOR_ENVELOPE_VERSION } from '../release';

export interface AdvisorValidationIssue {
  code: string;
  message: string;
}

export interface AdvisorValidationResult {
  ok: boolean;
  issues: AdvisorValidationIssue[];
}

const KNOWN_SUBSYSTEMS = new Set([
  'skin_intelligence',
  'face_intelligence',
  'wardrobe_foundation',
  'garment_intelligence',
  'outfit_intelligence',
  'styling_intelligence',
  'beauty_experience',
]);

export function validateEnvelopeCompleteness(
  envelope: AdvisorEvidenceEnvelope,
): AdvisorValidationResult {
  const issues: AdvisorValidationIssue[] = [];
  if (!envelope.sealed) {
    issues.push({ code: 'not_sealed', message: 'Envelope must be sealed' });
  }
  if (envelope.version !== ADVISOR_ENVELOPE_VERSION) {
    issues.push({
      code: 'version_mismatch',
      message: `Expected ${ADVISOR_ENVELOPE_VERSION}`,
    });
  }
  if (!envelope.envelopeId || !envelope.sessionId) {
    issues.push({
      code: 'missing_ids',
      message: 'envelopeId and sessionId required',
    });
  }
  if (!envelope.traceability?.traceId) {
    issues.push({
      code: 'missing_trace',
      message: 'traceability.traceId required',
    });
  }
  for (const sid of envelope.subsystemIds) {
    if (!KNOWN_SUBSYSTEMS.has(sid) && sid !== 'unknown') {
      issues.push({
        code: 'invalid_subsystem',
        message: `Unknown subsystem ${sid}`,
      });
    }
  }
  for (const c of envelope.citations) {
    if (!envelope.evidenceIds.includes(c.evidenceId)) {
      issues.push({
        code: 'orphan_citation',
        message: `Citation ${c.citationId} refs unknown evidence`,
      });
    }
  }
  for (const key of envelope.allowedClaims) {
    if (!envelope.claims[key]) {
      issues.push({
        code: 'missing_claim_body',
        message: `allowedClaim ${key} has no claims entry`,
      });
    }
  }
  return { ok: issues.length === 0, issues };
}

/** Law #34 — every cited claim must exist in envelope allowedClaims. */
export function validateLaw34Response(
  envelope: AdvisorEvidenceEnvelope,
  response: GroundedAdvisorResponse,
): AdvisorValidationResult {
  const issues: AdvisorValidationIssue[] = [];
  for (const key of response.citedClaimKeys) {
    if (!envelope.allowedClaims.includes(key)) {
      issues.push({
        code: 'law34_unknown_claim',
        message: `Claim ${key} not in envelope`,
      });
    }
    if (envelope.forbiddenClaims.includes(key)) {
      issues.push({
        code: 'forbidden_claim',
        message: `Claim ${key} is forbidden`,
      });
    }
    if (!envelope.claims[key]) {
      issues.push({
        code: 'claim_without_evidence',
        message: `Claim ${key} has no evidence body`,
      });
    }
  }
  for (const cid of response.citationIds) {
    if (!envelope.citations.some((c) => c.citationId === cid)) {
      issues.push({
        code: 'missing_citation',
        message: `Citation ${cid} not in envelope`,
      });
    }
  }
  if (
    response.answerAr.includes('score=') ||
    /invented|hallucin/i.test(response.answerAr)
  ) {
    issues.push({
      code: 'suspicious_invention',
      message: 'Response appears to invent content',
    });
  }
  return { ok: issues.length === 0, issues };
}

export function validatePlannerConsistency(
  envelope: AdvisorEvidenceEnvelope,
  plan: ConversationPlan,
): AdvisorValidationResult {
  const issues: AdvisorValidationIssue[] = [];
  for (const key of plan.selectedClaimKeys) {
    if (!envelope.allowedClaims.includes(key)) {
      issues.push({
        code: 'planner_unknown_claim',
        message: `Planner selected ${key} outside envelope`,
      });
    }
  }
  if (
    plan.answerStrategy === 'grounded' &&
    plan.selectedClaimKeys.length === 0
  ) {
    issues.push({
      code: 'planner_empty_grounded',
      message: 'Grounded strategy requires selected claims',
    });
  }
  return { ok: issues.length === 0, issues };
}

export function validateExpiredEvidence(
  envelope: AdvisorEvidenceEnvelope,
): AdvisorValidationResult {
  const issues: AdvisorValidationIssue[] = [];
  if (envelope.freshness.stale) {
    issues.push({
      code: 'expired_evidence',
      message: 'Envelope freshness marked stale',
    });
  }
  if (envelope.limitations.includes('stale_or_expired_evidence')) {
    issues.push({
      code: 'stale_limitation',
      message: 'Envelope lists stale_or_expired_evidence',
    });
  }
  return { ok: issues.length === 0, issues };
}

/** Grounded narration is forbidden when expiry validation fails. */
export function assertFreshForGrounded(
  envelope: AdvisorEvidenceEnvelope,
  plan: ConversationPlan,
): void {
  if (plan.answerStrategy !== 'grounded') return;
  const expiry = validateExpiredEvidence(envelope);
  if (!expiry.ok) {
    throw new Error(
      `Stale grounded narration blocked: ${expiry.issues.map((i) => i.code).join(',')}`,
    );
  }
}

export function assertValidEnvelope(envelope: AdvisorEvidenceEnvelope): void {
  const r = validateEnvelopeCompleteness(envelope);
  if (!r.ok) {
    throw new Error(
      `Invalid Advisor Evidence Envelope: ${r.issues.map((i) => i.code).join(',')}`,
    );
  }
}

export function assertPlannerConsistency(
  envelope: AdvisorEvidenceEnvelope,
  plan: ConversationPlan,
): void {
  const r = validatePlannerConsistency(envelope, plan);
  if (!r.ok) {
    throw new Error(
      `Planner consistency failure: ${r.issues.map((i) => i.code).join(',')}`,
    );
  }
  if (
    plan.answerStrategy === 'grounded' &&
    (envelope.freshness.stale || plan.selectedClaimKeys.length === 0)
  ) {
    throw new Error('Planner consistency failure: grounded_requires_fresh_claims');
  }
}

export function assertLaw34(
  envelope: AdvisorEvidenceEnvelope,
  response: GroundedAdvisorResponse,
): void {
  const r = validateLaw34Response(envelope, response);
  if (!r.ok) {
    throw new Error(
      `Law #34 violation: ${r.issues.map((i) => i.code).join(',')}`,
    );
  }
  if (!response.law34Compliant) {
    throw new Error('Law #34 violation: law34Compliant_flag_false');
  }
}
