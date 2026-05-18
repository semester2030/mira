class OutfitReport {
  final String? id;
  final double compatibilityScore;
  final List<String> dominantColors;
  final String garmentType;
  final String garmentTypeEn;
  final String styleCategory;
  final String styleCategoryEn;
  final String occasionSuitability;
  final String occasionSuitabilityEn;
  final List<String> alternativeColors;
  final List<String> alternativeColorsEn;
  final String occasionId;
  final String occasionLabelAr;
  final DateTime? createdAt;

  const OutfitReport({
    this.id,
    required this.compatibilityScore,
    required this.dominantColors,
    required this.garmentType,
    this.garmentTypeEn = '',
    required this.styleCategory,
    this.styleCategoryEn = '',
    required this.occasionSuitability,
    this.occasionSuitabilityEn = '',
    required this.alternativeColors,
    this.alternativeColorsEn = const [],
    required this.occasionId,
    required this.occasionLabelAr,
    this.createdAt,
  });
}
