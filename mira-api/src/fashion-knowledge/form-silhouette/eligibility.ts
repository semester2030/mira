/**
 * FK-7 — Year-1 Mode B eligibility + form/silhouette advice types.
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
import { EvidenceSufficiency } from './models';

export const FK7_FORM_ADVICE_TYPES: readonly FashionAdviceType[] =
  Object.freeze([
    FashionAdviceType.FABRIC_DIRECTION,
    FashionAdviceType.BALANCE_VOLUME,
    FashionAdviceType.PRESERVE_VOLUME_CONTRAST,
    FashionAdviceType.SIMPLIFY_TEXTURE,
    FashionAdviceType.PRESERVE_TEXTURE_CONTRAST,
    FashionAdviceType.ADJUST_LAYERING_DIRECTION,
    FashionAdviceType.INCREASE_STRUCTURE,
    FashionAdviceType.INCREASE_FLUIDITY,
    FashionAdviceType.SIMPLIFY_SILHOUETTE,
    FashionAdviceType.PRESERVE_STATEMENT_SILHOUETTE,
    FashionAdviceType.ADJUST_LENGTH_RELATIONSHIP,
    FashionAdviceType.INCREASE_FORMALITY,
    FashionAdviceType.DECREASE_FORMALITY,
    FashionAdviceType.PRESERVE_LOOK,
    FashionAdviceType.NEUTRALIZE_SUPPORTING_ELEMENTS,
    FashionAdviceType.PRESERVE_SUPPORTING_ELEMENTS,
    FashionAdviceType.OCCASION_ADJUSTMENT,
    FashionAdviceType.CLARIFICATION_REQUIRED,
    FashionAdviceType.NO_CHANGE_NEEDED,
  ]);

export interface Fk7ModeBEligibilityResult {
  readonly eligible: boolean;
  readonly reasons: readonly string[];
  readonly qualification: typeof AdviceQualification.UNCURATED_MODEL_GUIDANCE;
  readonly expectedDefaultDecision: typeof YEAR1_MODE_B_POLICY.defaultPublicEligibility;
  readonly forcePublicQualification: boolean;
}

export function evaluateFk7ModeBEligibility(input: {
  readonly candidate?: FashionAdviceCandidate;
  readonly lock?: FashionClaimLockResult;
  readonly assumptionsExplicit?: boolean;
  readonly evidenceSufficiency?: string;
}): Fk7ModeBEligibilityResult {
  const reasons: string[] = [];
  if (
    input.evidenceSufficiency === EvidenceSufficiency.INSUFFICIENT_EVIDENCE ||
    input.evidenceSufficiency === EvidenceSufficiency.NEED_CLARIFICATION
  ) {
    reasons.push('insufficient_form_evidence');
  }
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

  return Object.freeze({
    eligible: reasons.length === 0,
    reasons: Object.freeze(reasons),
    qualification: AdviceQualification.UNCURATED_MODEL_GUIDANCE,
    expectedDefaultDecision: YEAR1_MODE_B_POLICY.defaultPublicEligibility,
    forcePublicQualification:
      c?.knowledgeType === KnowledgeType.LLM_GENERAL_KNOWLEDGE,
  });
}
