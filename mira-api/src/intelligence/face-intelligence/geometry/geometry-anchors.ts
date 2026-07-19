/**
 * Phase 4B — Geometry anchors (normalized 0–1 image space).
 *
 * JUSTIFICATION: Provider-independent measurement input.
 * Index ownership remains Flutter `MediapipeLandmarkIndices` — this DTO carries
 * coordinates only, never MediaPipe package types.
 */

export const GEOMETRY_ANCHORS_VERSION = 'geometry-anchors-v1';

export interface NormPoint {
  x: number;
  y: number;
}

export interface GeometryAnchors {
  version: typeof GEOMETRY_ANCHORS_VERSION;
  foreheadTop: NormPoint;
  browMid: NormPoint;
  noseTip: NormPoint;
  noseBase: NormPoint;
  chin: NormPoint;
  leftEyeOuter: NormPoint;
  leftEyeInner: NormPoint;
  rightEyeInner: NormPoint;
  rightEyeOuter: NormPoint;
  leftMouth: NormPoint;
  rightMouth: NormPoint;
  leftFace: NormPoint;
  rightFace: NormPoint;
  leftAla: NormPoint;
  rightAla: NormPoint;
  /** Phase 4C — jaw width (MediaPipe chinArc endpoints; indices owned on Flutter). */
  leftJaw: NormPoint;
  rightJaw: NormPoint;
  source: 'mediapipe_mesh' | 'synthetic_test' | 'mock';
}

export function dist(a: NormPoint, b: NormPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function midpoint(a: NormPoint, b: NormPoint): NormPoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Validate finite coords in roughly normalized space. */
export function anchorsAreValid(a: GeometryAnchors): boolean {
  const pts: NormPoint[] = [
    a.foreheadTop,
    a.browMid,
    a.noseTip,
    a.noseBase,
    a.chin,
    a.leftEyeOuter,
    a.leftEyeInner,
    a.rightEyeInner,
    a.rightEyeOuter,
    a.leftMouth,
    a.rightMouth,
    a.leftFace,
    a.rightFace,
    a.leftAla,
    a.rightAla,
    a.leftJaw,
    a.rightJaw,
  ];
  return pts.every(
    (p) =>
      Number.isFinite(p.x) &&
      Number.isFinite(p.y) &&
      p.x >= -0.05 &&
      p.x <= 1.05 &&
      p.y >= -0.05 &&
      p.y <= 1.05,
  );
}
