/**
 * Phase 4C — Hybrid face-shape classifier.
 *
 * JUSTIFICATION: Architecture Lock — no face-shape unit existed.
 * FORMULA: face-shape-hybrid-ratios-v1
 *
 * Cosmetic taxonomy only (oval/round/square/heart/oblong/diamond/triangle).
 * Not medical craniofacial diagnosis. Not attractiveness ranking.
 * Never invents a class when eligibility/anchors/signals are insufficient.
 */

import {
  CANONICAL_FACE_METRIC_CATALOG,
  CanonicalFaceMetric,
  CanonicalFaceModel,
  FACE_FOUNDATION_VERSION,
  FACE_INTELLIGENCE_VERSION,
  FACE_MODEL_VERSION,
  unavailableFaceMetric,
} from '../canonical-face.model';
import { dist, GeometryAnchors, anchorsAreValid } from '../geometry/geometry-anchors';

export const FACE_SHAPE_VERSION = 'face-shape-v1';
export const FACE_SHAPE_FORMULA_ID = 'face-shape-hybrid-ratios-v1';

export type FaceShapeId =
  | 'oval'
  | 'round'
  | 'square'
  | 'heart'
  | 'oblong'
  | 'diamond'
  | 'triangle';

export const FACE_SHAPE_IDS: FaceShapeId[] = [
  'oval',
  'round',
  'square',
  'heart',
  'oblong',
  'diamond',
  'triangle',
];

export const FACE_SHAPE_LABELS: Record<
  FaceShapeId,
  { displayNameAr: string; displayNameEn: string }
> = {
  oval: { displayNameAr: 'بيضاوي', displayNameEn: 'Oval' },
  round: { displayNameAr: 'مستدير', displayNameEn: 'Round' },
  square: { displayNameAr: 'مربع', displayNameEn: 'Square' },
  heart: { displayNameAr: 'قلبي', displayNameEn: 'Heart' },
  oblong: { displayNameAr: 'مستطيل/طويل', displayNameEn: 'Oblong' },
  diamond: { displayNameAr: 'ماسي', displayNameEn: 'Diamond' },
  triangle: { displayNameAr: 'مثلث/كمثري', displayNameEn: 'Triangle' },
};

export interface FaceShapeClassification {
  version: typeof FACE_SHAPE_VERSION;
  formulaId: typeof FACE_SHAPE_FORMULA_ID;
  availability: 'available' | 'unavailable';
  shapeId?: FaceShapeId;
  confidence: number;
  scores: Partial<Record<FaceShapeId, number>>;
  signals: Record<string, number>;
  unavailableReason?: string;
  explanationAr: string;
  explanationEn: string;
  limitations: string[];
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function clamp100(n: number): number {
  return Math.round(Math.min(100, Math.max(0, n)));
}

/** Soft membership around target value. */
function near(value: number, target: number, tol: number): number {
  if (!Number.isFinite(value)) return 0;
  return clamp01(1 - Math.abs(value - target) / Math.max(tol, 1e-6));
}

function rising(value: number, lo: number, hi: number): number {
  if (value <= lo) return 0;
  if (value >= hi) return 1;
  return (value - lo) / (hi - lo);
}

function falling(value: number, lo: number, hi: number): number {
  if (value >= hi) return 0;
  if (value <= lo) return 1;
  return (hi - value) / (hi - lo);
}

/**
 * Hybrid scorer from width/height + forehead/cheek/jaw span ratios.
 */
export function classifyFaceShape(input: {
  eligible: boolean;
  eligibilityReasons: string[];
  anchors?: GeometryAnchors | null;
  trackingQuality?: 'low' | 'medium' | 'high';
}): FaceShapeClassification {
  const baseLimits = [
    'Cosmetic face-shape taxonomy — not attractiveness scoring.',
    'Not a medical or clinical craniofacial assessment.',
    'Separate from skin type / undertone.',
    `Formula ${FACE_SHAPE_FORMULA_ID}`,
  ];

  if (!input.eligible) {
    return {
      version: FACE_SHAPE_VERSION,
      formulaId: FACE_SHAPE_FORMULA_ID,
      availability: 'unavailable',
      confidence: 0,
      scores: {},
      signals: {},
      unavailableReason: 'measurement_not_eligible',
      explanationAr: 'شكل الوجه غير متاح — القياس غير مؤهل.',
      explanationEn: 'Face shape unavailable — measurement not eligible.',
      limitations: [
        ...baseLimits,
        ...input.eligibilityReasons.map((c) => `eligibility:${c}`),
      ],
    };
  }

  if (!input.anchors || !anchorsAreValid(input.anchors)) {
    return {
      version: FACE_SHAPE_VERSION,
      formulaId: FACE_SHAPE_FORMULA_ID,
      availability: 'unavailable',
      confidence: 0,
      scores: {},
      signals: {},
      unavailableReason: 'missing_or_invalid_geometry_anchors',
      explanationAr: 'شكل الوجه غير متاح — مراسي غير كافية.',
      explanationEn: 'Face shape unavailable — anchors insufficient.',
      limitations: baseLimits,
    };
  }

  const a = input.anchors;
  const cheekW = dist(a.leftFace, a.rightFace);
  const faceH = dist(a.foreheadTop, a.chin);
  const foreheadW = dist(a.leftEyeOuter, a.rightEyeOuter);
  const jawW = dist(a.leftJaw, a.rightJaw);

  if (cheekW < 1e-6 || faceH < 1e-6 || foreheadW < 1e-6 || jawW < 1e-6) {
    return {
      version: FACE_SHAPE_VERSION,
      formulaId: FACE_SHAPE_FORMULA_ID,
      availability: 'unavailable',
      confidence: 0,
      scores: {},
      signals: { cheekW, faceH, foreheadW, jawW },
      unavailableReason: 'degenerate_face_span',
      explanationAr: 'شكل الوجه غير متاح — أبعاد الوجه degenerate.',
      explanationEn: 'Face shape unavailable — degenerate face spans.',
      limitations: baseLimits,
    };
  }

  const wh = cheekW / faceH;
  const f2c = foreheadW / cheekW;
  const j2c = jawW / cheekW;
  const f2j = foreheadW / Math.max(jawW, 1e-6);

  const scores: Record<FaceShapeId, number> = {
    oblong: falling(wh, 0.62, 0.72) * (0.55 + 0.45 * near(f2c, 0.95, 0.2)),
    round:
      rising(wh, 0.82, 0.92) *
      near(j2c, 0.95, 0.15) *
      near(f2c, 0.95, 0.15),
    square:
      rising(wh, 0.76, 0.88) *
      near(j2c, 1.0, 0.1) *
      near(f2c, 0.98, 0.12) *
      (1 - 0.35 * falling(wh, 0.7, 0.78)),
    heart:
      rising(f2j, 1.08, 1.28) *
      falling(j2c, 0.72, 0.9) *
      near(wh, 0.74, 0.14),
    triangle:
      rising(j2c - f2c, 0.04, 0.14) *
      rising(j2c, 0.88, 1.02) *
      near(wh, 0.76, 0.14),
    diamond:
      falling(f2c, 0.78, 0.92) *
      falling(j2c, 0.78, 0.92) *
      near(wh, 0.74, 0.12),
    oval:
      near(wh, 0.74, 0.1) *
      near(f2c, 0.92, 0.14) *
      near(j2c, 0.86, 0.14) *
      (1 - 0.5 * rising(Math.abs(f2j - 1.05), 0.12, 0.28)),
  };

  let best: FaceShapeId = 'oval';
  let bestScore = -1;
  let second = 0;
  for (const id of FACE_SHAPE_IDS) {
    const s = scores[id];
    if (s > bestScore) {
      second = bestScore;
      bestScore = s;
      best = id;
    } else if (s > second) {
      second = s;
    }
  }

  if (bestScore < 0.22) {
    return {
      version: FACE_SHAPE_VERSION,
      formulaId: FACE_SHAPE_FORMULA_ID,
      availability: 'unavailable',
      confidence: 0,
      scores,
      signals: { wh, f2c, j2c, f2j, cheekW, faceH, foreheadW, jawW },
      unavailableReason: 'low_shape_signal',
      explanationAr: 'إشارة شكل الوجه ضعيفة — لم يُخترع تصنيف.',
      explanationEn: 'Weak face-shape signal — class not invented.',
      limitations: baseLimits,
    };
  }

  const qualityMul =
    input.trackingQuality === 'high'
      ? 1
      : input.trackingQuality === 'medium'
        ? 0.9
        : input.trackingQuality === 'low'
          ? 0.75
          : 0.85;

  const margin = bestScore - Math.max(second, 0);
  const confidence = clamp100((48 + margin * 95 + bestScore * 20) * qualityMul);
  const labels = FACE_SHAPE_LABELS[best];

  return {
    version: FACE_SHAPE_VERSION,
    formulaId: FACE_SHAPE_FORMULA_ID,
    availability: 'available',
    shapeId: best,
    confidence,
    scores,
    signals: { wh, f2c, j2c, f2j, cheekW, faceH, foreheadW, jawW },
    explanationAr: `شكل الوجه الظاهر: ${labels.displayNameAr} (ثقة ${confidence}). صيغة هجينة من نسب العرض/الارتفاع والجبهة/الوجنة/الفك.`,
    explanationEn: `Apparent face shape: ${labels.displayNameEn} (confidence ${confidence}). Hybrid ratios of width/height and forehead/cheek/jaw spans.`,
    limitations: [
      ...baseLimits,
      'Hybrid heuristic — lighting, hairstyle, and expression can shift class.',
      'Jaw span uses MediaPipe chinArc endpoints (indices owned by MediapipeLandmarkIndices).',
    ],
  };
}

export function faceShapeMetricFromClassification(
  shape: FaceShapeClassification,
): CanonicalFaceMetric {
  const cat = CANONICAL_FACE_METRIC_CATALOG.faceShape;
  if (shape.availability !== 'available' || !shape.shapeId) {
    return unavailableFaceMetric(
      'faceShape',
      shape.unavailableReason ?? 'shape_unavailable',
      shape.limitations,
    );
  }
  return {
    id: 'faceShape',
    displayNameAr: cat.displayNameAr,
    displayNameEn: cat.displayNameEn,
    categoricalValue: shape.shapeId,
    normalizedValue: shape.confidence,
    confidence: shape.confidence,
    availability: 'available',
    source: 'locally_calculated',
    limitations: shape.limitations,
  };
}

/** Merge 4C faceShape into a geometry-applied canonical model. */
export function applyFaceShapeToCanonicalModel(
  base: CanonicalFaceModel,
  shape: FaceShapeClassification,
): CanonicalFaceModel {
  const shapeMetric = faceShapeMetricFromClassification(shape);
  const metrics = base.metrics.map((m) =>
    m.id === 'faceShape' ? shapeMetric : m,
  );
  return {
    ...base,
    version: FACE_MODEL_VERSION,
    intelligenceVersion: FACE_INTELLIGENCE_VERSION,
    foundationVersion: FACE_FOUNDATION_VERSION,
    metrics,
    limitations: [
      'Phase 4C face shape applied where signals allow.',
      'Sibling to Skin Intelligence; does not modify SVI or FaceHealthMap.',
      ...shape.limitations.slice(0, 3),
      ...base.limitations.filter((l) => !l.includes('faceShape remains')),
    ].slice(0, 8),
  };
}
