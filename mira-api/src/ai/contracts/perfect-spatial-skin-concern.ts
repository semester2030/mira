/**
 * Canonical Perfect spatial skin concern contract (MIRA account evidence 2026-09-12).
 * No landmark fallback. Spatial overlays only when spatialMode is a provider mask mode.
 */

export const PERFECT_HD_INVENTORY_ACTIONS = [
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

export type PerfectHdInventoryAction =
  (typeof PERFECT_HD_INVENTORY_ACTIONS)[number];

export type PerfectSpatialMode =
  | 'PROVIDER_PIXEL_MASK'
  | 'PROVIDER_SUBREGION_MASKS'
  | 'SCORE_ONLY';

export type FaceExplorerRole =
  | 'PRIMARY'
  | 'SECONDARY'
  | 'SCORE_ONLY'
  | 'SEPARATE_COMPONENT'
  | 'NOT_USABLE';

export type PerfectSpatialSkinConcern = {
  providerType: PerfectHdInventoryAction | string;
  rawScore: number | null;
  uiScore: number | null;
  spatialMode: PerfectSpatialMode;
  /** Temporary session mask refs only — never durable History URLs. */
  maskRefs: string[];
  subregions: Array<{
    region: string;
    rawScore: number | null;
    uiScore: number | null;
    maskRefs: string[];
  }>;
  sourceWidth: number;
  sourceHeight: number;
  maskWidth: number | null;
  maskHeight: number | null;
  temporaryLifecycle: 'EPHEMERAL_SESSION_ONLY';
  landmarkFallback: false;
};

/** Derive spatialMode from real provider artifacts (no invention). */
export function classifySpatialMode(input: {
  hasRootMask: boolean;
  subregionMaskCount: number;
  hasScore: boolean;
}): PerfectSpatialMode {
  if (input.subregionMaskCount >= 2) return 'PROVIDER_SUBREGION_MASKS';
  if (input.hasRootMask || input.subregionMaskCount === 1) {
    return 'PROVIDER_PIXEL_MASK';
  }
  return 'SCORE_ONLY';
}

export function mayShowSpatialOverlay(mode: PerfectSpatialMode): boolean {
  return (
    mode === 'PROVIDER_PIXEL_MASK' || mode === 'PROVIDER_SUBREGION_MASKS'
  );
}
