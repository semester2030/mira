/**
 * FK-8 — Internal cultural-context evaluation.
 * Registry → Mode A (likely empty) → optional Mode B → Claim Lock.
 * No HTTP. No Advisor. No identity inference. OI modesty CONSUME_ONLY.
 */
import type { FashionKnowledgeRegistry } from '../registry/contracts';
import { askApplicableCuratedRules } from '../registry/lookup';
import { LookupReasonCode } from '../registry/contracts';
import { emptyProductionRegistry } from '../registry/storage';
import { FashionRuleDomain } from '../contracts/rule-domains';
import { FashionAdviceType } from '../contracts/advice-types';
import { runFashionKnowledgeLlm } from '../llm/orchestrator';
import type { FashionKnowledgeLlmPort } from '../llm/provider-port';
import {
  projectFashionLlmContext,
  type ProjectableAccessoryInput,
  type ProjectableGarmentInput,
  type ProjectableOutfitInput,
} from '../llm/context-projection';
import type { FashionKnowledgeLlmEvaluationResult } from '../llm/evaluation-result';
import { isFashionKnowledgeLlmEnabled } from '../llm/feature-flag';
import { isFashionKnowledgeCulturalContextEnabled } from './feature-flag';
import {
  FK8_CULTURAL_ADVICE_TYPES,
  YEAR1_MODE_B_CULTURAL_POLICY,
  evaluateFk8ModeBEligibility,
} from './eligibility';
import { YEAR1_MODE_B_POLICY } from '../accessories/year1-mode-b-policy';
import { FASHION_KNOWLEDGE_CULTURAL_RUNTIME_VERSION } from '../versioning/release';
import {
  normalizeFashionCulturalContext,
  culturalContextToLlmToken,
  isReligiousRulingRequest,
  type FashionCulturalContext,
  type FashionCulturalContextInput,
} from './contract';
import {
  CulturalContextConfidence,
  CulturalEvaluationOutcome,
} from './models';
import { ENGINEERING_LAW_38 } from './engineering-law-38';
import { ConflictState } from '../contracts/conflicts';

export interface RunFk8CulturalContextInput {
  readonly requestId: string;
  readonly traceId: string;
  readonly clockNowIso: string;
  readonly garments: readonly ProjectableGarmentInput[];
  readonly accessories?: readonly ProjectableAccessoryInput[];
  readonly outfit?: ProjectableOutfitInput;
  readonly occasion?: string;
  readonly dressCode?: string;
  readonly styleGoal?: string;
  readonly preferenceTokens?: readonly string[];
  readonly culturalInput?: FashionCulturalContextInput;
  /** Optional free-text user question for out-of-scope detection. */
  readonly userQuestion?: string;
  /** OI modesty projection only — never recompute. */
  readonly oiModestySummary?: string;
  readonly oiModestyEvidenceRefs?: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly provider: FashionKnowledgeLlmPort;
  readonly registry?: FashionKnowledgeRegistry;
  readonly enabledCultural?: boolean;
  readonly enabledLlm?: boolean;
  readonly getEnv?: (key: string, def?: string) => string | undefined;
}

export interface Fk8CulturalEvaluationResult {
  readonly schemaVersion: typeof FASHION_KNOWLEDGE_CULTURAL_RUNTIME_VERSION | string;
  readonly law38: typeof ENGINEERING_LAW_38.lawId;
  readonly cultural: FashionCulturalContext;
  readonly outcome: string;
  readonly preferenceConflict?: string;
  readonly oiModestyBoundary: 'CONSUME_ONLY';
  readonly modeA: {
    readonly available: boolean;
    readonly code: string;
    readonly matchedRuleIds: readonly string[];
  };
  readonly modeBInvoked: boolean;
  readonly modeB?: FashionKnowledgeLlmEvaluationResult;
  readonly year1PolicyVersion: string;
  readonly culturalModeBPolicyVersion: string;
  readonly eligibility?: ReturnType<typeof evaluateFk8ModeBEligibility>;
  readonly notes: string;
}

export async function runFk8CulturalContextEvaluation(
  input: RunFk8CulturalContextInput,
): Promise<Fk8CulturalEvaluationResult> {
  const culturalEnabled =
    input.enabledCultural ??
    isFashionKnowledgeCulturalContextEnabled(input.getEnv);
  const llmEnabled =
    input.enabledLlm ?? isFashionKnowledgeLlmEnabled(input.getEnv);

  const cultural = normalizeFashionCulturalContext(input.culturalInput ?? {});

  const preferenceConflict =
    cultural.mayInvokeRegionalKnowledgePath &&
    input.preferenceTokens?.some((t) => /bold|statement|جريئة|جريء/i.test(t))
      ? ConflictState.POSSIBLE_CONFLICT
      : ConflictState.NO_CONFLICT;

  const base = {
    schemaVersion: FASHION_KNOWLEDGE_CULTURAL_RUNTIME_VERSION,
    law38: ENGINEERING_LAW_38.lawId,
    cultural,
    preferenceConflict,
    oiModestyBoundary: 'CONSUME_ONLY' as const,
    year1PolicyVersion: YEAR1_MODE_B_POLICY.schemaVersion,
    culturalModeBPolicyVersion: 'year1-mode-b-cultural-v1',
  };

  if (input.userQuestion && isReligiousRulingRequest(input.userQuestion)) {
    return Object.freeze({
      ...base,
      outcome: CulturalEvaluationOutcome.OUT_OF_SCOPE_RELIGION,
      modeA: Object.freeze({
        available: false,
        code: LookupReasonCode.NO_APPLICABLE_CURATED_RULE,
        matchedRuleIds: Object.freeze([] as string[]),
      }),
      modeBInvoked: false,
      notes:
        'Religious ruling requests are OUT_OF_SCOPE for Fashion Knowledge (Law #38)',
    });
  }

  if (input.culturalInput?.cleared) {
    return Object.freeze({
      ...base,
      outcome: CulturalEvaluationOutcome.CONTEXT_CLEARED,
      modeA: Object.freeze({
        available: false,
        code: LookupReasonCode.NO_APPLICABLE_CURATED_RULE,
        matchedRuleIds: Object.freeze([] as string[]),
      }),
      modeBInvoked: false,
      notes: 'User cleared cultural context — no immutable cultural profile',
    });
  }

  const registry =
    input.registry ?? emptyProductionRegistry(input.clockNowIso);
  const modeAResult = askApplicableCuratedRules(registry, {
    domain: FashionRuleDomain.CULTURAL_CONTEXT,
    clockNowIso: input.clockNowIso,
    activeOnly: true,
    occasion: input.occasion,
    dressCode: input.dressCode,
    styleGoal: input.styleGoal,
    preferenceTokens: input.preferenceTokens,
    culturalContext: cultural.explicitLabel,
  });

  if (!culturalEnabled) {
    return Object.freeze({
      ...base,
      outcome: CulturalEvaluationOutcome.INSUFFICIENT_CONTEXT,
      modeA: Object.freeze({
        available: modeAResult.available,
        code: modeAResult.available
          ? LookupReasonCode.MATCHED
          : LookupReasonCode.NO_APPLICABLE_CURATED_RULE,
        matchedRuleIds: Object.freeze([...modeAResult.matchedRuleIds]),
      }),
      modeBInvoked: false,
      notes:
        'FASHION_KNOWLEDGE_CULTURAL_CONTEXT_ENABLED=false — capability idle',
    });
  }

  if (modeAResult.available) {
    return Object.freeze({
      ...base,
      outcome: CulturalEvaluationOutcome.QUALIFIED_CULTURAL_CANDIDATE,
      modeA: Object.freeze({
        available: true,
        code: LookupReasonCode.MATCHED,
        matchedRuleIds: Object.freeze([...modeAResult.matchedRuleIds]),
      }),
      modeBInvoked: false,
      notes: 'Mode A curated cultural rules matched — Mode B not auto-invoked',
    });
  }

  const genericOnly =
    cultural.confidence === CulturalContextConfidence.UNKNOWN ||
    cultural.confidence === CulturalContextConfidence.WEAK;

  if (!llmEnabled) {
    return Object.freeze({
      ...base,
      outcome: genericOnly
        ? CulturalEvaluationOutcome.GENERIC_OCCASION_ONLY
        : CulturalEvaluationOutcome.INSUFFICIENT_CONTEXT,
      modeA: Object.freeze({
        available: false,
        code: LookupReasonCode.NO_APPLICABLE_CURATED_RULE,
        matchedRuleIds: Object.freeze([] as string[]),
      }),
      modeBInvoked: false,
      notes:
        'NO_APPLICABLE_CURATED_RULE and FASHION_KNOWLEDGE_LLM_ENABLED=false',
    });
  }

  const llmCulturalToken = culturalContextToLlmToken(cultural);
  // WEAK locale must not become regional cultural authority in the prompt token
  const culturalContextForLlm =
    cultural.confidence === CulturalContextConfidence.WEAK
      ? undefined
      : llmCulturalToken;

  const projection = projectFashionLlmContext({
    requestId: input.requestId,
    traceId: input.traceId,
    clockNowIso: input.clockNowIso,
    garments: input.garments,
    accessories: input.accessories,
    outfit: input.outfit
      ? {
          ...input.outfit,
          limitations: [
            ...(input.outfit.limitations ?? []),
            ...(input.oiModestySummary
              ? [`oi_modesty:${input.oiModestySummary}`]
              : []),
          ],
        }
      : input.oiModestySummary
        ? {
            outfitId: 'outfit:cultural',
            garmentRefs: input.garments.map((g) => g.garmentId),
            limitations: [`oi_modesty:${input.oiModestySummary}`],
          }
        : undefined,
    occasion: input.occasion,
    dressCode: input.dressCode,
    styleGoal: input.styleGoal,
    preference: {
      styleGoal: input.styleGoal,
      preferenceTokens: input.preferenceTokens,
    },
    culturalContext: culturalContextForLlm,
    evidenceRefs: input.evidenceRefs,
    allowedAdviceTypes: FK8_CULTURAL_ADVICE_TYPES,
    existingKnowledgeRuleRefs: [...modeAResult.matchedRuleIds],
    forbiddenClaims: [
      'attractiveness',
      'body_shaming',
      'body_shape_judgment',
      'cultural_stereotype',
      'religious_ruling',
      'cultural_essentialism',
      'fake_citation',
      'product_availability',
      'brand_recommendation',
      'gender_stereotype',
      'social_status',
    ],
  });

  if (!projection.ok || !projection.request) {
    return Object.freeze({
      ...base,
      outcome: CulturalEvaluationOutcome.NEED_CLARIFICATION,
      modeA: Object.freeze({
        available: false,
        code: LookupReasonCode.NO_APPLICABLE_CURATED_RULE,
        matchedRuleIds: Object.freeze([] as string[]),
      }),
      modeBInvoked: false,
      notes: `projection_failed:${projection.issues.join(',')}`,
    });
  }

  const modeB = await runFashionKnowledgeLlm({
    request: projection.request,
    provider: input.provider,
    enabled: true,
    getEnv: input.getEnv,
  });

  const eligibility = evaluateFk8ModeBEligibility({
    candidate: modeB.candidate,
    lock: modeB.claimLockResult,
    cultural,
    assumptionsExplicit: true,
  });

  const outcome = cultural.mayInvokeRegionalKnowledgePath
    ? CulturalEvaluationOutcome.QUALIFIED_CULTURAL_CANDIDATE
    : CulturalEvaluationOutcome.GENERIC_OCCASION_ONLY;

  return Object.freeze({
    ...base,
    outcome,
    modeA: Object.freeze({
      available: false,
      code: LookupReasonCode.NO_APPLICABLE_CURATED_RULE,
      matchedRuleIds: Object.freeze([] as string[]),
    }),
    modeBInvoked: true,
    modeB,
    eligibility,
    notes: cultural.mayInvokeRegionalKnowledgePath
      ? `Explicit cultural context → Mode B UNCURATED under Law #38; policy=${YEAR1_MODE_B_CULTURAL_POLICY.forceUncurated}`
      : 'Generic occasion path — no regional cultural authority; Mode B UNCURATED',
  });
}

export function fk8AdviceForOutcome(outcome: string): FashionAdviceType {
  if (outcome === CulturalEvaluationOutcome.OUT_OF_SCOPE_RELIGION) {
    return FashionAdviceType.CLARIFICATION_REQUIRED;
  }
  if (outcome === CulturalEvaluationOutcome.NEED_CLARIFICATION) {
    return FashionAdviceType.CLARIFICATION_REQUIRED;
  }
  return FashionAdviceType.OCCASION_ADJUSTMENT;
}
