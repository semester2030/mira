import 'package:equatable/equatable.dart';

import 'mira_occasion.dart';
import '../../../features/outfit_analysis/domain/entities/outfit_style_metrics.dart';

/// Canonical outfit analysis output (provider-agnostic contract).
/// Maps to FASHN.ai / Style DNA when API keys are configured.
class OutfitAnalysisResult extends Equatable {
  final double compatibilityScore;
  final List<String> dominantColors;
  final String garmentTypeAr;
  final String garmentTypeEn;
  final String styleCategoryAr;
  final String styleCategoryEn;
  final String occasionSuitabilityAr;
  final String occasionSuitabilityEn;
  final List<String> alternativeColorsAr;
  final List<String> alternativeColorsEn;
  final MiraOccasion occasion;
  final OutfitStyleMetrics? styleMetrics;

  const OutfitAnalysisResult({
    required this.compatibilityScore,
    required this.dominantColors,
    required this.garmentTypeAr,
    required this.garmentTypeEn,
    required this.styleCategoryAr,
    required this.styleCategoryEn,
    required this.occasionSuitabilityAr,
    required this.occasionSuitabilityEn,
    required this.alternativeColorsAr,
    required this.alternativeColorsEn,
    required this.occasion,
    this.styleMetrics,
  });

  OutfitAnalysisResult copyWith({
    double? compatibilityScore,
    List<String>? dominantColors,
    String? garmentTypeAr,
    String? garmentTypeEn,
    String? styleCategoryAr,
    String? styleCategoryEn,
    String? occasionSuitabilityAr,
    String? occasionSuitabilityEn,
    List<String>? alternativeColorsAr,
    List<String>? alternativeColorsEn,
    MiraOccasion? occasion,
    OutfitStyleMetrics? styleMetrics,
  }) {
    return OutfitAnalysisResult(
      compatibilityScore: compatibilityScore ?? this.compatibilityScore,
      dominantColors: dominantColors ?? this.dominantColors,
      garmentTypeAr: garmentTypeAr ?? this.garmentTypeAr,
      garmentTypeEn: garmentTypeEn ?? this.garmentTypeEn,
      styleCategoryAr: styleCategoryAr ?? this.styleCategoryAr,
      styleCategoryEn: styleCategoryEn ?? this.styleCategoryEn,
      occasionSuitabilityAr: occasionSuitabilityAr ?? this.occasionSuitabilityAr,
      occasionSuitabilityEn: occasionSuitabilityEn ?? this.occasionSuitabilityEn,
      alternativeColorsAr: alternativeColorsAr ?? this.alternativeColorsAr,
      alternativeColorsEn: alternativeColorsEn ?? this.alternativeColorsEn,
      occasion: occasion ?? this.occasion,
      styleMetrics: styleMetrics ?? this.styleMetrics,
    );
  }

  @override
  List<Object?> get props => [
        compatibilityScore,
        dominantColors,
        garmentTypeAr,
        garmentTypeEn,
        styleCategoryAr,
        styleCategoryEn,
        occasionSuitabilityAr,
        occasionSuitabilityEn,
        alternativeColorsAr,
        alternativeColorsEn,
        occasion,
        styleMetrics,
      ];
}
