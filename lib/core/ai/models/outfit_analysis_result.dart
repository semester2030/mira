import 'package:equatable/equatable.dart';

import 'mira_occasion.dart';

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
  });

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
      ];
}
