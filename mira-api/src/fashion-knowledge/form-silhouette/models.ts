/**
 * FK-7 — Fabric / texture / silhouette / proportion / volume models.
 * Descriptive garment relationships only — never body classification.
 */
export const FabricSemanticFamily = {
  LIGHTWEIGHT: 'LIGHTWEIGHT',
  MEDIUM_WEIGHT: 'MEDIUM_WEIGHT',
  HEAVYWEIGHT: 'HEAVYWEIGHT',
  STRUCTURED: 'STRUCTURED',
  FLUID: 'FLUID',
  SHEER: 'SHEER',
  OPAQUE: 'OPAQUE',
  MATTE: 'MATTE',
  LUSTROUS: 'LUSTROUS',
  TEXTURED: 'TEXTURED',
  SMOOTH: 'SMOOTH',
  STRETCH: 'STRETCH',
  RIGID: 'RIGID',
  UNKNOWN: 'UNKNOWN',
} as const;

export type FabricSemanticFamily =
  (typeof FabricSemanticFamily)[keyof typeof FabricSemanticFamily];

export const FabricEvidenceState = {
  MEASURED: 'MEASURED',
  SUPPORTED: 'SUPPORTED',
  ESTIMATED: 'ESTIMATED',
  UNKNOWN: 'UNKNOWN',
} as const;

export type FabricEvidenceState =
  (typeof FabricEvidenceState)[keyof typeof FabricEvidenceState];

export const TextureRelationship = {
  SIMILAR: 'SIMILAR',
  CONTRASTING: 'CONTRASTING',
  COMPETING: 'COMPETING',
  SUPPORTING: 'SUPPORTING',
  UNKNOWN: 'UNKNOWN',
} as const;

export type TextureRelationship =
  (typeof TextureRelationship)[keyof typeof TextureRelationship];

export const SilhouetteVocabulary = {
  FITTED: 'FITTED',
  STRAIGHT: 'STRAIGHT',
  RELAXED: 'RELAXED',
  OVERSIZED: 'OVERSIZED',
  FLARED: 'FLARED',
  A_LINE: 'A_LINE',
  COLUMN: 'COLUMN',
  VOLUMINOUS: 'VOLUMINOUS',
  STRUCTURED: 'STRUCTURED',
  FLUID: 'FLUID',
  UNKNOWN: 'UNKNOWN',
} as const;

export type SilhouetteVocabulary =
  (typeof SilhouetteVocabulary)[keyof typeof SilhouetteVocabulary];

export const VisualVolume = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  UNKNOWN: 'UNKNOWN',
} as const;

export type VisualVolume = (typeof VisualVolume)[keyof typeof VisualVolume];

/** Descriptive garment-to-garment proportion — BALANCED ≠ better. */
export const ProportionRelationship = {
  BALANCED: 'BALANCED',
  TOP_DOMINANT: 'TOP_DOMINANT',
  BOTTOM_DOMINANT: 'BOTTOM_DOMINANT',
  MULTI_DOMINANT: 'MULTI_DOMINANT',
  ASYMMETRIC_INTENTIONAL: 'ASYMMETRIC_INTENTIONAL',
  UNKNOWN: 'UNKNOWN',
} as const;

export type ProportionRelationship =
  (typeof ProportionRelationship)[keyof typeof ProportionRelationship];

export const LengthRelationship = {
  CROPPED_UPPER_HIGH_RISE_LOWER: 'CROPPED_UPPER_HIGH_RISE_LOWER',
  LONG_OUTER_SHORTER_INNER: 'LONG_OUTER_SHORTER_INNER',
  MIDI_MAXI_MINI: 'MIDI_MAXI_MINI',
  OVERLAPPING_LENGTHS: 'OVERLAPPING_LENGTHS',
  UNKNOWN: 'UNKNOWN',
} as const;

export type LengthRelationship =
  (typeof LengthRelationship)[keyof typeof LengthRelationship];

/** Descriptive composition state — HIGH is not inherently bad. */
export const VisualComplexity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  UNKNOWN: 'UNKNOWN',
} as const;

export type VisualComplexity =
  (typeof VisualComplexity)[keyof typeof VisualComplexity];

export const EvidenceSufficiency = {
  SUFFICIENT: 'SUFFICIENT',
  PARTIAL: 'PARTIAL',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
  NEED_CLARIFICATION: 'NEED_CLARIFICATION',
} as const;

export type EvidenceSufficiency =
  (typeof EvidenceSufficiency)[keyof typeof EvidenceSufficiency];

export const FormStyleGoalToken = {
  BOLD: 'bold',
  MINIMAL: 'minimal',
  STRUCTURED: 'structured',
  RELAXED: 'relaxed',
  ROMANTIC: 'romantic',
  CLASSIC: 'classic',
  EXPERIMENTAL: 'experimental',
  EDITORIAL: 'editorial',
  STREAMLINED: 'streamlined',
} as const;
