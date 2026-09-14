/**
 * FK-6 — Internal orchestration: Registry → Mode B LLM → Claim Lock.
 * No HTTP. No Advisor. No fake Mode A rules.
 */
import type { FashionKnowledgeRegistry } from '../registry/contracts';
import { askApplicableCuratedRules } from '../registry/lookup';
import { LookupReasonCode } from '../registry/contracts';
import { emptyProductionRegistry } from '../registry/storage';
import { FashionRuleDomain } from '../contracts/rule-domains';
import { runFashionKnowledgeLlm } from '../llm/orchestrator';
import type { FashionKnowledgeLlmPort } from '../llm/provider-port';
import {
  projectFashionLlmContext,
  type ProjectableAccessoryInput,
  type ProjectableGarmentInput,
} from '../llm/context-projection';
import type { FashionKnowledgeLlmEvaluationResult } from '../llm/evaluation-result';
import { isFashionKnowledgeLlmEnabled } from '../llm/feature-flag';
import { isFashionKnowledgeAccessoriesEnabled } from './feature-flag';
import { FK6_ACCESSORY_ADVICE_TYPES, evaluateModeBEligibility } from './eligibility';
import { YEAR1_MODE_B_POLICY } from './year1-mode-b-policy';
import { FASHION_KNOWLEDGE_ACCESSORIES_RUNTIME_VERSION } from '../versioning/release';
import type { FashionAccessoryFact } from './fact-projection';

export interface RunFk6AccessoriesInput {
  readonly requestId: string;
  readonly traceId: string;
  readonly clockNowIso: string;
  readonly garments: readonly ProjectableGarmentInput[];
  readonly accessories?: readonly ProjectableAccessoryInput[];
  readonly projectedAccessoryFacts?: readonly FashionAccessoryFact[];
  readonly occasion?: string;
  readonly dressCode?: string;
  readonly styleGoal?: string;
  readonly preferenceTokens?: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly provider: FashionKnowledgeLlmPort;
  readonly registry?: FashionKnowledgeRegistry;
  readonly domains?: readonly FashionRuleDomain[];
  readonly enabledAccessories?: boolean;
  readonly enabledLlm?: boolean;
  readonly getEnv?: (key: string, def?: string) => string | undefined;
}

export interface Fk6AccessoriesEvaluationResult {
  readonly schemaVersion: typeof FASHION_KNOWLEDGE_ACCESSORIES_RUNTIME_VERSION | string;
  readonly modeA: {
    readonly available: boolean;
    readonly code: string;
    readonly matchedRuleIds: readonly string[];
  };
  readonly modeBInvoked: boolean;
  readonly modeB?: FashionKnowledgeLlmEvaluationResult;
  readonly year1PolicyVersion: string;
  readonly eligibility?: ReturnType<typeof evaluateModeBEligibility>;
  readonly notes: string;
}

export async function runFk6AccessoriesEvaluation(
  input: RunFk6AccessoriesInput,
): Promise<Fk6AccessoriesEvaluationResult> {
  const accessoriesEnabled =
    input.enabledAccessories ??
    isFashionKnowledgeAccessoriesEnabled(input.getEnv);
  const llmEnabled =
    input.enabledLlm ?? isFashionKnowledgeLlmEnabled(input.getEnv);

  const registry =
    input.registry ?? emptyProductionRegistry(input.clockNowIso);
  const domains = input.domains ?? [
    FashionRuleDomain.SHOES,
    FashionRuleDomain.BAGS,
    FashionRuleDomain.JEWELRY,
    FashionRuleDomain.ACCESSORY,
  ];

  const modeAResults = domains.map((domain) =>
    askApplicableCuratedRules(registry, {
      domain,
      clockNowIso: input.clockNowIso,
      activeOnly: true,
      occasion: input.occasion,
      dressCode: input.dressCode,
      styleGoal: input.styleGoal,
      preferenceTokens: input.preferenceTokens,
    }),
  );
  const anyModeA = modeAResults.some((r) => r.available);
  const matchedRuleIds = modeAResults.flatMap((r) => [...r.matchedRuleIds]);
  const modeACode = anyModeA
    ? LookupReasonCode.MATCHED
    : LookupReasonCode.NO_APPLICABLE_CURATED_RULE;

  if (!accessoriesEnabled) {
    return Object.freeze({
      schemaVersion: FASHION_KNOWLEDGE_ACCESSORIES_RUNTIME_VERSION,
      modeA: Object.freeze({
        available: anyModeA,
        code: modeACode,
        matchedRuleIds: Object.freeze(matchedRuleIds),
      }),
      modeBInvoked: false,
      year1PolicyVersion: YEAR1_MODE_B_POLICY.schemaVersion,
      notes: 'FASHION_KNOWLEDGE_ACCESSORIES_ENABLED=false — capability idle',
    });
  }

  if (anyModeA) {
    return Object.freeze({
      schemaVersion: FASHION_KNOWLEDGE_ACCESSORIES_RUNTIME_VERSION,
      modeA: Object.freeze({
        available: true,
        code: LookupReasonCode.MATCHED,
        matchedRuleIds: Object.freeze(matchedRuleIds),
      }),
      modeBInvoked: false,
      year1PolicyVersion: YEAR1_MODE_B_POLICY.schemaVersion,
      notes:
        'Mode A curated accessory rules matched — Mode B not auto-invoked',
    });
  }

  if (!llmEnabled) {
    return Object.freeze({
      schemaVersion: FASHION_KNOWLEDGE_ACCESSORIES_RUNTIME_VERSION,
      modeA: Object.freeze({
        available: false,
        code: LookupReasonCode.NO_APPLICABLE_CURATED_RULE,
        matchedRuleIds: Object.freeze([] as string[]),
      }),
      modeBInvoked: false,
      year1PolicyVersion: YEAR1_MODE_B_POLICY.schemaVersion,
      notes:
        'NO_APPLICABLE_CURATED_RULE and FASHION_KNOWLEDGE_LLM_ENABLED=false',
    });
  }

  const projection = projectFashionLlmContext({
    requestId: input.requestId,
    traceId: input.traceId,
    clockNowIso: input.clockNowIso,
    garments: input.garments,
    accessories: input.accessories,
    occasion: input.occasion,
    dressCode: input.dressCode,
    styleGoal: input.styleGoal,
    preference: {
      styleGoal: input.styleGoal,
      preferenceTokens: input.preferenceTokens,
    },
    evidenceRefs: input.evidenceRefs,
    allowedAdviceTypes: FK6_ACCESSORY_ADVICE_TYPES,
    existingKnowledgeRuleRefs: matchedRuleIds,
  });

  if (!projection.ok || !projection.request) {
    return Object.freeze({
      schemaVersion: FASHION_KNOWLEDGE_ACCESSORIES_RUNTIME_VERSION,
      modeA: Object.freeze({
        available: false,
        code: LookupReasonCode.NO_APPLICABLE_CURATED_RULE,
        matchedRuleIds: Object.freeze([] as string[]),
      }),
      modeBInvoked: false,
      year1PolicyVersion: YEAR1_MODE_B_POLICY.schemaVersion,
      notes: `projection_failed:${projection.issues.join(',')}`,
    });
  }

  const modeB = await runFashionKnowledgeLlm({
    request: projection.request,
    provider: input.provider,
    enabled: true,
    getEnv: input.getEnv,
  });

  const eligibility = evaluateModeBEligibility({
    candidate: modeB.candidate,
    lock: modeB.claimLockResult,
    assumptionsExplicit: true,
  });

  return Object.freeze({
    schemaVersion: FASHION_KNOWLEDGE_ACCESSORIES_RUNTIME_VERSION,
    modeA: Object.freeze({
      available: false,
      code: LookupReasonCode.NO_APPLICABLE_CURATED_RULE,
      matchedRuleIds: Object.freeze([] as string[]),
    }),
    modeBInvoked: true,
    modeB,
    year1PolicyVersion: YEAR1_MODE_B_POLICY.schemaVersion,
    eligibility,
    notes:
      'Mode A empty → Year-1 Mode B invoked under Claim Lock; UNCURATED forced',
  });
}
