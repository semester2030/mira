import 'age_comparison.dart';
import 'beauty_journey.dart';
import 'confidence_layer.dart';
import 'concern_zones_section.dart';
import 'face_health_map.dart';
import 'face_intelligence_report.dart';
import 'progress_forecast.dart';
import 'result_provenance.dart';
import 'skin_intelligence_report.dart';
import 'weekly_plan.dart';
import '../../../face_intelligence/domain/face_intel_runtime_state.dart';

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
/// Phase 0: overallBeautyScore is Skin Vitality Index (legacy field name retained).
class MiraBeautyReport {
  final int version;
  final int scoreSchemaVersion;
  final String spatialConfidence;
  final int overallBeautyScore;
  final String displayScoreLabelAr;
  final String displayScoreLabelEn;
  final String scoreSupportingAr;
  final String disclaimerAr;
  final String disclaimerEn;
  final ResultProvenance? provenance;
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
  final BeautyJourney beautyJourney;
  final ConfidenceLayer confidenceLayer;
  /// Phase 3 — explainable skin intelligence (optional for legacy stored reports).
  final SkinIntelligenceReport? skinIntelligence;
  /// Phase 4E — face intelligence sibling (optional; never FaceHealthMap).
  final FaceIntelligenceReport? faceIntelligence;
  /// Operational Hardening — explicit Face Intelligence runtime (never silent).
  final FaceIntelRuntimeState? faceIntelligenceRuntime;

  const MiraBeautyReport({
    required this.version,
    this.scoreSchemaVersion = 1,
    required this.spatialConfidence,
    required this.overallBeautyScore,
    this.displayScoreLabelAr = CosmeticCopy.skinVitalityIndexAr,
    this.displayScoreLabelEn = CosmeticCopy.skinVitalityIndexEn,
    this.scoreSupportingAr = CosmeticCopy.skinVitalitySupportingAr,
    this.disclaimerAr = CosmeticCopy.disclaimerAr,
    this.disclaimerEn = CosmeticCopy.disclaimerEn,
    this.provenance,
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
    required this.beautyJourney,
    required this.confidenceLayer,
    this.skinIntelligence,
    this.faceIntelligence,
    this.faceIntelligenceRuntime,
  });

  /// Skin Vitality Index — same numeric field, credible display name.
  int get skinVitalityIndex => overallBeautyScore;

  bool get hasSpatialFaceMap =>
      faceHealthMap.isRealSpatial && faceHealthMap.confidence != 'low';

  bool get canDisplayInProduction =>
      provenance == null || (provenance!.canDisplay && !provenance!.isMock);
}
