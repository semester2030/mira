import { SkinAnalysisResult } from '../../ai/contracts/skin-analysis-result.interface';
import {
  DailyRoutinePlan,
  RoutineStep,
} from '../contracts/mira-beauty-report.interface';

function score(skin: SkinAnalysisResult, id: string, fallback: number): number {
  return skin.concernScores?.[id] ?? fallback;
}

export function buildTreatmentPlan(skin: SkinAnalysisResult): DailyRoutinePlan {
  return routineFromOptionalScores({
    moisture: score(skin, 'moisture', skin.hydration),
    oilinessUi: score(skin, 'oiliness', 100 - skin.oiliness),
    acne: score(skin, 'acne', 100 - skin.acne * 20),
    redness: score(skin, 'redness', 100 - skin.redness * 20),
    pores: score(skin, 'pore', 100 - skin.pores * 20),
  });
}

/** Rebuild only from measured scores. Missing keys do not become substitute numbers. */
export function buildRoutineFromKnownScores(scores: Record<string, number>): DailyRoutinePlan {
  return routineFromOptionalScores({
    moisture: scores.moisture,
    oilinessUi: scores.oiliness,
    acne: scores.acne,
    redness: scores.redness,
    pores: scores.pore,
  });
}

function routineFromOptionalScores(input: {
  moisture?: number;
  oilinessUi?: number;
  acne?: number;
  redness?: number;
  pores?: number;
}): DailyRoutinePlan {
  const { moisture, oilinessUi, acne, redness, pores } = input;
  const oilinessHigh = oilinessUi != null && oilinessUi < 55;

  const morning: RoutineStep[] = [
    {
      id: 'cleanser_am',
      nameAr: oilinessHigh ? 'غسول توازن الدهون' : 'غسول لطيف',
      nameEn: oilinessHigh ? 'Balancing Cleanser' : 'Gentle Cleanser',
      stepAr: 'صباحاً — 30 ثانية بلطف',
      period: 'am',
    },
  ];

  if (moisture != null && moisture < 62) {
    morning.push({
      id: 'serum_am',
      nameAr: 'سيروم ترطيب',
      nameEn: 'Hydrating Serum',
      stepAr: 'بعد الغسول — طبقة خفيفة',
      period: 'am',
    });
  }

  morning.push({
    id: 'sunscreen',
    nameAr: 'واقي شمس SPF 50',
    nameEn: 'SPF 50 Sunscreen',
    stepAr: 'آخر خطوة صباحاً — كل يوم',
    period: 'am',
  });

  const evening: RoutineStep[] = [
    {
      id: 'cleanser_pm',
      nameAr: 'غسول مسائي',
      nameEn: 'Evening Cleanser',
      stepAr: 'مساءً — إزالة الشوائب',
      period: 'pm',
    },
  ];

  if (acne != null && acne < 58) {
    evening.push({
      id: 'treatment_acne',
      nameAr: 'عناية لطيفة بالحبوب',
      nameEn: 'Gentle blemish care',
      stepAr: 'لا تلمسيها. تقييم أي علاج يكون مع مختص، وليس من صورة التحليل.',
      period: 'pm',
    });
  } else if (pores != null && pores < 58) {
    evening.push({
      id: 'treatment_pores',
      nameAr: 'تنظيف لطيف للمسام',
      nameEn: 'Gentle pore care',
      stepAr: 'تجنبي الإفراط في المقشرات. اختيار المقشر يكون مع مختص عند الحاجة.',
      period: 'pm',
    });
  }

  if (redness != null && redness < 55) {
    evening.push({
      id: 'soothing',
      nameAr: 'مرطب مهدئ',
      nameEn: 'Soothing Moisturizer',
      stepAr: 'مساءً — طبقة كاملة',
      period: 'pm',
    });
  } else {
    evening.push({
      id: 'moisturizer_pm',
      nameAr: moisture != null && moisture < 60 ? 'كريم ترطيب غني' : 'مرطب يومي',
      nameEn: moisture != null && moisture < 60 ? 'Rich Moisturizer' : 'Daily Moisturizer',
      stepAr: 'مساءً — قبل النوم',
      period: 'pm',
    });
  }

  return { morning, evening };
}
