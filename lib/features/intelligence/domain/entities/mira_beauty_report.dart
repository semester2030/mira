import 'age_comparison.dart';
import 'concern_zones_section.dart';
import 'face_health_map.dart';
import 'progress_forecast.dart';
import 'weekly_plan.dart';

class ConcernNarrative {
  final String id;
  final String titleAr;
  final String narrativeAr;
  final String severity;

  const ConcernNarrative({
    required this.id,
    required this.titleAr,
    required this.narrativeAr,
    required this.severity,
  });
}

class RoutineStep {
  final String id;
  final String nameAr;
  final String nameEn;
  final String stepAr;
  final String period;

  const RoutineStep({
    required this.id,
    required this.nameAr,
    required this.nameEn,
    required this.stepAr,
    required this.period,
  });
}

class DailyRoutinePlan {
  final List<RoutineStep> morning;
  final List<RoutineStep> evening;

  const DailyRoutinePlan({
    required this.morning,
    required this.evening,
  });
}

class RecommendedProductSummary {
  final String id;
  final String nameAr;
  final String nameEn;
  final String partnerNameAr;
  final String priceLabel;
  final String externalUrl;
  final String? stepAr;
  final int matchScore;

  const RecommendedProductSummary({
    required this.id,
    required this.nameAr,
    required this.nameEn,
    required this.partnerNameAr,
    required this.priceLabel,
    required this.externalUrl,
    this.stepAr,
    required this.matchScore,
  });
}

/// User-facing intelligence report — Phase 1 Mira Intelligence Layer.
class MiraBeautyReport {
  final int version;
  final String spatialConfidence;
  final int overallBeautyScore;
  final String headlineAr;
  final String skinTypeAr;
  final String skinTypeEn;
  final int? skinAgeEstimate;
  final AgeComparison ageComparison;
  final ChildSafety childSafety;
  final List<ConcernNarrative> mainConcerns;
  final DailyRoutinePlan dailyRoutine;
  final String summaryAdviceAr;
  final List<String> tipsAr;
  final bool faceMapEnabled;
  final ConcernZonesSection concernZonesSection;
  final FaceHealthMap faceHealthMap;
  final List<String> concernZonesNarrative;
  final List<RecommendedProductSummary> recommendedProducts;
  final WeeklyPlan weeklyPlan;
  final ProgressForecast progressForecast;

  const MiraBeautyReport({
    required this.version,
    required this.spatialConfidence,
    required this.overallBeautyScore,
    required this.headlineAr,
    required this.skinTypeAr,
    required this.skinTypeEn,
    this.skinAgeEstimate,
    required this.ageComparison,
    required this.childSafety,
    required this.mainConcerns,
    required this.dailyRoutine,
    required this.summaryAdviceAr,
    required this.tipsAr,
    required this.faceMapEnabled,
    required this.concernZonesSection,
    required this.faceHealthMap,
    required this.concernZonesNarrative,
    required this.recommendedProducts,
    required this.weeklyPlan,
    required this.progressForecast,
  });

  bool get hasSpatialFaceMap =>
      faceHealthMap.isRealSpatial && faceHealthMap.confidence != 'low';
}
