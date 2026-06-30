/**
 * Universal Fashion Schema v1.0.0 — provider-agnostic contract.
 * Official reference: docs/mira-vision-platform.html (Phase 1)
 */

export const FASHION_VISION_SCHEMA_VERSION = '1.0.0' as const;

export type AnalysisGate = 'proceed' | 'blocked' | 'degraded';

export type RegionRole =
  | 'upper'
  | 'lower'
  | 'outerwear'
  | 'feet'
  | 'accessory'
  | 'full_body'
  | 'unknown';

export type SilhouetteHint =
  | 'one_piece'
  | 'two_piece'
  | 'layered'
  | 'unknown';

export interface NormalizedBbox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GeometrySegment {
  id: string;
  regionRole: RegionRole;
  polygon: number[][];
  bbox: NormalizedBbox;
  cropRef?: string;
}

export interface GeometryTopology {
  pieceCount: number;
  onePiece: boolean;
  silhouetteHint: SilhouetteHint;
}

export interface GeometryPayload {
  segments: GeometrySegment[];
  topology: GeometryTopology;
}

export interface SemanticGarment {
  categoryId: string;
  typeId: string;
  sleeve?: string;
  neckline?: string;
  fit?: string;
  colors: string[];
  material?: string;
  providerConfidence: number;
}

export interface SemanticAccessory {
  categoryId: string;
  typeId: string;
  colors?: string[];
  providerConfidence: number;
}

export interface SemanticsPayload {
  garments: SemanticGarment[];
  accessories: SemanticAccessory[];
  styleArchetypeId?: string;
  layering: string[];
  dominantColorIds: string[];
  secondaryColorIds: string[];
}

export interface FieldConfidence {
  field: string;
  confidence: number;
}

export interface VisionConflict {
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  semanticValue?: string;
  geometryValue?: string;
}

export interface ResolvedGarment {
  categoryId: string;
  typeId: string;
  confidence: number;
}

export interface FusionPayload {
  resolvedGarments: ResolvedGarment[];
  conflicts: VisionConflict[];
  fieldConfidence: FieldConfidence[];
  overallConfidence: number;
}

export interface ProvenanceAuditEntry {
  code: string;
  message: string;
  path?: string;
}

export interface VisionProvenance {
  providers: string[];
  timestamp: string;
  orchestratorVersion: string;
  /** Phase 5 — pipeline audit trail */
  pipelinePhase?: string;
  rejectReasons?: ProvenanceAuditEntry[];
  normalizationNotes?: string[];
}

/** Universal contract — MIRA Engine consumes this, not provider payloads. */
export interface FashionVisionDocument {
  schemaVersion: typeof FASHION_VISION_SCHEMA_VERSION;
  analysisGate: AnalysisGate;
  provenance: VisionProvenance;
  geometry: GeometryPayload;
  semantics: SemanticsPayload;
  fusion: FusionPayload;
}

export interface FashionVisionValidationError {
  path: string;
  code: string;
  message: string;
}

export interface FashionVisionValidationResult {
  valid: boolean;
  errors: FashionVisionValidationError[];
}
