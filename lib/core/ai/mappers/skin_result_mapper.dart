import '../../../features/intelligence/domain/services/local_mira_report_builder.dart';
import '../../../features/skin_analysis/domain/entities/capture_quality_signals.dart';
import '../../../features/skin_analysis/domain/entities/skin_report.dart';
import '../../../features/skin_analysis/domain/services/beauty_score_engine.dart';
import '../models/skin_analysis_result.dart';

/// Maps provider contract → feature entity (Firestore / UI).
abstract final class SkinResultMapper {
  static SkinReport toReport(
    SkinAnalysisResult result, {
    String? id,
    String? imageUrl,
    DateTime? createdAt,
    int? previousBeautyScore,
    CaptureQualitySignals? captureQuality,
  }) {
    final preliminary = SkinReport(
      id: id,
      skinType: result.skinTypeAr,
      skinTypeEn: result.skinTypeEn,
      score: result.beautyScore,
      hydration: result.hydration,
      oiliness: result.oiliness,
      pores: result.pores,
      wrinkles: result.wrinkles,
      spots: result.darkSpots,
      acne: result.acne,
      redness: result.redness,
      undertone: result.undertoneAr,
      undertoneEn: result.undertoneEn,
      skinTone: result.skinToneAr,
      skinToneEn: result.skinToneEn,
      recommendations: result.recommendationsAr,
      advice: result.primaryRecommendationAr,
      imageUrl: imageUrl,
      createdAt: createdAt,
      skinAge: result.skinAge,
      concernScores: result.concernScores,
    );

    final scored = BeautyScoreEngine.compute(
      preliminary,
      previousScore: previousBeautyScore,
      captureQuality: captureQuality ?? const CaptureQualitySignals.neutral(),
    );

    return preliminary.copyWith(score: scored.finalScore.toDouble());
  }

  static SkinAnalysisResult fromReport(SkinReport report) {
    // SkinAnalysisResult.hydration is a required int. This substitute is only
    // consumed by recommendation copy, not by the overall score or progress path.
    return SkinAnalysisResult(
      beautyScore: report.score,
      skinTypeAr: report.skinType,
      skinTypeEn: report.skinTypeEn,
      hydration: report.hydration ?? 0,
      oiliness: report.oiliness,
      pores: report.pores,
      wrinkles: report.wrinkles,
      darkSpots: report.spots,
      acne: report.acne,
      redness: report.redness,
      undertoneAr: report.undertone,
      undertoneEn: report.undertoneEn,
      skinToneAr: report.skinTone,
      skinToneEn: report.skinToneEn,
      recommendationsAr: LocalMiraReportBuilder.currentTipsFor(report),
      recommendationsEn: LocalMiraReportBuilder.currentTipsFor(report),
      skinAge: report.skinAge,
      concernScores: report.concernScores,
    );
  }
}
