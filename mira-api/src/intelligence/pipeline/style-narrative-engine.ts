import { MiraOccasion } from '../../ai/contracts/mira-occasion';
import { OutfitAnalysisResult } from '../../ai/contracts/outfit-analysis-result.interface';
import { OutfitScoreResult } from './outfit-score-engine';

export function buildStyleHeadline(score: number): string {
  if (score >= 86) return 'إطلالة متقنة — جاهزة للمناسبة بثقة';
  if (score >= 76) return 'إطلالة جيدة — مع فرصة لتحسين بسيط';
  if (score >= 64) return 'إطلالة مقبولة — تحتاج ضبطاً لونياً أو رسمياً';
  if (score >= 48) return 'إطلالتك تحتاج إعادة توازن قبل المناسبة';
  return 'إطلالتك تحتاج تعديلاً واضحاً — ابدئي بالألوان والقصّة';
}

export function buildStyleTips(
  score: OutfitScoreResult,
  occasion: MiraOccasion,
): string[] {
  const tips: string[] = [];

  switch (score.strongestIssueId) {
    case 'colorClash':
      tips.push('قلّلي عدد الألوان القوية في قطعة واحدة — لون أساس + لون accent يكفي.');
      tips.push('جرّبي دمج لون محايد (بيج · كريمي · أسود ناعم) مع لون واحد بارز.');
      break;
    case 'occasionMismatch':
      tips.push(`لمناسبة ${occasionLabel(occasion)}، اختاري قصّة وألوان أقرب للرسمية المطلوبة.`);
      tips.push('تجنّبي قطع كاجوال واضحة إذا كانت المناسبة رسمية.');
      break;
    case 'tonalImbalance':
      tips.push('وازني بين الفاتح والغامق — طبقة علوية وسفلية بدرجة لون متقاربة.');
      break;
    case 'accessoryOverload':
      tips.push('اختاري إكسسواراً واحداً بارزاً بدل تعدد القطع.');
      break;
    case 'formalityGap':
      tips.push('ارفعي مستوى الرسمية: أحذية أنظف · قماش أقل casual · تفاصيل أبسط.');
      break;
    default:
      tips.push('ركّزي على لونين متناسقين وقصّة واضحة — النتيجة تتحسن بسرعة.');
  }

  if (score.finalScore < 70) {
    tips.push('صورة إطلالة كاملة بإضاءة نهارية ترفع دقة التحليل في المرة القادمة.');
  }

  return tips.slice(0, 4);
}

export function colorCompatibilityLabel(score: number): string {
  if (score >= 85) return 'توافق لوني ممتاز';
  if (score >= 72) return 'توافق لوني جيد';
  if (score >= 58) return 'توافق لوني متوسط';
  return 'توافق لوني يحتاج تحسين';
}

function occasionLabel(occasion: MiraOccasion): string {
  const map: Record<MiraOccasion, string> = {
    [MiraOccasion.Wedding]: 'الزفاف',
    [MiraOccasion.Work]: 'العمل',
    [MiraOccasion.Casual]: 'الكاجوال',
    [MiraOccasion.University]: 'الجامعة',
    [MiraOccasion.Evening]: 'السهرة',
    [MiraOccasion.Eid]: 'العيد',
    [MiraOccasion.Interview]: 'المقابلة',
  };
  return map[occasion] ?? occasion;
}

export function buildStyleSummary(
  outfit: OutfitAnalysisResult,
  score: OutfitScoreResult,
): string {
  return `تقييم الإطلالة ${score.finalScore}/100 — ${outfit.styleCategoryAr} بألوان ${outfit.dominantColors.join(' · ')}. ${outfit.occasionSuitabilityAr}.`;
}
