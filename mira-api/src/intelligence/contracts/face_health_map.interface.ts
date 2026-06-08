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
};
