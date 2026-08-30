/**
 * FK-10 — Eligibility mapping: Claim Lock → Advisor-safe projection.
 * BLOCK never projects suggestion content.
 */
import { createHash } from 'crypto';
import {
  ClaimLockDecision,
  type FashionClaimLockResult,
} from '../contracts/claim-lock';
import type { FashionAdviceCandidate } from '../advice/advice-candidate';
import { CandidateSourceType } from '../advice/advice-candidate';
import { PublicClaimStrength } from '../contracts/claim-strength';
import {
  FASHION_ADVISOR_PROJECTION_VERSION,
  FASHION_KNOWLEDGE_RELEASE,
  FASHION_LLM_POLICY_VERSION,
} from '../versioning/release';
import {
  FashionAdvisorProjectionKind,
  FashionAdvisorSourceMode,
  type FashionAdvisorEnvelopeFragment,
  type FashionAdvisorProjectedAlternative,
  type FashionKnowledgeAdvisorProjection,
} from './projection';
import { narrateAlternativeAr, narrateSuggestionAr } from './narration';

function hashId(prefix: string, payload: string, len = 16): string {
  return `${prefix}_${createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, len)}`;
}

function sourceModeFromCandidate(
  candidate?: FashionAdviceCandidate,
): {
  mode: FashionAdvisorSourceMode;
  authority: FashionKnowledgeAdvisorProjection['sourceAuthorityClass'];
} {
  if (!candidate) {
    return { mode: FashionAdvisorSourceMode.NO_KNOWLEDGE, authority: 'NONE' };
  }
  if (candidate.sourceType === CandidateSourceType.MIRA_CURATED) {
    return { mode: FashionAdvisorSourceMode.MODE_A_CURATED, authority: 'CURATED' };
  }
  if (candidate.sourceType === CandidateSourceType.HYBRID) {
    return { mode: FashionAdvisorSourceMode.MIXED, authority: 'UNCURATED_LLM' };
  }
  return {
    mode: FashionAdvisorSourceMode.MODE_B_LLM,
    authority: 'UNCURATED_LLM',
  };
}

function claimKey(candidateId: string, suffix: string): string {
  return `fashion.knowledge.${suffix}.${candidateId}`;
}

function toConfidence(
  band?: string,
): 'high' | 'medium' | 'low' {
  if (band === 'HIGH') return 'high';
  if (band === 'LOW' || band === 'VERY_LOW') return 'low';
  return 'medium';
}

function mapAlternatives(
  candidate: FashionAdviceCandidate,
): FashionAdvisorProjectedAlternative[] {
  return candidate.alternatives.slice(0, 5).map((a) => ({
    alternativeId: a.alternativeId,
    direction: a.direction,
    expectedStyleEffect: a.expectedStyleEffect,
    qualification: a.qualification,
    statementAr: narrateAlternativeAr(a.direction, a.qualification),
  }));
}

/**
 * Map Claim Lock result → projection. Never includes blocked suggestion/rationale.
 */
export function projectClaimLockedCandidate(input: {
  readonly candidate?: FashionAdviceCandidate;
  readonly lock: FashionClaimLockResult;
  readonly clockNowIso: string;
  readonly registryVersion?: string;
  readonly culturalContextPresent?: boolean;
  readonly stale?: boolean;
}): FashionKnowledgeAdvisorProjection {
  const { lock, candidate, clockNowIso } = input;
  const src = sourceModeFromCandidate(candidate);
  const projectionId = hashId(
    'fkp',
    `${lock.traceId}|${lock.decision}|${candidate?.candidateId ?? 'none'}`,
  );

  const base = {
    projectionId,
    schemaVersion: FASHION_ADVISOR_PROJECTION_VERSION,
    evidenceRefs: candidate?.evidenceRefs ?? [],
    ruleRefs: candidate?.knowledgeRuleIds ?? [],
    sourceMode: src.mode,
    sourceAuthorityClass: src.authority,
    subjectivity: candidate?.subjectivity,
    confidenceBand: lock.confidenceCap ?? candidate?.confidence,
    qualificationCodes: [...lock.qualificationCodes],
    limitations: [...(candidate?.limitations ?? [])],
    preferenceConflict:
      candidate?.preferenceConflict === 'POSSIBLE_CONFLICT' ||
      candidate?.preferenceConflict === 'DIRECT_CONFLICT',
    culturalConflict:
      candidate?.culturalConflict === 'POSSIBLE_CONFLICT' ||
      candidate?.culturalConflict === 'DIRECT_CONFLICT',
    culturalContextPresent: input.culturalContextPresent === true,
    clarificationNeeds: [...lock.clarificationNeeds],
    releaseVersion: FASHION_KNOWLEDGE_RELEASE,
    registryVersion: input.registryVersion,
    llmPolicyVersion:
      src.mode === FashionAdvisorSourceMode.MODE_B_LLM
        ? FASHION_LLM_POLICY_VERSION
        : undefined,
    claimLockDecision: lock.decision,
    traceId: lock.traceId,
    createdAt: clockNowIso,
  } as const;

  if (lock.decision === ClaimLockDecision.BLOCK) {
    const fragments: FashionAdvisorEnvelopeFragment[] = [
      {
        claimKey: claimKey(candidate?.candidateId ?? 'blocked', 'unavailable'),
        statementAr:
          'لا تتوفر نصيحة أزياء مؤهلة حاليًا ضمن معرفة الأزياء لهذه الإطلالة.',
        confidence: 'high',
        capabilityId: 'fashion_knowledge',
        sourceRef: candidate?.candidateId ?? lock.traceId,
        provenance: 'fashion_knowledge_claim_locked',
        subsystemHint: 'unknown',
        stale: input.stale === true,
      },
    ];
    return {
      ...base,
      kind: FashionAdvisorProjectionKind.UNAVAILABLE,
      candidateId: candidate?.candidateId,
      adviceType: candidate?.adviceType,
      allowedClaimStrength: PublicClaimStrength.UNAVAILABLE,
      alternatives: [],
      unavailableReason: lock.reasonCodes.join(',') || 'BLOCK',
      fragments,
      narrationHints: ['NO_SUGGESTION', 'DO_NOT_PARAPHRASE_BLOCKED'],
    };
  }

  if (lock.decision === ClaimLockDecision.NEED_CLARIFICATION) {
    const needs = lock.clarificationNeeds.length
      ? lock.clarificationNeeds
      : ['NEED_CONTEXT'];
    const clarifyAr = narrateClarificationAr(needs);
    const fragments: FashionAdvisorEnvelopeFragment[] = [
      {
        claimKey: claimKey(candidate?.candidateId ?? 'clarify', 'clarification'),
        statementAr: clarifyAr,
        confidence: 'medium',
        capabilityId: 'fashion_knowledge',
        sourceRef: candidate?.candidateId ?? lock.traceId,
        provenance: 'fashion_knowledge_claim_locked',
        subsystemHint: 'unknown',
        stale: input.stale === true,
      },
    ];
    return {
      ...base,
      kind: FashionAdvisorProjectionKind.CLARIFICATION_ONLY,
      candidateId: candidate?.candidateId,
      adviceType: candidate?.adviceType,
      allowedClaimStrength: PublicClaimStrength.UNAVAILABLE,
      alternatives: [],
      clarificationNeeds: needs,
      fragments,
      narrationHints: ['ASK_CLARIFICATION_ONLY', 'NO_GUESS'],
    };
  }

  if (!candidate) {
    return projectNoKnowledge({
      clockNowIso,
      traceId: lock.traceId,
      reason: 'NO_CANDIDATE_AFTER_LOCK',
    });
  }

  const qualified =
    lock.decision === ClaimLockDecision.PASS_WITH_QUALIFICATION;
  const strength = lock.publicClaimStrength;
  const suggestionAr = narrateSuggestionAr({
    suggestion: candidate.suggestion.structuredText,
    strength,
    qualified,
    preferenceConflict: base.preferenceConflict,
  });
  const observationAr = candidate.currentObservation
    ? `ملاحظة على الإطلالة: ${candidate.currentObservation}`
    : undefined;
  const rationaleAr = candidate.rationale
    ? narrateRationaleAr(candidate.rationale, strength)
    : undefined;
  const alternatives = mapAlternatives(candidate);

  const fragments: FashionAdvisorEnvelopeFragment[] = [];
  if (observationAr) {
    fragments.push({
      claimKey: claimKey(candidate.candidateId, 'observation'),
      statementAr: observationAr,
      confidence: toConfidence(candidate.confidence),
      capabilityId: 'fashion_knowledge',
      sourceRef: candidate.candidateId,
      provenance: 'fashion_knowledge_claim_locked',
      subsystemHint: 'unknown',
      stale: input.stale === true,
    });
  }
  fragments.push({
    claimKey: claimKey(candidate.candidateId, 'suggestion'),
    statementAr: suggestionAr,
    confidence: toConfidence(lock.confidenceCap ?? candidate.confidence),
    capabilityId: 'fashion_knowledge',
    sourceRef: candidate.candidateId,
    provenance: 'fashion_knowledge_claim_locked',
    subsystemHint: 'unknown',
    stale: input.stale === true,
  });
  if (rationaleAr) {
    fragments.push({
      claimKey: claimKey(candidate.candidateId, 'rationale'),
      statementAr: rationaleAr,
      confidence: toConfidence(candidate.confidence),
      capabilityId: 'fashion_knowledge',
      sourceRef: candidate.candidateId,
      provenance: 'fashion_knowledge_claim_locked',
      subsystemHint: 'unknown',
      stale: input.stale === true,
    });
  }
  for (const alt of alternatives) {
    fragments.push({
      claimKey: claimKey(candidate.candidateId, `alt.${alt.alternativeId}`),
      statementAr: alt.statementAr,
      confidence: 'medium',
      capabilityId: 'fashion_knowledge',
      sourceRef: alt.alternativeId,
      provenance: 'fashion_knowledge_claim_locked',
      subsystemHint: 'unknown',
      stale: input.stale === true,
    });
  }
  if (qualified || src.authority === 'UNCURATED_LLM') {
    fragments.push({
      claimKey: claimKey(candidate.candidateId, 'qualification'),
      statementAr:
        'هذا توجيه اختياري مبني على معرفة عامة غير مراجعة كقاعدة ميرا معتمدة — وليس مبدأ أزياء رسميًا من ميرا.',
      confidence: 'high',
      capabilityId: 'fashion_knowledge',
      sourceRef: candidate.candidateId,
      provenance: 'fashion_knowledge_claim_locked',
      subsystemHint: 'unknown',
      stale: input.stale === true,
    });
  }

  return {
    ...base,
    kind: qualified
      ? FashionAdvisorProjectionKind.QUALIFIED_SUGGESTION
      : FashionAdvisorProjectionKind.SUGGESTION,
    candidateId: candidate.candidateId,
    adviceType: candidate.adviceType,
    allowedClaimStrength: strength,
    currentObservation: candidate.currentObservation,
    allowedSuggestion: candidate.suggestion.structuredText,
    rationaleSummary: candidate.rationale,
    alternatives,
    occasionDependency: candidate.occasionContext?.length
      ? true
      : undefined,
    fragments,
    narrationHints: qualified
      ? [
          'OPTION_NOT_TRUTH',
          'CONDITIONAL_LANGUAGE',
          'NO_AUTHORITATIVE_SOURCE_CLAIM',
          'ALTERNATIVES_FROM_PROJECTION_ONLY',
        ]
      : ['ENVELOPE_CLAIMS_ONLY', 'ALTERNATIVES_FROM_PROJECTION_ONLY'],
  };
}

export function projectNoKnowledge(input: {
  readonly clockNowIso: string;
  readonly traceId: string;
  readonly reason: string;
}): FashionKnowledgeAdvisorProjection {
  const projectionId = hashId('fkp', `${input.traceId}|noknowledge`);
  return {
    projectionId,
    schemaVersion: FASHION_ADVISOR_PROJECTION_VERSION,
    kind: FashionAdvisorProjectionKind.UNAVAILABLE,
    allowedClaimStrength: PublicClaimStrength.UNAVAILABLE,
    alternatives: [],
    evidenceRefs: [],
    ruleRefs: [],
    sourceMode: FashionAdvisorSourceMode.NO_KNOWLEDGE,
    sourceAuthorityClass: 'NONE',
    qualificationCodes: [],
    limitations: ['NO_KNOWLEDGE_AVAILABLE'],
    clarificationNeeds: [],
    unavailableReason: input.reason,
    fragments: [
      {
        claimKey: claimKey('none', 'unavailable'),
        statementAr:
          'لا تتوفر معرفة أزياء مؤهلة لهذه الإجابة حاليًا، ولن أقترح تنسيقًا من معرفة عامة غير مقيّدة.',
        confidence: 'high',
        capabilityId: 'fashion_knowledge',
        sourceRef: input.traceId,
        provenance: 'fashion_knowledge_claim_locked',
        subsystemHint: 'unknown',
      },
    ],
    narrationHints: ['NO_GENERIC_FALLBACK', 'HONEST_UNAVAILABLE'],
    releaseVersion: FASHION_KNOWLEDGE_RELEASE,
    claimLockDecision: 'N/A',
    traceId: input.traceId,
    createdAt: input.clockNowIso,
  };
}

export function projectOutOfScope(input: {
  readonly clockNowIso: string;
  readonly traceId: string;
  readonly reason: string;
}): FashionKnowledgeAdvisorProjection {
  const projectionId = hashId('fkp', `${input.traceId}|oos`);
  return {
    projectionId,
    schemaVersion: FASHION_ADVISOR_PROJECTION_VERSION,
    kind: FashionAdvisorProjectionKind.OUT_OF_SCOPE,
    allowedClaimStrength: PublicClaimStrength.UNAVAILABLE,
    alternatives: [],
    evidenceRefs: [],
    ruleRefs: [],
    sourceMode: FashionAdvisorSourceMode.NO_KNOWLEDGE,
    sourceAuthorityClass: 'NONE',
    qualificationCodes: [],
    limitations: ['OUT_OF_SCOPE'],
    clarificationNeeds: [],
    outOfScopeReason: input.reason,
    fragments: [
      {
        claimKey: claimKey('oos', 'outofscope'),
        statementAr:
          'هذا الطلب خارج نطاق معرفة الأزياء في ميرا (مثل الأحكام الدينية). يمكنني المساعدة في تنسيق اختياري عند توفر سياق مناسب، دون إصدار حكم ديني.',
        confidence: 'high',
        capabilityId: 'fashion_knowledge',
        sourceRef: input.traceId,
        provenance: 'fashion_knowledge_claim_locked',
        subsystemHint: 'unknown',
      },
    ],
    narrationHints: ['RELIGIOUS_OUT_OF_SCOPE', 'NO_FASHION_RULING'],
    releaseVersion: FASHION_KNOWLEDGE_RELEASE,
    claimLockDecision: 'N/A',
    traceId: input.traceId,
    createdAt: input.clockNowIso,
  };
}

function narrateClarificationAr(needs: readonly string[]): string {
  const map: Record<string, string> = {
    NEED_OCCASION: 'ما هي المناسبة؟',
    NEED_DRESS_CODE: 'ما هو مستوى الرسمية المطلوب؟',
    NEED_STYLE_DIRECTION: 'هل تفضّلين اتجاهًا أكثر هدوءًا أم أكثر جرأة؟',
    NEED_CULTURAL_CONTEXT:
      'إذا رغبتِ بتوجيه ثقافي، حدّدي السياق صراحةً (لا أستنتجه من اللغة أو الموقع).',
    NEED_PREFERENCE: 'ما هو اتجاه الأسلوب الذي تفضّلينه؟',
    NEED_GARMENT_STATE: 'حدّدي حالة القطع الأساسية الناقصة (مثل الحذاء أو الشنطة).',
    NEED_CONTEXT: 'أحتاج معلومات إضافية قبل اقتراح تنسيق.',
  };
  const parts = needs.map((n) => map[n] ?? n);
  return `لأن المعلومات المتاحة لا تكفي للإجابة بدقة، أحتاج منكِ: ${parts.join(' · ')}`;
}

function narrateRationaleAr(
  rationale: string,
  strength: PublicClaimStrength,
): string {
  if (
    strength === PublicClaimStrength.QUALIFIED_SUGGESTION ||
    strength === PublicClaimStrength.PREFERENCE_DEPENDENT_OPTION
  ) {
    return `سبب هذا الخيار (توجيهي): ${rationale}`;
  }
  return `السبب: ${rationale}`;
}
