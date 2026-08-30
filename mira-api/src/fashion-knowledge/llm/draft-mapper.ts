/**
 * FK-3 — Deterministic draft → FashionAdviceCandidate mapper.
 * Never trusts provider-supplied provenance.
 */
import {
  CandidateSourceType,
  CandidateStatus,
  PresentationEligibility,
  type FashionAdviceCandidate,
  type FashionAdviceCandidateDraft,
} from '../advice/advice-candidate';
import { ConflictState } from '../contracts/conflicts';
import {
  ProvenanceApprovalStatus,
  llmUncuratedProvenance,
} from '../contracts/provenance';
import { SubjectivityLevel } from '../contracts/subjectivity';
import { FASHION_ADVICE_CANDIDATE_VERSION } from '../versioning/release';
import { applyLlmConfidenceCap } from './confidence-cap';
import { resolveLlmKnowledgeType } from './knowledge-type-policy';
import type { FashionLlmKnowledgeRequest } from './request-contract';
import { createHash } from 'node:crypto';

function stableHash(parts: readonly string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 24);
}

export function mapLlmDraftToCandidate(input: {
  readonly draft: FashionAdviceCandidateDraft;
  readonly request: FashionLlmKnowledgeRequest;
  readonly hasApprovedSupportingRule?: boolean;
}): FashionAdviceCandidate {
  const { draft, request } = input;
  const kt = resolveLlmKnowledgeType(
    draft.knowledgeType,
    input.hasApprovedSupportingRule === true,
  );
  const confidence = applyLlmConfidenceCap(
    draft.confidenceEstimate,
    draft.subjectivity,
  );

  const candidateId = `fk3_llm_${stableHash([
    draft.draftId,
    draft.adviceType,
    draft.currentObservation,
    draft.suggestion.structuredText,
    draft.rationale,
    draft.subjectivity,
    request.traceId,
    request.clockNowIso,
    ...draft.evidenceRefs,
  ])}`;

  const limitations = [
    ...new Set([
      ...(draft.limitations ?? []),
      'LLM_GENERAL_KNOWLEDGE — uncurated Mode B; not Mira established principle',
      ...(draft.assumptions ?? []).map((a) => `assumption:${a}`),
    ]),
  ];

  const preferenceConflict =
    draft.preferenceConflict ?? ConflictState.UNKNOWN;
  const culturalConflict = draft.culturalConflict ?? ConflictState.NO_CONFLICT;

  // Prefer alternatives for subjective / preference-sensitive advice
  const alternatives = draft.alternatives ?? [];

  const occasionContext =
    request.occasion != null
      ? [request.occasion, ...(draft.occasionContext ?? [])].filter(
          (v, i, a) => a.indexOf(v) === i,
        )
      : undefined;

  return {
    candidateId,
    schemaVersion: FASHION_ADVICE_CANDIDATE_VERSION,
    adviceType: draft.adviceType,
    targetRefs: draft.targetRefs,
    currentObservation: draft.currentObservation,
    suggestion: {
      ...draft.suggestion,
      absoluteClaim: false,
      knownRuleWording: false,
    },
    rationale: draft.rationale,
    knowledgeRuleIds: [], // LLM drafts never invent curated rule ids
    knowledgeType: kt.type,
    sourceType: CandidateSourceType.LLM_GENERAL_KNOWLEDGE,
    provenanceState: ProvenanceApprovalStatus.UNCURATED,
    provenance: llmUncuratedProvenance(`llm_adapter:${request.requestId}`),
    evidenceRefs: draft.evidenceRefs,
    confidence,
    subjectivity: draft.subjectivity ?? SubjectivityLevel.HIGH_SUBJECTIVITY,
    occasionContext,
    preferenceConflict,
    culturalConflict,
    limitations,
    alternatives,
    presentationEligibility: PresentationEligibility.ELIGIBLE_QUALIFIED,
    status: CandidateStatus.READY_FOR_LOCK,
    traceId: request.traceId,
    createdAt: draft.createdAt || request.clockNowIso,
    claimsExternalPublication: false,
  };
}
