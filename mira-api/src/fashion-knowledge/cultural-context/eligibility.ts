/**
 * FK-8 — Eligibility + cultural advice types + Mode B cultural policy helpers.
 */
import { FashionAdviceType } from '../contracts/advice-types';
import {
  ClaimLockDecision,
  type FashionClaimLockResult,
} from '../contracts/claim-lock';
import type { FashionAdviceCandidate } from '../advice/advice-candidate';
import { CandidateSourceType } from '../advice/advice-candidate';
import { ProvenanceApprovalStatus } from '../contracts/provenance';
import { KnowledgeType } from '../contracts/knowledge-types';
import { KnowledgeConfidence } from '../contracts/confidence';
import { AdviceQualification } from '../accessories/models';
import { YEAR1_MODE_B_POLICY } from '../accessories/year1-mode-b-policy';
import type { FashionCulturalContext } from './contract';
import { CulturalContextConfidence } from './models';

export const FK8_CULTURAL_ADVICE_TYPES: readonly FashionAdviceType[] =
  Object.freeze([
    FashionAdviceType.PRESERVE_LOOK,
    FashionAdviceType.OCCASION_ADJUSTMENT,
    FashionAdviceType.INCREASE_FORMALITY,
    FashionAdviceType.DECREASE_FORMALITY,
    FashionAdviceType.BALANCE_COLOR,
    FashionAdviceType.REDUCE_CONTRAST,
    FashionAdviceType.NEUTRALIZE_SUPPORTING_ELEMENTS,
    FashionAdviceType.PRESERVE_SUPPORTING_ELEMENTS,
    FashionAdviceType.BALANCE_VOLUME,
    FashionAdviceType.PRESERVE_VOLUME_CONTRAST,
    FashionAdviceType.FABRIC_DIRECTION,
    FashionAdviceType.CLARIFICATION_REQUIRED,
    FashionAdviceType.NO_CHANGE_NEEDED,
  ]);

export const YEAR1_MODE_B_CULTURAL_POLICY = Object.freeze({
  forceUncurated: true,
  forbidLlmCulturalConventionAuthority: true,
  requireCulturalDependencyDeclaration: true,
  requireQualification: true,
  defaultEligibility: 'PASS_WITH_QUALIFICATION' as const,
  axioms: Object.freeze([
    'CULTURE_IS_CONTEXT_NOT_IDENTITY',
    'LOCALE_IS_NOT_IDENTITY',
    'LLM_IS_NOT_CULTURAL_AUTHORITY',
  ]),
});

export interface Fk8ModeBEligibilityResult {
  readonly eligible: boolean;
  readonly reasons: readonly string[];
  readonly qualification: typeof AdviceQualification.UNCURATED_MODEL_GUIDANCE;
  readonly expectedDefaultDecision: typeof YEAR1_MODE_B_POLICY.defaultPublicEligibility;
  readonly forcePublicQualification: boolean;
}

export function evaluateFk8ModeBEligibility(input: {
  readonly candidate?: FashionAdviceCandidate;
  readonly lock?: FashionClaimLockResult;
  readonly cultural?: FashionCulturalContext;
  readonly assumptionsExplicit?: boolean;
}): Fk8ModeBEligibilityResult {
  const reasons: string[] = [];
  const c = input.candidate;
  if (!c) {
    reasons.push('missing_candidate');
  } else {
    if (c.sourceType !== CandidateSourceType.LLM_GENERAL_KNOWLEDGE) {
      reasons.push('source_not_llm');
    }
    if (c.knowledgeType === KnowledgeType.CULTURAL_CONVENTION) {
      reasons.push('llm_cultural_convention_authority_forbidden');
    }
    if (c.knowledgeType !== KnowledgeType.LLM_GENERAL_KNOWLEDGE) {
      reasons.push('knowledge_type_not_llm');
    }
    if (c.provenanceState !== ProvenanceApprovalStatus.UNCURATED) {
      reasons.push('provenance_not_uncurated');
    }
    if (c.confidence === KnowledgeConfidence.HIGH) {
      reasons.push('confidence_not_capped');
    }
    if (!c.subjectivity) reasons.push('subjectivity_missing');
    if (!c.suggestion || c.suggestion.absoluteClaim === true) {
      reasons.push('absolute_or_missing_suggestion');
    }
  }
  if (!input.lock) {
    reasons.push('claim_lock_missing');
  } else if (input.lock.decision === ClaimLockDecision.BLOCK) {
    reasons.push('claim_lock_blocked');
  }
  if (input.assumptionsExplicit === false) {
    reasons.push('assumptions_not_explicit');
  }
  if (
    input.cultural &&
    input.cultural.confidence === CulturalContextConfidence.WEAK &&
    input.cultural.mayInvokeRegionalKnowledgePath
  ) {
    reasons.push('weak_context_cannot_invoke_regional_path');
  }

  return Object.freeze({
    eligible: reasons.length === 0,
    reasons: Object.freeze(reasons),
    qualification: AdviceQualification.UNCURATED_MODEL_GUIDANCE,
    expectedDefaultDecision: YEAR1_MODE_B_POLICY.defaultPublicEligibility,
    forcePublicQualification: true,
  });
}
