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

function buildWeeklyFocuses(skin: SkinAnalysisResult): WeeklyFocus[] {
  const moisture = ui(skin, 'moisture', skin.hydration);
  const pores = ui(skin, 'pore', 100 - skin.pores * 20);
  const acne = ui(skin, 'acne', 100 - skin.acne * 20);
  const redness = ui(skin, 'redness', 100 - skin.redness * 20);

  const am = (r: DailyRoutinePlan) => summarizeSteps(r.morning, 'صباحاً');
  const pm = (r: DailyRoutinePlan) => summarizeSteps(r.evening, 'مساءً');

  return [
    {
      title: 'أساس الترطيب',
      steps: (r) => [...am(r), ...pm(r), 'اشربي 8 أكواب ماء'],
    },
    {
      title: moisture < 58 ? 'تركيز الترطيب العميق' : 'حماية SPF',
      steps: (r) => [
        ...am(r),
        moisture < 58 ? 'قناع ترطيب 15 دقيقة مساءً' : pm(r)[0] ?? 'روتين مسائي',
      ],
    },
    {
      title: pores < 58 ? 'تنظيف المسام بلطف' : 'توازن البشرة',
      steps: (r, i) => [
        ...am(r),
        pores < 58 && i === 2 ? 'BHA خفيف — مساءً فقط' : pm(r)[0] ?? 'روتين مسائي',
      ],
    },
    {
      title: 'يوم راحة — بدون مقشرات',
      steps: (r) => [...am(r), 'مرطب فقط مساءً — لا actives'],
    },
    {
      title: acne < 58 ? 'هدئة الحبوب' : 'تغذية البشرة',
      steps: (r) => [
        ...am(r),
        ...(acne < 58 ? ['نياسيناميد على البثور فقط'] : pm(r)),
      ],
    },
    {
      title: redness < 55 ? 'تخفيف الاحمرار' : 'إشراق نهاية الأسبوع',
      steps: (r) => [
        ...am(r),
        redness < 55 ? 'مرطب مهدئ + تجنّبي الحرارة' : pm(r)[0] ?? 'روتين مسائي',
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
