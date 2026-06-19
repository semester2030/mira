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
    );

    return preliminary.copyWith(score: scored.finalScore.toDouble());
  }

  static SkinAnalysisResult fromReport(SkinReport report) {
    return SkinAnalysisResult(
      beautyScore: report.score,
      skinTypeAr: report.skinType,
      skinTypeEn: report.skinTypeEn,
      hydration: report.hydration,
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
      recommendationsAr:
          report.recommendations.isNotEmpty ? report.recommendations : [report.advice],
      recommendationsEn: report.recommendations.isNotEmpty
          ? List<String>.from(report.recommendations)
          : (report.advice.isNotEmpty ? [report.advice] : const []),
      skinAge: report.skinAge,
      concernScores: report.concernScores,
    );
  }
}
