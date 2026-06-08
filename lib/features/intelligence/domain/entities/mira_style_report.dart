class StyleFusion {
  final bool enabled;
  final String undertoneAr;
  final String undertoneEn;
  final String headlineAr;
  final String summaryAr;
  final List<String> recommendedColorsAr;
  final List<String> avoidColorsAr;
  final String makeupHintAr;
  final String accessoryHintAr;

  const StyleFusion({
    required this.enabled,
    required this.undertoneAr,
    required this.undertoneEn,
    required this.headlineAr,
    required this.summaryAr,
    required this.recommendedColorsAr,
    required this.avoidColorsAr,
    required this.makeupHintAr,
    required this.accessoryHintAr,
  });

  static const empty = StyleFusion(
    enabled: false,
    undertoneAr: '',
    undertoneEn: '',
    headlineAr: '',
    summaryAr: '',
    recommendedColorsAr: [],
    avoidColorsAr: [],
    makeupHintAr: '',
    accessoryHintAr: '',
  );
}

class MiraStyleReport {
  final int version;
  final int outfitScore;
  final String styleCategoryAr;
  final String styleCategoryEn;
  final String garmentTypeAr;
  final String colorCompatibilityAr;
  final List<String> dominantColorsAr;
  final List<String> alternativeLooksAr;
  final String occasionSuitabilityAr;
  final String headlineAr;
  final String summaryAr;

  const MiraStyleReport({
    required this.version,
    required this.outfitScore,
    required this.styleCategoryAr,
    required this.styleCategoryEn,
    required this.garmentTypeAr,
    required this.colorCompatibilityAr,
    required this.dominantColorsAr,
    required this.alternativeLooksAr,
    required this.occasionSuitabilityAr,
    required this.headlineAr,
    required this.summaryAr,
  });
}
