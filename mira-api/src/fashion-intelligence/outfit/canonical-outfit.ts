import { CanonicalFashionRuntime } from '../runtime/fashion-runtime-state';
import { FASHION_OUTFIT_SCHEMA_VERSION } from '../release';

export type OutfitSlot =
  | 'base'
  | 'mid'
  | 'outer'
  | 'full_body'
  | 'lower'
  | 'feet'
  | 'accessory'
  | 'unknown';

export interface OutfitSlotAssignment {
  garmentId: string;
  slot: OutfitSlot;
}

export interface OutfitFieldConfidence {
  field: string;
  confidence: number;
  evidenceIds: string[];
}

export interface OutfitMetric {
  name: string;
  value: number;
  evidenceIds: string[];
}

export interface OutfitExplainability {
  code: string;
  reasonEn: string;
  reasonAr: string;
  evidenceRefs: string[];
}

/** Canonical Outfit — Phase 6A.5 §4 · implemented in 6D */
export interface CanonicalOutfit {
  outfitId: string;
  version: string;
  garmentIds: string[];
  slots: OutfitSlotAssignment[];
  metrics: OutfitMetric[];
  confidence: number;
  fieldConfidence: OutfitFieldConfidence[];
  limitations: string[];
  explainability: OutfitExplainability[];
  context: {
    occasionId?: string;
    climate?: string;
    season?: string;
    modestyPolicy?: string;
  };
  /** Internal evaluation artifact — stripped from public DTO helpers */
  evidenceGraphRef?: string;
  runtime: CanonicalFashionRuntime;
  evaluationVersion: string;
  mappingVersion: string;
  createdAt: string;
  updatedAt: string;
}

export const FASHION_OUTFIT_EVALUATION_VERSION = 'outfit-eval-v1';
export const FASHION_OUTFIT_MAPPING_VERSION = 'outfit-mapping-v1';
export const FASHION_OUTFIT_CONTRACT_VERSION = 'outfit-contract-v1';

export function outfitSchemaVersion(): string {
  return FASHION_OUTFIT_SCHEMA_VERSION;
}

/** Public projection — never includes provider fields or raw evidence graph. */
export function toPublicCanonicalOutfit(
  outfit: CanonicalOutfit,
): Omit<CanonicalOutfit, 'evidenceGraphRef'> {
  const { evidenceGraphRef: _drop, ...rest } = outfit;
  return rest;
}
