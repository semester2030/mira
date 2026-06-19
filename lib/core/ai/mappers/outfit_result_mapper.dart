import '../../../features/intelligence/domain/entities/mira_style_report.dart';
import '../../../features/outfit_analysis/domain/entities/outfit_report.dart';
import '../models/mira_occasion.dart';
import '../models/outfit_analysis_result.dart';

abstract final class OutfitResultMapper {
  static OutfitReport toReport(
    OutfitAnalysisResult result, {
    String? id,
    DateTime? createdAt,
    MiraStyleReport? miraStyleReport,
    StyleFusion? styleFusion,
  }) {
    return OutfitReport(
      id: id,
      compatibilityScore: result.compatibilityScore,
      dominantColors: result.dominantColors,
      garmentType: result.garmentTypeAr,
      garmentTypeEn: result.garmentTypeEn,
      styleCategory: result.styleCategoryAr,
      styleCategoryEn: result.styleCategoryEn,
      occasionSuitability: result.occasionSuitabilityAr,
      occasionSuitabilityEn: result.occasionSuitabilityEn,
      alternativeColors: result.alternativeColorsAr,
      alternativeColorsEn: result.alternativeColorsEn,
      occasionId: result.occasion.id,
      occasionLabelAr: result.occasion.labelAr,
      createdAt: createdAt,
      miraStyleReport: miraStyleReport,
      styleFusion: styleFusion,
    );
  }

  static OutfitAnalysisResult fromReport(OutfitReport report) {
    final occasion =
        MiraOccasion.fromId(report.occasionId) ?? MiraOccasion.casual;

    return OutfitAnalysisResult(
      compatibilityScore: report.compatibilityScore,
      dominantColors: report.dominantColors,
      garmentTypeAr: report.garmentType,
      garmentTypeEn: report.garmentTypeEn,
      styleCategoryAr: report.styleCategory,
      styleCategoryEn: report.styleCategoryEn,
      occasionSuitabilityAr: report.occasionSuitability,
      occasionSuitabilityEn: report.occasionSuitabilityEn,
      alternativeColorsAr: report.alternativeColors,
      alternativeColorsEn: report.alternativeColorsEn,
      occasion: occasion,
    );
  }
}
