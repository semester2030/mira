/**
 * Phase 4C — Explainable face feature findings.
 *
 * JUSTIFICATION: Architecture Lock — face findings sibling to skin findings.
 * Does NOT import skin-intelligence. Does NOT diagnose medically.
 * Evidence only from available face geometry / shape metrics.
 */

import { CanonicalFaceModel } from '../canonical-face.model';
import { GeometryComputationResult } from '../geometry/face-geometry.engine';
import {
  FaceShapeClassification,
  FACE_SHAPE_LABELS,
  FaceShapeId,
} from './face-shape.classifier';

export type FaceFindingSeverity = 'info' | 'notable';
export type FaceFindingConfidence = 'high' | 'medium' | 'low' | 'unavailable';
export type FaceFindingCategory = 'shape' | 'proportion' | 'symmetry_note';

export interface FaceFinding {
  id: string;
  category: FaceFindingCategory;
  metricIds: string[];
  titleAr: string;
  titleEn: string;
  detailAr: string;
  detailEn: string;
  severity: FaceFindingSeverity;
  confidence: FaceFindingConfidence;
  recommendationEligible: boolean;
  priority: number;
  limitations: string[];
  source: string;
}

function confBand(c: number): FaceFindingConfidence {
  if (c <= 0) return 'unavailable';
  if (c >= 80) return 'high';
  if (c >= 55) return 'medium';
  return 'low';
}

const SHAPE_DETAIL: Record<
  FaceShapeId,
  { ar: string; en: string }
> = {
  oval: {
    ar: 'نسب متوازنة نسبياً بين العرض والارتفاع مع فك أضيق قليلاً من الوجنة.',
    en: 'Relatively balanced width/height with a jaw slightly narrower than the cheeks.',
  },
  round: {
    ar: 'عرض أقرب للارتفاع مع تقارب عروض الجبهة والوجنة والفك.',
    en: 'Width closer to height with similar forehead, cheek, and jaw spans.',
  },
  square: {
    ar: 'عرض/ارتفاع أقصر مع فك قريب من عرض الوجنة (تصنيف تجميلي ظاهري).',
    en: 'Shorter width/height with jaw near cheek width (cosmetic apparent class).',
  },
  heart: {
    ar: 'جبهة أعرض نسبياً من الفك السفلي الظاهر.',
    en: 'Forehead relatively wider than the apparent lower jaw.',
  },
  oblong: {
    ar: 'ارتفاع الوجه أطول نسبياً مقارنة بالعرض.',
    en: 'Face height relatively longer compared with width.',
  },
  diamond: {
    ar: 'الوجنة هي الأعرض نسبياً مقابل جبهة وفك أضيق.',
    en: 'Cheeks relatively widest versus narrower forehead and jaw.',
  },
  triangle: {
    ar: 'الفك أعرض نسبياً من الجبهة الظاهرة.',
    en: 'Jaw relatively wider than the apparent forehead.',
  },
};

/**
 * Build deterministic face findings from available shape + geometry only.
 */
export function buildFaceFindings(input: {
  model: CanonicalFaceModel;
  shape: FaceShapeClassification;
  geometry: GeometryComputationResult;
}): FaceFinding[] {
  const findings: FaceFinding[] = [];
  const limits = [
    'Cosmetic styling finding — not a medical diagnosis.',
    'Not attractiveness scoring.',
    'Independent of skin type / undertone.',
  ];

  if (input.shape.availability === 'available' && input.shape.shapeId) {
    const id = input.shape.shapeId;
    const labels = FACE_SHAPE_LABELS[id];
    const detail = SHAPE_DETAIL[id];
    findings.push({
      id: `face_shape_${id}`,
      category: 'shape',
      metricIds: ['faceShape'],
      titleAr: `شكل الوجه: ${labels.displayNameAr}`,
      titleEn: `Face shape: ${labels.displayNameEn}`,
      detailAr: detail.ar,
      detailEn: detail.en,
      severity: 'info',
      confidence: confBand(input.shape.confidence),
      recommendationEligible: true,
      priority: 10,
      limitations: limits,
      source: 'face-shape-hybrid-ratios-v1',
    });

    if (id === 'oblong') {
      findings.push({
        id: 'elongated_vertical_proportion',
        category: 'proportion',
        metricIds: ['faceWidthHeightRatio', 'faceShape'],
        titleAr: 'نِسَب عمودية أطول ظاهرياً',
        titleEn: 'Apparently elongated vertical proportions',
        detailAr: 'ارتفاع الوجه أكبر نسبياً من العرض في القياس الحالي.',
        detailEn: 'Face height is relatively larger than width in the current measurement.',
        severity: 'notable',
        confidence: confBand(input.shape.confidence),
        recommendationEligible: true,
        priority: 20,
        limitations: limits,
        source: 'face-shape-hybrid-ratios-v1',
      });
    }
    if (id === 'heart') {
      findings.push({
        id: 'narrower_lower_face',
        category: 'proportion',
        metricIds: ['faceShape'],
        titleAr: 'جزء سفلي أضيق ظاهرياً',
        titleEn: 'Apparently narrower lower face',
        detailAr: 'عرض الفك أقل نسبياً من الجبهة في المراسي الحالية.',
        detailEn: 'Jaw span is relatively smaller than forehead in current anchors.',
        severity: 'info',
        confidence: confBand(input.shape.confidence),
        recommendationEligible: true,
        priority: 25,
        limitations: limits,
        source: 'face-shape-hybrid-ratios-v1',
      });
    }
    if (id === 'triangle') {
      findings.push({
        id: 'wider_lower_face',
        category: 'proportion',
        metricIds: ['faceShape'],
        titleAr: 'جزء سفلي أعرض ظاهرياً',
        titleEn: 'Apparently wider lower face',
        detailAr: 'عرض الفك أكبر نسبياً من الجبهة في المراسي الحالية.',
        detailEn: 'Jaw span is relatively larger than forehead in current anchors.',
        severity: 'info',
        confidence: confBand(input.shape.confidence),
        recommendationEligible: true,
        priority: 25,
        limitations: limits,
        source: 'face-shape-hybrid-ratios-v1',
      });
    }
  }

  const byId = Object.fromEntries(input.model.metrics.map((m) => [m.id, m]));
  const thirds = byId.facialThirdsBalance;
  if (
    thirds?.availability === 'available' &&
    (thirds.normalizedValue ?? 0) >= 70
  ) {
    findings.push({
      id: 'balanced_facial_thirds',
      category: 'proportion',
      metricIds: ['facialThirdsBalance'],
      titleAr: 'توازن أثلاث وجه جيد ظاهرياً',
      titleEn: 'Apparently balanced facial thirds',
      detailAr: `درجة توازن الأثلاث ${thirds.normalizedValue}.`,
      detailEn: `Facial thirds balance score ${thirds.normalizedValue}.`,
      severity: 'info',
      confidence: confBand(thirds.confidence),
      recommendationEligible: true,
      priority: 40,
      limitations: limits,
      source: 'face-geom-ratios-thirds-sym-v1',
    });
  }

  const sym = byId.symmetryCautious;
  if (
    sym?.availability === 'available' &&
    (sym.normalizedValue ?? 100) < 55
  ) {
    findings.push({
      id: 'soft_asymmetry_note',
      category: 'symmetry_note',
      metricIds: ['symmetryCautious'],
      titleAr: 'ملاحظة تماثل ظاهري حذرة',
      titleEn: 'Cautious apparent-symmetry note',
      detailAr:
        'انحراف L/R ظاهري أعلى من النطاق الهادئ — قد يكون بسبب الوضعية أو التعبير، وليس تشخيصاً.',
      detailEn:
        'Apparent L/R deviation above the calm band — may be pose/expression; not a diagnosis.',
      severity: 'notable',
      confidence: confBand(sym.confidence),
      recommendationEligible: false,
      priority: 50,
      limitations: [
        ...limits,
        'Symmetry note is cautious and pose-sensitive.',
      ],
      source: 'face-geom-ratios-thirds-sym-v1',
    });
  }

  // Geometry explanations are optional evidence; do not invent findings from empty geometry.
  void input.geometry;

  return findings.sort((a, b) => a.priority - b.priority);
}
