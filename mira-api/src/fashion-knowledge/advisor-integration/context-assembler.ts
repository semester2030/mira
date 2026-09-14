/**
 * FK-12 — Production-safe Fashion Advisor context assembly.
 * Output is FashionLlmKnowledgeRequest-ready. No provider/ledger/graph dumps.
 */
import { createHash } from 'crypto';
import type { FashionLlmKnowledgeRequest } from '../llm/request-contract';
import { FASHION_LLM_REQUEST_VERSION } from '../versioning/release';
import { FashionAdviceType } from '../contracts/advice-types';

/** Public-safe structured fashion context (mirrors AdvisorChatDto.fashion). */
export interface FashionAdvisorPublicContext {
  readonly garments?: readonly {
    readonly garmentId: string;
    readonly category?: string;
    readonly type?: string;
    readonly colors?: readonly string[];
    readonly silhouette?: string;
    readonly material?: string;
  }[];
  readonly accessories?: readonly {
    readonly accessoryId: string;
    readonly category: string;
    readonly presence: string;
    readonly type?: string;
    readonly colors?: readonly string[];
  }[];
  readonly outfitId?: string;
  readonly occasion?: string;
  readonly dressCode?: string;
  readonly styleGoal?: string;
  readonly preferenceTokens?: readonly string[];
  readonly culturalContext?: string;
  readonly culturalContextExplicit?: boolean;
  readonly evidenceRefs?: readonly string[];
  readonly evidenceStale?: boolean;
}

export interface AssembledFashionAdvisorContext {
  readonly ok: boolean;
  readonly sufficientForModeB: boolean;
  readonly missing: readonly string[];
  readonly request?: FashionLlmKnowledgeRequest;
  readonly culturalContextPresent: boolean;
  readonly evidenceStale: boolean;
}

function hashTrace(parts: string): string {
  return `trace_fk12_${createHash('sha256').update(parts, 'utf8').digest('hex').slice(0, 16)}`;
}

export function assembleFashionAdvisorContext(input: {
  readonly userMessage: string;
  readonly userId?: string;
  readonly fashion?: FashionAdvisorPublicContext;
  readonly clockNowIso: string;
  readonly requestId?: string;
}): AssembledFashionAdvisorContext {
  const fashion = input.fashion;
  const missing: string[] = [];
  const garments = fashion?.garments ?? [];
  if (garments.length === 0) missing.push('garment_facts');

  const evidenceRefs = [
    ...(fashion?.evidenceRefs ?? []),
    ...garments.map((g) => `ev_${g.garmentId}`),
    ...(fashion?.accessories ?? []).map((a) => `ev_${a.accessoryId}`),
    ...(fashion?.occasion ? [`ev_occasion_${fashion.occasion}`] : []),
  ];
  const uniqueEvidence = [...new Set(evidenceRefs)];

  const culturalContextPresent =
    fashion?.culturalContextExplicit === true &&
    Boolean(fashion?.culturalContext?.trim());

  if (!fashion?.occasion?.trim()) {
    missing.push('occasion');
  }

  const sufficientForModeB = garments.length > 0 && uniqueEvidence.length > 0;
  if (!sufficientForModeB) {
    return {
      ok: false,
      sufficientForModeB: false,
      missing: [...new Set(missing.length ? missing : ['fashion_context'])],
      culturalContextPresent,
      evidenceStale: fashion?.evidenceStale === true,
    };
  }

  const requestId =
    input.requestId ??
    `req_fk12_${createHash('sha256')
      .update(`${input.userId ?? 'anon'}|${input.clockNowIso}|${input.userMessage}`, 'utf8')
      .digest('hex')
      .slice(0, 12)}`;

  const request: FashionLlmKnowledgeRequest = {
    requestId,
    garmentFacts: garments.map((g) => ({
      garmentId: g.garmentId,
      category: g.category,
      type: g.type,
      colors: g.colors ? [...g.colors] : undefined,
      silhouette: g.silhouette,
      material: g.material,
    })),
    accessoryFacts: (fashion?.accessories ?? []).map((a) => ({
      accessoryId: a.accessoryId,
      category: a.category,
      presence: (a.presence as 'PRESENT' | 'ABSENT' | 'UNKNOWN') || 'UNKNOWN',
      type: a.type,
      colors: a.colors ? [...a.colors] : undefined,
    })),
    outfitFacts: fashion?.outfitId
      ? {
          outfitId: fashion.outfitId,
          garmentRefs: garments.map((g) => g.garmentId),
        }
      : undefined,
    occasion: fashion?.occasion,
    dressCode: fashion?.dressCode,
    styleGoal: fashion?.styleGoal,
    preferenceContext: {
      styleGoal: fashion?.styleGoal,
      preferenceTokens: fashion?.preferenceTokens
        ? [...fashion.preferenceTokens]
        : undefined,
    },
    culturalContext: culturalContextPresent
      ? fashion?.culturalContext
      : undefined,
    existingKnowledgeRuleRefs: [],
    evidenceRefs: uniqueEvidence,
    allowedAdviceTypes: [...Object.values(FashionAdviceType)],
    forbiddenClaims: [
      'attractiveness',
      'body_shaming',
      'medical',
      'fake_citation',
      'shopping',
      'sku',
    ],
    locale: 'ar',
    schemaVersion: FASHION_LLM_REQUEST_VERSION,
    traceId: hashTrace(`${requestId}|${input.userMessage}`),
    clockNowIso: input.clockNowIso,
  };

  return {
    ok: true,
    sufficientForModeB: true,
    missing: Object.freeze(missing.filter((m) => m !== 'garment_facts')),
    request,
    culturalContextPresent,
    evidenceStale: fashion?.evidenceStale === true,
  };
}
