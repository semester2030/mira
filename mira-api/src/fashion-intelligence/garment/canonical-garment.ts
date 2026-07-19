import { CanonicalFashionRuntime } from '../runtime/fashion-runtime-state';
import { FashionEntityClass } from '../models/canonical-wardrobe';
import { FASHION_GARMENT_SCHEMA_VERSION } from '../release';

export type GarmentMaterialKind = 'measured' | 'estimated' | 'unknown';
export type GarmentAvailability =
  | 'detected'
  | 'catalog'
  | 'wardrobe'
  | 'unavailable';
export type GarmentSource =
  | 'vision'
  | 'catalog'
  | 'user'
  | 'import'
  | 'derived';

export interface CanonicalGarmentMaterial {
  value?: string;
  kind: GarmentMaterialKind;
  confidence?: number;
}

export interface GarmentFieldConfidence {
  field: string;
  confidence: number;
}

export interface GarmentExplainability {
  code: string;
  reasonEn: string;
  reasonAr: string;
  evidenceRefs: string[];
}

/** Canonical Garment — Phase 6A.5 §3 · implemented in 6C */
export interface CanonicalGarment {
  garmentId: string;
  version: string;
  identity: {
    categoryId: string;
    subcategoryId?: string;
    typeId: string;
    catalogPieceId?: string;
    entityClass: FashionEntityClass;
  };
  attributes: {
    colors: string[];
    pattern?: string;
    material: CanonicalGarmentMaterial;
    fit?: string;
    season: string[];
    occasion: string[];
    styleHints: string[];
    sleeve?: string;
    neckline?: string;
  };
  geometryRef?: {
    segmentId?: string;
    regionRole?: string;
  };
  confidence: number;
  fieldConfidence: GarmentFieldConfidence[];
  availability: GarmentAvailability;
  source: GarmentSource;
  limitations: string[];
  explainability: GarmentExplainability[];
  localeLabels?: { en?: string; ar?: string };
  runtime: CanonicalFashionRuntime;
  mappingVersion: string;
  createdAt: string;
  updatedAt: string;
}

export const FASHION_GARMENT_MAPPING_VERSION = 'garment-mapping-v1';
export const FASHION_GARMENT_CONTRACT_VERSION = 'garment-contract-v1';

export function emptyMaterial(): CanonicalGarmentMaterial {
  return { kind: 'unknown' };
}

export function garmentSchemaVersion(): string {
  return FASHION_GARMENT_SCHEMA_VERSION;
}
