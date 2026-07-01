import '../../../../core/ai/models/mira_occasion.dart';
import 'outfit_analysis_mode.dart';
import 'outfit_segment_map.dart';

/// Skin-Based Outfit Intelligence — hybrid engine output.
class OutfitAnalysis {
  final MiraOccasion occasion;
  final OutfitAnalysisMode mode;
  final String clothingType;
  final String styleType;
  final List<String> dominantColors;
  final int compatibilityScore;
  final List<String> recommendedColors;
  final List<String> rejectedColors;
  final List<String> suggestedAccessories;
  final String suggestedMakeup;
  final String explanation;
  final int confidence;

  final List<String> matchReasons;
  final List<String> mismatchReasons;
  final List<String> recommendations;
  final String styleVerdict;

  final List<String> detectedPieces;
  final List<String> visionLabels;
  final int visualConfidence;

  final String contrastLevel;
  final String formalityLevel;
  final String analysisSource;
  final String visualSource;

  final int skinCompatibilityScore;
  final int occasionMatchScore;
  final int styleBalanceScore;
  final int colorHarmonyScore;

  /// Frozen capture path — analysis uses still image only.
  final String? frozenImagePath;

  /// Region-based segmentation map from frozen image.
  final OutfitSegmentMap? segmentMap;

  /// Per-region extracted colors.
  final List<String> upperBodyColors;
  final List<String> lowerBodyColors;
  final List<String> shoeColors;
  final List<String> accessoryColors;

  /// Vision Platform gate — proceed | degraded | blocked.
  final String analysisGate;

  /// User-facing trust message from server or client gate.
  final String? photoTrustMessageAr;

  List<String> get whyItFits => matchReasons;

  List<String> get whatNeedsAttention => mismatchReasons;

  List<String> get suggestedColors => recommendedColors;

  List<String> get accessories => suggestedAccessories;

  String get makeupSuggestions => suggestedMakeup;

  bool get isQuickMode => mode == OutfitAnalysisMode.quick;
  bool get isSmartMode => mode == OutfitAnalysisMode.smart;

  const OutfitAnalysis({
    required this.occasion,
    this.mode = OutfitAnalysisMode.quick,
    required this.clothingType,
    required this.styleType,
    required this.dominantColors,
    required this.compatibilityScore,
    required this.recommendedColors,
    required this.rejectedColors,
    required this.suggestedAccessories,
    required this.suggestedMakeup,
    required this.explanation,
    required this.confidence,
    this.matchReasons = const [],
    this.mismatchReasons = const [],
    this.recommendations = const [],
    this.styleVerdict = '',
    this.detectedPieces = const [],
    this.visionLabels = const [],
    this.visualConfidence = 70,
    this.contrastLevel = '',
    this.formalityLevel = '',
    this.analysisSource = 'deterministic',
    this.visualSource = 'deterministic',
    this.skinCompatibilityScore = 0,
    this.occasionMatchScore = 0,
    this.styleBalanceScore = 0,
    this.colorHarmonyScore = 0,
    this.frozenImagePath,
    this.segmentMap,
    this.upperBodyColors = const [],
    this.lowerBodyColors = const [],
    this.shoeColors = const [],
    this.accessoryColors = const [],
    this.analysisGate = 'proceed',
    this.photoTrustMessageAr,
  });

  OutfitAnalysis copyWith({
    MiraOccasion? occasion,
    OutfitAnalysisMode? mode,
    String? clothingType,
    String? styleType,
    List<String>? dominantColors,
    int? compatibilityScore,
    List<String>? recommendedColors,
    List<String>? rejectedColors,
    List<String>? suggestedAccessories,
    String? suggestedMakeup,
    String? explanation,
    int? confidence,
    List<String>? matchReasons,
    List<String>? mismatchReasons,
    List<String>? recommendations,
    String? styleVerdict,
    List<String>? detectedPieces,
    List<String>? visionLabels,
    int? visualConfidence,
    String? contrastLevel,
    String? formalityLevel,
    String? analysisSource,
    String? visualSource,
    int? skinCompatibilityScore,
    int? occasionMatchScore,
    int? styleBalanceScore,
    int? colorHarmonyScore,
    String? frozenImagePath,
    OutfitSegmentMap? segmentMap,
    List<String>? upperBodyColors,
    List<String>? lowerBodyColors,
    List<String>? shoeColors,
    List<String>? accessoryColors,
    String? analysisGate,
    String? photoTrustMessageAr,
  }) {
    return OutfitAnalysis(
      occasion: occasion ?? this.occasion,
      mode: mode ?? this.mode,
      clothingType: clothingType ?? this.clothingType,
      styleType: styleType ?? this.styleType,
      dominantColors: dominantColors ?? this.dominantColors,
      compatibilityScore: compatibilityScore ?? this.compatibilityScore,
      recommendedColors: recommendedColors ?? this.recommendedColors,
      rejectedColors: rejectedColors ?? this.rejectedColors,
      suggestedAccessories: suggestedAccessories ?? this.suggestedAccessories,
      suggestedMakeup: suggestedMakeup ?? this.suggestedMakeup,
      explanation: explanation ?? this.explanation,
      confidence: confidence ?? this.confidence,
      matchReasons: matchReasons ?? this.matchReasons,
      mismatchReasons: mismatchReasons ?? this.mismatchReasons,
      recommendations: recommendations ?? this.recommendations,
      styleVerdict: styleVerdict ?? this.styleVerdict,
      detectedPieces: detectedPieces ?? this.detectedPieces,
      visionLabels: visionLabels ?? this.visionLabels,
      visualConfidence: visualConfidence ?? this.visualConfidence,
      contrastLevel: contrastLevel ?? this.contrastLevel,
      formalityLevel: formalityLevel ?? this.formalityLevel,
      analysisSource: analysisSource ?? this.analysisSource,
      visualSource: visualSource ?? this.visualSource,
      skinCompatibilityScore: skinCompatibilityScore ?? this.skinCompatibilityScore,
      occasionMatchScore: occasionMatchScore ?? this.occasionMatchScore,
      styleBalanceScore: styleBalanceScore ?? this.styleBalanceScore,
      colorHarmonyScore: colorHarmonyScore ?? this.colorHarmonyScore,
      frozenImagePath: frozenImagePath ?? this.frozenImagePath,
      segmentMap: segmentMap ?? this.segmentMap,
      upperBodyColors: upperBodyColors ?? this.upperBodyColors,
      lowerBodyColors: lowerBodyColors ?? this.lowerBodyColors,
      shoeColors: shoeColors ?? this.shoeColors,
      accessoryColors: accessoryColors ?? this.accessoryColors,
      analysisGate: analysisGate ?? this.analysisGate,
      photoTrustMessageAr: photoTrustMessageAr ?? this.photoTrustMessageAr,
    );
  }

  factory OutfitAnalysis.fromJson(
    Map<String, dynamic> json, {
    required MiraOccasion occasion,
  }) {
    List<String> list(String key) =>
        (json[key] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? const [];

    return OutfitAnalysis(
      occasion: occasion,
      mode: _parseMode(json['mode']),
      clothingType: json['clothingType'] as String? ??
          json['garmentTypeAr'] as String? ??
          '',
      styleType: json['styleType'] as String? ??
          json['styleTypeAr'] as String? ??
          '',
      dominantColors: list('dominantColors').isNotEmpty
          ? list('dominantColors')
          : list('dominantColorsAr'),
      compatibilityScore: (json['compatibilityScore'] as num?)?.round() ?? 0,
      recommendedColors: list('recommendedColors').isNotEmpty
          ? list('recommendedColors')
          : list('suggestedColors'),
      rejectedColors: list('rejectedColors').isNotEmpty
          ? list('rejectedColors')
          : list('avoidColors'),
      suggestedAccessories: list('suggestedAccessories'),
      suggestedMakeup: json['suggestedMakeup'] as String? ?? '',
      explanation: json['explanation'] as String? ?? '',
      confidence: (json['confidence'] as num?)?.round() ?? 70,
      matchReasons: list('matchReasons'),
      mismatchReasons: list('mismatchReasons'),
      recommendations: list('recommendations'),
      styleVerdict: json['styleVerdict'] as String? ?? '',
      detectedPieces: list('detectedPieces').isNotEmpty
          ? list('detectedPieces')
          : list('clothingTypes'),
      visionLabels: list('visionLabels').isNotEmpty ? list('visionLabels') : list('labels'),
      visualConfidence: (json['visualConfidence'] as num?)?.round() ?? 70,
      contrastLevel: json['contrastLevel'] as String? ?? '',
      formalityLevel: json['formalityLevel'] as String? ?? '',
      analysisSource: json['analysisSource'] as String? ?? 'hybrid',
      visualSource: json['visualSource'] as String? ?? 'vision_platform',
      skinCompatibilityScore:
          (json['skinCompatibilityScore'] as num?)?.round() ?? 0,
      occasionMatchScore: (json['occasionMatchScore'] as num?)?.round() ?? 0,
      styleBalanceScore: (json['styleBalanceScore'] as num?)?.round() ?? 0,
      colorHarmonyScore: (json['colorHarmonyScore'] as num?)?.round() ?? 0,
    );
  }

  static OutfitAnalysisMode _parseMode(Object? raw) {
    return switch (raw?.toString()) {
      'smart' => OutfitAnalysisMode.smart,
      _ => OutfitAnalysisMode.quick,
    };
  }
}
