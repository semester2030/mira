/**
 * FK-3 — Approved LLM input contract (no raw provider/vision/ledger payloads).
 */
import type { FashionAdviceType } from '../contracts/advice-types';
import { FASHION_LLM_REQUEST_VERSION } from '../versioning/release';

export interface FashionLlmGarmentFact {
  readonly garmentId: string;
  readonly category?: string;
  readonly type?: string;
  readonly colors?: readonly string[];
  readonly pattern?: string;
  readonly material?: string;
  /** FK-7 — MEASURED | ESTIMATED | UNKNOWN when supplied */
  readonly materialEvidence?: 'MEASURED' | 'SUPPORTED' | 'ESTIMATED' | 'UNKNOWN';
  readonly fit?: string;
  readonly silhouette?: string;
  readonly length?: string;
  readonly sleeve?: string;
  readonly neckline?: string;
  readonly styleHints?: readonly string[];
  readonly formalityHint?: string;
  readonly occasionHint?: string;
  /** Public-safe geometry ref only — never raw geometry body. */
  readonly geometryRef?: string;
  readonly outfitSlot?: string;
  readonly visualVolumeHint?: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
}

/** FK-6 — Supporting piece facts (shoes/bags/jewelry/accessories). Missing stays missing. */
export interface FashionLlmAccessoryFact {
  readonly accessoryId: string;
  readonly category: 'shoes' | 'bags' | 'jewelry' | 'accessory' | string;
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
}

export interface FashionLlmOutfitFact {
  readonly outfitId: string;
  readonly garmentRefs: readonly string[];
  readonly harmonySummary?: string;
  readonly compatibilitySummary?: string;
  readonly occasionSummary?: string;
  /**
   * FK-7 — CONSUME_ONLY OI layering projection (structural validity summary).
   * Do not re-evaluate layering legality here.
   */
  readonly layeringSummary?: string;
  readonly layeringEvidenceRefs?: readonly string[];
  readonly limitations?: readonly string[];
  readonly confidence?: string;
}

export interface FashionLlmPreferenceContext {
  readonly styleGoal?: string;
  readonly preferenceTokens?: readonly string[];
  readonly acceptedPreferenceRefs?: readonly string[];
}

export interface FashionLlmKnowledgeRequest {
  readonly requestId: string;
  readonly garmentFacts: readonly FashionLlmGarmentFact[];
  /** FK-6 optional supporting pieces — UNKNOWN must not be coerced to ABSENT. */
  readonly accessoryFacts?: readonly FashionLlmAccessoryFact[];
  readonly outfitFacts?: FashionLlmOutfitFact;
  readonly occasion?: string;
  readonly dressCode?: string;
  readonly styleGoal?: string;
  readonly preferenceContext?: FashionLlmPreferenceContext;
  readonly culturalContext?: string;
  readonly existingKnowledgeRuleRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly allowedAdviceTypes: readonly FashionAdviceType[];
  readonly forbiddenClaims: readonly string[];
  readonly locale: string;
  readonly schemaVersion: typeof FASHION_LLM_REQUEST_VERSION | string;
  readonly traceId: string;
  /** Explicit clock — no wall-clock inside adapter. */
  readonly clockNowIso: string;
}
