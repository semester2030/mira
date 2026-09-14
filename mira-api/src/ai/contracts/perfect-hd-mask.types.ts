/**
 * Perfect Corp HD Skin Analysis — mask acceptance contracts.
 * Source: Perfect AI Skin Analysis Inputs & Outputs (S2S v2.0).
 * Independent masks: enable_mask_overlay = false (default).
 */

export const PERFECT_HD_ACCEPTANCE_ACTIONS = [
  'hd_age_spot',
  'hd_pore',
  'hd_wrinkle',
  'hd_redness',
  'hd_texture',
  'hd_acne',
  'hd_moisture',
  'hd_oiliness',
  'hd_radiance',
  'hd_dark_circle',
  'hd_eye_bag',
  'hd_droopy_upper_eyelid',
  'hd_droopy_lower_eyelid',
  'hd_firmness',
  'hd_tear_trough',
  'hd_skin_type',
] as const;

/** Production Face Explorer HD actions (one Perfect task; no skin_type crowding). */
export const PERFECT_HD_FACE_EXPLORER_ACTIONS = [
  'hd_age_spot',
  'hd_pore',
  'hd_wrinkle',
  'hd_redness',
  'hd_texture',
  'hd_acne',
  'hd_moisture',
  'hd_oiliness',
  'hd_radiance',
  'hd_dark_circle',
  'hd_eye_bag',
  'hd_droopy_upper_eyelid',
  'hd_droopy_lower_eyelid',
  'hd_firmness',
  'hd_tear_trough',
] as const;

export type PerfectHdAction = (typeof PERFECT_HD_ACCEPTANCE_ACTIONS)[number];

export const PERFECT_SD_ACTIONS = new Set([
  'wrinkle',
  'pore',
  'texture',
  'acne',
  'moisture',
  'oiliness',
  'redness',
  'age_spot',
  'radiance',
  'firmness',
  'eye_bag',
  'dark_circle',
  'dark_circle_v2',
  'droopy_upper_eyelid',
  'droopy_lower_eyelid',
  'tear_trough',
  'skin_type',
]);

export type PerfectHdMaskArtifact = {
  concernType: string;
  region?: string;
  rawScore?: number;
  uiScore?: number;
  outputMaskName?: string;
  maskUrls: string[];
  /** True when scores exist but no mask URL / name. */
  scoreOnly: boolean;
};

export type PerfectHdMaskParseResult = {
  artifacts: PerfectHdMaskArtifact[];
  skinAge?: number;
  hasAnyMask: boolean;
  mixedSdHdRejected: boolean;
};

export type PerfectHdMaskMaterialized = PerfectHdMaskArtifact & {
  bytes?: Buffer;
  contentType?: string;
  width?: number;
  height?: number;
  formatOk?: boolean;
  downloadOk: boolean;
  downloadError?: string;
  alignedWithSource?: boolean | null;
  alignmentNotes?: string;
};

export type PerfectHdAcceptanceReport = {
  apiVersion: 's2s/v2.0';
  dstActions: string[];
  enableMaskOverlay: false;
  sourceWidth: number;
  sourceHeight: number;
  sourceShortSide: number;
  hdResolutionOk: boolean;
  taskIdPrefix: string;
  artifacts: PerfectHdMaskMaterialized[];
  matrix: Array<{
    metric: string;
    rawScore: number | null;
    uiScore: number | null;
    maskReturned: boolean;
    dimensions: string | null;
    aligned: boolean | null | 'n/a';
  }>;
  unitsConsumed: 'unknown' | number;
  providerError?: string;
};
