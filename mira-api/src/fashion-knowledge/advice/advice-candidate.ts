/**
 * FK-2 — FashionAdviceCandidate (INTERNAL — not final public prose).
 */
import type { FashionAdviceAlternative } from '../contracts/alternatives';
import type { FashionAdviceType } from '../contracts/advice-types';
import type { KnowledgeConfidence } from '../contracts/confidence';
import type { ConflictState } from '../contracts/conflicts';
import type { KnowledgeType } from '../contracts/knowledge-types';
import type {
  FashionProvenance,
  ProvenanceApprovalStatus,
} from '../contracts/provenance';
import type { SubjectivityLevel } from '../contracts/subjectivity';
import { FASHION_ADVICE_CANDIDATE_VERSION } from '../versioning/release';

export const CandidateSourceType = {
  MIRA_CURATED: 'mira_curated',
  LLM_GENERAL_KNOWLEDGE: 'llm_general_knowledge',
  HYBRID: 'hybrid',
} as const;

export type CandidateSourceType =
  (typeof CandidateSourceType)[keyof typeof CandidateSourceType];

export const CandidateStatus = {
  DRAFT: 'DRAFT',
  READY_FOR_LOCK: 'READY_FOR_LOCK',
  LOCKED_PASS: 'LOCKED_PASS',
  LOCKED_QUALIFIED: 'LOCKED_QUALIFIED',
  LOCKED_BLOCK: 'LOCKED_BLOCK',
  LOCKED_CLARIFY: 'LOCKED_CLARIFY',
} as const;

export type CandidateStatus =
  (typeof CandidateStatus)[keyof typeof CandidateStatus];

export const PresentationEligibility = {
  ELIGIBLE: 'ELIGIBLE',
  ELIGIBLE_QUALIFIED: 'ELIGIBLE_QUALIFIED',
  NOT_ELIGIBLE: 'NOT_ELIGIBLE',
  NEEDS_CLARIFICATION: 'NEEDS_CLARIFICATION',
} as const;

export type PresentationEligibility =
  (typeof PresentationEligibility)[keyof typeof PresentationEligibility];

export interface FashionAdviceSuggestion {
  readonly structuredText: string;
  readonly adviceType: FashionAdviceType;
  readonly absoluteClaim: boolean;
  readonly knownRuleWording: boolean;
}

export interface FashionAdviceCandidate {
  readonly candidateId: string;
  readonly schemaVersion: typeof FASHION_ADVICE_CANDIDATE_VERSION | string;
  readonly adviceType: FashionAdviceType;
  readonly targetRefs: readonly string[];
  readonly currentObservation: string;
  readonly suggestion: FashionAdviceSuggestion;
  readonly rationale: string;
  readonly knowledgeRuleIds: readonly string[];
  readonly knowledgeType: KnowledgeType;
  readonly sourceType: CandidateSourceType;
  readonly provenanceState: ProvenanceApprovalStatus;
  readonly provenance: FashionProvenance;
  readonly evidenceRefs: readonly string[];
  readonly confidence: KnowledgeConfidence;
  readonly subjectivity: SubjectivityLevel;
  readonly occasionContext?: readonly string[];
  readonly preferenceConflict: ConflictState;
  readonly culturalConflict: ConflictState;
  readonly limitations: readonly string[];
  readonly alternatives: readonly FashionAdviceAlternative[];
  readonly presentationEligibility: PresentationEligibility;
  readonly status: CandidateStatus;
  readonly traceId?: string;
  readonly createdAt: string;
  /** When true, Claim Lock treats publication citation as unverified. */
  readonly claimsExternalPublication?: boolean;
}

/**
 * Structured LLM draft — never final public advice.
 * FK-3 provider output must map into this shape before Claim Lock.
 */
export interface FashionAdviceCandidateDraft {
  readonly draftId: string;
  readonly schemaVersion: typeof FASHION_ADVICE_CANDIDATE_VERSION | string;
  readonly adviceType: FashionAdviceType;
  readonly targetRefs: readonly string[];
  /** Observation distinct from suggestion. */
  readonly currentObservation: string;
  readonly suggestion: FashionAdviceSuggestion;
  readonly rationale: string;
  readonly evidenceRefs: readonly string[];
  readonly subjectivity: SubjectivityLevel;
  readonly occasionContext?: readonly string[];
  readonly alternatives: readonly FashionAdviceAlternative[];
  readonly limitations: readonly string[];
  readonly createdAt: string;
  readonly traceId?: string;
  /** FK-3 — provider-proposed knowledge type (may be downgraded). */
  readonly knowledgeType?: KnowledgeType;
  /** FK-3 — provider confidence estimate (never trusted as truth). */
  readonly confidenceEstimate?: KnowledgeConfidence;
  readonly preferenceConflict?: ConflictState;
  readonly culturalConflict?: ConflictState;
  /** True when advice depends on occasion being known. */
  readonly occasionDependency?: boolean;
  readonly assumptions?: readonly string[];
  readonly clarificationNeeds?: readonly string[];
  readonly forbiddenClaimDetected?: boolean;
}
