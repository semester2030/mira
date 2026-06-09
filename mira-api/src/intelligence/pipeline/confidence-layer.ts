import {
  ConfidenceItem,
  ConfidenceLayerPayload,
  MiraBeautyReport,
} from '../contracts/mira-beauty-report.interface';

function levelLabel(level: ConfidenceItem['level']): string {
  switch (level) {
    case 'high':
      return 'ثقة عالية';
    case 'medium':
      return 'ثقة متوسطة';
    default:
      return 'ثقة منخفضة';
  }
}

function ageComparisonConfidence(report: MiraBeautyReport): ConfidenceItem {
  const age = report.ageComparison;

  if (!age.enabled) {
    return {
      id: 'age_comparison',
      labelAr: 'مقارنة عمر البشرة',
      level: 'low',
      reasonAr:
        age.suppressedReason === 'missing_birth_year'
          ? 'أضيفي سنة الميلاد في الملف الشخصي لتفعيل مقارنة دقيقة.'
          : 'مقارنة العمر غير متاحة — بيانات غير كافية.',
    };
  }

  if (age.userAge != null && age.skinAge != null && age.deltaYears != null) {
    const level =
      Math.abs(age.deltaYears) >= 5 ? 'medium' : 'high';
    return {
      id: 'age_comparison',
      labelAr: 'مقارنة عمر البشرة',
      level,
      reasonAr:
        level === 'high'
          ? `${levelLabel(level)} — عمرك وعمر بشرتك من تحليل موثّق.`
          : `${levelLabel(level)} — فرق ملحوظ؛ استمري على الروتين للتأكيد.`,
    };
  }

  return {
    id: 'age_comparison',
    labelAr: 'مقارنة عمر البشرة',
    level: 'medium',
    reasonAr: `${levelLabel('medium')} — تقدير من تحليل واحد.`,
  };
}

function journeyGoalConfidence(report: MiraBeautyReport): ConfidenceItem {
  const scans = report.progressForecast.scanCount;
  const level = scans >= 2 ? 'medium' : 'low';

  return {
    id: 'journey_goal',
    labelAr: 'هدف الرحلة (30 يوماً)',
    level: scans >= 3 ? 'high' : level,
    reasonAr:
      scans >= 3
        ? `${levelLabel('high')} — الهدف مبني على ${scans} تحليلات وTrends.`
        : scans >= 2
          ? `${levelLabel('medium')} — تقدير من تحليلين — يتحسن مع المتابعة.`
          : `${levelLabel('low')} — تقدير أولي من تحليل واحد — أجري متابعة بعد 7–14 يوماً.`,
  };
}

function progressForecastConfidence(report: MiraBeautyReport): ConfidenceItem {
  const pf = report.progressForecast;

  if (!pf.enabled || pf.needsMoreScans) {
    return {
      id: 'progress_forecast',
      labelAr: 'توقعات التقدم',
      level: 'low',
      reasonAr: `${levelLabel('low')} — تحتاجين تحليلاً ثانياً لتفعيل Trends.`,
    };
  }

  const level = pf.scanCount >= 3 ? 'high' : 'medium';
  return {
    id: 'progress_forecast',
    labelAr: 'توقعات التقدم',
    level,
    reasonAr:
      level === 'high'
        ? `${levelLabel('high')} — projection من ${pf.scanCount} تحليلات.`
        : `${levelLabel('medium')} — مقارنة بين آخر تحليلين — تقدير خطي.`,
  };
}

function recommendationsConfidence(report: MiraBeautyReport): ConfidenceItem {
  const products = report.recommendedProducts;
  if (products.length === 0) {
    return {
      id: 'recommendations',
      labelAr: 'توصيات المنتجات',
      level: 'low',
      reasonAr: `${levelLabel('low')} — لا منتجات مطابقة بعد.`,
    };
  }

  const avg =
    products.reduce((sum, p) => sum + p.matchScore, 0) / products.length;
  const level = avg >= 75 ? 'high' : avg >= 55 ? 'medium' : 'low';

  return {
    id: 'recommendations',
    labelAr: 'توصيات المنتجات',
    level,
    reasonAr: `${levelLabel(level)} — متوسط تطابق ${Math.round(avg)}% مع بشرتك.`,
  };
}

function faceMapConfidence(report: MiraBeautyReport): ConfidenceItem {
  const map = report.faceHealthMap;
  if (!map.enabled) {
    return {
      id: 'face_map',
      labelAr: 'خريطة الوجه',
      level: 'low',
      reasonAr: `${levelLabel('low')} — خريطة استرشادية غير مفعّلة.`,
    };
  }

  return {
    id: 'face_map',
    labelAr: 'خريطة الوجه',
    level: map.confidence,
    reasonAr: map.confidenceLabelAr || levelLabel(map.confidence),
  };
}

export function buildConfidenceLayer(
  report: MiraBeautyReport,
): ConfidenceLayerPayload {
  const items: ConfidenceItem[] = [
    ageComparisonConfidence(report),
    journeyGoalConfidence(report),
    progressForecastConfidence(report),
    recommendationsConfidence(report),
    faceMapConfidence(report),
  ];

  const highCount = items.filter((i) => i.level === 'high').length;

  return {
    enabled: true,
    headlineAr: 'درجة ثقة ميرا في تقريرك',
    summaryAr:
      highCount >= 3
        ? 'معظم ادّعاءات التقرير مدعومة ببيانات قوية — استمري على المتابعة.'
        : 'بعض الأقسام تقديرية — المتابعة الدورية ترفع دقة التقرير.',
    items,
  };
}
