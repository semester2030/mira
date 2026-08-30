/**
 * FK-2 — LLM candidate policy contract (for future FK-3; no wiring here).
 */
import { KnowledgeConfidence } from '../contracts/confidence';
import { ProvenanceApprovalStatus, ProvenanceSourceType } from '../contracts/provenance';
import { KnowledgeType } from '../contracts/knowledge-types';
import { CandidateSourceType } from '../advice/advice-candidate';
import type { FashionAdviceCandidateDraft } from '../advice/advice-candidate';
import { FASHION_LLM_POLICY_VERSION } from '../versioning/release';

export interface LlmCandidatePolicy {
  readonly version: typeof FASHION_LLM_POLICY_VERSION;
  readonly requiredSourceType: typeof CandidateSourceType.LLM_GENERAL_KNOWLEDGE;
  readonly requiredKnowledgeType: typeof KnowledgeType.LLM_GENERAL_KNOWLEDGE;
  readonly requiredProvenanceSourceType: typeof ProvenanceSourceType.LLM_GENERAL_KNOWLEDGE;
  readonly requiredApprovalStatus: typeof ProvenanceApprovalStatus.UNCURATED;
  readonly confidenceCap: typeof KnowledgeConfidence.MEDIUM;
  readonly allowFabricatedCitations: false;
  readonly allowFinalPublicAdvice: false;
}

export const LLM_CANDIDATE_POLICY: LlmCandidatePolicy = Object.freeze({
  version: FASHION_LLM_POLICY_VERSION,
  requiredSourceType: CandidateSourceType.LLM_GENERAL_KNOWLEDGE,
  requiredKnowledgeType: KnowledgeType.LLM_GENERAL_KNOWLEDGE,
  requiredProvenanceSourceType: ProvenanceSourceType.LLM_GENERAL_KNOWLEDGE,
  requiredApprovalStatus: ProvenanceApprovalStatus.UNCURATED,
  confidenceCap: KnowledgeConfidence.MEDIUM,
  allowFabricatedCitations: false,
  allowFinalPublicAdvice: false,
});

export interface LlmDraftValidationIssue {
  readonly code: string;
  readonly message: string;
}

/** Validate that a future LLM draft obeys FK-3 contract shape (no network). */
export function validateLlmCandidateDraft(
  draft: FashionAdviceCandidateDraft,
): { ok: boolean; issues: LlmDraftValidationIssue[] } {
  const issues: LlmDraftValidationIssue[] = [];
  if (!draft.draftId) {
    issues.push({ code: 'missing_draft_id', message: 'draftId required' });
  }
  if (!draft.subjectivity) {
    issues.push({
      code: 'missing_subjectivity',
      message: 'subjectivity required for LLM drafts',
    });
  }
  if (draft.suggestion.knownRuleWording) {
    issues.push({
      code: 'known_rule_wording',
      message: 'LLM draft cannot claim known curated rule wording',
    });
  }
  if (draft.suggestion.absoluteClaim) {
    issues.push({
      code: 'absolute_claim',
      message: 'LLM draft cannot make absolute fashion truth claims',
    });
  }
  const blob = `${draft.rationale} ${draft.suggestion.structuredText}`.toLowerCase();
  if (
    /\b(dior|chanel|vogue editorial)\b/.test(blob) &&
    !draft.evidenceRefs.some((r) => r.startsWith('registered_source:'))
  ) {
    issues.push({
      code: 'fabricated_citation',
      message: 'Citation-like language without registered source evidence',
    });
  }
  return { ok: issues.length === 0, issues };
}
