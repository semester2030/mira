import { SkinAnalysisResult } from '../../ai/contracts/skin-analysis-result.interface';
import {
  DailyRoutinePlan,
  RoutineStep,
} from '../contracts/mira-beauty-report.interface';

function score(skin: SkinAnalysisResult, id: string, fallback: number): number {
  return skin.concernScores?.[id] ?? fallback;
}

export function buildTreatmentPlan(skin: SkinAnalysisResult): DailyRoutinePlan {
  const moisture = score(skin, 'moisture', skin.hydration);
  const oilinessUi = score(skin, 'oiliness', 100 - skin.oiliness);
  const oilinessHigh = oilinessUi < 55;
  const acne = score(skin, 'acne', 100 - skin.acne * 20);
  const redness = score(skin, 'redness', 100 - skin.redness * 20);
  const pores = score(skin, 'pore', 100 - skin.pores * 20);

  const morning: RoutineStep[] = [
    {
      id: 'cleanser_am',
      nameAr: oilinessHigh ? 'غسول توازن الدهون' : 'غسول لطيف',
      nameEn: oilinessHigh ? 'Balancing Cleanser' : 'Gentle Cleanser',
      stepAr: 'صباحاً — 30 ثانية بلطف',
      period: 'am',
    },
  ];

  if (moisture < 62) {
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

  if (acne < 58) {
    evening.push({
      id: 'treatment_acne',
      nameAr: 'معالجة الحبوب (نياسيناميد)',
      nameEn: 'Niacinamide Treatment',
      stepAr: 'مساءً — على المناطق المتأثرة',
      period: 'pm',
    });
  } else if (pores < 58) {
    evening.push({
      id: 'treatment_pores',
      nameAr: 'مقشر BHA خفيف',
      nameEn: 'Light BHA Exfoliant',
      stepAr: '2–3 مرات أسبوعياً — مساءً',
      period: 'pm',
    });
  }

  if (redness < 55) {
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
      nameAr: moisture < 60 ? 'كريم ترطيب غني' : 'مرطب يومي',
      nameEn: moisture < 60 ? 'Rich Moisturizer' : 'Daily Moisturizer',
      stepAr: 'مساءً — قبل النوم',
      period: 'pm',
    });
  }

  return { morning, evening };
}
