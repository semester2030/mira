/**
 * Phase 4E — Face Intelligence Report DTO (sibling to Skin report).
 *
 * JUSTIFICATION: Architecture Lock — Face Report DTO on MiraBeautyReport.
 * Does NOT overload FaceHealthMap. No provider JSON. No attractiveness score.
 * Feature layers are narrative styling overlays — not skin heatmap truth.
 */

import {
  CanonicalFaceMetric,
  CanonicalFaceModel,
  FACE_INTELLIGENCE_VERSION,
  FACE_MODEL_VERSION,
} from '../canonical-face.model';
import { FaceFinding } from '../features/face-finding.engine';
import {
  FACE_SHAPE_FORMULA_ID,
  FACE_SHAPE_LABELS,
  FACE_SHAPE_VERSION,
  FaceShapeClassification,
} from '../features/face-shape.classifier';
import {
  FACE_RECOMMENDATION_ENGINE_ID,
  FACE_RECOMMENDATION_VERSION,
  FaceRecommendation,
} from '../recommendation/face-recommendation.engine';
import { FACE_GEOMETRY_FORMULA_ID, FACE_GEOMETRY_VERSION } from '../geometry/face-geometry.engine';

export const FACE_REPORT_VERSION = 'face-report-v1';
export const CAPTURE_VERSION_DEFAULT = 'cq-thresholds-v2.1';

export type FaceFeatureLayerKind = 'shape' | 'proportion' | 'symmetry_note';

/** Narrative feature overlay — NOT FaceHealthMap / skin heatmap. */
export interface FaceFeatureLayer {
  id: string;
  kind: FaceFeatureLayerKind;
  titleAr: string;
  titleEn: string;
  detailAr: string;
  detailEn: string;
  metricIds: string[];
  confidence: string;
}

/** Clean client DTO — no provider JSON leakage. */
export interface FaceIntelligenceReportDto {
  analysisId: string;
  provider: string;
  formulaVersion: string;
  captureVersion: string;
  faceVersion: string;
  intelligenceVersion: string;
  geometryVersion: string;
  geometryFormulaId: string;
  shapeVersion: string;
  shapeFormulaId: string;
  recommendationVersion: string;
  recommendationEngineId: string;
  reportVersion: string;
  generatedAt: string;
  confidence: number;
  limitations: string[];
  language: 'ar' | 'en' | 'ar+en';

  executiveSummaryAr: string;
  executiveSummaryEn: string;

  measurementEligible: boolean;
  eligibilityReasonCodes: string[];

  shape: {
    availability: 'available' | 'unavailable';
    shapeId?: string;
    displayNameAr?: string;
    displayNameEn?: string;
    confidence: number;
    explanationAr: string;
    explanationEn: string;
    unavailableReason?: string;
  };

  findings: FaceFinding[];
  notableFindings: FaceFinding[];

  metrics: Array<{
    id: string;
    displayNameAr: string;
    displayNameEn: string;
    availability: 'available' | 'unavailable';
    normalizedValue?: number;
    categoricalValue?: string;
    confidence: number;
    source: string;
    limitations: string[];
    unavailableReason?: string;
  }>;

  recommendations: FaceRecommendation[];

  /** Styling feature layers — sibling narrative, never FaceHealthMap. */
  featureLayers: FaceFeatureLayer[];

  retakeGuidanceAr: string;
  retakeGuidanceEn: string;
  metadata: {
    isMock: boolean;
    measurementEligible: boolean;
    schemaNote: string;
  };
}

function metricRows(model: CanonicalFaceModel): FaceIntelligenceReportDto['metrics'] {
  return model.metrics.map((m: CanonicalFaceMetric) => ({
    id: m.id,
    displayNameAr: m.displayNameAr,
    displayNameEn: m.displayNameEn,
    availability: m.availability,
    normalizedValue: m.normalizedValue,
    categoricalValue: m.categoricalValue,
    confidence: m.confidence,
    source: m.source,
    limitations: m.limitations,
    unavailableReason: m.unavailableReason,
  }));
}

function buildFeatureLayers(findings: FaceFinding[]): FaceFeatureLayer[] {
  return findings.map((f) => ({
    id: `layer_${f.id}`,
    kind: f.category,
    titleAr: f.titleAr,
    titleEn: f.titleEn,
    detailAr: f.detailAr,
    detailEn: f.detailEn,
    metricIds: [...f.metricIds],
    confidence: f.confidence,
  }));
}

function reportConfidence(
  shape: FaceShapeClassification,
  metrics: CanonicalFaceMetric[],
): number {
  if (shape.availability === 'available' && shape.confidence > 0) {
    return shape.confidence;
  }
  const available = metrics.filter((m) => m.availability === 'available');
  if (available.length === 0) return 0;
  return Math.round(
    available.reduce((s, m) => s + m.confidence, 0) / available.length,
  );
}

export function buildFaceIntelligenceReport(input: {
  analysisId: string;
  model: CanonicalFaceModel;
  shape: FaceShapeClassification;
  findings: FaceFinding[];
  recommendations: FaceRecommendation[];
  captureVersion?: string;
  language?: 'ar' | 'en' | 'ar+en';
}): FaceIntelligenceReportDto {
  const generatedAt = new Date().toISOString();
  const notable = input.findings.filter((f) => f.severity === 'notable');
  const shapeLabels =
    input.shape.shapeId != null
      ? FACE_SHAPE_LABELS[input.shape.shapeId]
      : null;

  const shapeLineAr =
    input.shape.availability === 'available' && shapeLabels
      ? `شكل الوجه الظاهر: ${shapeLabels.displayNameAr} (ثقة ${input.shape.confidence}).`
      : 'شكل الوجه غير متاح في هذه القراءة.';
  const shapeLineEn =
    input.shape.availability === 'available' && shapeLabels
      ? `Apparent face shape: ${shapeLabels.displayNameEn} (confidence ${input.shape.confidence}).`
      : 'Face shape unavailable in this reading.';

  const topFinding = input.findings.find((f) => f.id.startsWith('face_shape_'));
  const recoCount = input.recommendations.filter(
    (r) => r.category !== 'educational',
  ).length;

  const executiveSummaryAr = [
    shapeLineAr,
    topFinding ? topFinding.detailAr : '',
    recoCount > 0
      ? `${recoCount} توصيات تنسيق تجميلية بأدلة.`
      : 'لا توصيات تنسيق إضافية في هذه القراءة.',
    'ذكاء ملامح تجميلي — ليس تشخيصاً طبياً ولا درجة جاذبية. منفصل عن خريطة صحة البشرة.',
  ]
    .filter(Boolean)
    .join(' ');

  const executiveSummaryEn = [
    shapeLineEn,
    topFinding ? topFinding.detailEn : '',
    recoCount > 0
      ? `${recoCount} evidence-backed cosmetic styling tips.`
      : 'No additional styling tips in this reading.',
    'Cosmetic facial-feature intelligence — not medical diagnosis or attractiveness scoring. Separate from skin FaceHealthMap.',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    analysisId: input.analysisId,
    provider: input.model.provider,
    formulaVersion: FACE_SHAPE_FORMULA_ID,
    captureVersion: input.captureVersion ?? CAPTURE_VERSION_DEFAULT,
    faceVersion: FACE_MODEL_VERSION,
    intelligenceVersion: FACE_INTELLIGENCE_VERSION,
    geometryVersion: FACE_GEOMETRY_VERSION,
    geometryFormulaId: FACE_GEOMETRY_FORMULA_ID,
    shapeVersion: FACE_SHAPE_VERSION,
    shapeFormulaId: FACE_SHAPE_FORMULA_ID,
    recommendationVersion: FACE_RECOMMENDATION_VERSION,
    recommendationEngineId: FACE_RECOMMENDATION_ENGINE_ID,
    reportVersion: FACE_REPORT_VERSION,
    generatedAt,
    confidence: reportConfidence(input.shape, input.model.metrics),
    limitations: [
      'Cosmetic facial-feature report — not attractiveness scoring.',
      'Not a medical or clinical assessment.',
      'Feature layers are styling narratives — not skin heatmap measurement truth.',
      'Sibling to Skin Intelligence; does not modify FaceHealthMap or SVI.',
      ...input.model.limitations.slice(0, 3),
      ...input.shape.limitations.slice(0, 2),
    ],
    language: input.language ?? 'ar+en',
    executiveSummaryAr,
    executiveSummaryEn,
    measurementEligible: input.model.measurementEligible,
    eligibilityReasonCodes: [...input.model.eligibilityReasonCodes],
    shape: {
      availability: input.shape.availability,
      shapeId: input.shape.shapeId,
      displayNameAr: shapeLabels?.displayNameAr,
      displayNameEn: shapeLabels?.displayNameEn,
      confidence: input.shape.confidence,
      explanationAr: input.shape.explanationAr,
      explanationEn: input.shape.explanationEn,
      unavailableReason: input.shape.unavailableReason,
    },
    findings: input.findings,
    notableFindings: notable,
    metrics: metricRows(input.model),
    recommendations: input.recommendations,
    featureLayers: buildFeatureLayers(input.findings),
    retakeGuidanceAr:
      'لقراءة ملامح أوضح: إضاءة أمامية ناعمة، وجه أمامي ثابت، مسافة كافية، بدون التفات قوي.',
    retakeGuidanceEn:
      'For clearer feature reading: soft front light, steady frontal face, adequate distance, no strong head turn.',
    metadata: {
      isMock: input.model.isMock,
      measurementEligible: input.model.measurementEligible,
      schemaNote:
        'faceIntelligence sibling on MiraBeautyReport — never FaceHealthMap schema.',
    },
  };
}
