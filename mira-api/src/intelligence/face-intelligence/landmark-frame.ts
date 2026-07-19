/**
 * Phase 4A — Landmark frame summary (provider-independent).
 *
 * JUSTIFICATION (new file): Boundary DTO so Face Intel never depends on MediaPipe
 * package types or Perfect/YouCam schemas.
 * REUSES semantic region ids aligned with live FaceRegionId labels — does not
 * reimplement MediaPipe index loops (those stay in Flutter mediapipe_landmark_indices).
 */

export const LANDMARK_FRAME_VERSION = 'landmark-frame-v1';

/** Mesh anatomical regions — mirrors Flutter FaceRegionId names (mapping only). */
export type MeshRegionId =
  | 'forehead'
  | 'underEye'
  | 'nose'
  | 'cheek'
  | 'chin'
  | 'jawline';

export interface LandmarkFrameSummary {
  version: typeof LANDMARK_FRAME_VERSION;
  /** Landmark / outline point count when known */
  pointCount: number;
  hasOutline: boolean;
  hasRegions: boolean;
  regionIdsPresent: MeshRegionId[];
  /** Tracking quality band from capture mesh (low/medium/high) when known */
  trackingQuality?: 'low' | 'medium' | 'high';
  /** Bounding box normalized 0–1 when known */
  boundingBoxNorm?: { x: number; y: number; w: number; h: number };
  source: 'mediapipe_mesh' | 'unavailable' | 'mock';
  limitations: string[];
}

export function emptyLandmarkFrame(
  reason: string,
): LandmarkFrameSummary {
  return {
    version: LANDMARK_FRAME_VERSION,
    pointCount: 0,
    hasOutline: false,
    hasRegions: false,
    regionIdsPresent: [],
    source: 'unavailable',
    limitations: [
      reason,
      'Landmark indices remain owned by mediapipe_landmark_indices.dart — not duplicated here.',
    ],
  };
}

export function summarizeLandmarkInput(input: {
  pointCount?: number;
  hasOutline?: boolean;
  regionIdsPresent?: MeshRegionId[];
  trackingQuality?: 'low' | 'medium' | 'high';
  boundingBoxNorm?: LandmarkFrameSummary['boundingBoxNorm'];
  source?: LandmarkFrameSummary['source'];
}): LandmarkFrameSummary {
  const pointCount = input.pointCount ?? 0;
  const regionIdsPresent = input.regionIdsPresent ?? [];
  const hasOutline = input.hasOutline === true || pointCount >= 8;
  const hasRegions = regionIdsPresent.length > 0;

  if (!hasOutline && pointCount === 0) {
    return emptyLandmarkFrame('No landmark frame supplied to Face Foundation.');
  }

  return {
    version: LANDMARK_FRAME_VERSION,
    pointCount,
    hasOutline,
    hasRegions,
    regionIdsPresent,
    trackingQuality: input.trackingQuality,
    boundingBoxNorm: input.boundingBoxNorm,
    source: input.source ?? 'mediapipe_mesh',
    limitations: [
      'Summary only — raw MediaPipe buffers are never stored in Face Intelligence DTOs.',
      'Not a substitute for Skin FaceHealthMap zones.',
    ],
  };
}
