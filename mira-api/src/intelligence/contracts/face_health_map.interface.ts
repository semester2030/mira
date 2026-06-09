import type { ConcernSeverity } from './mira-beauty-report.interface';

/** User-facing confidence — translated to Arabic in payload. */
export type FaceMapConfidence = 'low' | 'medium' | 'high';

export type FaceMapMode = 'educational' | 'regional' | 'spatial';

export type FaceHealthZoneId =
  | 'forehead'
  | 'under_eye'
  | 'cheek_left'
  | 'cheek_right'
  | 'nose'
  | 'chin'
  | 'jawline'
  | 't_zone';

export type FaceHealthZoneSource = 'educational' | 'perfect_corp';

export interface FaceHealthMapZone {
  id: FaceHealthZoneId;
  labelAr: string;
  highlight: boolean;
  /** Soft highlight hex — e.g. #C19EE0 for educational purple. */
  highlightColor: string;
  concernIds: string[];
  /** Per-zone ui_score when regional/spatial data exists. */
  zoneScore?: number;
  educationalNoteAr?: string;
  source: FaceHealthZoneSource;
}

export interface FaceHealthInsightCard {
  id: string;
  concernId: string;
  concernLabelAr: string;
  zoneIds: FaceHealthZoneId[];
  zoneLabelAr: string;
  bodyAr: string;
}

/** Playground-style concern tab — global score + optional per-zone scores. */
export interface FaceHealthConcernOverlay {
  concernId: string;
  labelAr: string;
  labelEn: string;
  globalScore: number;
  severity: ConcernSeverity;
  zoneScores: Partial<Record<FaceHealthZoneId, number>>;
  highlightZoneIds: FaceHealthZoneId[];
  highlightColor: string;
  /** True when zone scores originate from YouCam regional data. */
  hasRegionalData: boolean;
}

/** Pixel-level markers when YouCam returns coordinates (spatial mode). */
export interface FaceHealthSpatialMarker {
  concernId: string;
  zoneId: FaceHealthZoneId;
  /** Normalized 0–1 relative to face bounds. */
  x: number;
  y: number;
  severity: number;
}

export interface FaceHealthMapPayload {
  enabled: boolean;
  confidence: FaceMapConfidence;
  confidenceLabelAr: string;
  mode: FaceMapMode;
  titleAr: string;
  subtitleAr: string;
  disclaimerAr: string;
  zones: FaceHealthMapZone[];
  insightCards: FaceHealthInsightCard[];
  /** Interactive concern tabs (Playground-style). */
  concernOverlays: FaceHealthConcernOverlay[];
  defaultConcernId: string;
  markers: FaceHealthSpatialMarker[];
}

export const FACE_HEALTH_MAP_EMPTY: FaceHealthMapPayload = {
  enabled: false,
  confidence: 'low',
  confidenceLabelAr: 'ثقة منخفضة',
  mode: 'educational',
  titleAr: 'خريطة الوجه الاسترشادية',
  subtitleAr: '',
  disclaimerAr: '',
  zones: [],
  insightCards: [],
  concernOverlays: [],
  defaultConcernId: '',
  markers: [],
};
