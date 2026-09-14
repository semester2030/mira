/**
 * FK-3 — Fashion Knowledge LLM orchestrator.
 * Pipeline: request → prompt → provider → validate → map → Claim Lock.
 * No bypass. No public API. No Advisor wiring.
 */
import type { FashionAdviceCandidate } from '../advice/advice-candidate';
import {
  ClaimLockDecision,
  type FashionClaimLockResult,
} from '../contracts/claim-lock';
import { evaluateFashionClaimLock } from '../claim-lock/claim-lock-runtime';
import {
  emptyLockContext,
  type FashionClaimLockContext,
} from '../runtime/evaluation-context';
import { resolveCuratedOverLlm } from '../conflict/curated-precedence';
import type { FashionKnowledgeRule } from '../knowledge/fashion-knowledge-rule';
import { FashionRuleDomain } from '../contracts/rule-domains';
import { isFashionKnowledgeLlmEnabled } from './feature-flag';
import { resolveFashionLlmAdapterConfig } from './config';
import { buildFashionLlmPrompt } from './prompt-builder';
import { validateFashionLlmDraft } from './draft-validator';
import { mapLlmDraftToCandidate } from './draft-mapper';
import type { FashionKnowledgeLlmPort } from './provider-port';
import type { FashionLlmKnowledgeRequest } from './request-contract';
import {
  FashionLlmRuntimeStage,
  FashionLlmRuntimeStatus,
  makeRuntime,
} from './runtime';
import {
  decideLlmRetry,
  FK3_MAX_PROVIDER_ATTEMPTS,
} from './retry-policy';
import type { FashionKnowledgeLlmEvaluationResult } from './evaluation-result';
import type { FashionLlmCostSink } from './cost-telemetry';
import { FashionAdviceType } from '../contracts/advice-types';

export interface RunFashionKnowledgeLlmInput {
  readonly request: FashionLlmKnowledgeRequest;
  readonly provider: FashionKnowledgeLlmPort;
  /** Override env flag for tests. */
  readonly enabled?: boolean;
  readonly lockContext?: FashionClaimLockContext;
  readonly curatedTestRules?: readonly FashionKnowledgeRule[];
  readonly costSink?: FashionLlmCostSink;
  readonly getEnv?: (key: string, def?: string) => string | undefined;
}

function buildDefaultLockContext(
  request: FashionLlmKnowledgeRequest,
  candidate: FashionAdviceCandidate,
): FashionClaimLockContext {
  const occasionTokens = new Set<string>();
  if (request.occasion) occasionTokens.add(request.occasion.toLowerCase());
  const preferenceTokens = new Set(
    (request.preferenceContext?.preferenceTokens ?? []).map((t) =>
      t.toLowerCase(),
    ),
  );
  const factTokens = new Set<string>();
  for (const g of request.garmentFacts) {
    if (g.type) factTokens.add(g.type.toLowerCase());
    if (g.category) factTokens.add(g.category.toLowerCase());
    for (const c of g.colors ?? []) factTokens.add(c.toLowerCase());
  }
  for (const a of request.accessoryFacts ?? []) {
    factTokens.add(a.category.toLowerCase());
    factTokens.add(a.presence.toLowerCase());
    if (a.type) factTokens.add(a.type.toLowerCase());
    if (a.metallicFamily) factTokens.add(a.metallicFamily.toLowerCase());
    for (const c of a.colors ?? []) factTokens.add(c.toLowerCase());
  }
  if (request.occasion) factTokens.add(request.occasion.toLowerCase());
  if (request.styleGoal) factTokens.add(request.styleGoal.toLowerCase());

  return emptyLockContext({
    clock: { nowIso: request.clockNowIso },
    traceId: request.traceId,
    resolvedEvidenceIds: new Set(request.evidenceRefs),
    registeredSourceIds: new Set(),
    applicableRuleIds: new Set(request.existingKnowledgeRuleRefs),
    occasionTokens,
    preferenceTokens,
    culturalTokens: new Set(
      request.culturalContext ? [request.culturalContext.toLowerCase()] : [],
    ),
    factTokens,
    dressCodeKnown: Boolean(request.dressCode),
    rulesRequiringOccasion: new Set(
      candidate.adviceType === FashionAdviceType.OCCASION_ADJUSTMENT ||
        candidate.adviceType === FashionAdviceType.CLARIFICATION_REQUIRED
        ? candidate.knowledgeRuleIds
        : [],
    ),
  });
}

/**
 * Mandatory Claim Lock path for LLM Mode B.
 * When flag disabled: does not call provider.
 */
export async function runFashionKnowledgeLlm(
  input: RunFashionKnowledgeLlmInput,
): Promise<FashionKnowledgeLlmEvaluationResult> {
  const { request, provider } = input;
  const enabled =
    input.enabled ??
    isFashionKnowledgeLlmEnabled(input.getEnv ?? ((k, d) => process.env[k] ?? d));
  const config = resolveFashionLlmAdapterConfig(
    input.getEnv ?? ((k, d) => process.env[k] ?? d),
  );
  const maxAttempts = Math.min(
    Math.max(1, config.maxRetries + 1),
    FK3_MAX_PROVIDER_ATTEMPTS,
  );

  const auditBase = {
    requestId: request.requestId,
    traceId: request.traceId,
    claimLockInvoked: false,
    sourceForcedUncurated: true,
    featureFlagEnabled: enabled,
    providerId: provider.providerId,
    injectionFlags: [] as string[],
    validationIssueCodes: [] as string[],
  };

  if (!enabled) {
    input.costSink?.({
      event: 'disabled',
      traceId: request.traceId,
      providerId: provider.providerId,
    });
    return {
      runtime: makeRuntime({
        stage: FashionLlmRuntimeStage.TERMINAL,
        status: FashionLlmRuntimeStatus.DISABLED,
        reasonCode: 'feature_flag_disabled',
        retryable: false,
        traceId: request.traceId,
      }),
      audit: auditBase,
    };
  }

  input.costSink?.({
    event: 'request',
    traceId: request.traceId,
    providerId: provider.providerId,
  });

  const prompt = buildFashionLlmPrompt(request);
  auditBase.injectionFlags = [...prompt.injectionFlags];

  // Prompt injection: do not fail closed on filtered text alone —
  // sanitized payload proceeds; flags recorded for audit.
  // Explicit override attempts still proceed with filtered content.

  let attempts = 0;
  let lastError = 'provider_failed';
  let providerResult = await provider.generateStructuredDraft({
    request,
    prompt,
  });
  attempts = 1;

  while (
    providerResult.status !== 'ok' &&
    decideLlmRetry({
      attempt: attempts,
      maxAttempts,
      errorCode: providerResult.errorCode ?? lastError,
    }).shouldRetry
  ) {
    input.costSink?.({
      event: 'retry',
      traceId: request.traceId,
      providerId: provider.providerId,
      attempt: attempts,
    });
    providerResult = await provider.generateStructuredDraft({
      request,
      prompt,
    });
    attempts += 1;
  }

  if (providerResult.status !== 'ok' || !providerResult.draft) {
    input.costSink?.({
      event: 'failed',
      traceId: request.traceId,
      providerId: provider.providerId,
      attempt: attempts,
      latencyMs: providerResult.latencyMs,
    });
    return {
      runtime: makeRuntime({
        stage: FashionLlmRuntimeStage.PROVIDER_CALL,
        status: FashionLlmRuntimeStatus.FAILED,
        reasonCode: providerResult.errorCode ?? 'provider_failed',
        retryable: false,
        traceId: request.traceId,
        providerAuditId: providerResult.providerAuditId,
        attempts,
      }),
      audit: { ...auditBase, providerId: provider.providerId },
    };
  }

  const draft = providerResult.draft;
  const validation = validateFashionLlmDraft(draft, request);
  if (!validation.ok) {
    const codes = validation.issues.map((i) => i.code);
    auditBase.validationIssueCodes = codes;
    input.costSink?.({
      event: codes.some((c) =>
        /attractiveness|body|medical|fake|provenance|invented/i.test(c),
      )
        ? 'blocked'
        : 'malformed',
      traceId: request.traceId,
      providerId: provider.providerId,
      attempt: attempts,
    });

    // Safety blocks must not retry
    return {
      draft,
      runtime: makeRuntime({
        stage: FashionLlmRuntimeStage.DRAFT_VALIDATION,
        status: FashionLlmRuntimeStatus.BLOCKED,
        reasonCode: codes[0] ?? 'draft_invalid',
        retryable: false,
        traceId: request.traceId,
        providerAuditId: providerResult.providerAuditId,
        attempts,
      }),
      audit: {
        ...auditBase,
        claimLockInvoked: false,
        validationIssueCodes: codes,
      },
    };
  }

  // Curated TEST_ONLY precedence simulation (no production rules)
  let curatedWinner: string | undefined;
  if (input.curatedTestRules && input.curatedTestRules.length > 0) {
    const prec = resolveCuratedOverLlm({
      curatedRules: input.curatedTestRules,
      llmCandidateRuleIds: [`llm_draft:${draft.draftId}`],
      domain: FashionRuleDomain.COLOR,
    });
    if (prec.winner === 'curated_rule') {
      curatedWinner = prec.winningRuleId;
    }
  }

  const candidate = mapLlmDraftToCandidate({
    draft,
    request,
    hasApprovedSupportingRule: Boolean(curatedWinner),
  });

  // Force clarification path when occasion missing but advice needs it
  let candidateForLock = candidate;
  if (
    !request.occasion &&
    (draft.occasionDependency === true ||
      draft.adviceType === FashionAdviceType.OCCASION_ADJUSTMENT ||
      draft.adviceType === FashionAdviceType.CLARIFICATION_REQUIRED ||
      (draft.clarificationNeeds?.length ?? 0) > 0)
  ) {
    candidateForLock = {
      ...candidate,
      adviceType: FashionAdviceType.OCCASION_ADJUSTMENT,
      knowledgeType: candidate.knowledgeType,
    };
  }

  const lockCtx =
    input.lockContext ??
    buildDefaultLockContext(request, candidateForLock);

  // CLAIM LOCK MANDATORY — no bypass
  const claimLockResult: FashionClaimLockResult = evaluateFashionClaimLock(
    candidateForLock,
    lockCtx,
  );

  input.costSink?.({
    event:
      claimLockResult.decision === ClaimLockDecision.BLOCK
        ? 'blocked'
        : claimLockResult.decision === ClaimLockDecision.NEED_CLARIFICATION
          ? 'clarification'
          : claimLockResult.decision ===
              ClaimLockDecision.PASS_WITH_QUALIFICATION
            ? 'qualified'
            : 'success',
    traceId: request.traceId,
    providerId: provider.providerId,
    attempt: attempts,
    latencyMs: providerResult.latencyMs,
    promptTokens: providerResult.tokenUsage?.promptTokens,
    completionTokens: providerResult.tokenUsage?.completionTokens,
  });

  const status =
    claimLockResult.decision === ClaimLockDecision.BLOCK
      ? FashionLlmRuntimeStatus.BLOCKED
      : claimLockResult.decision === ClaimLockDecision.NEED_CLARIFICATION
        ? FashionLlmRuntimeStatus.NEED_CLARIFICATION
        : claimLockResult.decision === ClaimLockDecision.PASS_WITH_QUALIFICATION
          ? FashionLlmRuntimeStatus.QUALIFIED
          : claimLockResult.decision === ClaimLockDecision.PASS
            ? FashionLlmRuntimeStatus.PASSED
            : FashionLlmRuntimeStatus.FAILED;

  return {
    candidate: candidateForLock,
    draft,
    claimLockResult,
    runtime: makeRuntime({
      stage: FashionLlmRuntimeStage.TERMINAL,
      status,
      reasonCode: claimLockResult.reasonCodes[0] ?? claimLockResult.decision,
      retryable: false,
      traceId: request.traceId,
      candidateId: candidateForLock.candidateId,
      providerAuditId: providerResult.providerAuditId,
      attempts,
    }),
    audit: {
      ...auditBase,
      claimLockInvoked: true,
      curatedPrecedenceWinner: curatedWinner,
      validationIssueCodes: [],
    },
  };
}
