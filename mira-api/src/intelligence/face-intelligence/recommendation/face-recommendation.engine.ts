/**
 * Phase 4D — Face styling recommendations (evidence-backed).
 *
 * JUSTIFICATION: Architecture Lock — styling reco sibling to skin reco.
 * Does NOT import skin-intelligence. Does NOT lock Perfect products.
 * Every non-educational reco requires finding and/or metric evidence.
 */

import { CanonicalFaceModel } from '../canonical-face.model';
import { FaceFinding } from '../features/face-finding.engine';
import {
  FACE_SHAPE_LABELS,
  FaceShapeId,
} from '../features/face-shape.classifier';

export const FACE_RECOMMENDATION_VERSION = 'face-reco-v1';
export const FACE_RECOMMENDATION_ENGINE_ID = 'face-styling-reco-v1';

export type FaceRecommendationCategory =
  | 'hairstyle'
  | 'makeup_contour'
  | 'eyewear'
  | 'accessories'
  | 'educational';

export interface FaceRecommendation {
  id: string;
  category: FaceRecommendationCategory;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  reasonAr: string;
  reasonEn: string;
  evidence: {
    metricIds: string[];
    findingIds: string[];
    values: Record<string, number | string>;
  };
  confidence: number;
  priority: number;
  cosmeticOnly: true;
  productLockIn: false;
  limitations: string[];
}

const COSMETIC_LIMIT =
  'Cosmetic styling guidance only — not a medical prescription or diagnosis.';
const NO_PRODUCT_LOCK =
  'No Perfect Corp / marketplace product lock-in in Phase 4D.';

interface ShapeRecoTemplate {
  category: FaceRecommendationCategory;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  priority: number;
}

const SHAPE_HAIRSTYLE: Record<FaceShapeId, ShapeRecoTemplate> = {
  oval: {
    category: 'hairstyle',
    titleAr: 'مرونة في قصّات الشعر',
    titleEn: 'Flexible hairstyle options',
    bodyAr:
      'الشكل البيضاوي الظاهري يتقبّل معظم الأطوال؛ جرّبي طبقات خفيفة حول الوجه لإبراز التوازن.',
    bodyEn:
      'An apparent oval shape suits most lengths; soft face-framing layers can highlight balance.',
    priority: 20,
  },
  round: {
    category: 'hairstyle',
    titleAr: 'ارتفاع وطبقات لإطالة المظهر',
    titleEn: 'Height and layers for elongation',
    bodyAr:
      'أضيفي حجماً عند التاج وتجنّبي قصّات قصيرة جداً عند الخدين لإطالة المظهر الظاهري.',
    bodyEn:
      'Add crown volume and avoid very short cuts at the cheeks to lengthen the apparent look.',
    priority: 20,
  },
  square: {
    category: 'hairstyle',
    titleAr: 'ليونة حول خط الفك',
    titleEn: 'Softness around the jawline',
    bodyAr:
      'طبقات متموجة أو انحناءات ناعمة حول الفك تخفّف الزوايا الظاهرة دون ادعاء طبي.',
    bodyEn:
      'Waves or soft bends around the jaw soften apparent angles — cosmetic tip only.',
    priority: 20,
  },
  heart: {
    category: 'hairstyle',
    titleAr: 'توازن الجزء السفلي',
    titleEn: 'Balance the lower face',
    bodyAr:
      'أطوال تصل للذقن أو أطول مع طبقات سفلية تساعد على موازنة جبهة أعرض ظاهرياً.',
    bodyEn:
      'Chin-length or longer cuts with lower layers help balance an apparently wider forehead.',
    priority: 20,
  },
  oblong: {
    category: 'hairstyle',
    titleAr: 'عرض جانبي خفيف',
    titleEn: 'Gentle lateral width',
    bodyAr:
      'تجنّبي الارتفاع الزائد عند التاج؛ طبقات جانبية أو انحناء عند الخدين تُقرّب النسب ظاهرياً.',
    bodyEn:
      'Avoid excess crown height; side layers or cheek curves can soften elongated proportions.',
    priority: 20,
  },
  diamond: {
    category: 'hairstyle',
    titleAr: 'تخفيف عرض الوجنة الظاهر',
    titleEn: 'Softening apparent cheek width',
    bodyAr:
      'خصل أمامية ناعمة أو طول متوسط يقلّل التركيز على أوسع نقطة في الوجنة.',
    bodyEn:
      'Soft front pieces or mid-length styles reduce focus on the widest cheek point.',
    priority: 20,
  },
  triangle: {
    category: 'hairstyle',
    titleAr: 'حجم علوي متوازن',
    titleEn: 'Balanced upper volume',
    bodyAr:
      'حجم خفيف عند الجبهة/التاج مع تجنّب كثافة زائدة عند الفك يوازن الجزء السفلي الأعراض ظاهرياً.',
    bodyEn:
      'Light crown/forehead volume while avoiding heavy jaw bulk balances an apparently wider lower face.',
    priority: 20,
  },
};

const SHAPE_CONTOUR: Partial<Record<FaceShapeId, ShapeRecoTemplate>> = {
  round: {
    category: 'makeup_contour',
    titleAr: 'كنتور عمودي خفيف',
    titleEn: 'Soft vertical contour',
    bodyAr:
      'ظلال أغمق رقيقة على جانبي الوجه وإبراز عمودي خفيف يطيل المظهر — تجميلي فقط.',
    bodyEn:
      'Soft side shadow and a light vertical highlight can lengthen the look — cosmetic only.',
    priority: 30,
  },
  oblong: {
    category: 'makeup_contour',
    titleAr: 'كنتور أفقي لطيف',
    titleEn: 'Gentle horizontal contour',
    bodyAr:
      'إبراز على التفاحات وكنتور خفيف تحت عظمة الوجنة يقرّب الطول الظاهر دون مبالغة.',
    bodyEn:
      'Apple highlight with soft under-cheek contour can shorten the apparent length gently.',
    priority: 30,
  },
  heart: {
    category: 'makeup_contour',
    titleAr: 'تخفيف الجبهة وإبراز الذقن',
    titleEn: 'Soften forehead, lift chin',
    bodyAr:
      'كنتور خفيف على الصدغين وإبراز بسيط على الذقن يوازن النسب الظاهرة.',
    bodyEn:
      'Light temple contour and a soft chin highlight balance apparent proportions.',
    priority: 30,
  },
  square: {
    category: 'makeup_contour',
    titleAr: 'تدوير زوايا الفك الظاهر',
    titleEn: 'Softening apparent jaw corners',
    bodyAr:
      'دمج ناعم عند زوايا الفك بدل خطوط حادة يعطي مظهراً ألطف.',
    bodyEn:
      'Soft blending at jaw corners rather than hard lines creates a gentler look.',
    priority: 30,
  },
  diamond: {
    category: 'makeup_contour',
    titleAr: 'موازنة الوجنة',
    titleEn: 'Balancing the cheeks',
    bodyAr:
      'إبراز على الجبهة والذقن مع كنتور خفيف على قمة الوجنة يوزّع الانتباه.',
    bodyEn:
      'Forehead and chin highlight with soft cheekbone contour redistributes focus.',
    priority: 30,
  },
  triangle: {
    category: 'makeup_contour',
    titleAr: 'تضييق الجزء السفلي الظاهر',
    titleEn: 'Softening apparent lower width',
    bodyAr:
      'كنتور لطيف على جانبي الفك السفلي وإبراز علوي خفيف يوازن العرض الظاهر.',
    bodyEn:
      'Gentle lower-jaw contour with light upper highlight balances apparent width.',
    priority: 30,
  },
};

const SHAPE_EYEWEAR: Partial<Record<FaceShapeId, ShapeRecoTemplate>> = {
  round: {
    category: 'eyewear',
    titleAr: 'إطارات بزوايا أوضح',
    titleEn: 'Frames with clearer angles',
    bodyAr:
      'إطارات مستطيلة أو بزوايا خفيفة تضيف تبايناً للوجه المستدير الظاهر.',
    bodyEn:
      'Rectangular or softly angled frames contrast an apparently round face.',
    priority: 40,
  },
  square: {
    category: 'eyewear',
    titleAr: 'إطارات منحنية',
    titleEn: 'Curved frames',
    bodyAr: 'عدسات دائرية أو بيضاوية تليّن الزوايا الظاهرة حول الفك.',
    bodyEn: 'Round or oval lenses soften apparent angles around the jaw.',
    priority: 40,
  },
  heart: {
    category: 'eyewear',
    titleAr: 'إطارات أخف في الأعلى',
    titleEn: 'Lighter upper frames',
    bodyAr:
      'إطارات أرفع عند الحافة العلوية أو بشكل قطة خفيف توازن الجبهة الأعراض ظاهرياً.',
    bodyEn:
      'Lighter top edges or soft cat-eye shapes balance an apparently wider forehead.',
    priority: 40,
  },
  oblong: {
    category: 'eyewear',
    titleAr: 'إطارات أعرض أفقياً',
    titleEn: 'Wider horizontal frames',
    bodyAr: 'إطارات أعرض من منتصف الوجه تقلّل الإحساس بالطول الظاهر.',
    bodyEn: 'Frames wider than mid-face reduce the sense of elongation.',
    priority: 40,
  },
};

function confFromFinding(f: FaceFinding): number {
  if (f.confidence === 'high') return 82;
  if (f.confidence === 'medium') return 68;
  if (f.confidence === 'low') return 52;
  return 0;
}

function shapeIdFromFinding(findingId: string): FaceShapeId | null {
  const m = /^face_shape_([a-z]+)$/.exec(findingId);
  if (!m) return null;
  const id = m[1] as FaceShapeId;
  return id in FACE_SHAPE_LABELS ? id : null;
}

/**
 * Build deterministic styling recommendations from eligible findings only.
 */
export function buildFaceRecommendations(input: {
  model: CanonicalFaceModel;
  findings: FaceFinding[];
}): FaceRecommendation[] {
  const out: FaceRecommendation[] = [];
  const findingIds = new Set(input.findings.map((f) => f.id));

  out.push({
    id: 'edu_face_styling_disclaimer',
    category: 'educational',
    titleAr: 'طبيعة توصيات التنسيق',
    titleEn: 'About styling recommendations',
    bodyAr:
      'اقتراحات ميرا للشعر/المكياج/النظارات تجميلية وإرشادية من شكل الوجه الظاهر والقياسات المتاحة. لا تشخّص ولا تربط بمنتج إلزامي.',
    bodyEn:
      'Mira hairstyle/makeup/eyewear tips are cosmetic guidance from apparent face shape and available measurements. Not diagnostic; no mandatory product lock-in.',
    reasonAr: 'شفافية المنتج وثقة المستخدم.',
    reasonEn: 'Product transparency and user trust.',
    evidence: { metricIds: [], findingIds: [], values: {} },
    confidence: 100,
    priority: 5,
    cosmeticOnly: true,
    productLockIn: false,
    limitations: [COSMETIC_LIMIT, NO_PRODUCT_LOCK],
  });

  const eligible = input.findings.filter((f) => f.recommendationEligible);
  const shapeFinding = eligible.find((f) => f.id.startsWith('face_shape_'));
  const shapeId = shapeFinding
    ? shapeIdFromFinding(shapeFinding.id)
    : null;

  if (shapeFinding && shapeId) {
    const labels = FACE_SHAPE_LABELS[shapeId];
    const conf = confFromFinding(shapeFinding);
    const evidenceBase = {
      metricIds: ['faceShape', ...shapeFinding.metricIds.filter((x) => x !== 'faceShape')],
      findingIds: [shapeFinding.id],
      values: { faceShape: shapeId },
    };

    const hair = SHAPE_HAIRSTYLE[shapeId];
    out.push({
      id: `rec_hairstyle_${shapeId}`,
      category: hair.category,
      titleAr: hair.titleAr,
      titleEn: hair.titleEn,
      bodyAr: hair.bodyAr,
      bodyEn: hair.bodyEn,
      reasonAr: `بناءً على شكل الوجه الظاهر: ${labels.displayNameAr}.`,
      reasonEn: `Based on apparent face shape: ${labels.displayNameEn}.`,
      evidence: evidenceBase,
      confidence: conf,
      priority: hair.priority,
      cosmeticOnly: true,
      productLockIn: false,
      limitations: [COSMETIC_LIMIT, NO_PRODUCT_LOCK, ...shapeFinding.limitations.slice(0, 2)],
    });

    const contour = SHAPE_CONTOUR[shapeId];
    if (contour) {
      out.push({
        id: `rec_contour_${shapeId}`,
        category: contour.category,
        titleAr: contour.titleAr,
        titleEn: contour.titleEn,
        bodyAr: contour.bodyAr,
        bodyEn: contour.bodyEn,
        reasonAr: `دليل الشكل: ${labels.displayNameAr}.`,
        reasonEn: `Shape evidence: ${labels.displayNameEn}.`,
        evidence: { ...evidenceBase },
        confidence: conf,
        priority: contour.priority,
        cosmeticOnly: true,
        productLockIn: false,
        limitations: [COSMETIC_LIMIT, NO_PRODUCT_LOCK],
      });
    }

    const eyewear = SHAPE_EYEWEAR[shapeId];
    if (eyewear) {
      out.push({
        id: `rec_eyewear_${shapeId}`,
        category: eyewear.category,
        titleAr: eyewear.titleAr,
        titleEn: eyewear.titleEn,
        bodyAr: eyewear.bodyAr,
        bodyEn: eyewear.bodyEn,
        reasonAr: `دليل الشكل: ${labels.displayNameAr}.`,
        reasonEn: `Shape evidence: ${labels.displayNameEn}.`,
        evidence: { ...evidenceBase },
        confidence: conf,
        priority: eyewear.priority,
        cosmeticOnly: true,
        productLockIn: false,
        limitations: [COSMETIC_LIMIT, NO_PRODUCT_LOCK],
      });
    }
  }

  for (const f of eligible) {
    if (f.id === 'elongated_vertical_proportion') {
      out.push({
        id: 'rec_accessories_elongation',
        category: 'accessories',
        titleAr: 'إكسسوارات تُقرّب الطول الظاهر',
        titleEn: 'Accessories that soften elongation',
        bodyAr:
          'أقراط أعرض أفقياً أو قلائد متوسطة الطول قد تُوازن الإحساس بالطول — اختيار شخصي تجميلي.',
        bodyEn:
          'Wider earrings or mid-length necklaces may balance elongation — personal cosmetic choice.',
        reasonAr: f.detailAr,
        reasonEn: f.detailEn,
        evidence: {
          metricIds: [...f.metricIds],
          findingIds: [f.id],
          values: {},
        },
        confidence: confFromFinding(f),
        priority: 45,
        cosmeticOnly: true,
        productLockIn: false,
        limitations: [COSMETIC_LIMIT, NO_PRODUCT_LOCK],
      });
    }
    if (f.id === 'narrower_lower_face') {
      out.push({
        id: 'rec_accessories_narrow_lower',
        category: 'accessories',
        titleAr: 'تفصيل يضيف عرضاً سفلياً خفيفاً',
        titleEn: 'Detail that adds soft lower width',
        bodyAr:
          'أقراط تتسع للأسفل أو طوق يلامس عظمة الترقوة قد يوازن الجزء السفلي الأضيق ظاهرياً.',
        bodyEn:
          'Earrings that widen downward or a collarbone necklace may balance an apparently narrower lower face.',
        reasonAr: f.detailAr,
        reasonEn: f.detailEn,
        evidence: {
          metricIds: [...f.metricIds],
          findingIds: [f.id],
          values: {},
        },
        confidence: confFromFinding(f),
        priority: 46,
        cosmeticOnly: true,
        productLockIn: false,
        limitations: [COSMETIC_LIMIT, NO_PRODUCT_LOCK],
      });
    }
    if (f.id === 'wider_lower_face') {
      out.push({
        id: 'rec_accessories_wider_lower',
        category: 'accessories',
        titleAr: 'تفصيل يرفع الانتباه للأعلى',
        titleEn: 'Detail that lifts focus upward',
        bodyAr:
          'أقراط أعلى أو أقرب للوجه مع تجنّب قطع ثقيلة عند الفك قد يوازن العرض السفلي الظاهر.',
        bodyEn:
          'Higher-set earrings closer to the face, avoiding heavy jaw pieces, may balance apparent lower width.',
        reasonAr: f.detailAr,
        reasonEn: f.detailEn,
        evidence: {
          metricIds: [...f.metricIds],
          findingIds: [f.id],
          values: {},
        },
        confidence: confFromFinding(f),
        priority: 46,
        cosmeticOnly: true,
        productLockIn: false,
        limitations: [COSMETIC_LIMIT, NO_PRODUCT_LOCK],
      });
    }
    if (f.id === 'balanced_facial_thirds') {
      out.push({
        id: 'rec_edu_balanced_thirds',
        category: 'educational',
        titleAr: 'توازن أثلاث جيد — حافظي على البساطة',
        titleEn: 'Balanced thirds — keep styling simple',
        bodyAr:
          'عندما تكون الأثلاث متوازنة ظاهرياً، المكياج الخفيف والقصّات غير المعقّدة غالباً تكفي.',
        bodyEn:
          'When thirds look balanced, light makeup and uncomplicated cuts usually suffice.',
        reasonAr: f.detailAr,
        reasonEn: f.detailEn,
        evidence: {
          metricIds: [...f.metricIds],
          findingIds: [f.id],
          values: {},
        },
        confidence: confFromFinding(f),
        priority: 55,
        cosmeticOnly: true,
        productLockIn: false,
        limitations: [COSMETIC_LIMIT, NO_PRODUCT_LOCK],
      });
    }
  }

  // Traceability: drop any non-edu reco whose findingIds are missing (defensive).
  return out
    .filter((r) => {
      if (r.category === 'educational' && r.evidence.findingIds.length === 0) {
        return true;
      }
      if (r.evidence.findingIds.length === 0 && r.evidence.metricIds.length === 0) {
        return r.category === 'educational';
      }
      return r.evidence.findingIds.every((id) => findingIds.has(id));
    })
    .sort((a, b) => a.priority - b.priority);
}

/** Validate reco evidence rules (for tests / 4F auditors later). */
export function assertFaceRecommendationEvidence(
  recos: FaceRecommendation[],
): void {
  for (const r of recos) {
    if (r.productLockIn !== false) {
      throw new Error(`productLockIn must be false: ${r.id}`);
    }
    if (r.cosmeticOnly !== true) {
      throw new Error(`cosmeticOnly required: ${r.id}`);
    }
    if (r.category !== 'educational') {
      const hasEvidence =
        r.evidence.findingIds.length > 0 || r.evidence.metricIds.length > 0;
      if (!hasEvidence) {
        throw new Error(`Missing evidence: ${r.id}`);
      }
    }
  }
}
