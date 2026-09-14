/**
 * FK-3 — Safe projection from allowed frozen-facing facts into LLM request.
 * Does NOT import or mutate frozen fashion-intelligence modules.
 * FK-6 adds optional accessory projection (presence must stay honest).
 */
import type {
  FashionLlmAccessoryFact,
  FashionLlmGarmentFact,
  FashionLlmKnowledgeRequest,
  FashionLlmOutfitFact,
  FashionLlmPreferenceContext,
} from './request-contract';
import { FASHION_LLM_REQUEST_VERSION } from '../versioning/release';
import type { FashionAdviceType } from '../contracts/advice-types';
import { ALL_FASHION_ADVICE_TYPES } from '../contracts/advice-types';

export interface ProjectableGarmentInput {
  readonly garmentId: string;
  readonly category?: string;
  readonly type?: string;
  readonly colors?: readonly string[];
  readonly pattern?: string;
  readonly material?: string;
  readonly materialEvidence?: 'MEASURED' | 'SUPPORTED' | 'ESTIMATED' | 'UNKNOWN';
  readonly fit?: string;
  readonly silhouette?: string;
  readonly length?: string;
  readonly sleeve?: string;
  readonly neckline?: string;
  readonly styleHints?: readonly string[];
  readonly formalityHint?: string;
  readonly occasionHint?: string;
  readonly geometryRef?: string;
  readonly outfitSlot?: string;
  readonly visualVolumeHint?: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  /** Rejected if present — frozen/provider leakage. */
  readonly rawProviderPayload?: unknown;
  readonly decisionLedger?: unknown;
  readonly evidenceGraphBody?: unknown;
}

/** FK-6 — supporting piece projection input. Do not invent missing fields. */
export interface ProjectableAccessoryInput {
  readonly accessoryId: string;
  readonly category: string;
  readonly type?: string;
  readonly colors?: readonly string[];
  readonly material?: string;
  readonly pattern?: string;
  readonly formalityHint?: string;
  readonly metallicFamily?: string;
  readonly outfitRole?: string;
  readonly presence: 'PRESENT' | 'ABSENT' | 'UNKNOWN';
  readonly confidence?: string;
  readonly evidenceRefs?: readonly string[];
  readonly rawProviderPayload?: unknown;
  readonly decisionLedger?: unknown;
}

export interface ProjectableOutfitInput {
  readonly outfitId: string;
  readonly garmentRefs: readonly string[];
  readonly harmonySummary?: string;
  readonly compatibilitySummary?: string;
  readonly occasionSummary?: string;
  /** CONSUME_ONLY — OI Layering Engine projection; never recompute. */
  readonly layeringSummary?: string;
  readonly layeringEvidenceRefs?: readonly string[];
  readonly limitations?: readonly string[];
  readonly confidence?: string;
}

export interface ProjectFashionLlmContextInput {
  readonly requestId: string;
  readonly traceId: string;
  readonly clockNowIso: string;
  readonly locale?: string;
  readonly garments: readonly ProjectableGarmentInput[];
  readonly accessories?: readonly ProjectableAccessoryInput[];
  readonly outfit?: ProjectableOutfitInput;
  readonly occasion?: string;
  readonly dressCode?: string;
  readonly styleGoal?: string;
  readonly preference?: FashionLlmPreferenceContext;
  readonly culturalContext?: string;
  readonly existingKnowledgeRuleRefs?: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly allowedAdviceTypes?: readonly FashionAdviceType[];
  readonly forbiddenClaims?: readonly string[];
}

const LEAK_KEYS = [
  'rawProviderPayload',
  'decisionLedger',
  'evidenceGraphBody',
  'openai',
  'fashn',
] as const;

export interface ProjectionResult {
  readonly ok: boolean;
  readonly request?: FashionLlmKnowledgeRequest;
  readonly issues: readonly string[];
}

export function projectFashionLlmContext(
  input: ProjectFashionLlmContextInput,
): ProjectionResult {
  const issues: string[] = [];
  for (const g of input.garments) {
    const rec = g as unknown as Record<string, unknown>;
    for (const k of LEAK_KEYS) {
      if (k in g && rec[k] != null) {
        issues.push(`garment_leak:${k}`);
      }
    }
  }
  for (const a of input.accessories ?? []) {
    const rec = a as unknown as Record<string, unknown>;
    for (const k of LEAK_KEYS) {
      if (k in a && rec[k] != null) {
        issues.push(`accessory_leak:${k}`);
      }
    }
    if (
      a.presence !== 'PRESENT' &&
      a.presence !== 'ABSENT' &&
      a.presence !== 'UNKNOWN'
    ) {
      issues.push(`invalid_presence:${a.accessoryId}`);
    }
  }
  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const garmentFacts: FashionLlmGarmentFact[] = input.garments.map((g) => ({
    garmentId: g.garmentId,
    category: g.category,
    type: g.type,
    colors: g.colors,
    pattern: g.pattern,
    material: g.material,
    materialEvidence: g.materialEvidence,
    fit: g.fit,
    silhouette: g.silhouette,
    length: g.length,
    sleeve: g.sleeve,
    neckline: g.neckline,
    styleHints: g.styleHints,
    formalityHint: g.formalityHint,
    occasionHint: g.occasionHint,
    geometryRef: g.geometryRef,
    outfitSlot: g.outfitSlot,
    visualVolumeHint: g.visualVolumeHint,
  }));

  const accessoryFacts: FashionLlmAccessoryFact[] | undefined =
    input.accessories && input.accessories.length > 0
      ? input.accessories.map((a) => ({
          accessoryId: a.accessoryId,
          category: a.category,
          type: a.type,
          colors: a.colors,
          material: a.material,
          pattern: a.pattern,
          formalityHint: a.formalityHint,
          metallicFamily: a.metallicFamily,
          outfitRole: a.outfitRole,
          presence: a.presence,
          confidence: a.confidence,
          evidenceRefs: a.evidenceRefs,
        }))
      : undefined;

  let outfitFacts: FashionLlmOutfitFact | undefined;
  if (input.outfit) {
    outfitFacts = {
      outfitId: input.outfit.outfitId,
      garmentRefs: input.outfit.garmentRefs,
      harmonySummary: input.outfit.harmonySummary,
      compatibilitySummary: input.outfit.compatibilitySummary,
      occasionSummary: input.outfit.occasionSummary,
      layeringSummary: input.outfit.layeringSummary,
      layeringEvidenceRefs: input.outfit.layeringEvidenceRefs,
      limitations: input.outfit.limitations,
      confidence: input.outfit.confidence,
    };
  }

  if (!input.requestId || !input.traceId || input.evidenceRefs.length === 0) {
    issues.push('missing_required_projection_fields');
    return { ok: false, issues };
  }
  if (garmentFacts.length === 0) {
    issues.push('no_garment_facts');
    return { ok: false, issues };
  }

  const request: FashionLlmKnowledgeRequest = {
    requestId: input.requestId,
    garmentFacts,
    accessoryFacts,
    outfitFacts,
    occasion: input.occasion,
    dressCode: input.dressCode,
    styleGoal: input.styleGoal,
    preferenceContext: input.preference,
    culturalContext: input.culturalContext,
    existingKnowledgeRuleRefs: input.existingKnowledgeRuleRefs ?? [],
    evidenceRefs: input.evidenceRefs,
    allowedAdviceTypes: input.allowedAdviceTypes ?? ALL_FASHION_ADVICE_TYPES,
    forbiddenClaims: input.forbiddenClaims ?? [
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
    locale: input.locale ?? 'ar',
    schemaVersion: FASHION_LLM_REQUEST_VERSION,
    traceId: input.traceId,
    clockNowIso: input.clockNowIso,
  };

  return { ok: true, request, issues: [] };
}
