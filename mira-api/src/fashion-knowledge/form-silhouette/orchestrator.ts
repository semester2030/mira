/**
 * FK-7 — Internal orchestration: relationship projection → Registry → Mode B → Claim Lock.
 * No HTTP. No Advisor. No fake Mode A rules. OI layering CONSUME_ONLY.
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
import { isFashionKnowledgeFormSilhouetteEnabled } from './feature-flag';
import {
  FK7_FORM_ADVICE_TYPES,
  evaluateFk7ModeBEligibility,
} from './eligibility';
import { YEAR1_MODE_B_POLICY } from '../accessories/year1-mode-b-policy';
import { FASHION_KNOWLEDGE_FORM_SILHOUETTE_RUNTIME_VERSION } from '../versioning/release';
import {
  projectFormRelationships,
  type FormRelationshipProjection,
  type RawFormGarmentInput,
} from './fact-projection';
import { EvidenceSufficiency } from './models';
import { ENGINEERING_LAW_37 } from './engineering-law-37';

export interface RunFk7FormSilhouetteInput {
  readonly requestId: string;
  readonly traceId: string;
  readonly clockNowIso: string;
  readonly garments: readonly ProjectableGarmentInput[];
  readonly formGarments?: readonly RawFormGarmentInput[];
  readonly accessories?: readonly ProjectableAccessoryInput[];
  readonly outfit?: ProjectableOutfitInput;
  readonly occasion?: string;
  readonly dressCode?: string;
  readonly styleGoal?: string;
  readonly preferenceTokens?: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly colorContrastHigh?: boolean;
  readonly accessoryDominanceHigh?: boolean;
  readonly provider: FashionKnowledgeLlmPort;
  readonly registry?: FashionKnowledgeRegistry;
  readonly domains?: readonly FashionRuleDomain[];
  readonly enabledFormSilhouette?: boolean;
  readonly enabledLlm?: boolean;
  readonly getEnv?: (key: string, def?: string) => string | undefined;
}

export interface Fk7FormSilhouetteEvaluationResult {
  readonly schemaVersion:
    | typeof FASHION_KNOWLEDGE_FORM_SILHOUETTE_RUNTIME_VERSION
    | string;
  readonly law37: typeof ENGINEERING_LAW_37.lawId;
  readonly relationships: FormRelationshipProjection;
  readonly modeA: {
    readonly available: boolean;
    readonly code: string;
    readonly matchedRuleIds: readonly string[];
  };
  readonly modeBInvoked: boolean;
  readonly modeB?: FashionKnowledgeLlmEvaluationResult;
  readonly year1PolicyVersion: string;
  readonly eligibility?: ReturnType<typeof evaluateFk7ModeBEligibility>;
  readonly notes: string;
}

function toRawForm(g: ProjectableGarmentInput): RawFormGarmentInput {
  return {
    garmentId: g.garmentId,
    category: g.category,
    type: g.type,
    material: g.material,
    materialEvidence: g.materialEvidence,
    pattern: g.pattern,
    fit: g.fit,
    silhouette: g.silhouette,
    length: g.length,
    sleeve: g.sleeve,
    neckline: g.neckline,
    styleHints: g.styleHints,
    formalityHint: g.formalityHint,
    geometryRef: g.geometryRef,
    outfitSlot: g.outfitSlot,
    colors: g.colors,
    visualVolumeHint: g.visualVolumeHint,
  };
}

export async function runFk7FormSilhouetteEvaluation(
  input: RunFk7FormSilhouetteInput,
): Promise<Fk7FormSilhouetteEvaluationResult> {
  const formEnabled =
    input.enabledFormSilhouette ??
    isFashionKnowledgeFormSilhouetteEnabled(input.getEnv);
  const llmEnabled =
    input.enabledLlm ?? isFashionKnowledgeLlmEnabled(input.getEnv);

  const relationships = projectFormRelationships({
    garments: input.formGarments ?? input.garments.map(toRawForm),
    layeringSummary: input.outfit?.layeringSummary,
    layeringEvidenceRefs: input.outfit?.layeringEvidenceRefs,
    colorContrastHigh: input.colorContrastHigh,
    accessoryDominanceHigh: input.accessoryDominanceHigh,
  });

  const registry =
    input.registry ?? emptyProductionRegistry(input.clockNowIso);
  const domains = input.domains ?? [
    FashionRuleDomain.FABRIC,
    FashionRuleDomain.TEXTURE,
    FashionRuleDomain.SILHOUETTE,
    FashionRuleDomain.PROPORTION,
    FashionRuleDomain.LAYERING,
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

  const base = {
    schemaVersion: FASHION_KNOWLEDGE_FORM_SILHOUETTE_RUNTIME_VERSION,
    law37: ENGINEERING_LAW_37.lawId,
    relationships,
    year1PolicyVersion: YEAR1_MODE_B_POLICY.schemaVersion,
  } as const;

  if (!formEnabled) {
    return Object.freeze({
      ...base,
      modeA: Object.freeze({
        available: anyModeA,
        code: modeACode,
        matchedRuleIds: Object.freeze(matchedRuleIds),
      }),
      modeBInvoked: false,
      notes:
        'FASHION_KNOWLEDGE_FORM_SILHOUETTE_ENABLED=false — capability idle',
    });
  }

  if (
    relationships.evidenceSufficiency ===
      EvidenceSufficiency.INSUFFICIENT_EVIDENCE ||
    relationships.evidenceSufficiency === EvidenceSufficiency.NEED_CLARIFICATION
  ) {
    return Object.freeze({
      ...base,
      modeA: Object.freeze({
        available: false,
        code: LookupReasonCode.NO_APPLICABLE_CURATED_RULE,
        matchedRuleIds: Object.freeze([] as string[]),
      }),
      modeBInvoked: false,
      notes: `form_evidence:${relationships.evidenceSufficiency} — do not fabricate fabric/silhouette advice`,
    });
  }

  if (anyModeA) {
    return Object.freeze({
      ...base,
      modeA: Object.freeze({
        available: true,
        code: LookupReasonCode.MATCHED,
        matchedRuleIds: Object.freeze(matchedRuleIds),
      }),
      modeBInvoked: false,
      notes: 'Mode A curated form rules matched — Mode B not auto-invoked',
    });
  }

  if (!llmEnabled) {
    return Object.freeze({
      ...base,
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

  const projection = projectFashionLlmContext({
    requestId: input.requestId,
    traceId: input.traceId,
    clockNowIso: input.clockNowIso,
    garments: input.garments,
    accessories: input.accessories,
    outfit: input.outfit,
    occasion: input.occasion,
    dressCode: input.dressCode,
    styleGoal: input.styleGoal,
    preference: {
      styleGoal: input.styleGoal,
      preferenceTokens: input.preferenceTokens,
    },
    evidenceRefs: input.evidenceRefs,
    allowedAdviceTypes: FK7_FORM_ADVICE_TYPES,
    existingKnowledgeRuleRefs: matchedRuleIds,
    forbiddenClaims: [
      'attractiveness',
      'body_shaming',
      'body_shape_judgment',
      'slimming_claim',
      'medical',
      'social_status',
      'fake_citation',
      'product_availability',
      'brand_recommendation',
      'gender_stereotype',
    ],
  });

  if (!projection.ok || !projection.request) {
    return Object.freeze({
      ...base,
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

  const eligibility = evaluateFk7ModeBEligibility({
    candidate: modeB.candidate,
    lock: modeB.claimLockResult,
    assumptionsExplicit: true,
    evidenceSufficiency: relationships.evidenceSufficiency,
  });

  return Object.freeze({
    ...base,
    modeA: Object.freeze({
      available: false,
      code: LookupReasonCode.NO_APPLICABLE_CURATED_RULE,
      matchedRuleIds: Object.freeze([] as string[]),
    }),
    modeBInvoked: true,
    modeB,
    eligibility,
    notes:
      'Mode A empty → Year-1 Mode B under Claim Lock + Law #37; UNCURATED forced',
  });
}

/** Prefer clarification advice type when form evidence is insufficient. */
export function fk7AdviceTypeForSufficiency(
  sufficiency: string,
): FashionAdviceType {
  if (
    sufficiency === EvidenceSufficiency.INSUFFICIENT_EVIDENCE ||
    sufficiency === EvidenceSufficiency.NEED_CLARIFICATION
  ) {
    return FashionAdviceType.CLARIFICATION_REQUIRED;
  }
  return FashionAdviceType.BALANCE_VOLUME;
}
