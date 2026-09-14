/**
 * FK-3 — Draft validation before candidate mapping.
 */
import type { FashionAdviceCandidateDraft } from '../advice/advice-candidate';
import { validateLlmCandidateDraft } from '../advice/llm-candidate-policy';
import { isFashionAdviceType } from '../contracts/advice-types';
import { isKnowledgeConfidence } from '../contracts/confidence';
import { isConflictState } from '../contracts/conflicts';
import { isKnowledgeType } from '../contracts/knowledge-types';
import { isSubjectivityLevel } from '../contracts/subjectivity';
import { FASHION_ADVICE_CANDIDATE_VERSION } from '../versioning/release';
import { sanitizeStructuredDraftText } from './output-sanitization';
import type { FashionLlmKnowledgeRequest } from './request-contract';

export interface DraftValidationResult {
  readonly ok: boolean;
  readonly issues: readonly { code: string; message: string }[];
}

export function validateFashionLlmDraft(
  draft: FashionAdviceCandidateDraft,
  request: FashionLlmKnowledgeRequest,
): DraftValidationResult {
  const issues: { code: string; message: string }[] = [];
  const base = validateLlmCandidateDraft(draft);
  issues.push(...base.issues);

  if (draft.schemaVersion !== FASHION_ADVICE_CANDIDATE_VERSION) {
    issues.push({
      code: 'invalid_schema_version',
      message: `Expected ${FASHION_ADVICE_CANDIDATE_VERSION}`,
    });
  }
  if (!isFashionAdviceType(draft.adviceType)) {
    issues.push({ code: 'invalid_advice_type', message: 'adviceType invalid' });
  }
  if (
    request.allowedAdviceTypes.length > 0 &&
    !request.allowedAdviceTypes.includes(draft.adviceType)
  ) {
    issues.push({
      code: 'advice_type_not_allowed',
      message: `adviceType ${draft.adviceType} not in allowed set`,
    });
  }
  if (!isSubjectivityLevel(draft.subjectivity)) {
    issues.push({ code: 'missing_subjectivity', message: 'subjectivity required' });
  }
  if (draft.knowledgeType && !isKnowledgeType(draft.knowledgeType)) {
    issues.push({ code: 'invalid_knowledge_type', message: 'knowledgeType invalid' });
  }
  if (
    draft.confidenceEstimate &&
    !isKnowledgeConfidence(draft.confidenceEstimate)
  ) {
    issues.push({
      code: 'invalid_confidence',
      message: 'confidenceEstimate invalid',
    });
  }
  if (
    draft.preferenceConflict &&
    !isConflictState(draft.preferenceConflict)
  ) {
    issues.push({
      code: 'invalid_preference_conflict',
      message: 'preferenceConflict invalid',
    });
  }
  if (draft.culturalConflict && !isConflictState(draft.culturalConflict)) {
    issues.push({
      code: 'invalid_cultural_conflict',
      message: 'culturalConflict invalid',
    });
  }
  if (!draft.currentObservation?.trim()) {
    issues.push({ code: 'missing_observation', message: 'observation required' });
  }
  if (!draft.evidenceRefs?.length) {
    issues.push({ code: 'missing_evidence', message: 'evidenceRefs required' });
  }
  const unresolved = (draft.evidenceRefs ?? []).filter(
    (id) => !request.evidenceRefs.includes(id),
  );
  if (unresolved.length > 0) {
    issues.push({
      code: 'unresolved_evidence',
      message: `Unknown evidence refs: ${unresolved.join(',')}`,
    });
  }
  if (draft.forbiddenClaimDetected === true) {
    issues.push({
      code: 'forbidden_claim_flag',
      message: 'Provider flagged forbidden claim',
    });
  }

  const blob = [
    draft.currentObservation,
    draft.suggestion?.structuredText ?? '',
    draft.rationale,
    ...(draft.limitations ?? []),
    ...(draft.assumptions ?? []),
  ].join(' ');
  for (const s of sanitizeStructuredDraftText(blob)) {
    issues.push({ code: s.code, message: s.message });
  }

  // Invented occasion: draft claims occasion not in request
  if (
    draft.occasionContext?.length &&
    !request.occasion &&
    draft.occasionContext.some((o) => o.toLowerCase() !== 'unknown')
  ) {
    issues.push({
      code: 'invented_occasion',
      message: 'Draft invents occasion not present in request',
    });
  }

  return { ok: issues.length === 0, issues };
}
