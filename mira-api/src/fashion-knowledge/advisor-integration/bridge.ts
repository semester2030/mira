/**
 * FK-10 — FashionKnowledgeAdvisorBridge
 * Mode A registry first → optional Mode B LLM → Claim Lock → projection.
 */
import { createHash } from 'crypto';
import type { FashionAdviceCandidate } from '../advice/advice-candidate';
import {
  CandidateSourceType,
  CandidateStatus,
  PresentationEligibility,
} from '../advice/advice-candidate';
import {
  ClaimLockDecision,
  type FashionClaimLockResult,
} from '../contracts/claim-lock';
import { evaluateFashionClaimLock } from '../claim-lock/claim-lock-runtime';
import { emptyLockContext } from '../runtime/evaluation-context';
import { FashionAdviceType } from '../contracts/advice-types';
import { KnowledgeType } from '../contracts/knowledge-types';
import { ConflictState } from '../contracts/conflicts';
import {
  ProvenanceApprovalStatus,
  ProvenanceSourceType,
} from '../contracts/provenance';
import { FASHION_ADVICE_CANDIDATE_VERSION } from '../versioning/release';
import { isFashionKnowledgeLlmEnabled } from '../llm/feature-flag';
import { isFashionKnowledgeRegistryEnabled } from '../registry/feature-flag';
import { runFashionKnowledgeLlm } from '../llm/orchestrator';
import type { FashionKnowledgeLlmPort } from '../llm/provider-port';
import type { FashionLlmKnowledgeRequest } from '../llm/request-contract';
import {
  getRuleById,
  lookupFashionKnowledgeRules,
} from '../registry/lookup';
import type { FashionKnowledgeLookupQuery } from '../registry/contracts';
import type { FashionKnowledgeRegistry } from '../registry/contracts';
import type { FashionKnowledgeRule } from '../knowledge/fashion-knowledge-rule';
import { RuleLifecycleStatus } from '../knowledge/fashion-knowledge-rule';
import {
  createFashionKnowledgeTelemetryService,
  type FashionKnowledgeTelemetryService,
} from '../telemetry/service';
import { InMemoryFashionKnowledgeTelemetryStore } from '../telemetry/memory-store';
import { FashionKnowledgeEventType } from '../telemetry/event-taxonomy';
import { AdviceSourceMode } from '../telemetry/event-taxonomy';
import { isFashionKnowledgeTelemetryEnabled } from '../telemetry/feature-flag';
import { FASHION_ADVISOR_INTEGRATION_VERSION } from '../versioning/release';
import { isFashionKnowledgeAdvisorIntegrationEnabled } from './feature-flag';
import {
  detectFashionAdvisorIntent,
  FashionAdvisorIntent,
  isReligiousOutOfScope,
} from './intent-routing';
import {
  projectClaimLockedCandidate,
  projectNoKnowledge,
  projectOutOfScope,
} from './eligibility';
import type { FashionKnowledgeAdvisorProjection } from './projection';
import { FashionAdvisorEnvelopeProjectionPortImpl } from './projection-port';

export interface FashionAdvisorBridgeContext {
  readonly sessionRef?: string;
  readonly userMessage: string;
  readonly request: FashionLlmKnowledgeRequest;
  readonly registry?: FashionKnowledgeRegistry;
  readonly evidenceStale?: boolean;
  readonly culturalContextPresent?: boolean;
}

export interface FashionAdvisorBridgeResult {
  readonly integrationVersion: typeof FASHION_ADVISOR_INTEGRATION_VERSION | string;
  readonly intent: FashionAdvisorIntent;
  readonly modeUsed: 'MODE_A' | 'MODE_B' | 'NONE' | 'OUT_OF_SCOPE';
  readonly projection: FashionKnowledgeAdvisorProjection;
  readonly candidate?: FashionAdviceCandidate;
  readonly claimLockResult?: FashionClaimLockResult;
  readonly modeARuleIds: readonly string[];
  readonly telemetryRecorded: boolean;
  readonly featureFlagEnabled: boolean;
  readonly registryWriteAttempted: false;
  readonly autoPromotionAttempted: false;
}

function hashId(prefix: string, payload: string, len = 16): string {
  return `${prefix}_${createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, len)}`;
}

function curatedRuleToCandidate(
  rule: FashionKnowledgeRule,
  request: FashionLlmKnowledgeRequest,
): FashionAdviceCandidate {
  const candidateId = hashId('cand', `${rule.ruleId}|${request.requestId}`);
  return {
    candidateId,
    schemaVersion: FASHION_ADVICE_CANDIDATE_VERSION,
    adviceType: FashionAdviceType.PRESERVE_LOOK,
    targetRefs: request.garmentFacts.map((g) => g.garmentId),
    currentObservation:
      rule.recommendationPattern.structuredSuggestion || rule.rationale,
    suggestion: {
      structuredText: rule.recommendationPattern.structuredSuggestion,
      adviceType: FashionAdviceType.PRESERVE_LOOK,
      absoluteClaim: false,
      knownRuleWording: true,
    },
    rationale: rule.rationale,
    knowledgeRuleIds: [rule.ruleId],
    knowledgeType: rule.knowledgeType ?? KnowledgeType.ESTABLISHED_PRINCIPLE,
    sourceType: CandidateSourceType.MIRA_CURATED,
    provenanceState: ProvenanceApprovalStatus.APPROVED,
    provenance: {
      sourceId: rule.provenance.sourceId,
      sourceType: rule.provenance.sourceType ?? ProvenanceSourceType.MIRA_EDITORIAL,
      approvalStatus: ProvenanceApprovalStatus.APPROVED,
      sourceConfidence: rule.provenance.sourceConfidence ?? 0.9,
      notes: 'Mode A curated rule',
    },
    evidenceRefs: request.evidenceRefs,
    confidence: rule.confidence,
    subjectivity: rule.subjectivity,
    occasionContext: request.occasion ? [request.occasion] : undefined,
    preferenceConflict: ConflictState.NO_CONFLICT,
    culturalConflict: ConflictState.NO_CONFLICT,
    limitations: [],
    alternatives: [],
    presentationEligibility: PresentationEligibility.ELIGIBLE,
    status: CandidateStatus.READY_FOR_LOCK,
    traceId: request.traceId,
    createdAt: request.clockNowIso,
  };
}

async function tryModeA(input: {
  readonly registry?: FashionKnowledgeRegistry;
  readonly request: FashionLlmKnowledgeRequest;
  readonly getEnv?: (key: string, def?: string) => string | undefined;
}): Promise<{
  candidate?: FashionAdviceCandidate;
  lock?: FashionClaimLockResult;
  ruleIds: string[];
}> {
  const registryOn = isFashionKnowledgeRegistryEnabled(
    input.getEnv ?? ((k, d) => process.env[k] ?? d),
  );
  if (!registryOn || !input.registry) {
    return { ruleIds: [] };
  }
  const query: FashionKnowledgeLookupQuery = {
    colorFacts: input.request.garmentFacts.flatMap((g) => g.colors ?? []),
    occasion: input.request.occasion,
    dressCode: input.request.dressCode,
    culturalContext: input.request.culturalContext,
    styleGoal: input.request.styleGoal,
    preferenceTokens: input.request.preferenceContext?.preferenceTokens,
    clockNowIso: input.request.clockNowIso,
    activeOnly: true,
    allowTestOnly: false,
  };
  const lookup = lookupFashionKnowledgeRules(input.registry, query);
  const activeIds = lookup.matchedRules
    .map((m) => m.ruleId)
    .filter((id) => {
      const rule = getRuleById(input.registry!, id);
      return (
        rule &&
        rule.status === RuleLifecycleStatus.ACTIVE &&
        rule.lifecycle === RuleLifecycleStatus.ACTIVE &&
        !rule.testOnly
      );
    });
  if (activeIds.length === 0) {
    return { ruleIds: [] };
  }
  const rule = getRuleById(input.registry, activeIds[0]!);
  if (!rule) return { ruleIds: [] };
  const candidate = curatedRuleToCandidate(rule, input.request);
  const lockCtx = emptyLockContext({
    clock: { nowIso: input.request.clockNowIso },
    traceId: input.request.traceId,
    resolvedEvidenceIds: new Set(input.request.evidenceRefs),
    registeredSourceIds: new Set([rule.provenance.sourceId]),
    applicableRuleIds: new Set([rule.ruleId]),
    occasionTokens: new Set(
      input.request.occasion ? [input.request.occasion.toLowerCase()] : [],
    ),
    preferenceTokens: new Set(
      (input.request.preferenceContext?.preferenceTokens ?? []).map((t) =>
        t.toLowerCase(),
      ),
    ),
    factTokens: new Set(
      input.request.garmentFacts.flatMap((g) => [
        ...(g.colors ?? []).map((c) => c.toLowerCase()),
        ...(g.type ? [g.type.toLowerCase()] : []),
      ]),
    ),
    dressCodeKnown: Boolean(input.request.dressCode),
  });
  const lock = evaluateFashionClaimLock(candidate, lockCtx);
  return { candidate, lock, ruleIds: [rule.ruleId] };
}

/**
 * Primary FK-10 orchestration entry.
 */
export async function runFashionKnowledgeAdvisorBridge(input: {
  readonly context: FashionAdvisorBridgeContext;
  readonly provider?: FashionKnowledgeLlmPort;
  readonly enabled?: boolean;
  readonly llmEnabled?: boolean;
  readonly telemetryService?: FashionKnowledgeTelemetryService;
  readonly getEnv?: (key: string, def?: string) => string | undefined;
}): Promise<FashionAdvisorBridgeResult> {
  const getEnv = input.getEnv ?? ((k, d) => process.env[k] ?? d);
  const enabled =
    input.enabled ?? isFashionKnowledgeAdvisorIntegrationEnabled(getEnv);
  const intent = detectFashionAdvisorIntent(input.context.userMessage);
  const clock = input.context.request.clockNowIso;
  const traceId = input.context.request.traceId;

  const baseFlags = {
    registryWriteAttempted: false as const,
    autoPromotionAttempted: false as const,
    featureFlagEnabled: enabled,
    intent,
    integrationVersion: FASHION_ADVISOR_INTEGRATION_VERSION,
  };

  if (!enabled) {
    return {
      ...baseFlags,
      modeUsed: 'NONE',
      projection: projectNoKnowledge({
        clockNowIso: clock,
        traceId,
        reason: 'ADVISOR_INTEGRATION_DISABLED',
      }),
      modeARuleIds: [],
      telemetryRecorded: false,
    };
  }

  if (isReligiousOutOfScope(intent)) {
    return {
      ...baseFlags,
      modeUsed: 'OUT_OF_SCOPE',
      projection: projectOutOfScope({
        clockNowIso: clock,
        traceId,
        reason: 'RELIGIOUS_OUT_OF_SCOPE',
      }),
      modeARuleIds: [],
      telemetryRecorded: false,
    };
  }

  if (intent === FashionAdvisorIntent.SHOPPING_OUT_OF_SCOPE) {
    return {
      ...baseFlags,
      modeUsed: 'OUT_OF_SCOPE',
      projection: projectOutOfScope({
        clockNowIso: clock,
        traceId,
        reason: 'SHOPPING_OUT_OF_SCOPE',
      }),
      modeARuleIds: [],
      telemetryRecorded: false,
    };
  }

  if (input.context.evidenceStale) {
    const projection = projectNoKnowledge({
      clockNowIso: clock,
      traceId,
      reason: 'STALE_EVIDENCE',
    });
    return {
      ...baseFlags,
      modeUsed: 'NONE',
      projection: {
        ...projection,
        fragments: projection.fragments.map((f) => ({ ...f, stale: true })),
        limitations: [...projection.limitations, 'STALE_EVIDENCE'],
      },
      modeARuleIds: [],
      telemetryRecorded: false,
    };
  }

  const modeA = await tryModeA({
    registry: input.context.registry,
    request: input.context.request,
    getEnv,
  });

  let candidate = modeA.candidate;
  let lock = modeA.lock;
  let modeUsed: FashionAdvisorBridgeResult['modeUsed'] = 'NONE';

  if (
    candidate &&
    lock &&
    (lock.decision === ClaimLockDecision.PASS ||
      lock.decision === ClaimLockDecision.PASS_WITH_QUALIFICATION)
  ) {
    modeUsed = 'MODE_A';
  } else {
    const llmOn = input.llmEnabled ?? isFashionKnowledgeLlmEnabled(getEnv);
    if (!llmOn || !input.provider) {
      return {
        ...baseFlags,
        modeUsed: 'NONE',
        projection: projectNoKnowledge({
          clockNowIso: clock,
          traceId,
          reason: llmOn ? 'MODE_B_PROVIDER_MISSING' : 'MODE_B_DISABLED',
        }),
        candidate,
        claimLockResult: lock,
        modeARuleIds: modeA.ruleIds,
        telemetryRecorded: false,
      };
    }

    const evalResult = await runFashionKnowledgeLlm({
      request: input.context.request,
      provider: input.provider,
      enabled: true,
      getEnv,
    });
    candidate = evalResult.candidate;
    lock = evalResult.claimLockResult;
    modeUsed = 'MODE_B';
  }

  if (!lock) {
    return {
      ...baseFlags,
      modeUsed,
      projection: projectNoKnowledge({
        clockNowIso: clock,
        traceId,
        reason: 'CLAIM_LOCK_MISSING',
      }),
      candidate,
      modeARuleIds: modeA.ruleIds,
      telemetryRecorded: false,
    };
  }

  const projection = projectClaimLockedCandidate({
    candidate,
    lock,
    clockNowIso: clock,
    culturalContextPresent: input.context.culturalContextPresent,
    stale: input.context.evidenceStale,
  });

  if (candidate) {
    const port = new FashionAdvisorEnvelopeProjectionPortImpl();
    await port.projectLockedCandidate({
      candidate,
      lock,
      context: emptyLockContext({
        clock: { nowIso: clock },
        traceId,
        resolvedEvidenceIds: new Set(input.context.request.evidenceRefs),
      }),
    });
  }

  let telemetryRecorded = false;
  if (isFashionKnowledgeTelemetryEnabled(getEnv)) {
    try {
      const tel =
        input.telemetryService ??
        createFashionKnowledgeTelemetryService({
          enabled: true,
          port: new InMemoryFashionKnowledgeTelemetryStore(),
          getEnv,
        });
      const sourceMode =
        modeUsed === 'MODE_A'
          ? AdviceSourceMode.MODE_A_CURATED
          : AdviceSourceMode.MODE_B_LLM;
      const events = [
        {
          eventId: hashId('evt', `${traceId}|gen`),
          eventType: FashionKnowledgeEventType.ADVICE_GENERATED,
          schemaVersion: 'fashion-telemetry-schema-v1',
          occurredAt: clock,
          sessionRef: input.context.sessionRef,
          adviceCandidateId: candidate?.candidateId,
          sourceMode,
          releaseVersion: projection.releaseVersion,
          traceId,
          metadata: {} as Record<string, string | number | boolean | null>,
        },
        {
          eventId: hashId('evt', `${traceId}|lock`),
          eventType: FashionKnowledgeEventType.ADVICE_CLAIM_LOCKED,
          schemaVersion: 'fashion-telemetry-schema-v1',
          occurredAt: clock,
          adviceCandidateId: candidate?.candidateId,
          claimLockDecision: lock.decision,
          sourceMode,
          releaseVersion: projection.releaseVersion,
          reasonCodes: [...lock.reasonCodes],
          traceId,
          metadata: {} as Record<string, string | number | boolean | null>,
        },
        {
          eventId: hashId('evt', `${traceId}|proj`),
          eventType: FashionKnowledgeEventType.ADVICE_PRESENTED,
          schemaVersion: 'fashion-telemetry-schema-v1',
          occurredAt: clock,
          adviceCandidateId: candidate?.candidateId,
          sourceMode,
          releaseVersion: projection.releaseVersion,
          traceId,
          metadata: {
            projectionId: projection.projectionId,
          } as Record<string, string | number | boolean | null>,
        },
      ];
      for (const e of events) {
        const recorded = await tel.recordEvent(e);
        if (recorded.recorded) telemetryRecorded = true;
      }
    } catch {
      telemetryRecorded = false;
    }
  }

  return {
    ...baseFlags,
    modeUsed,
    projection,
    candidate,
    claimLockResult: lock,
    modeARuleIds: modeA.ruleIds,
    telemetryRecorded,
  };
}
