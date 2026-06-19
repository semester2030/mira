import '../entities/outfit_analysis.dart';
import '../entities/outfit_report.dart';

abstract final class OutfitAnalysisMapper {
  static OutfitReport toLegacyReport(OutfitAnalysis analysis) {
    return OutfitReport(
      compatibilityScore: analysis.compatibilityScore.toDouble(),
      dominantColors: analysis.dominantColors,
      garmentType: analysis.clothingType,
      styleCategory: analysis.styleType,
      occasionSuitability: analysis.explanation,
      alternativeColors: analysis.recommendedColors,
      occasionId: analysis.occasion.id,
      occasionLabelAr: analysis.occasion.labelAr,
      createdAt: DateTime.now(),
    );
  }
}
