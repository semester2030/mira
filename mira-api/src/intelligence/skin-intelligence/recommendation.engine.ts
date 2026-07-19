import { CanonicalSkinModel, metricById } from './canonical-skin.model';
import { SkinFinding } from './skin-finding.engine';

export type RecommendationCategory =
  | 'morning'
  | 'night'
  | 'weekly'
  | 'lifestyle'
  | 'professional_consultation'
  | 'educational';

export interface SkinRecommendation {
  id: string;
  category: RecommendationCategory;
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
  limitations: string[];
}

const COSMETIC_LIMIT =
  'Cosmetic guidance only — not a medical prescription or diagnosis.';

/**
 * Cosmetic recommendation engine — evidence-backed, never medicates or diagnoses.
 */
export function buildRecommendations(input: {
  model: CanonicalSkinModel;
  findings: SkinFinding[];
}): SkinRecommendation[] {
  const { model, findings } = input;
  const out: SkinRecommendation[] = [];

  out.push({
    id: 'edu_disclaimer',
    category: 'educational',
    titleAr: 'طبيعة التحليل',
    titleEn: 'About this analysis',
    bodyAr:
      'نتائج ميرا تجميلية وإرشادية مبنية على الصورة. لا تشخّص أمراضاً ولا تصف أدوية.',
    bodyEn:
      'Mira results are cosmetic and image-based. They do not diagnose disease or prescribe medication.',
    reasonAr: 'شفافية المنتج وثقة المستخدم.',
    reasonEn: 'Product transparency and user trust.',
    evidence: { metricIds: [], findingIds: [], values: {} },
    confidence: 100,
    priority: 5,
    cosmeticOnly: true,
    limitations: [COSMETIC_LIMIT],
  });

  const eligible = findings.filter((f) => f.recommendationEligible);
  for (const f of eligible.slice(0, 6)) {
    const m = metricById(model, f.metricId as never);
    const v = f.normalizedValue ?? m?.normalizedValue;
    const templates = templatesFor(f.metricId);
    if (!templates) continue;

    out.push({
      id: `rec_${f.metricId}_${templates.category}`,
      category: templates.category,
      titleAr: templates.titleAr,
      titleEn: templates.titleEn,
      bodyAr: templates.bodyAr,
      bodyEn: templates.bodyEn,
      reasonAr: f.evidenceAr,
      reasonEn: f.evidenceEn,
      evidence: {
        metricIds: [f.metricId],
        findingIds: [f.id],
        values: v != null ? { [f.metricId]: Math.round(v) } : {},
      },
      confidence: Math.round(m?.confidence ?? 60),
      priority: f.priority,
      cosmeticOnly: true,
      limitations: [...f.limitations, COSMETIC_LIMIT],
    });
  }

  // Lifestyle when hydration available and soft
  const hydration = metricById(model, 'hydration');
  if (
    hydration?.availability === 'available' &&
    hydration.normalizedValue != null &&
    hydration.normalizedValue < 60
  ) {
    out.push({
      id: 'lifestyle_hydration',
      category: 'lifestyle',
      titleAr: 'عادات لطيفة للترطيب',
      titleEn: 'Gentle hydration habits',
      bodyAr:
        'اشربي الماء بانتظام وتجنّبي غسل الوجه بماء ساخن جداً. هذه نصيحة نمط حياة تجميلية.',
      bodyEn:
        'Stay hydrated and avoid very hot water on the face. Lifestyle cosmetic tip only.',
      reasonAr: `الترطيب المقاس ${Math.round(hydration.normalizedValue)}/100.`,
      reasonEn: `Measured hydration ${Math.round(hydration.normalizedValue)}/100.`,
      evidence: {
        metricIds: ['hydration'],
        findingIds: [],
        values: { hydration: Math.round(hydration.normalizedValue) },
      },
      confidence: Math.round(hydration.confidence),
      priority: 55,
      cosmeticOnly: true,
      limitations: [COSMETIC_LIMIT, ...hydration.limitations],
    });
  }

  // Professional consultation — only educational, never diagnose
  const priorityFindings = findings.filter((f) => f.severity === 'priority');
  if (priorityFindings.length >= 2) {
    out.push({
      id: 'consult_cosmetic_pro',
      category: 'professional_consultation',
      titleAr: 'استشارة تجميلية متخصصة (اختيارية)',
      titleEn: 'Optional cosmetic professional consult',
      bodyAr:
        'إذا رغبتِ برأي متخصص تجميلي، يمكنكِ استشارة خبير عناية بالبشرة. ميرا لا تقدّم تشخيصاً طبياً.',
      bodyEn:
        'For a specialist cosmetic opinion, consider a skincare professional. Mira does not provide medical diagnosis.',
      reasonAr: 'ظهرت أكثر من فرصة عناية ذات أولوية في القراءة التجميلية.',
      reasonEn: 'More than one care-priority opportunity appeared in the cosmetic reading.',
      evidence: {
        metricIds: priorityFindings.map((f) => f.metricId),
        findingIds: priorityFindings.map((f) => f.id),
        values: {},
      },
      confidence: 70,
      priority: 20,
      cosmeticOnly: true,
      limitations: [COSMETIC_LIMIT],
    });
  }

  return out.sort((a, b) => a.priority - b.priority);
}

function templatesFor(metricId: string): {
  category: RecommendationCategory;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
} | null {
  switch (metricId) {
    case 'hydration':
      return {
        category: 'morning',
        titleAr: 'مرطّب لطيف صباحاً',
        titleEn: 'Gentle morning moisturizer',
        bodyAr:
          'جرّبي مرطباً خفيفاً مناسباً لنوع بشرتكِ بعد التنظيف. منتج تجميلي — ليس علاجاً طبياً.',
        bodyEn:
          'Try a light moisturizer suited to your skin type after cleansing. Cosmetic product — not medical treatment.',
      };
    case 'oiliness':
      return {
        category: 'morning',
        titleAr: 'تنظيف لطيف صباحاً',
        titleEn: 'Gentle morning cleanse',
        bodyAr:
          'منظف لطيف غير مجفّف قد يساعد على مظهر توازن الدهون. تجنبي الإفراط في التجفيف.',
        bodyEn:
          'A gentle non-stripping cleanser may support a more balanced oil appearance. Avoid over-drying.',
      };
    case 'pores':
      return {
        category: 'night',
        titleAr: 'عناية مسائية للملمس',
        titleEn: 'Evening texture care',
        bodyAr:
          'منتجات عناية تجميلية خفيفة القوام ليلاً قد تدعم مظهر نعومة المسام مع الوقت.',
        bodyEn:
          'Lightweight evening cosmetic care may support a smoother pore appearance over time.',
      };
    case 'acne':
      return {
        category: 'night',
        titleAr: 'روتين لطيف لمظهر البشرة',
        titleEn: 'Gentle appearance-focused routine',
        bodyAr:
          'حافظي على تنظيف لطيف وتجنّبي فرك المنطقة بقوة. للاستشارات الطبية راجعي مختصاً — ميرا لا تشخّص حب الشباب الطبي.',
        bodyEn:
          'Keep cleansing gentle and avoid harsh scrubbing. For medical advice see a clinician — Mira does not diagnose acne disease.',
      };
    case 'pigmentation':
      return {
        category: 'morning',
        titleAr: 'حماية من الشمس (تجميلية)',
        titleEn: 'Sun protection (cosmetic)',
        bodyAr:
          'واقي شمس يومي تجميلي يساعد على دعم مظهر توحيد اللون مع الوقت.',
        bodyEn:
          'Daily cosmetic sunscreen helps support a more even-looking tone over time.',
      };
    case 'redness':
      return {
        category: 'lifestyle',
        titleAr: 'تهدئة المظهر',
        titleEn: 'Soothing appearance care',
        bodyAr:
          'تجنّبي المهيجات القاسية ودرجات الحرارة القصوى عند العناية. نصيحة تجميلية فقط.',
        bodyEn:
          'Avoid harsh irritants and extreme temperatures in your routine. Cosmetic tip only.',
      };
    case 'darkCircles':
      return {
        category: 'night',
        titleAr: 'عناية محيط العين',
        titleEn: 'Under-eye cosmetic care',
        bodyAr:
          'كريم عين لطيف ونوم كافٍ قد يدعمان مظهر المنطقة. ليس تشخيصاً طبياً للهالات.',
        bodyEn:
          'A gentle eye cream and adequate rest may support under-eye appearance. Not a medical diagnosis of dark circles.',
      };
    case 'wrinkles':
    case 'fineLines':
      return {
        category: 'night',
        titleAr: 'ترطيب داعم للمظهر',
        titleEn: 'Appearance-supporting moisture',
        bodyAr:
          'ترطيب ليلي منتظم منتج تجميلي قد يدعم مظهر نعومة الخطوط مع الوقت.',
        bodyEn:
          'Consistent evening moisturization (cosmetic) may support a smoother look of lines over time.',
      };
    case 'texture':
    case 'radiance':
    case 'firmness':
      return {
        category: 'weekly',
        titleAr: 'عناية أسبوعية لطيفة',
        titleEn: 'Gentle weekly care',
        bodyAr:
          'تقشير لطيف جداً مرة أسبوعياً إن ناسب بشرتكِ — تجنبي الإفراط. تجميلي فقط.',
        bodyEn:
          'Very gentle weekly exfoliation if suitable for your skin — avoid overdoing it. Cosmetic only.',
      };
    default:
      return {
        category: 'educational',
        titleAr: 'عناية متوازنة',
        titleEn: 'Balanced care',
        bodyAr: 'روتين بسيط ومنتظم غالباً أفضل من كثرة المنتجات.',
        bodyEn: 'A simple consistent routine is often better than too many products.',
      };
  }
}
