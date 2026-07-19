/**
 * Interpreted styling evidence — reasoning inputs only.
 * Never mutates frozen Skin/Face/Garment/Outfit artifacts.
 */

export type StylingEvidencePolarity = 'supports' | 'conflicts' | 'neutral';

export type StylingEvidenceSourceKind =
  | 'skin'
  | 'face'
  | 'garment'
  | 'outfit'
  | 'wardrobe'
  | 'preference'
  | 'goal'
  | 'memory';

export interface InterpretedStylingEvidence {
  evidenceId: string;
  sourceKind: StylingEvidenceSourceKind;
  /** Frozen artifact id (report/garment/outfit/wardrobe ref) */
  sourceRef: string;
  claim: string;
  polarity: StylingEvidencePolarity;
  strength: number;
  subjectRefs: string[];
}

export interface FrozenReportRef {
  reportId: string;
  confidence?: number;
  limitationCodes?: string[];
}

export interface WardrobeRefInput {
  garmentIds: string[];
  lookIds?: string[];
  favoriteOutfitIds?: string[];
}

export interface StyleGoalDraft {
  titleEn: string;
  titleAr: string;
  target: string;
  horizon?: string;
  dependsOnTargets?: string[];
}

export interface StyleMemorySnapshot {
  preferredColors: string[];
  avoidedColors: string[];
  preferredSilhouettes: string[];
  avoidedStyles: string[];
  favoriteOutfitIds: string[];
  dislikedStyleTags: string[];
  priorDecisionIds: string[];
  sessionIds: string[];
}
