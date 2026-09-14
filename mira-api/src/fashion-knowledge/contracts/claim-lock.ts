/**
 * FK-2 — Claim Lock contract (result + gate ids).
 */
import type { PublicClaimStrength } from './claim-strength';
import type { KnowledgeConfidence } from './confidence';
import { FASHION_CLAIM_LOCK_VERSION } from '../versioning/release';

export const ClaimLockDecision = {
  PASS: 'PASS',
  PASS_WITH_QUALIFICATION: 'PASS_WITH_QUALIFICATION',
  BLOCK: 'BLOCK',
  NEED_CLARIFICATION: 'NEED_CLARIFICATION',
} as const;

export type ClaimLockDecision =
  (typeof ClaimLockDecision)[keyof typeof ClaimLockDecision];

export const ClaimLockGateId = {
  G1_INPUT_VALIDITY: 'G1_INPUT_VALIDITY',
  G2_ADVICE_TYPE_ALLOWED: 'G2_ADVICE_TYPE_ALLOWED',
  G3_KNOWLEDGE_TYPE_CLASSIFIED: 'G3_KNOWLEDGE_TYPE_CLASSIFIED',
  G4_SUBJECTIVITY_DECLARED: 'G4_SUBJECTIVITY_DECLARED',
  G5_PROVENANCE_DECLARED: 'G5_PROVENANCE_DECLARED',
  G6_EVIDENCE_RESOLVES: 'G6_EVIDENCE_RESOLVES',
  G7_APPLICABILITY_SATISFIED: 'G7_APPLICABILITY_SATISFIED',
  G8_EXCEPTIONS_CHECKED: 'G8_EXCEPTIONS_CHECKED',
  G9_PREFERENCE_CONFLICT: 'G9_PREFERENCE_CONFLICT',
  G10_CULTURAL_CONFLICT: 'G10_CULTURAL_CONFLICT',
  G11_CONFIDENCE_SUFFICIENT: 'G11_CONFIDENCE_SUFFICIENT',
  G12_NO_UNSUPPORTED_DETERMINISTIC: 'G12_NO_UNSUPPORTED_DETERMINISTIC',
  G13_NO_FALSE_PROVENANCE: 'G13_NO_FALSE_PROVENANCE',
  G14_NO_PROHIBITED_CLAIM: 'G14_NO_PROHIBITED_CLAIM',
  G15_PUBLIC_NARRATION_ELIGIBILITY: 'G15_PUBLIC_NARRATION_ELIGIBILITY',
} as const;

export type ClaimLockGateId =
  (typeof ClaimLockGateId)[keyof typeof ClaimLockGateId];

export const ALL_CLAIM_LOCK_GATES: readonly ClaimLockGateId[] = Object.freeze(
  Object.values(ClaimLockGateId),
);

export type GateOutcome = 'pass' | 'qualify' | 'block' | 'clarify';

export interface ClaimLockGateResult {
  readonly gateId: ClaimLockGateId;
  readonly outcome: GateOutcome;
  readonly reasonCodes: readonly string[];
  readonly detail?: string;
}

export interface FashionClaimLockResult {
  readonly decision: ClaimLockDecision;
  readonly gateResults: readonly ClaimLockGateResult[];
  readonly reasonCodes: readonly string[];
  readonly qualificationCodes: readonly string[];
  readonly blockedClaims: readonly string[];
  readonly clarificationNeeds: readonly string[];
  readonly allowedCandidateRef?: string;
  readonly confidenceCap?: KnowledgeConfidence;
  readonly publicClaimStrength: PublicClaimStrength;
  readonly traceId: string;
  readonly version: typeof FASHION_CLAIM_LOCK_VERSION | string;
}

export const ClaimLockReasonCode = {
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_ADVICE_TYPE: 'INVALID_ADVICE_TYPE',
  MISSING_KNOWLEDGE_TYPE: 'MISSING_KNOWLEDGE_TYPE',
  MISSING_SUBJECTIVITY: 'MISSING_SUBJECTIVITY',
  MISSING_PROVENANCE: 'MISSING_PROVENANCE',
  UNRESOLVED_EVIDENCE: 'UNRESOLVED_EVIDENCE',
  APPLICABILITY_FAILED: 'APPLICABILITY_FAILED',
  EXCEPTION_VIOLATED: 'EXCEPTION_VIOLATED',
  PREFERENCE_CONFLICT: 'PREFERENCE_CONFLICT',
  CULTURAL_CONFLICT: 'CULTURAL_CONFLICT',
  CONFIDENCE_TOO_LOW: 'CONFIDENCE_TOO_LOW',
  UNSUPPORTED_DETERMINISTIC_CLAIM: 'UNSUPPORTED_DETERMINISTIC_CLAIM',
  FALSE_PROVENANCE: 'FALSE_PROVENANCE',
  PROHIBITED_JUDGMENT: 'PROHIBITED_JUDGMENT',
  ATTRACTIVENESS_CLAIM: 'ATTRACTIVENESS_CLAIM',
  BODY_SHAMING: 'BODY_SHAMING',
  MEDICAL_CLAIM: 'MEDICAL_CLAIM',
  LLM_AS_CURATED: 'LLM_AS_CURATED',
  LLM_HIGH_CONFIDENCE: 'LLM_HIGH_CONFIDENCE',
  NEED_OCCASION: 'NEED_OCCASION',
  NEED_STYLE_DIRECTION: 'NEED_STYLE_DIRECTION',
  NEED_DRESS_CODE: 'NEED_DRESS_CODE',
  NEED_CULTURAL_CONTEXT: 'NEED_CULTURAL_CONTEXT',
  NEED_PREFERENCE: 'NEED_PREFERENCE',
  NEED_GARMENT_STATE: 'NEED_GARMENT_STATE',
  QUALIFIED_LLM: 'QUALIFIED_LLM',
  QUALIFIED_SUBJECTIVITY: 'QUALIFIED_SUBJECTIVITY',
  QUALIFIED_TREND: 'QUALIFIED_TREND',
  QUALIFIED_ALTERNATIVES: 'QUALIFIED_ALTERNATIVES',
  PROVIDER_LEAKAGE: 'PROVIDER_LEAKAGE',
} as const;

export type ClaimLockReasonCode =
  (typeof ClaimLockReasonCode)[keyof typeof ClaimLockReasonCode];
