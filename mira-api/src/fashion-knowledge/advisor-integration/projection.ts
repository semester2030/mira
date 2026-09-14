/**
 * FK-10 — Fashion Knowledge Advisor Projection (Claim-Locked facts only).
 * Pure Fashion Knowledge DTO — does NOT import beauty-advisor.
 */
import type { FashionAdviceType } from '../contracts/advice-types';
import type { PublicClaimStrength } from '../contracts/claim-strength';
import type { SubjectivityLevel } from '../contracts/subjectivity';
import type { KnowledgeConfidence } from '../contracts/confidence';
import { FASHION_ADVISOR_PROJECTION_VERSION } from '../versioning/release';

export const FashionAdvisorSourceMode = {
  MODE_A_CURATED: 'MODE_A_CURATED',
  MODE_B_LLM: 'MODE_B_LLM',
  MIXED: 'MIXED',
  NO_KNOWLEDGE: 'NO_KNOWLEDGE',
  UNKNOWN: 'UNKNOWN',
} as const;

export type FashionAdvisorSourceMode =
  (typeof FashionAdvisorSourceMode)[keyof typeof FashionAdvisorSourceMode];

export const FashionAdvisorProjectionKind = {
  SUGGESTION: 'SUGGESTION',
  QUALIFIED_SUGGESTION: 'QUALIFIED_SUGGESTION',
  CLARIFICATION_ONLY: 'CLARIFICATION_ONLY',
  UNAVAILABLE: 'UNAVAILABLE',
  OUT_OF_SCOPE: 'OUT_OF_SCOPE',
} as const;

export type FashionAdvisorProjectionKind =
  (typeof FashionAdvisorProjectionKind)[keyof typeof FashionAdvisorProjectionKind];

export interface FashionAdvisorProjectedAlternative {
  readonly alternativeId: string;
  readonly direction: string;
  readonly expectedStyleEffect: string;
  readonly qualification: string;
  readonly statementAr: string;
}

export interface FashionAdvisorEnvelopeFragment {
  /** Envelope claim key — must be cited by Advisor for Law #34. */
  readonly claimKey: string;
  readonly statementAr: string;
  readonly confidence: 'high' | 'medium' | 'low';
  readonly capabilityId: 'fashion_knowledge';
  readonly sourceRef: string;
  /** Always claim-locked Fashion Knowledge — never frozen GI/OI/SI. */
  readonly provenance: 'fashion_knowledge_claim_locked';
  /** Honest attribution: never claim frozen subsystem ids. */
  readonly subsystemHint: 'unknown';
  readonly stale?: boolean;
  readonly expiresAt?: string;
}

export interface FashionKnowledgeAdvisorProjection {
  readonly projectionId: string;
  readonly schemaVersion: typeof FASHION_ADVISOR_PROJECTION_VERSION | string;
  readonly kind: FashionAdvisorProjectionKind;
  readonly candidateId?: string;
  readonly adviceType?: FashionAdviceType;
  readonly allowedClaimStrength: PublicClaimStrength;
  readonly currentObservation?: string;
  readonly allowedSuggestion?: string;
  readonly rationaleSummary?: string;
  readonly alternatives: readonly FashionAdvisorProjectedAlternative[];
  readonly evidenceRefs: readonly string[];
  readonly ruleRefs: readonly string[];
  readonly sourceMode: FashionAdvisorSourceMode;
  readonly sourceAuthorityClass:
    | 'CURATED'
    | 'UNCURATED_LLM'
    | 'NONE'
    | 'UNKNOWN';
  readonly subjectivity?: SubjectivityLevel;
  readonly confidenceBand?: KnowledgeConfidence;
  readonly qualificationCodes: readonly string[];
  readonly limitations: readonly string[];
  readonly occasionDependency?: boolean;
  readonly preferenceConflict?: boolean;
  readonly culturalConflict?: boolean;
  readonly culturalContextPresent?: boolean;
  readonly clarificationNeeds: readonly string[];
  readonly unavailableReason?: string;
  readonly outOfScopeReason?: string;
  readonly fragments: readonly FashionAdvisorEnvelopeFragment[];
  readonly narrationHints: readonly string[];
  readonly releaseVersion: string;
  readonly registryVersion?: string;
  readonly llmPolicyVersion?: string;
  readonly claimLockDecision: string;
  readonly traceId: string;
  readonly createdAt: string;
}
