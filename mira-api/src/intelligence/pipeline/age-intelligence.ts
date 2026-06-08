import {
  AgeComparisonInsight,
  AgeComparisonPayload,
} from '../contracts/mira-beauty-report.interface';
import {
  ChildSafetyResult,
  MAX_REALISTIC_SKIN_AGE,
  computeUserAge,
} from './child-safety-guard';

const CAUSE_BY_CONCERN: Record<string, string> = {
  moisture: 'جفاف يسرّع ظهور علامات التعب على البشرة.',
  oiliness: 'زيادة الدهون قد تؤثر على مظهر المسام وتوازن البشرة.',
  pore: 'المسام البارزة تعطي انطباعاً ببشرة أكثر نضجاً.',
  wrinkle: 'خطوط دقيقة أو نقص ترطيب يظهران كفرق في العمر.',
  acne: 'التهابات الحبوب قد تؤثر على ملمس البشرة ومظهرها.',
  age_spot: 'التصبغات وإفراط التعرض للشمس يرفعان مظهر العمر.',
  redness: 'الاحمرار المزمن يضعف حاجز البشرة.',
  texture: 'ملمس غير متجانس يعطي انطباعاً ببشرة متعبة.',
  dark_circle: 'الهالات والتعب يظهران كفرق في النضارة.',
};

const DEFAULT_CAUSES = [
  'التعرض للشمس بدون واقي يومي.',
  'نقص الترطيب المنتظم.',
  'قلة النوم أو الإجهاد.',
];

function buildCauses(concernIds: string[]): string[] {
  const causes = concernIds
    .map((id) => CAUSE_BY_CONCERN[id])
    .filter((c): c is string => Boolean(c));
  if (causes.length >= 2) return causes.slice(0, 3);
  return [...causes, ...DEFAULT_CAUSES].slice(0, 3);
}

function buildOpportunities(delta: number, concernIds: string[]): string[] {
  const ops: string[] = [];
  if (delta > 0) {
    ops.push('واقي شمس SPF 50 يومياً — أهم خطوة لإبطاء فرق العمر.');
    if (concernIds.includes('moisture')) {
      ops.push('سيروم ترطيب صباحاً ومساءً لتحسين مظهر البشرة.');
    }
    if (concernIds.includes('age_spot')) {
      ops.push('فيتامين C صباحاً لتوحيد اللون تدريجياً.');
    }
    ops.push('نوم كافٍ وشرب ماء — يظهران على نضارة البشرة.');
  } else if (delta < 0) {
    ops.push('حافظي على روتينك الحالي — بشرتك في توازن جيد.');
    ops.push('استمرري بواقي الشمس لحماية هذا التقدم.');
  } else {
    ops.push('روتين ثابت: تنظيف لطيف، ترطيب، وSPF.');
    ops.push('راجعي تحليلك شهرياً لمتابعة التغيّر.');
  }
  return ops.slice(0, 4);
}

function buildInsights(
  delta: number,
  causes: string[],
): AgeComparisonInsight[] {
  const insights: AgeComparisonInsight[] = [
    {
      id: 'why',
      titleAr: 'لماذا هذا الفرق؟',
      bodyAr:
        delta > 0
          ? 'الجمع بين عوامل بيئية (شمس، جفاف) ونمط حياة قد يرفع مظهر عمر البشرة.'
          : delta < 0
            ? 'بشرتك تبدو أصغر من عمرك — غالباً بفضل ترطيب جيد وحماية من الشمس.'
            : 'عمر بشرتك متوافق مع عمرك — مؤشر على عناية متوازنة.',
    },
  ];

  if (causes.length > 0) {
    insights.push({
      id: 'causes',
      titleAr: 'أسباب محتملة',
      bodyAr: causes.join(' '),
    });
  }

  return insights;
}

export function buildAgeComparison(params: {
  birthYear?: number | null;
  skinAge?: number;
  safety: ChildSafetyResult;
  concernIds?: string[];
}): AgeComparisonPayload {
  if (params.safety.isMinor) {
    return {
      enabled: false,
      headlineAr: 'مقارنة العمر غير متاحة',
      summaryAr:
        params.safety.messageAr ??
        'نركز على عناية لطيفة ومناسبة للمراهقات.',
      causesAr: [],
      opportunitiesAr: [],
      insights: [],
      suppressedReason: 'minor_user',
    };
  }

  const userAge = computeUserAge(params.birthYear);
  if (userAge === undefined) {
    return {
      enabled: false,
      headlineAr: 'أضيفي سنة ميلادك',
      summaryAr:
        'حدّدي سنة ميلادك في الملف الشخصي لمقارنة عمرك مع عمر بشرتك التقديري.',
      causesAr: [],
      opportunitiesAr: [],
      insights: [],
      suppressedReason: 'missing_birth_year',
    };
  }

  const skinAge = params.safety.sanitizedSkinAge ?? params.skinAge;
  if (skinAge === undefined || skinAge > MAX_REALISTIC_SKIN_AGE) {
    return {
      enabled: false,
      headlineAr: 'تقدير العمر غير متاح',
      summaryAr:
        'لم نتمكن من عرض مقارنة دقيقة — ركزنا على ملاحظات العناية العامة.',
      causesAr: [],
      opportunitiesAr: [],
      insights: [],
      suppressedReason: 'unrealistic_skin_age',
    };
  }

  const delta = skinAge - userAge;
  const deltaLabel =
    delta === 0
      ? '±0 سنة'
      : `${delta > 0 ? '+' : ''}${delta} ${Math.abs(delta) === 1 ? 'سنة' : 'سنوات'}`;

  const causes = buildCauses(params.concernIds ?? []);
  const opportunities = buildOpportunities(delta, params.concernIds ?? []);

  const summaryAr =
    delta > 0
      ? `بشرتك تبدو أكبر بـ ${Math.abs(delta)} ${Math.abs(delta) === 1 ? 'سنة' : 'سنوات'} — يمكن تحسين ذلك بروتين ثابت.`
      : delta < 0
        ? `بشرتك تبدو أصغر بـ ${Math.abs(delta)} ${Math.abs(delta) === 1 ? 'سنة' : 'سنوات'} — ممتاز!`
        : 'عمر بشرتك يطابق عمرك — توازن ممتاز.';

  return {
    enabled: true,
    userAge,
    skinAge,
    deltaYears: delta,
    headlineAr: `عمرك ${userAge} · بشرتك تبدو ${skinAge} · ${deltaLabel}`,
    summaryAr,
    causesAr: causes,
    opportunitiesAr: opportunities,
    insights: buildInsights(delta, causes),
  };
}
