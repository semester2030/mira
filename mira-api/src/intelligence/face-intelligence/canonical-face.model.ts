/**
 * Phase 4A — Canonical Face Model (skeleton).
 *
 * JUSTIFICATION (new file): Architecture Lock — no Face Intelligence model exists.
 * Does NOT duplicate Skin Intelligence metrics or FaceHealthMap zones.
 * Geometry values remain unavailable until Phase 4B/4C.
 *
 * Owner: face-intelligence (sole owner of face measurement ids).
 */

export const FACE_MODEL_VERSION = 'face-model-v1';
export const FACE_INTELLIGENCE_VERSION = 'face-intel-v1';
export const FACE_FOUNDATION_VERSION = 'face-foundation-v1';

export type FaceMetricAvailability = 'available' | 'unavailable';
export type FaceMetricSource =
  | 'landmark_measured'
  | 'locally_calculated'
  | 'unavailable'
  | 'mock';

/**
 * Reserved measurement ids — 4A defines the catalog only.
 * Values are produced in 4B (geometry) / 4C (shape). Never invent in 4A.
 */
export type CanonicalFaceMetricId =
  | 'facialThirdsBalance'
  | 'eyeSpacingRatio'
  | 'faceWidthHeightRatio'
  | 'noseToFaceWidthRatio'
  | 'mouthToFaceWidthRatio'
  | 'symmetryCautious'
  | 'faceShape';

export interface CanonicalFaceMetric {
  id: CanonicalFaceMetricId;
  displayNameAr: string;
  displayNameEn: string;
  /** Present only when available (never fabricated). */
  normalizedValue?: number;
  categoricalValue?: string;
  confidence: number;
  availability: FaceMetricAvailability;
  source: FaceMetricSource;
  limitations: string[];
  /** Why unavailable when availability=unavailable */
  unavailableReason?: string;
}

export interface CanonicalFaceModel {
  version: typeof FACE_MODEL_VERSION;
  intelligenceVersion: typeof FACE_INTELLIGENCE_VERSION;
  foundationVersion: typeof FACE_FOUNDATION_VERSION;
  metrics: CanonicalFaceMetric[];
  provider: string;
  isMock: boolean;
  limitations: string[];
  /** Measurement eligibility from pose/quality gates */
  measurementEligible: boolean;
  eligibilityReasonCodes: string[];
}

export const CANONICAL_FACE_METRIC_CATALOG: Record<
  CanonicalFaceMetricId,
  { displayNameAr: string; displayNameEn: string; phaseOwner: '4B' | '4C' }
> = {
  facialThirdsBalance: {
    displayNameAr: 'توازن أثلاث الوجه',
    displayNameEn: 'Facial thirds balance',
    phaseOwner: '4B',
  },
  eyeSpacingRatio: {
    displayNameAr: 'نسبة تباعد العينين',
    displayNameEn: 'Eye spacing ratio',
    phaseOwner: '4B',
  },
  faceWidthHeightRatio: {
    displayNameAr: 'نسبة عرض إلى ارتفاع الوجه',
    displayNameEn: 'Face width-to-height ratio',
    phaseOwner: '4B',
  },
  noseToFaceWidthRatio: {
    displayNameAr: 'نسبة عرض الأنف إلى الوجه',
    displayNameEn: 'Nose-to-face width ratio',
    phaseOwner: '4B',
  },
  mouthToFaceWidthRatio: {
    displayNameAr: 'نسبة عرض الفم إلى الوجه',
    displayNameEn: 'Mouth-to-face width ratio',
    phaseOwner: '4B',
  },
  symmetryCautious: {
    displayNameAr: 'التماثل الظاهر (بحذر)',
    displayNameEn: 'Apparent symmetry (cautious)',
    phaseOwner: '4B',
  },
  faceShape: {
    displayNameAr: 'شكل الوجه',
    displayNameEn: 'Face shape',
    phaseOwner: '4C',
  },
};

export const ALL_FACE_METRIC_IDS = Object.keys(
  CANONICAL_FACE_METRIC_CATALOG,
) as CanonicalFaceMetricId[];

export function unavailableFaceMetric(
  id: CanonicalFaceMetricId,
  unavailableReason: string,
  limitations: string[] = [],
): CanonicalFaceMetric {
  const cat = CANONICAL_FACE_METRIC_CATALOG[id];
  return {
    id,
    displayNameAr: cat.displayNameAr,
    displayNameEn: cat.displayNameEn,
    confidence: 0,
    availability: 'unavailable',
    source: 'unavailable',
    limitations: [
      ...limitations,
      `Catalog owner phase: ${cat.phaseOwner}. Unavailable — value not invented.`,
    ],
    unavailableReason,
  };
}

export function buildSkeletonCanonicalFaceModel(input: {
  measurementEligible: boolean;
  eligibilityReasonCodes: string[];
  provider?: string;
  isMock?: boolean;
}): CanonicalFaceModel {
  const reason = input.measurementEligible
    ? 'awaiting_geometry_engine_4b'
    : 'measurement_not_eligible';

  return {
    version: FACE_MODEL_VERSION,
    intelligenceVersion: FACE_INTELLIGENCE_VERSION,
    foundationVersion: FACE_FOUNDATION_VERSION,
    metrics: ALL_FACE_METRIC_IDS.map((id) =>
      unavailableFaceMetric(id, reason, [
        'Cosmetic facial-feature intelligence — not attractiveness scoring.',
        'Not a medical assessment.',
      ]),
    ),
    provider: input.provider ?? 'on_device_landmarks',
    isMock: input.isMock === true,
    limitations: [
      'Phase 4A foundation only — geometry and face shape not computed.',
      'Sibling to Skin Intelligence; does not modify SVI or FaceHealthMap.',
      'Never invents measurement values.',
    ],
    measurementEligible: input.measurementEligible,
    eligibilityReasonCodes: [...input.eligibilityReasonCodes],
  };
}
