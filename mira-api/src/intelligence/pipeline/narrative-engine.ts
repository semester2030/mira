import { SkinAnalysisResult } from '../../ai/contracts/skin-analysis-result.interface';
import {
  ConcernNarrative,
  ConcernSeverity,
} from '../contracts/mira-beauty-report.interface';

const LABELS: Record<string, string> = {
  moisture: 'الترطيب',
  oiliness: 'إفراز الدهون',
  pore: 'المسام',
  wrinkle: 'التجاعيد',
  acne: 'الحبوب',
  age_spot: 'التصبغات',
  redness: 'الاحمرار',
  texture: 'الملمس',
  dark_circle: 'الهالات',
  radiance: 'الإشراق',
  firmness: 'المرونة',
  eye_bag: 'انتفاخ العين',
};

const NARRATIVES: Record<
  string,
  Record<ConcernSeverity, string>
> = {
  moisture: {
    none: 'مستوى الترطيب متوازن — بشرتك تحتفظ بالرطوبة بشكل جيد.',
    mild: 'نلاحظ احتياجاً بسيطاً للترطيب — كريم يومي خفيف يساعد.',
    moderate: 'البشرة تحتاج ترطيباً أوضح — ركزي على سيروم أو كريم غني.',
    noticeable: 'جفاف واضح — اجعلي الترطيب خطوة أساسية صباحاً ومساءً.',
  },
  oiliness: {
    none: 'إفراز الدهون متوازن — لا مبالغة في اللمعان أو الجفاف.',
    mild: 'زيادة بسيطة في الدهون في منطقة T-Zone — منظف لطيف يساعد.',
    moderate: 'نلاحظ زيادة في إفراز الدهون — منتجات oil-free أنسب لك.',
    noticeable: 'دهنية ملحوظة — روتين توازن الدهون ضروري يومياً.',
  },
  pore: {
    none: 'المسام غير بارزة — مظهر ناعم ومتجانس.',
    mild: 'المسام ظاهرة بدرجة خفيفة — تنظيف لطيف يحافظ على الوضوح.',
    moderate: 'المسام ظاهرة بدرجة متوسطة وتحتاج عناية منتظمة.',
    noticeable: 'المسام بارزة — مقشر BHA خفيف 1–2 مرات أسبوعياً قد يساعد.',
  },
  wrinkle: {
    none: 'لا توجد مؤشرات قوية على التجاعيد حالياً.',
    mild: 'خطوط دقيقة طفيفة — واقي الشمس يومياً أمر أساسي.',
    moderate: 'علامات بداية تجاعيد — ترطيب + SPF يبطئان التطور.',
    noticeable: 'تجاعيد أو خطوط واضحة — روتين مضاد للشيخوخة مناسب.',
  },
  acne: {
    none: 'لا مؤشرات واضحة على الحبوب — البشرة هادئة.',
    mild: 'بثور أو حبوب خفيفة — تجنبي لمس الوجه واستخدمي منظفاً لطيفاً.',
    moderate: 'حبوب متوسطة — نياسيناميد أو BPO خفيف بعد استشارة.',
    noticeable: 'حبوب ملحوظة — روتين مخصص للحبوب مع متابعة.',
  },
  age_spot: {
    none: 'لون البشرة متجانس نسبياً — لا تصبغات بارزة.',
    mild: 'بقع خفيفة — SPF يمنع تفاقمها.',
    moderate: 'تصبغات متوسطة — فيتامين C صباحاً قد يساعد تدريجياً.',
    noticeable: 'تصبغات واضحة — خطة توحيد لون تحتاج صبراً وثباتاً.',
  },
  redness: {
    none: 'البشرة هادئة — لا احمرار ملحوظ.',
    mild: 'احمرار خفيف — تجنبي الحرارة والمنتجات القاسية.',
    moderate: 'احمرار متوسط — مرطبات مهدئة مناسبة لك.',
    noticeable: 'احمرار واضح — روتين مهدئ بدون عطور أو كحول.',
  },
  texture: {
    none: 'ملمس البشرة ناعم ومتسق.',
    mild: 'ملمس غير متجانس بسيط — تقشير لطيف 1× أسبوعياً.',
    moderate: 'خشونة متوسطة — ترطيب + مقشر لطيف يحسّنان الملمس.',
    noticeable: 'ملمس خشن — روتين تجديد لطيف مع ترطيب عميق.',
  },
  dark_circle: {
    none: 'منطقة تحت العين متوازنة.',
    mild: 'هالات خفيفة — نوم كافٍ وكريم للعين يساعد.',
    moderate: 'هالات متوسطة — كريم عين + SPF واقٍ.',
    noticeable: 'هالات واضحة — روتين عناية بالعين منتظم.',
  },
};

function severityFromUiScore(uiScore: number): ConcernSeverity {
  if (uiScore >= 78) return 'none';
  if (uiScore >= 65) return 'mild';
  if (uiScore >= 50) return 'moderate';
  return 'noticeable';
}

function resolveUiScore(
  skin: SkinAnalysisResult,
  id: string,
): number {
  const fromMap = skin.concernScores?.[id];
  if (typeof fromMap === 'number') return fromMap;

  switch (id) {
    case 'moisture':
      return skin.hydration;
    case 'oiliness':
      return 100 - skin.oiliness;
    case 'pore':
      return 100 - skin.pores * 20;
    case 'wrinkle':
      return 100 - skin.wrinkles * 20;
    case 'acne':
      return 100 - skin.acne * 20;
    case 'age_spot':
      return 100 - skin.darkSpots * 20;
    case 'redness':
      return 100 - skin.redness * 20;
    default:
      return 72;
  }
}

export function buildHeadlineAr(skin: SkinAnalysisResult): string {
  const score = skin.beautyScore;
  if (score >= 82) {
    return 'بشرتك في حالة جيدة — نكمل معاً على روتين يحافظ على توازنها.';
  }
  if (score >= 68) {
    return 'بشرتك تحتاج عناية مركّزة — خطة ميرا اليومية تناسبك.';
  }
  return 'بشرتك تستحق اهتماماً إضافياً — ابدئي بالخطوات البسيطة أدناه.';
}

export function buildConcernNarratives(
  skin: SkinAnalysisResult,
): ConcernNarrative[] {
  const priorityIds = [
    'moisture',
    'oiliness',
    'pore',
    'wrinkle',
    'acne',
    'age_spot',
    'redness',
    'texture',
    'dark_circle',
  ];

  const narratives: ConcernNarrative[] = [];

  for (const id of priorityIds) {
    const uiScore = resolveUiScore(skin, id);
    const severity = severityFromUiScore(uiScore);
    const templates = NARRATIVES[id];
    if (!templates) continue;

    narratives.push({
      id,
      titleAr: LABELS[id] ?? id,
      narrativeAr: templates[severity],
      severity,
    });
  }

  const actionable = narratives
    .filter((n) => n.severity !== 'none')
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

  if (actionable.length >= 3) {
    return actionable.slice(0, 5);
  }

  const positives = narratives
    .filter((n) => n.severity === 'none')
    .slice(0, 2);

  return [...actionable, ...positives].slice(0, 5);
}

export function buildTipsAr(skin: SkinAnalysisResult): string[] {
  const tips = new Set<string>(skin.recommendationsAr.slice(0, 3));
  tips.add('روتين يومي: تنظيف لطيف، ترطيب، وواقي شمس.');
  if (resolveUiScore(skin, 'moisture') < 60) {
    tips.add('زيدي الترطيب بسيروم حمض الهيالورونيك.');
  }
  if (resolveUiScore(skin, 'oiliness') < 55) {
    tips.add('اختاري منظفاً خفيفاً غير كوميدوجينيك.');
  }
  return [...tips].slice(0, 5);
}

function severityRank(severity: ConcernSeverity): number {
  switch (severity) {
    case 'noticeable':
      return 4;
    case 'moderate':
      return 3;
    case 'mild':
      return 2;
    default:
      return 1;
  }
}
