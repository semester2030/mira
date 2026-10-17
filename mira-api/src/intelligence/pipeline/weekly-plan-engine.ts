import { SkinAnalysisResult } from '../../ai/contracts/skin-analysis-result.interface';
import {
  DailyRoutinePlan,
  RoutineStep,
} from '../contracts/mira-beauty-report.interface';
import {
  WeeklyPlanDay,
  WeeklyPlanPayload,
} from '../contracts/weekly-plan.interface';
import { buildTreatmentPlan } from './treatment-plan-engine';

const DAY_LABELS = [
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];

export function buildWeeklyPlan(
  skin: SkinAnalysisResult,
  dailyRoutine?: DailyRoutinePlan,
): WeeklyPlanPayload {
  const routine = dailyRoutine ?? buildTreatmentPlan(skin);
  const focuses = buildWeeklyFocuses(skin);

  const days: WeeklyPlanDay[] = DAY_LABELS.map((labelAr, index) => {
    const focus = focuses[index] ?? focuses[0];
    return {
      dayIndex: index + 1,
      labelAr,
      focusAr: focus.title,
      stepsAr: focus.steps(routine, index),
    };
  });

  return {
    enabled: true,
    headlineAr: 'خطة أسبوعية — 7 أيام للعناية المتدرجة',
    summaryAr:
      'روتين يومي ثابت مع تركيز مختلف كل يوم — بدون إفراط. الثبات أهم من الكثرة.',
    days,
  };
}

interface WeeklyFocus {
  title: string;
  steps: (routine: DailyRoutinePlan, dayIndex: number) => string[];
}

function below(value: number | undefined, threshold: number): boolean {
  return value != null && value < threshold;
}

export function buildWeeklyPlanFromKnownScores(
  scores: Record<string, number>,
  dailyRoutine: DailyRoutinePlan,
): WeeklyPlanPayload {
  return weeklyFromScores(dailyRoutine, {
    moisture: scores.moisture,
    pores: scores.pore,
    acne: scores.acne,
    redness: scores.redness,
  });
}

function buildWeeklyFocuses(skin: SkinAnalysisResult): WeeklyFocus[] {
  return focusTemplates({
    moisture: ui(skin, 'moisture', skin.hydration),
    pores: ui(skin, 'pore', 100 - skin.pores * 20),
    acne: ui(skin, 'acne', 100 - skin.acne * 20),
    redness: ui(skin, 'redness', 100 - skin.redness * 20),
  });
}

function weeklyFromScores(
  routine: DailyRoutinePlan,
  scores: { moisture?: number; pores?: number; acne?: number; redness?: number },
): WeeklyPlanPayload {
  const focuses = focusTemplates(scores);
  const days: WeeklyPlanDay[] = DAY_LABELS.map((labelAr, index) => {
    const focus = focuses[index] ?? focuses[0];
    return {
      dayIndex: index + 1,
      labelAr,
      focusAr: focus.title,
      stepsAr: focus.steps(routine, index),
    };
  });
  return {
    enabled: true,
    headlineAr: 'خطة أسبوعية — 7 أيام للعناية المتدرجة',
    summaryAr: 'روتين يومي ثابت مع تركيز مختلف كل يوم — بدون إفراط. الثبات أهم من الكثرة.',
    days,
  };
}

function focusTemplates(scores: {
  moisture?: number;
  pores?: number;
  acne?: number;
  redness?: number;
}): WeeklyFocus[] {
  const moistureLow = below(scores.moisture, 58);
  const poresLow = below(scores.pores, 58);
  const acneLow = below(scores.acne, 58);
  const rednessLow = below(scores.redness, 55);

  const am = (r: DailyRoutinePlan) => summarizeSteps(r.morning, 'صباحاً');
  const pm = (r: DailyRoutinePlan) => summarizeSteps(r.evening, 'مساءً');

  return [
    {
      title: 'أساس الترطيب',
      steps: (r) => [...am(r), ...pm(r), 'اشربي 8 أكواب ماء'],
    },
    {
      title: moistureLow ? 'تركيز الترطيب العميق' : 'حماية SPF',
      steps: (r) => [
        ...am(r),
        moistureLow ? 'قناع ترطيب 15 دقيقة مساءً' : pm(r)[0] ?? 'روتين مسائي',
      ],
    },
    {
      title: poresLow ? 'تنظيف المسام بلطف' : 'توازن البشرة',
      steps: (r, i) => [
        ...am(r),
        poresLow && i === 2 ? 'تنظيف لطيف مساءً — دون مقشر جديد' : pm(r)[0] ?? 'روتين مسائي',
      ],
    },
    {
      title: 'يوم راحة — بدون مقشرات',
      steps: (r) => [...am(r), 'مرطب فقط مساءً — لا actives'],
    },
    {
      title: acneLow ? 'هدئة الحبوب' : 'تغذية البشرة',
      steps: (r) => [
        ...am(r),
        ...(acneLow ? ['لا تلمسي الحبوب؛ تقييم العلاج مع مختص'] : pm(r)),
      ],
    },
    {
      title: rednessLow ? 'تخفيف الاحمرار' : 'إشراق نهاية الأسبوع',
      steps: (r) => [
        ...am(r),
        rednessLow ? 'مرطب مهدئ + تجنّبي الحرارة' : pm(r)[0] ?? 'روتين مسائي',
      ],
    },
    {
      title: 'مراجعة أسبوعية',
      steps: (r) => [
        ...am(r),
        'لاحظي التحسّن — أجري تحليلاً ثانياً بعد أسبوعين',
        pm(r)[0] ?? 'روتين مسائي',
      ],
    },
  ];
}

function summarizeSteps(steps: RoutineStep[], period: string): string[] {
  return steps.slice(0, 3).map((s) => `${period}: ${s.nameAr}`);
}

function ui(skin: SkinAnalysisResult, id: string, fallback: number): number {
  return skin.concernScores?.[id] ?? fallback;
}
