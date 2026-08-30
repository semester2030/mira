/**
 * FK-6 — Year-1 Mode B eligibility + accessory advice type set.
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
import { AdviceQualification } from './models';
import { YEAR1_MODE_B_POLICY } from './year1-mode-b-policy';

export const FK6_ACCESSORY_ADVICE_TYPES: readonly FashionAdviceType[] =
  Object.freeze([
    FashionAdviceType.ADD_ACCESSORY,
    FashionAdviceType.REMOVE_ACCESSORY,
    FashionAdviceType.SIMPLIFY_ACCESSORIES,
    FashionAdviceType.CHANGE_ACCESSORY,
    FashionAdviceType.CHANGE_ACCESSORY_DIRECTION,
    FashionAdviceType.CHANGE_SHOE_DIRECTION,
    FashionAdviceType.CHANGE_BAG_DIRECTION,
    FashionAdviceType.JEWELRY_DIRECTION,
    FashionAdviceType.NEUTRALIZE_SUPPORTING_ELEMENTS,
    FashionAdviceType.PRESERVE_SUPPORTING_ELEMENTS,
    FashionAdviceType.PRESERVE_LOOK,
    FashionAdviceType.BALANCE_COLOR,
    FashionAdviceType.REDUCE_CONTRAST,
    FashionAdviceType.INCREASE_FORMALITY,
    FashionAdviceType.DECREASE_FORMALITY,
    FashionAdviceType.OCCASION_ADJUSTMENT,
    FashionAdviceType.CLARIFICATION_REQUIRED,
    FashionAdviceType.NO_CHANGE_NEEDED,
  ]);

export interface ModeBEligibilityResult {
  readonly eligible: boolean;
  readonly reasons: readonly string[];
  readonly qualification: typeof AdviceQualification.UNCURATED_MODEL_GUIDANCE;
  readonly expectedDefaultDecision: typeof YEAR1_MODE_B_POLICY.defaultPublicEligibility;
  /** LLM PASS is never treated as authoritative Mira PASS. */
  readonly forcePublicQualification: boolean;
}

export function evaluateModeBEligibility(input: {
  readonly candidate?: FashionAdviceCandidate;
  readonly lock?: FashionClaimLockResult;
  readonly assumptionsExplicit?: boolean;
}): ModeBEligibilityResult {
  const reasons: string[] = [];
  const c = input.candidate;
  if (!c) {
    reasons.push('missing_candidate');
  } else {
    if (c.sourceType !== CandidateSourceType.LLM_GENERAL_KNOWLEDGE) {
      reasons.push('source_not_llm');
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

  const forcePublicQualification =
    c?.knowledgeType === KnowledgeType.LLM_GENERAL_KNOWLEDGE;

  return Object.freeze({
    eligible: reasons.length === 0,
    reasons: Object.freeze(reasons),
    qualification: AdviceQualification.UNCURATED_MODEL_GUIDANCE,
    expectedDefaultDecision: YEAR1_MODE_B_POLICY.defaultPublicEligibility,
    forcePublicQualification: forcePublicQualification === true,
  });
}
