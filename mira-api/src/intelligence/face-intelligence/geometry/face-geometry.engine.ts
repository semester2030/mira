/**
 * Phase 4B — Face Geometry Engine.
 *
 * JUSTIFICATION: Architecture Lock — no ratios/thirds/symmetry engine existed.
 * FORMULA VERSION: face-geometry-v1
 *
 * Does NOT claim attractiveness, beauty ranking, or medical diagnosis.
 * Does NOT invent values when anchors/eligibility missing.
 *
 * Formulas (documented):
 * - faceWidth = dist(leftFace, rightFace)
 * - faceHeight = dist(foreheadTop, chin)
 * - faceWidthHeightRatio = faceWidth / faceHeight
 * - eyeSpacingRatio = dist(leftEyeInner, rightEyeInner) / faceWidth
 * - noseToFaceWidthRatio = dist(leftAla, rightAla) / faceWidth
 * - mouthToFaceWidthRatio = dist(leftMouth, rightMouth) / faceWidth
 * - facial thirds: upper=browMid.y-foreheadTop.y, mid=noseBase.y-browMid.y,
 *   lower=chin.y-noseBase.y (vertical extents); balance from coefficient of variation
 * - symmetryCautious: mean relative L/R deviation of eye outer y, mouth corners y,
 *   face sides x-mirror vs midline — capped confidence
 */

import {
  CANONICAL_FACE_METRIC_CATALOG,
  CanonicalFaceMetric,
  CanonicalFaceMetricId,
  CanonicalFaceModel,
  FACE_FOUNDATION_VERSION,
  FACE_INTELLIGENCE_VERSION,
  FACE_MODEL_VERSION,
  unavailableFaceMetric,
} from '../canonical-face.model';
import {
  anchorsAreValid,
  dist,
  GeometryAnchors,
  midpoint,
} from './geometry-anchors';

export const FACE_GEOMETRY_VERSION = 'face-geometry-v1';
export const FACE_GEOMETRY_FORMULA_ID = 'face-geom-ratios-thirds-sym-v1';

export interface GeometryComputationResult {
  version: typeof FACE_GEOMETRY_VERSION;
  formulaId: typeof FACE_GEOMETRY_FORMULA_ID;
  metrics: CanonicalFaceMetric[];
  raw: Record<string, number>;
  explanations: Record<
    string,
    { ar: string; en: string; formula: string }
  >;
  limitations: string[];
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function clamp100(n: number): number {
  return Math.round(Math.min(100, Math.max(0, n)));
}

/** Map raw ratio into 0–100 balance vs [lo, hi] typical cosmetic band. */
function bandScore(raw: number, lo: number, hi: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  const mid = (lo + hi) / 2;
  const half = (hi - lo) / 2 || 0.01;
  const deviation = Math.abs(raw - mid) / half;
  return clamp100((1 - clamp01(deviation)) * 100);
}

function metricAvailable(
  id: CanonicalFaceMetricId,
  opts: {
    raw: number;
    normalized: number;
    confidence: number;
    limitations: string[];
  },
): CanonicalFaceMetric {
  const cat = CANONICAL_FACE_METRIC_CATALOG[id];
  return {
    id,
    displayNameAr: cat.displayNameAr,
    displayNameEn: cat.displayNameEn,
    normalizedValue: opts.normalized,
    confidence: opts.confidence,
    availability: 'available',
    source: 'locally_calculated',
    limitations: opts.limitations,
    // raw ratio stored via categorical for transport without schema break
    categoricalValue: `raw=${opts.raw.toFixed(4)}`,
  };
}

/**
 * Compute 4B geometry metrics from anchors.
 * Returns unavailable metrics (never invented) when inputs insufficient.
 */
export function computeFaceGeometry(input: {
  eligible: boolean;
  eligibilityReasons: string[];
  anchors?: GeometryAnchors | null;
  trackingQuality?: 'low' | 'medium' | 'high';
}): GeometryComputationResult {
  const baseLimits = [
    'Cosmetic facial geometry — not attractiveness scoring.',
    'Not a medical or clinical craniofacial assessment.',
    'Pose, camera lens, and lighting can affect measurements.',
    `Formula ${FACE_GEOMETRY_FORMULA_ID}`,
  ];

  if (!input.eligible) {
    return {
      version: FACE_GEOMETRY_VERSION,
      formulaId: FACE_GEOMETRY_FORMULA_ID,
      metrics: (
        [
          'facialThirdsBalance',
          'eyeSpacingRatio',
          'faceWidthHeightRatio',
          'noseToFaceWidthRatio',
          'mouthToFaceWidthRatio',
          'symmetryCautious',
        ] as CanonicalFaceMetricId[]
      ).map((id) =>
        unavailableFaceMetric(id, 'measurement_not_eligible', [
          ...baseLimits,
          ...input.eligibilityReasons.map((c) => `eligibility:${c}`),
        ]),
      ),
      raw: {},
      explanations: {},
      limitations: [...baseLimits, 'Geometry skipped — measurement not eligible.'],
    };
  }

  if (!input.anchors || !anchorsAreValid(input.anchors)) {
    return {
      version: FACE_GEOMETRY_VERSION,
      formulaId: FACE_GEOMETRY_FORMULA_ID,
      metrics: (
        [
          'facialThirdsBalance',
          'eyeSpacingRatio',
          'faceWidthHeightRatio',
          'noseToFaceWidthRatio',
          'mouthToFaceWidthRatio',
          'symmetryCautious',
        ] as CanonicalFaceMetricId[]
      ).map((id) =>
        unavailableFaceMetric(id, 'missing_or_invalid_geometry_anchors', baseLimits),
      ),
      raw: {},
      explanations: {},
      limitations: [...baseLimits, 'Geometry anchors missing or invalid.'],
    };
  }

  const a = input.anchors;
  const faceWidth = dist(a.leftFace, a.rightFace);
  const faceHeight = dist(a.foreheadTop, a.chin);

  if (faceWidth < 1e-6 || faceHeight < 1e-6) {
    return {
      version: FACE_GEOMETRY_VERSION,
      formulaId: FACE_GEOMETRY_FORMULA_ID,
      metrics: (
        [
          'facialThirdsBalance',
          'eyeSpacingRatio',
          'faceWidthHeightRatio',
          'noseToFaceWidthRatio',
          'mouthToFaceWidthRatio',
          'symmetryCautious',
        ] as CanonicalFaceMetricId[]
      ).map((id) =>
        unavailableFaceMetric(id, 'degenerate_face_span', baseLimits),
      ),
      raw: { faceWidth, faceHeight },
      explanations: {},
      limitations: [...baseLimits, 'Face width/height degenerate.'],
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

  const widthHeight = faceWidth / faceHeight;
  const eyeSpacing = dist(a.leftEyeInner, a.rightEyeInner) / faceWidth;
  const noseWidth = dist(a.leftAla, a.rightAla) / faceWidth;
  const mouthWidth = dist(a.leftMouth, a.rightMouth) / faceWidth;

  // Vertical thirds (use y extents; require forehead above chin)
  const upper = Math.abs(a.browMid.y - a.foreheadTop.y);
  const middle = Math.abs(a.noseBase.y - a.browMid.y);
  const lower = Math.abs(a.chin.y - a.noseBase.y);
  const thirdSum = upper + middle + lower;
  let thirdsBalance = 0;
  let thirdsCv = 0;
  if (thirdSum > 1e-6) {
    const mean = thirdSum / 3;
    const variance =
      ((upper - mean) ** 2 + (middle - mean) ** 2 + (lower - mean) ** 2) / 3;
    thirdsCv = Math.sqrt(variance) / mean;
    thirdsBalance = clamp100((1 - clamp01(thirdsCv / 0.45)) * 100);
  }

  // Cautious symmetry: mirror deviations about face midline
  const mid = midpoint(a.leftFace, a.rightFace);
  const eyeYDev = Math.abs(a.leftEyeOuter.y - a.rightEyeOuter.y) / faceHeight;
  const mouthYDev = Math.abs(a.leftMouth.y - a.rightMouth.y) / faceHeight;
  const leftDx = Math.abs(a.leftFace.x - mid.x);
  const rightDx = Math.abs(a.rightFace.x - mid.x);
  const sideDev =
    Math.abs(leftDx - rightDx) / Math.max(leftDx + rightDx, 1e-6);
  const asym = (eyeYDev + mouthYDev + sideDev) / 3;
  const symmetryScore = clamp100((1 - clamp01(asym / 0.12)) * 100);

  const confBase = clamp100(78 * qualityMul);
  const confSym = clamp100(62 * qualityMul); // cautious — lower ceiling

  const raw = {
    faceWidth,
    faceHeight,
    widthHeight,
    eyeSpacing,
    noseWidth,
    mouthWidth,
    thirdUpper: upper,
    thirdMiddle: middle,
    thirdLower: lower,
    thirdsCv,
    asymmetryIndex: asym,
  };

  const metrics: CanonicalFaceMetric[] = [
    metricAvailable('faceWidthHeightRatio', {
      raw: widthHeight,
      normalized: bandScore(widthHeight, 0.65, 0.9),
      confidence: confBase,
      limitations: [
        ...baseLimits,
        'faceWidthHeightRatio = dist(leftFace,rightFace) / dist(foreheadTop,chin).',
      ],
    }),
    metricAvailable('eyeSpacingRatio', {
      raw: eyeSpacing,
      normalized: bandScore(eyeSpacing, 0.28, 0.4),
      confidence: confBase,
      limitations: [
        ...baseLimits,
        'eyeSpacingRatio = interocular(inner corners) / faceWidth.',
      ],
    }),
    metricAvailable('noseToFaceWidthRatio', {
      raw: noseWidth,
      normalized: bandScore(noseWidth, 0.18, 0.32),
      confidence: confBase,
      limitations: [
        ...baseLimits,
        'noseToFaceWidthRatio = dist(leftAla,rightAla) / faceWidth.',
      ],
    }),
    metricAvailable('mouthToFaceWidthRatio', {
      raw: mouthWidth,
      normalized: bandScore(mouthWidth, 0.32, 0.5),
      confidence: confBase,
      limitations: [
        ...baseLimits,
        'mouthToFaceWidthRatio = dist(leftMouth,rightMouth) / faceWidth.',
      ],
    }),
    metricAvailable('facialThirdsBalance', {
      raw: thirdsCv,
      normalized: thirdsBalance,
      confidence: confBase,
      limitations: [
        ...baseLimits,
        'Thirds from vertical spans forehead→brow, brow→noseBase, noseBase→chin; score from low CV.',
      ],
    }),
    metricAvailable('symmetryCautious', {
      raw: asym,
      normalized: symmetryScore,
      confidence: confSym,
      limitations: [
        ...baseLimits,
        'Cautious L/R deviation only — not medical symmetry diagnosis.',
        'Strongly affected by head yaw; eligibility must keep pose frontal.',
      ],
    }),
  ];

  const explanations: GeometryComputationResult['explanations'] = {
    faceWidthHeightRatio: {
      ar: `نسبة العرض/الارتفاع = ${widthHeight.toFixed(3)} → توازن ${bandScore(widthHeight, 0.65, 0.9)}.`,
      en: `Width/height ratio = ${widthHeight.toFixed(3)} → balance ${bandScore(widthHeight, 0.65, 0.9)}.`,
      formula: 'dist(leftFace,rightFace)/dist(foreheadTop,chin)',
    },
    eyeSpacingRatio: {
      ar: `تباعد العينين النسبي = ${eyeSpacing.toFixed(3)}.`,
      en: `Relative eye spacing = ${eyeSpacing.toFixed(3)}.`,
      formula: 'dist(leftEyeInner,rightEyeInner)/faceWidth',
    },
    facialThirdsBalance: {
      ar: `توازن الأثلاث = ${thirdsBalance} (CV=${thirdsCv.toFixed(3)}).`,
      en: `Facial thirds balance = ${thirdsBalance} (CV=${thirdsCv.toFixed(3)}).`,
      formula: '1 - clamp(CV(thirds)/0.45)',
    },
    symmetryCautious: {
      ar: `تماثل حذر = ${symmetryScore} (مؤشر انحراف=${asym.toFixed(3)}).`,
      en: `Cautious symmetry = ${symmetryScore} (asymmetry index=${asym.toFixed(3)}).`,
      formula: '1 - clamp(mean(L/R deviations)/0.12)',
    },
  };

  return {
    version: FACE_GEOMETRY_VERSION,
    formulaId: FACE_GEOMETRY_FORMULA_ID,
    metrics,
    raw,
    explanations,
    limitations: baseLimits,
  };
}

/** Merge geometry metrics into a canonical face model (faceShape stays 4C). */
export function applyGeometryToCanonicalModel(
  base: CanonicalFaceModel,
  geometry: GeometryComputationResult,
): CanonicalFaceModel {
  const byId = new Map(geometry.metrics.map((m) => [m.id, m]));
  const metrics = base.metrics.map((m) => {
    if (m.id === 'faceShape') {
      return unavailableFaceMetric(m.id, 'awaiting_face_shape_engine_4c', [
        'Cosmetic facial-feature intelligence — not attractiveness scoring.',
        'Face shape reserved for Phase 4C.',
      ]);
    }
    return byId.get(m.id) ?? m;
  });

  return {
    ...base,
    version: FACE_MODEL_VERSION,
    intelligenceVersion: FACE_INTELLIGENCE_VERSION,
    foundationVersion: FACE_FOUNDATION_VERSION,
    metrics,
    limitations: [
      'Phase 4B geometry applied where anchors + eligibility allow.',
      'faceShape remains unavailable until Phase 4C.',
      'Sibling to Skin Intelligence; does not modify SVI or FaceHealthMap.',
      ...geometry.limitations.slice(0, 3),
    ],
  };
}
