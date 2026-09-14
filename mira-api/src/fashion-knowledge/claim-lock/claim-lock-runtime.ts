/**
 * FK-2 — Fashion Claim Lock runtime.
 * Deterministic: same candidate + context + version → same result.
 * No wall-clock; trend checks use context.clock.nowIso only.
 */
import {
  ClaimLockDecision,
  ClaimLockGateId,
  ClaimLockReasonCode,
  type ClaimLockGateResult,
  type FashionClaimLockResult,
  type GateOutcome,
} from '../contracts/claim-lock';
import { PublicClaimStrength } from '../contracts/claim-strength';
import {
  KnowledgeConfidence,
  capConfidenceForLlm,
  confidenceRank,
} from '../contracts/confidence';
import { ConflictState } from '../contracts/conflicts';
import {
  KnowledgeType,
  knowledgeTypePolicy,
} from '../contracts/knowledge-types';
import {
  ProvenanceApprovalStatus,
  ProvenanceSourceType,
  isFalseCuratedAttribution,
} from '../contracts/provenance';
import {
  SubjectivityLevel,
  capClaimStrengthBySubjectivity,
  subjectivityPolicy,
} from '../contracts/subjectivity';
import { isFashionAdviceType } from '../contracts/advice-types';
import {
  CandidateSourceType,
  type FashionAdviceCandidate,
} from '../advice/advice-candidate';
import type { FashionClaimLockContext } from '../runtime/evaluation-context';
import { validateToneSafety } from '../validation/tone-safety';
import { FASHION_CLAIM_LOCK_VERSION } from '../versioning/release';

function gate(
  gateId: ClaimLockGateId,
  outcome: GateOutcome,
  reasonCodes: readonly string[],
  detail?: string,
): ClaimLockGateResult {
  return { gateId, outcome, reasonCodes, detail };
}

function worstDecision(
  outcomes: readonly GateOutcome[],
): ClaimLockDecision {
  if (outcomes.includes('block')) return ClaimLockDecision.BLOCK;
  if (outcomes.includes('clarify')) return ClaimLockDecision.NEED_CLARIFICATION;
  if (outcomes.includes('qualify')) {
    return ClaimLockDecision.PASS_WITH_QUALIFICATION;
  }
  return ClaimLockDecision.PASS;
}

function deriveClaimStrength(
  candidate: FashionAdviceCandidate,
  decision: ClaimLockDecision,
): PublicClaimStrength {
  if (
    decision === ClaimLockDecision.BLOCK ||
    decision === ClaimLockDecision.NEED_CLARIFICATION
  ) {
    return PublicClaimStrength.UNAVAILABLE;
  }

  const typeCeiling = knowledgeTypePolicy(candidate.knowledgeType).claimCeiling;
  let strength = capClaimStrengthBySubjectivity(
    typeCeiling,
    candidate.subjectivity,
  );

  if (
    candidate.sourceType === CandidateSourceType.LLM_GENERAL_KNOWLEDGE ||
    candidate.knowledgeType === KnowledgeType.LLM_GENERAL_KNOWLEDGE
  ) {
    strength = capClaimStrengthBySubjectivity(
      PublicClaimStrength.QUALIFIED_SUGGESTION,
      candidate.subjectivity,
    );
  }

  if (
    candidate.subjectivity === SubjectivityLevel.HIGH_SUBJECTIVITY &&
    (strength === PublicClaimStrength.ESTABLISHED_GUIDANCE ||
      strength === PublicClaimStrength.FACTUAL_RELATIONSHIP)
  ) {
    strength = PublicClaimStrength.QUALIFIED_SUGGESTION;
  }

  if (decision === ClaimLockDecision.PASS_WITH_QUALIFICATION) {
    if (
      strength === PublicClaimStrength.ESTABLISHED_GUIDANCE ||
      strength === PublicClaimStrength.FACTUAL_RELATIONSHIP
    ) {
      strength = PublicClaimStrength.QUALIFIED_SUGGESTION;
    }
  }

  return strength as PublicClaimStrength;
}

export function evaluateFashionClaimLock(
  candidate: FashionAdviceCandidate,
  context: FashionClaimLockContext,
): FashionClaimLockResult {
  const gates: ClaimLockGateResult[] = [];
  const qualificationCodes: string[] = [];
  const blockedClaims: string[] = [];
  const clarificationNeeds: string[] = [];

  // G1 — Canonical/context input validity
  if (
    !candidate.candidateId ||
    !candidate.schemaVersion ||
    !candidate.createdAt ||
    candidate.targetRefs.length === 0
  ) {
    gates.push(
      gate(
        ClaimLockGateId.G1_INPUT_VALIDITY,
        'block',
        [ClaimLockReasonCode.INVALID_INPUT],
        'Missing required candidate fields',
      ),
    );
  } else {
    gates.push(
      gate(ClaimLockGateId.G1_INPUT_VALIDITY, 'pass', []),
    );
  }

  // G2 — Advice type allowed
  if (!isFashionAdviceType(candidate.adviceType)) {
    gates.push(
      gate(ClaimLockGateId.G2_ADVICE_TYPE_ALLOWED, 'block', [
        ClaimLockReasonCode.INVALID_ADVICE_TYPE,
      ]),
    );
  } else {
    gates.push(gate(ClaimLockGateId.G2_ADVICE_TYPE_ALLOWED, 'pass', []));
  }

  // G3 — Knowledge type classified
  if (!candidate.knowledgeType) {
    gates.push(
      gate(ClaimLockGateId.G3_KNOWLEDGE_TYPE_CLASSIFIED, 'block', [
        ClaimLockReasonCode.MISSING_KNOWLEDGE_TYPE,
      ]),
    );
  } else {
    gates.push(gate(ClaimLockGateId.G3_KNOWLEDGE_TYPE_CLASSIFIED, 'pass', []));
  }

  // G4 — Subjectivity declared
  if (!candidate.subjectivity) {
    gates.push(
      gate(ClaimLockGateId.G4_SUBJECTIVITY_DECLARED, 'block', [
        ClaimLockReasonCode.MISSING_SUBJECTIVITY,
      ]),
    );
  } else {
    const pol = subjectivityPolicy(candidate.subjectivity);
    if (pol.requiresQualification) {
      qualificationCodes.push(ClaimLockReasonCode.QUALIFIED_SUBJECTIVITY);
      gates.push(
        gate(ClaimLockGateId.G4_SUBJECTIVITY_DECLARED, 'qualify', [
          ClaimLockReasonCode.QUALIFIED_SUBJECTIVITY,
        ]),
      );
    } else {
      gates.push(gate(ClaimLockGateId.G4_SUBJECTIVITY_DECLARED, 'pass', []));
    }
  }

  // G5 — Provenance declared
  if (!candidate.provenance || !candidate.provenanceState) {
    gates.push(
      gate(ClaimLockGateId.G5_PROVENANCE_DECLARED, 'block', [
        ClaimLockReasonCode.MISSING_PROVENANCE,
      ]),
    );
  } else if (
    candidate.knowledgeType === KnowledgeType.LLM_GENERAL_KNOWLEDGE ||
    candidate.sourceType === CandidateSourceType.LLM_GENERAL_KNOWLEDGE
  ) {
    const ok =
      candidate.provenance.sourceType ===
        ProvenanceSourceType.LLM_GENERAL_KNOWLEDGE &&
      candidate.provenanceState === ProvenanceApprovalStatus.UNCURATED &&
      candidate.provenance.approvalStatus ===
        ProvenanceApprovalStatus.UNCURATED;
    if (!ok) {
      gates.push(
        gate(ClaimLockGateId.G5_PROVENANCE_DECLARED, 'block', [
          ClaimLockReasonCode.LLM_AS_CURATED,
        ]),
      );
    } else {
      qualificationCodes.push(ClaimLockReasonCode.QUALIFIED_LLM);
      gates.push(
        gate(ClaimLockGateId.G5_PROVENANCE_DECLARED, 'qualify', [
          ClaimLockReasonCode.QUALIFIED_LLM,
        ]),
      );
    }
  } else {
    gates.push(gate(ClaimLockGateId.G5_PROVENANCE_DECLARED, 'pass', []));
  }

  // G6 — Evidence references resolve
  const unresolved = candidate.evidenceRefs.filter(
    (id) => !context.resolvedEvidenceIds.has(id),
  );
  if (candidate.evidenceRefs.length === 0 || unresolved.length > 0) {
    gates.push(
      gate(ClaimLockGateId.G6_EVIDENCE_RESOLVES, 'block', [
        ClaimLockReasonCode.UNRESOLVED_EVIDENCE,
      ], unresolved.join(',')),
    );
  } else {
    gates.push(gate(ClaimLockGateId.G6_EVIDENCE_RESOLVES, 'pass', []));
  }

  // G7 — Rule applicability / allowed knowledge mode
  const hasCuratedRule = candidate.knowledgeRuleIds.some((id) =>
    context.applicableRuleIds.has(id),
  );
  const llmMode =
    candidate.knowledgeType === KnowledgeType.LLM_GENERAL_KNOWLEDGE ||
    candidate.sourceType === CandidateSourceType.LLM_GENERAL_KNOWLEDGE;
  const requiresOccasion =
    candidate.adviceType === 'OCCASION_ADJUSTMENT' ||
    candidate.knowledgeType === KnowledgeType.DRESS_CODE_RULE ||
    candidate.knowledgeRuleIds.some((id) =>
      context.rulesRequiringOccasion?.has(id),
    );

  if (requiresOccasion && context.occasionTokens.size === 0) {
    clarificationNeeds.push(ClaimLockReasonCode.NEED_OCCASION);
    gates.push(
      gate(ClaimLockGateId.G7_APPLICABILITY_SATISFIED, 'clarify', [
        ClaimLockReasonCode.NEED_OCCASION,
      ]),
    );
  } else if (
    candidate.knowledgeType === KnowledgeType.DRESS_CODE_RULE &&
    !context.dressCodeKnown
  ) {
    clarificationNeeds.push(ClaimLockReasonCode.NEED_DRESS_CODE);
    gates.push(
      gate(ClaimLockGateId.G7_APPLICABILITY_SATISFIED, 'clarify', [
        ClaimLockReasonCode.NEED_DRESS_CODE,
      ]),
    );
  } else if (!hasCuratedRule && !llmMode) {
    gates.push(
      gate(ClaimLockGateId.G7_APPLICABILITY_SATISFIED, 'block', [
        ClaimLockReasonCode.APPLICABILITY_FAILED,
      ]),
    );
  } else {
    gates.push(gate(ClaimLockGateId.G7_APPLICABILITY_SATISFIED, 'pass', []));
  }

  // G8 — Known exceptions checked
  let exceptionViolated = false;
  for (const ruleId of candidate.knowledgeRuleIds) {
    const exceptions = context.ruleExceptionsByRuleId?.get(ruleId) ?? [];
    for (const ex of exceptions) {
      if (!ex.blocksAdvice || !ex.whenValues) continue;
      if (
        ex.whenValues.some((v) => context.factTokens.has(v.toLowerCase()))
      ) {
        exceptionViolated = true;
      }
    }
  }
  if (exceptionViolated) {
    gates.push(
      gate(ClaimLockGateId.G8_EXCEPTIONS_CHECKED, 'block', [
        ClaimLockReasonCode.EXCEPTION_VIOLATED,
      ]),
    );
  } else {
    gates.push(gate(ClaimLockGateId.G8_EXCEPTIONS_CHECKED, 'pass', []));
  }

  // G9 — Preference conflict
  if (candidate.preferenceConflict === ConflictState.DIRECT_CONFLICT) {
    gates.push(
      gate(ClaimLockGateId.G9_PREFERENCE_CONFLICT, 'block', [
        ClaimLockReasonCode.PREFERENCE_CONFLICT,
      ]),
    );
  } else if (candidate.preferenceConflict === ConflictState.POSSIBLE_CONFLICT) {
    qualificationCodes.push(ClaimLockReasonCode.PREFERENCE_CONFLICT);
    if (candidate.alternatives.length === 0) {
      clarificationNeeds.push(ClaimLockReasonCode.NEED_STYLE_DIRECTION);
      gates.push(
        gate(ClaimLockGateId.G9_PREFERENCE_CONFLICT, 'clarify', [
          ClaimLockReasonCode.NEED_STYLE_DIRECTION,
          ClaimLockReasonCode.PREFERENCE_CONFLICT,
        ]),
      );
    } else {
      qualificationCodes.push(ClaimLockReasonCode.QUALIFIED_ALTERNATIVES);
      gates.push(
        gate(ClaimLockGateId.G9_PREFERENCE_CONFLICT, 'qualify', [
          ClaimLockReasonCode.PREFERENCE_CONFLICT,
          ClaimLockReasonCode.QUALIFIED_ALTERNATIVES,
        ]),
      );
    }
  } else {
    gates.push(gate(ClaimLockGateId.G9_PREFERENCE_CONFLICT, 'pass', []));
  }

  // G10 — Cultural conflict
  if (candidate.culturalConflict === ConflictState.DIRECT_CONFLICT) {
    if (candidate.alternatives.length === 0) {
      gates.push(
        gate(ClaimLockGateId.G10_CULTURAL_CONFLICT, 'block', [
          ClaimLockReasonCode.CULTURAL_CONFLICT,
        ]),
      );
    } else {
      qualificationCodes.push(ClaimLockReasonCode.CULTURAL_CONFLICT);
      gates.push(
        gate(ClaimLockGateId.G10_CULTURAL_CONFLICT, 'qualify', [
          ClaimLockReasonCode.CULTURAL_CONFLICT,
        ]),
      );
    }
  } else if (candidate.culturalConflict === ConflictState.POSSIBLE_CONFLICT) {
    qualificationCodes.push(ClaimLockReasonCode.CULTURAL_CONFLICT);
    gates.push(
      gate(ClaimLockGateId.G10_CULTURAL_CONFLICT, 'qualify', [
        ClaimLockReasonCode.CULTURAL_CONFLICT,
      ]),
    );
  } else if (
    candidate.knowledgeType === KnowledgeType.CULTURAL_CONVENTION &&
    context.culturalTokens.size === 0
  ) {
    clarificationNeeds.push(ClaimLockReasonCode.NEED_CULTURAL_CONTEXT);
    gates.push(
      gate(ClaimLockGateId.G10_CULTURAL_CONFLICT, 'clarify', [
        ClaimLockReasonCode.NEED_CULTURAL_CONTEXT,
      ]),
    );
  } else {
    gates.push(gate(ClaimLockGateId.G10_CULTURAL_CONFLICT, 'pass', []));
  }

  // G11 — Knowledge confidence sufficient
  let confidence = candidate.confidence;
  if (llmMode) {
    confidence = capConfidenceForLlm(confidence);
    if (candidate.confidence === KnowledgeConfidence.HIGH) {
      qualificationCodes.push(ClaimLockReasonCode.LLM_HIGH_CONFIDENCE);
    }
  }
  if (
    confidence === KnowledgeConfidence.UNVERIFIED &&
    !llmMode
  ) {
    gates.push(
      gate(ClaimLockGateId.G11_CONFIDENCE_SUFFICIENT, 'block', [
        ClaimLockReasonCode.CONFIDENCE_TOO_LOW,
      ]),
    );
  } else if (confidenceRank(confidence) < confidenceRank(KnowledgeConfidence.LOW)) {
    gates.push(
      gate(ClaimLockGateId.G11_CONFIDENCE_SUFFICIENT, 'block', [
        ClaimLockReasonCode.CONFIDENCE_TOO_LOW,
      ]),
    );
  } else if (llmMode || confidence === KnowledgeConfidence.LOW) {
    gates.push(
      gate(ClaimLockGateId.G11_CONFIDENCE_SUFFICIENT, 'qualify', [
        ClaimLockReasonCode.QUALIFIED_LLM,
      ]),
    );
  } else {
    gates.push(gate(ClaimLockGateId.G11_CONFIDENCE_SUFFICIENT, 'pass', []));
  }

  // G12 — No unsupported deterministic claim
  const deterministicFromLlm =
    llmMode &&
    (candidate.suggestion.absoluteClaim ||
      candidate.suggestion.knownRuleWording);
  if (deterministicFromLlm) {
    blockedClaims.push('deterministic_llm_claim');
    gates.push(
      gate(ClaimLockGateId.G12_NO_UNSUPPORTED_DETERMINISTIC, 'block', [
        ClaimLockReasonCode.UNSUPPORTED_DETERMINISTIC_CLAIM,
      ]),
    );
  } else if (
    candidate.suggestion.absoluteClaim &&
    subjectivityPolicy(candidate.subjectivity).absoluteWordingForbidden
  ) {
    blockedClaims.push('absolute_subjective_claim');
    gates.push(
      gate(ClaimLockGateId.G12_NO_UNSUPPORTED_DETERMINISTIC, 'block', [
        ClaimLockReasonCode.UNSUPPORTED_DETERMINISTIC_CLAIM,
      ]),
    );
  } else {
    gates.push(
      gate(ClaimLockGateId.G12_NO_UNSUPPORTED_DETERMINISTIC, 'pass', []),
    );
  }

  // G13 — No false provenance
  const falseProv =
    isFalseCuratedAttribution(
      candidate.provenance,
      context.registeredSourceIds,
    ) ||
    (candidate.claimsExternalPublication === true &&
      !context.registeredSourceIds.has(candidate.provenance.sourceId));
  if (falseProv) {
    blockedClaims.push('false_provenance');
    gates.push(
      gate(ClaimLockGateId.G13_NO_FALSE_PROVENANCE, 'block', [
        ClaimLockReasonCode.FALSE_PROVENANCE,
      ]),
    );
  } else {
    gates.push(gate(ClaimLockGateId.G13_NO_FALSE_PROVENANCE, 'pass', []));
  }

  // G14 — Tone / prohibited claims
  const toneBlob = [
    candidate.currentObservation,
    candidate.suggestion.structuredText,
    candidate.rationale,
    ...candidate.limitations,
  ].join(' ');
  const toneIssues = validateToneSafety(toneBlob);
  if (toneIssues.length > 0) {
    const codes = toneIssues.map((i) => {
      if (i.code === 'ATTRACTIVENESS') {
        return ClaimLockReasonCode.ATTRACTIVENESS_CLAIM;
      }
      if (i.code === 'BODY_SHAMING') return ClaimLockReasonCode.BODY_SHAMING;
      if (i.code === 'BODY_SHAPE_JUDGMENT')
        return ClaimLockReasonCode.BODY_SHAMING;
      if (
        i.code === 'CULTURAL_STEREOTYPE' ||
        i.code === 'CULTURAL_ESSENTIALISM' ||
        i.code === 'MORAL_SHAME_LANGUAGE'
      ) {
        return ClaimLockReasonCode.CULTURAL_CONFLICT;
      }
      if (i.code === 'RELIGIOUS_RULING') {
        return ClaimLockReasonCode.UNSUPPORTED_DETERMINISTIC_CLAIM;
      }
      if (i.code === 'MEDICAL') return ClaimLockReasonCode.MEDICAL_CLAIM;
      if (i.code === 'PROVIDER_LEAKAGE') {
        return ClaimLockReasonCode.PROVIDER_LEAKAGE;
      }
      return ClaimLockReasonCode.PROHIBITED_JUDGMENT;
    });
    blockedClaims.push(...toneIssues.map((i) => i.code));
    gates.push(
      gate(ClaimLockGateId.G14_NO_PROHIBITED_CLAIM, 'block', codes),
    );
  } else {
    gates.push(gate(ClaimLockGateId.G14_NO_PROHIBITED_CLAIM, 'pass', []));
  }

  // G15 — Public narration eligibility
  if (candidate.alternatives.length > 1) {
    qualificationCodes.push(ClaimLockReasonCode.QUALIFIED_ALTERNATIVES);
  }
  if (candidate.knowledgeType === KnowledgeType.TREND) {
    qualificationCodes.push(ClaimLockReasonCode.QUALIFIED_TREND);
  }
  const earlyBlock = gates.some((g) => g.outcome === 'block');
  const earlyClarify = gates.some((g) => g.outcome === 'clarify');
  if (earlyBlock) {
    gates.push(
      gate(ClaimLockGateId.G15_PUBLIC_NARRATION_ELIGIBILITY, 'block', [
        ClaimLockReasonCode.PROHIBITED_JUDGMENT,
      ], 'Narration blocked due to prior gate failure'),
    );
  } else if (earlyClarify) {
    gates.push(
      gate(ClaimLockGateId.G15_PUBLIC_NARRATION_ELIGIBILITY, 'clarify', [
        ...clarificationNeeds,
      ]),
    );
  } else if (
    llmMode ||
    qualificationCodes.length > 0 ||
    candidate.subjectivity !== SubjectivityLevel.LOW_SUBJECTIVITY
  ) {
    gates.push(
      gate(ClaimLockGateId.G15_PUBLIC_NARRATION_ELIGIBILITY, 'qualify', [
        ...new Set(qualificationCodes),
      ]),
    );
  } else {
    gates.push(
      gate(ClaimLockGateId.G15_PUBLIC_NARRATION_ELIGIBILITY, 'pass', []),
    );
  }

  const decision = worstDecision(gates.map((g) => g.outcome));
  const reasonCodes = [
    ...new Set(gates.flatMap((g) => [...g.reasonCodes])),
  ].sort();
  const uniqueQual = [...new Set(qualificationCodes)].sort();
  const uniqueClarify = [...new Set(clarificationNeeds)].sort();
  const uniqueBlocked = [...new Set(blockedClaims)].sort();

  const confidenceCap =
    decision === ClaimLockDecision.PASS_WITH_QUALIFICATION || llmMode
      ? capConfidenceForLlm(
          confidence === KnowledgeConfidence.HIGH
            ? KnowledgeConfidence.MEDIUM
            : confidence,
        )
      : decision === ClaimLockDecision.PASS
        ? confidence
        : KnowledgeConfidence.UNVERIFIED;

  const result: FashionClaimLockResult = {
    decision,
    gateResults: gates,
    reasonCodes,
    qualificationCodes: uniqueQual,
    blockedClaims: uniqueBlocked,
    clarificationNeeds: uniqueClarify,
    allowedCandidateRef:
      decision === ClaimLockDecision.PASS ||
      decision === ClaimLockDecision.PASS_WITH_QUALIFICATION
        ? candidate.candidateId
        : undefined,
    confidenceCap,
    publicClaimStrength: deriveClaimStrength(candidate, decision),
    traceId: context.traceId,
    version: FASHION_CLAIM_LOCK_VERSION,
  };

  return Object.freeze(result);
}
