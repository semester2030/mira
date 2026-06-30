/// Visual outfit profile — from Google Vision, backend proxy, or deterministic fallback.
class OutfitVisualProfile {
  final List<String> labels;
  final List<String> dominantColors;
  final List<String> clothingTypes;
  final List<String> accessoryTypes;
  final List<String> styleSignals;
  final List<String> textureHints;
  final int confidence;
  final double clothingConfidence;
  final String source;

  final String garmentTypeAr;
  final String garmentTypeEn;
  final String styleTypeAr;
  final String styleTypeEn;
  final double contrastLevel;
  final double formalityLevel;
  final double brightness;

  const OutfitVisualProfile({
    this.labels = const [],
    this.dominantColors = const [],
    this.clothingTypes = const [],
    this.accessoryTypes = const [],
    this.styleSignals = const [],
    this.textureHints = const [],
    this.confidence = 70,
    this.clothingConfidence = 0,
    this.source = 'deterministic',
    this.garmentTypeAr = '',
    this.garmentTypeEn = '',
    this.styleTypeAr = '',
    this.styleTypeEn = '',
    this.contrastLevel = 0.5,
    this.formalityLevel = 0.5,
    this.brightness = 0.5,
  });

  String get clothingType =>
      garmentTypeAr.isNotEmpty
          ? garmentTypeAr
          : (clothingTypes.isNotEmpty ? clothingTypes.first : '');

  String get styleType =>
      styleTypeAr.isNotEmpty
          ? styleTypeAr
          : (styleSignals.isNotEmpty ? styleSignals.first : '');

  double get formalness => formalityLevel;

  String get texture =>
      textureHints.isNotEmpty ? textureHints.first : '';

  List<String> get dominantColorsAr =>
      dominantColors.isNotEmpty ? dominantColors : const [];

  String get contrastLabelAr {
    if (contrastLevel >= 0.72) return 'تباين عالٍ';
    if (contrastLevel >= 0.48) return 'تباين متوسط';
    return 'تباين منخفض';
  }

  String get formalityLabelAr {
    if (formalityLevel >= 0.72) return 'رسمي';
    if (formalityLevel >= 0.48) return 'شبه رسمي';
    return 'كاجوال';
  }

  OutfitVisualProfile copyWith({
    List<String>? labels,
    List<String>? dominantColors,
    List<String>? clothingTypes,
    List<String>? accessoryTypes,
    List<String>? styleSignals,
    List<String>? textureHints,
    int? confidence,
    double? clothingConfidence,
    String? source,
    String? garmentTypeAr,
    String? garmentTypeEn,
    String? styleTypeAr,
    String? styleTypeEn,
    double? contrastLevel,
    double? formalityLevel,
    double? brightness,
  }) {
    return OutfitVisualProfile(
      labels: labels ?? this.labels,
      dominantColors: dominantColors ?? this.dominantColors,
      clothingTypes: clothingTypes ?? this.clothingTypes,
      accessoryTypes: accessoryTypes ?? this.accessoryTypes,
      styleSignals: styleSignals ?? this.styleSignals,
      textureHints: textureHints ?? this.textureHints,
      confidence: confidence ?? this.confidence,
      clothingConfidence: clothingConfidence ?? this.clothingConfidence,
      source: source ?? this.source,
      garmentTypeAr: garmentTypeAr ?? this.garmentTypeAr,
      garmentTypeEn: garmentTypeEn ?? this.garmentTypeEn,
      styleTypeAr: styleTypeAr ?? this.styleTypeAr,
      styleTypeEn: styleTypeEn ?? this.styleTypeEn,
      contrastLevel: contrastLevel ?? this.contrastLevel,
      formalityLevel: formalityLevel ?? this.formalityLevel,
      brightness: brightness ?? this.brightness,
    );
  }

  factory OutfitVisualProfile.fromJson(Map<String, dynamic> json) {
    List<String> list(String key) =>
        (json[key] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? const [];

    return OutfitVisualProfile(
      labels: list('labels'),
      dominantColors: list('dominantColors').isNotEmpty
          ? list('dominantColors')
          : list('dominantColorsAr'),
      clothingTypes: list('clothingTypes'),
      accessoryTypes: list('accessoryTypes'),
      styleSignals: list('styleSignals'),
      textureHints: list('textureHints'),
      confidence: (json['confidence'] as num?)?.round() ?? 70,
      clothingConfidence:
          (json['clothingConfidence'] as num?)?.toDouble() ?? 0,
      source: json['source'] as String? ?? 'vision_platform',
      garmentTypeAr: json['garmentTypeAr'] as String? ?? '',
      garmentTypeEn: json['garmentTypeEn'] as String? ?? '',
      styleTypeAr: json['styleTypeAr'] as String? ?? '',
      styleTypeEn: json['styleTypeEn'] as String? ?? '',
      contrastLevel: (json['contrastLevel'] as num?)?.toDouble() ?? 0.5,
      formalityLevel: (json['formalityLevel'] as num?)?.toDouble() ??
          (json['formalness'] as num?)?.toDouble() ??
          0.5,
      brightness: (json['brightness'] as num?)?.toDouble() ?? 0.5,
    );
  }

  Map<String, dynamic> toJson() => {
        'labels': labels,
        'dominantColors': dominantColors,
        'clothingTypes': clothingTypes,
        'accessoryTypes': accessoryTypes,
        'styleSignals': styleSignals,
        'textureHints': textureHints,
        'confidence': confidence,
        'clothingConfidence': clothingConfidence,
        'source': source,
        'garmentTypeAr': garmentTypeAr,
        'garmentTypeEn': garmentTypeEn,
        'styleTypeAr': styleTypeAr,
        'styleTypeEn': styleTypeEn,
        'contrastLevel': contrastLevel,
        'formalityLevel': formalityLevel,
        'formalness': formalityLevel,
        'brightness': brightness,
      };
}
