import '../../../../core/ai/models/mira_occasion.dart';
import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../adapters/fashion_vision_to_engine_adapter.dart';
import '../entities/outfit_analysis.dart';
import '../entities/outfit_analysis_mode.dart';
import '../entities/fashion_vision_document.dart';
import '../entities/outfit_visual_profile.dart';
import '../entities/user_gender.dart';
import '../helpers/skin_palette_mapper.dart';
import '../helpers/undertone_resolver.dart';
import 'outfit_trust_scoring.dart';

export '../entities/outfit_analysis_mode.dart';

/// Deterministic outfit scoring — no external APIs, no randomness.
abstract final class DeterministicOutfitEngine {
  DeterministicOutfitEngine._();

  static const _femaleAccessoryHints = [
    'حقيبة يد',
    'عقد',
    'أقراط',
    'وشاح',
  ];

  static const _maleAccessoryDefaults = [
    'ساعة',
    'حزام',
    'حذاء كلاسيك',
    'ربطة عنق',
  ];

  static OutfitAnalysis analyze({
    SkinReport? skin,
    required OutfitVisualProfile visual,
    required MiraOccasion occasion,
    required OutfitAnalysisMode mode,
    UserGender gender = UserGender.female,
  }) {
    if (mode == OutfitAnalysisMode.smart) {
      if (skin == null) {
        throw ArgumentError('Smart mode requires a SkinReport');
      }
      return _analyzeSmart(
        skin: skin,
        visual: visual,
        occasion: occasion,
        gender: gender,
      );
    }
    return _analyzeQuick(
      visual: visual,
      occasion: occasion,
      gender: gender,
    );
  }

  /// Phase 7 — MIRA engine consumes [FashionVisionDocument] (via adapter).
  static OutfitAnalysis analyzeFromFashionVision({
    required FashionVisionDocument fashion,
    SkinReport? skin,
    required MiraOccasion occasion,
    required OutfitAnalysisMode mode,
    UserGender gender = UserGender.female,
  }) {
    final visual = FashionVisionToEngineAdapter.toVisualProfile(fashion);
    return analyze(
      skin: skin,
      visual: visual,
      occasion: occasion,
      mode: mode,
      gender: gender,
    );
  }

  static OutfitAnalysis _analyzeSmart({
    required SkinReport skin,
    required OutfitVisualProfile visual,
    required MiraOccasion occasion,
    required UserGender gender,
  }) {
    final palette = SkinPaletteMapper.fromSkinReport(skin);

    final skinScore = _skinCompatibilityScore(skin, palette, visual);
    final occasionScore = _occasionMatchScore(occasion, visual);
    final styleScore = _styleBalanceScore(visual);
    final harmonyScore = _colorHarmonyScore(palette, visual);

    final rawScore = computeWeightedFinalSmart(
      skinScore: skinScore,
      occasionScore: occasionScore,
      styleScore: styleScore,
      colorHarmonyScore: harmonyScore,
    );
    final compatibilityScore = OutfitTrustScoring.applyFinalScore(
      rawScore: rawScore,
      occasionScore: occasionScore,
      styleScore: styleScore,
      colorHarmonyScore: harmonyScore,
    );
    final confidence = OutfitTrustScoring.applyConfidence(
      baseConfidence: _smartConfidence(skin, visual),
      colorHarmonyScore: harmonyScore,
      occasionScore: occasionScore,
      styleScore: styleScore,
    );

    final matchReasons = _buildMatchReasons(skin, palette, visual, occasion);
    final mismatchReasons = _buildMismatchReasons(skin, palette, visual, occasion);
    final recommendations = mismatchReasons.isNotEmpty
        ? mismatchReasons
        : [
            'حافظي على بساطة الألوان مع undertone '
                '${UndertoneResolver.labelAr(palette.undertone)} لبشرتك',
          ];

    final recommendedColors =
        _dedupe(_recommendedAlternatives(palette, visual, occasion));
    final rejectedColors = _dedupe(_rejectedColors(palette, visual));
    final accessories = _accessoriesForGender(
      gender: gender,
      visual: visual,
      palette: palette,
    );
    final makeup = gender.isMale ? '' : _suggestedMakeup(skin, palette, visual);

    return _buildResult(
      mode: OutfitAnalysisMode.smart,
      occasion: occasion,
      visual: visual,
      compatibilityScore: compatibilityScore,
      matchReasons: matchReasons,
      mismatchReasons: mismatchReasons,
      recommendations: recommendations,
      recommendedColors: recommendedColors,
      rejectedColors: rejectedColors,
      accessories: accessories,
      makeup: makeup,
      explanation: _smartExplanation(skin, palette, visual, occasion, compatibilityScore),
      confidence: confidence,
      skinScore: skinScore,
      occasionScore: occasionScore,
      styleScore: styleScore,
      harmonyScore: harmonyScore,
      styleVerdict: _smartStyleVerdict(compatibilityScore),
    );
  }

  static OutfitAnalysis _analyzeQuick({
    required OutfitVisualProfile visual,
    required MiraOccasion occasion,
    required UserGender gender,
  }) {
    final occasionScore = _occasionMatchScore(occasion, visual);
    final styleScore = _styleBalanceScore(visual);
    final harmonyScore = _visualColorHarmonyScore(visual);

    final rawScore = computeWeightedFinalQuick(
      occasionScore: occasionScore,
      styleScore: styleScore,
      colorHarmonyScore: harmonyScore,
    );
    final compatibilityScore = OutfitTrustScoring.applyFinalScore(
      rawScore: rawScore,
      occasionScore: occasionScore,
      styleScore: styleScore,
      colorHarmonyScore: harmonyScore,
    );
    final confidence = OutfitTrustScoring.applyConfidence(
      baseConfidence: _quickConfidence(visual),
      colorHarmonyScore: harmonyScore,
      occasionScore: occasionScore,
      styleScore: styleScore,
    );

    final matchReasons = _buildQuickMatchReasons(visual, occasion);
    final mismatchReasons = _buildQuickMismatchReasons(visual, occasion);
    final recommendations = mismatchReasons.isNotEmpty
        ? mismatchReasons
        : ['حافظي على توازن لوني بسيط يناسب ${occasion.labelAr}'];

    return _buildResult(
      mode: OutfitAnalysisMode.quick,
      occasion: occasion,
      visual: visual,
      compatibilityScore: compatibilityScore,
      matchReasons: matchReasons,
      mismatchReasons: mismatchReasons,
      recommendations: recommendations,
      recommendedColors: _dedupe(_quickRecommendedColors(visual, occasion)),
      rejectedColors: _dedupe(_quickRejectedColors(visual, occasion)),
      accessories: _dedupe([
        ...visual.accessoryTypes,
        if (gender.isMale) ..._maleAccessoryDefaults else ..._femaleAccessoryHints,
      ]),
      makeup: '',
      explanation: _quickExplanation(visual, occasion, compatibilityScore),
      confidence: confidence,
      skinScore: 0,
      occasionScore: occasionScore,
      styleScore: styleScore,
      harmonyScore: harmonyScore,
      styleVerdict: _quickStyleVerdict(compatibilityScore),
    );
  }

  static OutfitAnalysis _buildResult({
    required OutfitAnalysisMode mode,
    required MiraOccasion occasion,
    required OutfitVisualProfile visual,
    required int compatibilityScore,
    required List<String> matchReasons,
    required List<String> mismatchReasons,
    required List<String> recommendations,
    required List<String> recommendedColors,
    required List<String> rejectedColors,
    required List<String> accessories,
    required String makeup,
    required String explanation,
    required int confidence,
    required int skinScore,
    required int occasionScore,
    required int styleScore,
    required int harmonyScore,
    required String styleVerdict,
  }) {
    return OutfitAnalysis(
      mode: mode,
      occasion: occasion,
      clothingType: visual.garmentTypeAr.isNotEmpty
          ? visual.garmentTypeAr
          : (visual.clothingTypes.firstOrNull ?? 'قطعة غير قابلة للتحليل'),
      styleType: visual.styleTypeAr.isNotEmpty
          ? visual.styleTypeAr
          : (visual.styleSignals.firstOrNull ?? 'أنيق'),
      dominantColors: visual.dominantColors,
      compatibilityScore: compatibilityScore,
      recommendedColors: recommendedColors.take(5).toList(),
      rejectedColors: rejectedColors.take(5).toList(),
      suggestedAccessories: accessories.take(5).toList(),
      suggestedMakeup: makeup,
      explanation: explanation,
      confidence: confidence,
      matchReasons: matchReasons.take(4).toList(),
      mismatchReasons: mismatchReasons.take(4).toList(),
      recommendations: recommendations.take(4).toList(),
      styleVerdict: styleVerdict,
      detectedPieces: visual.clothingTypes.isNotEmpty
          ? visual.clothingTypes
          : [visual.garmentTypeAr].where((e) => e.isNotEmpty).toList(),
      visionLabels: visual.labels,
      visualConfidence: visual.confidence,
      contrastLevel: visual.contrastLabelAr,
      formalityLevel: visual.formalityLabelAr,
      analysisSource: 'deterministic',
      visualSource: visual.source,
      skinCompatibilityScore: skinScore,
      occasionMatchScore: occasionScore,
      styleBalanceScore: styleScore,
      colorHarmonyScore: harmonyScore,
    );
  }

  /// Smart mode — skin 40%, occasion 35%, style 15%, colors 10%.
  static int computeWeightedFinalSmart({
    required int skinScore,
    required int occasionScore,
    required int styleScore,
    required int colorHarmonyScore,
  }) {
    final total = (skinScore * 0.40) +
        (occasionScore * 0.35) +
        (styleScore * 0.15) +
        (colorHarmonyScore * 0.10);
    return total.round().clamp(0, 100);
  }

  /// Quick mode — occasion 45%, style 30%, colors 25%.
  static int computeWeightedFinalQuick({
    required int occasionScore,
    required int styleScore,
    required int colorHarmonyScore,
  }) {
    final total = (occasionScore * 0.45) +
        (styleScore * 0.30) +
        (colorHarmonyScore * 0.25);
    return total.round().clamp(0, 100);
  }

  @Deprecated('Use computeWeightedFinalSmart or computeWeightedFinalQuick')
  static int computeWeightedFinal({
    required int skinScore,
    required int occasionScore,
    required int styleScore,
    required int colorHarmonyScore,
  }) =>
      computeWeightedFinalSmart(
        skinScore: skinScore,
        occasionScore: occasionScore,
        styleScore: styleScore,
        colorHarmonyScore: colorHarmonyScore,
      );

  static String _smartStyleVerdict(int score) {
    if (score >= 86) return 'إطلالة متقنة — متناغمة مع بشرتك';
    if (score >= 74) return 'إطلالة جيدة — تحسينات بسيطة تكفي';
    if (score >= 62) return 'إطلالة مقبولة — تحتاج ضبطاً لونياً';
    return 'إطلالة تحتاج إعادة توازن قبل المناسبة';
  }

  static String _quickStyleVerdict(int score) {
    if (score >= 86) return 'إطلالة متقنة — متناسقة مع المناسبة';
    if (score >= 74) return 'إطلالة جيدة — تحسينات بسيطة تكفي';
    if (score >= 62) return 'إطلالة مقبولة — تحتاج ضبطاً لونياً';
    return 'إطلالة تحتاج إعادة توازن قبل المناسبة';
  }

  static int _visualColorHarmonyScore(OutfitVisualProfile visual) {
    var score = 72.0;
    final colorCount = visual.dominantColors.length;
    if (colorCount == 2) score += 12;
    if (colorCount >= 4) score -= 14;
    if (visual.contrastLevel >= 0.35 && visual.contrastLevel <= 0.65) score += 10;
    if (_isNeutralPalette(visual.dominantColors)) score += 8;
    if (visual.contrastLevel > 0.82) score -= 8;
    return score.round().clamp(0, 100);
  }

  static List<String> _buildQuickMatchReasons(
    OutfitVisualProfile visual,
    MiraOccasion occasion,
  ) {
    final reasons = <String>[];
    if (visual.formalityLevel >= 0.6 &&
        (occasion == MiraOccasion.work || occasion == MiraOccasion.interview)) {
      reasons.add('مستوى الرسمية مناسب لمناسبة ${occasion.labelAr}');
    }
    if (visual.dominantColors.length <= 2) {
      reasons.add('توازن لوني بسيط يسهّل تنسيق الإطلالة');
    }
    if (_isNeutralPalette(visual.dominantColors)) {
      reasons.add('الألوان المحايدة متناسقة مع ${occasion.labelAr}');
    }
    if (visual.styleTypeAr.isNotEmpty) {
      reasons.add('أسلوب ${visual.styleTypeAr} متوازن للمناسبة');
    }
    if (reasons.isEmpty) {
      reasons.add('إطلالة ${visual.styleTypeAr} مناسبة جزئياً لـ${occasion.labelAr}');
    }
    return reasons.take(4).toList();
  }

  static List<String> _buildQuickMismatchReasons(
    OutfitVisualProfile visual,
    MiraOccasion occasion,
  ) {
    final reasons = <String>[];
    if (occasion == MiraOccasion.interview) {
      if (visual.contrastLevel > 0.78) {
        reasons.add('التباين العالي أقل ملاءمة لمقابلة عمل');
      }
      if (visual.formalityLevel < 0.45) {
        reasons.add('الإطلالة كاجوال أكثر من المطلوب للمقابلة');
      }
    }
    if (visual.dominantColors.length >= 4) {
      reasons.add('كثرة الألوان قد تشتت التنسيق');
    }
    if (visual.formalityLevel > 0.8 && occasion == MiraOccasion.casual) {
      reasons.add('الإطلالة رسمية أكثر من اللازم للكاجوال');
    }
    return reasons.take(4).toList();
  }

  static List<String> _quickRecommendedColors(
    OutfitVisualProfile visual,
    MiraOccasion occasion,
  ) {
    final base = switch (occasion) {
      MiraOccasion.wedding || MiraOccasion.eid => ['ذهبي', 'شامبين', 'عنابي'],
      MiraOccasion.work || MiraOccasion.interview => ['كحلي', 'بيج', 'رمادي فاتح'],
      MiraOccasion.evening => ['أسود', 'ياقوتي', 'فضي'],
      _ => ['تركواز', 'مرجاني', 'لافندر'],
    };
    base.removeWhere(visual.dominantColors.contains);
    return base;
  }

  static List<String> _quickRejectedColors(
    OutfitVisualProfile visual,
    MiraOccasion occasion,
  ) {
    final rejected = <String>[];
    if (occasion == MiraOccasion.interview || occasion == MiraOccasion.work) {
      rejected.addAll(['فوشيا', 'نيون', 'أصفر ليموني']);
    }
    if (visual.dominantColors.length >= 4) {
      rejected.add('مزج ألوان كثيرة');
    }
    return rejected;
  }

  static String _quickExplanation(
    OutfitVisualProfile visual,
    MiraOccasion occasion,
    int score,
  ) {
    final garment = visual.garmentTypeAr.isNotEmpty ? visual.garmentTypeAr : 'إطلالة';
    return 'تحليل سريع $score/100 لـ$garment (${visual.styleTypeAr}) '
        'في مناسبة ${occasion.labelAr} — بدون ربط بالبشرة.';
  }

  static String _smartExplanation(
    SkinReport skin,
    SkinPaletteProfile palette,
    OutfitVisualProfile visual,
    MiraOccasion occasion,
    int score,
  ) {
    final undertone = UndertoneResolver.labelAr(palette.undertone);
    final garment = visual.garmentTypeAr.isNotEmpty ? visual.garmentTypeAr : 'إطلالة';
    return 'تقييم $score/100 لـ$garment (${visual.styleTypeAr}) '
        'لبشرة ${skin.skinType} undertone $undertone '
        'في مناسبة ${occasion.labelAr}.';
  }

  static int _quickConfidence(OutfitVisualProfile visual) {
    var c = 68;
    if (visual.dominantColors.isNotEmpty) c += 8;
    if (visual.clothingConfidence >= 0.72) c += 6;
    if (visual.labels.isNotEmpty) c += 4;
    return c.clamp(55, 90);
  }

  static int _smartConfidence(SkinReport skin, OutfitVisualProfile visual) {
    var c = 74;
    if (skin.undertoneEn.isNotEmpty || skin.undertone.isNotEmpty) c += 8;
    if (skin.concernScores.isNotEmpty) c += 6;
    if (visual.dominantColors.isNotEmpty) c += 6;
    if (visual.clothingConfidence >= 0.72) c += 4;
    return c.clamp(55, 95);
  }

  static int _skinCompatibilityScore(
    SkinReport skin,
    SkinPaletteProfile palette,
    OutfitVisualProfile visual,
  ) {
    var score = 78.0;
    for (final color in visual.dominantColors) {
      if (_colorMatchesAny(color, palette.recommendedPalettes)) score += 6;
      if (_colorMatchesAny(color, palette.blockedPalettes)) score -= 14;
    }
    final oiliness = skin.oiliness > 0
        ? skin.oiliness
        : (100 - (skin.concernScores['oiliness'] ?? 60)).clamp(0, 100);
    if (oiliness > 75 && _hasShinyFabricHint(visual)) score -= 12;
    if (_issueSeverity(skin, 'redness', skin.redness) > 70 && _isRedDominant(visual)) {
      score -= 16;
    }
    if (_issueSeverity(skin, 'age_spot', skin.spots) > 80 &&
        visual.contrastLevel > 0.78) {
      score -= 8;
    }
    if (_issueSeverity(skin, 'dark_circle', skin.wrinkles) > 70 &&
        _isDullDarkNearFace(visual)) {
      score -= 10;
    }
    return score.round().clamp(0, 100);
  }

  static int _occasionMatchScore(MiraOccasion occasion, OutfitVisualProfile visual) {
    var score = 72.0;
    switch (occasion) {
      case MiraOccasion.interview:
      case MiraOccasion.work:
        if (visual.formalityLevel >= 0.62) score += 14;
        if (visual.formalityLevel < 0.45) score -= 18;
        if (visual.contrastLevel > 0.78) score -= 10;
        if (visual.styleTypeAr == 'بسيط' || visual.styleTypeAr == 'كلاسيكي') {
          score += 8;
        }
        if (visual.dominantColors.length > 3) score -= 8;
      case MiraOccasion.wedding:
      case MiraOccasion.eid:
        if (visual.formalityLevel >= 0.55) score += 10;
        if (_hasAnyColor(visual, ['ذهبي', 'كريمي', 'نبيتي', 'شامبين'])) score += 6;
      case MiraOccasion.evening:
        if (visual.contrastLevel >= 0.5) score += 8;
        if (visual.formalityLevel >= 0.5) score += 6;
      case MiraOccasion.university:
      case MiraOccasion.casual:
        if (visual.formalityLevel <= 0.65) score += 10;
        if (visual.formalityLevel > 0.8) score -= 6;
    }
    return score.round().clamp(0, 100);
  }

  static int _styleBalanceScore(OutfitVisualProfile visual) {
    var score = 75.0;
    final colorCount = visual.dominantColors.length;
    if (colorCount == 2) score += 10;
    if (colorCount >= 4) score -= 12;
    if (visual.contrastLevel >= 0.35 && visual.contrastLevel <= 0.65) score += 8;
    if (visual.contrastLevel > 0.82) score -= 10;
    return score.round().clamp(0, 100);
  }

  static int _colorHarmonyScore(SkinPaletteProfile palette, OutfitVisualProfile visual) {
    var score = 70.0;
    var matches = 0;
    for (final color in visual.dominantColors) {
      if (_colorMatchesAny(color, palette.recommendedPalettes)) matches++;
      if (_colorMatchesAny(color, palette.blockedPalettes)) score -= 12;
    }
    score += matches * 8;
    return score.round().clamp(0, 100);
  }

  static List<String> _buildMatchReasons(
    SkinReport skin,
    SkinPaletteProfile palette,
    OutfitVisualProfile visual,
    MiraOccasion occasion,
  ) {
    final reasons = <String>[];
    final undertone = UndertoneResolver.labelAr(palette.undertone);
    final matchingColors = visual.dominantColors
        .where((color) => _colorMatchesAny(color, palette.recommendedPalettes))
        .toList();

    if (matchingColors.length >= 2) {
      reasons.add('الألوان ${matchingColors.join(' و')} تنسجم مع undertone بشرتك ($undertone)');
    } else {
      for (final color in matchingColors) {
        reasons.add('لون $color يتناسب مع undertone بشرتك ($undertone)');
      }
    }

    if (_isNeutralPalette(visual.dominantColors)) {
      reasons.add('الألوان المحايدة تنسجم مع undertone بشرتك');
    }

    if (visual.formalityLevel >= 0.6 &&
        (occasion == MiraOccasion.work || occasion == MiraOccasion.interview)) {
      reasons.add('مستوى الرسمية مناسب لمناسبة ${occasion.labelAr}');
    }
    if (visual.dominantColors.length <= 2) {
      reasons.add('توازن لوني بسيط يسهّل التنسيق مع بشرتك ${skin.skinType}');
    }
    if (reasons.isEmpty) {
      reasons.add(
        'إطلالة ${visual.styleTypeAr} تتناغم جزئياً مع بشرتك ${skin.skinType}',
      );
    }
    return reasons.take(4).toList();
  }

  static List<String> _buildMismatchReasons(
    SkinReport skin,
    SkinPaletteProfile palette,
    OutfitVisualProfile visual,
    MiraOccasion occasion,
  ) {
    final reasons = <String>[];
    final undertone = UndertoneResolver.labelAr(palette.undertone);
    for (final color in visual.dominantColors) {
      if (_colorMatchesAny(color, palette.blockedPalettes)) {
        reasons.add('لون $color قد يتعارض مع undertone بشرتك ($undertone)');
      }
    }
    final oiliness = skin.oiliness > 0
        ? skin.oiliness
        : (100 - (skin.concernScores['oiliness'] ?? 60)).clamp(0, 100);
    if (oiliness > 75) reasons.add('بشرتك دهنية — تجنّبي الأقمشة اللامعة');
    if (_issueSeverity(skin, 'redness', skin.redness) > 70 && _isRedDominant(visual)) {
      reasons.add('احمرار البشرة — الأحمر السائد قرب الوجه يزيد الظهور');
    }
    if (occasion == MiraOccasion.interview) {
      if (visual.contrastLevel > 0.78) {
        reasons.add('التباين العالي أقل ملاءمة لمقابلة عمل');
      }
      if (visual.formalityLevel < 0.45) {
        reasons.add('الإطلالة كاجوال أكثر من المطلوب للمقابلة');
      }
    }
    return reasons.take(4).toList();
  }

  static List<String> _recommendedAlternatives(
    SkinPaletteProfile palette,
    OutfitVisualProfile visual,
    MiraOccasion occasion,
  ) {
    final base = List<String>.from(palette.recommendedPalettes);
    switch (occasion) {
      case MiraOccasion.wedding:
      case MiraOccasion.eid:
        base.insertAll(0, ['ذهبي', 'شامبين', 'عنابي']);
      case MiraOccasion.work:
      case MiraOccasion.interview:
        base.insertAll(0, ['كحلي', 'بيج', 'رمادي فاتح']);
      case MiraOccasion.evening:
        base.insertAll(0, ['أسود', 'ياقوتي', 'فضي']);
      default:
        base.insertAll(0, ['تركواز', 'مرجاني', 'لافندر']);
    }
    base.removeWhere(visual.dominantColors.contains);
    return base;
  }

  static List<String> _rejectedColors(SkinPaletteProfile palette, OutfitVisualProfile visual) {
    final rejected = List<String>.from(palette.blockedPalettes);
    for (final c in visual.dominantColors) {
      if (_colorMatchesAny(c, palette.blockedPalettes) && !rejected.contains(c)) {
        rejected.add(c);
      }
    }
    return rejected;
  }

  static List<String> _accessoriesForGender({
    required UserGender gender,
    required OutfitVisualProfile visual,
    required SkinPaletteProfile palette,
  }) {
    final combined = <String>[
      ...visual.accessoryTypes,
      ...palette.accessorySuggestions,
    ];

    if (gender.isMale) {
      final filtered = combined.where((item) {
        final lower = item.toLowerCase();
        return !_femaleAccessoryHints.any((hint) => lower.contains(hint));
      }).toList();
      return _dedupe([...filtered, ..._maleAccessoryDefaults]);
    }

    return _dedupe(combined);
  }

  static String _suggestedMakeup(
    SkinReport skin,
    SkinPaletteProfile palette,
    OutfitVisualProfile visual,
  ) {
    final base = switch (palette.undertone) {
      SkinUndertone.warm => 'نود دافئ · blush خوخي · bronzer خفيف',
      SkinUndertone.cool => 'وردي بارد · highlighter فضي · mauve eyes',
      SkinUndertone.neutral => 'وردي محايد · contour ناعم',
    };
    if (_issueSeverity(skin, 'redness', skin.redness) > 60) {
      return '$base — مكياج مهدئ أخضر خفيف تحت الأساس';
    }
    if (_isRedDominant(visual)) return '$base — تجنّبي أحمر الشفاه القوي';
    return base;
  }

  static List<String> _dedupe(List<String> items) {
    final seen = <String>{};
    final out = <String>[];
    for (final item in items) {
      if (item.isEmpty) continue;
      if (seen.add(item)) out.add(item);
    }
    return out;
  }

  static bool _isNeutralPalette(List<String> colors) {
    const neutral = ['بيج', 'كريمي', 'رمادي', 'أبيض', 'نود', 'أسود'];
    return colors.isNotEmpty &&
        colors.every((color) => _colorMatchesAny(color, neutral));
  }

  static int _issueSeverity(SkinReport skin, String key, int fallbackField) {
    final health = skin.concernScores[key];
    if (health != null) return (100 - health).clamp(0, 100);
    return (fallbackField * 20).clamp(0, 100);
  }

  static bool _colorMatchesAny(String color, List<String> palette) {
    final c = color.toLowerCase();
    for (final p in palette) {
      final pLower = p.toLowerCase();
      if (c.contains(pLower) || pLower.contains(c)) return true;
    }
    return false;
  }

  static bool _hasAnyColor(OutfitVisualProfile visual, List<String> names) {
    return visual.dominantColors.any((c) => _colorMatchesAny(c, names));
  }

  static bool _hasShinyFabricHint(OutfitVisualProfile visual) {
    return _hasAnyColor(visual, ['فضي', 'ذهبي']) && visual.contrastLevel > 0.55;
  }

  static bool _isRedDominant(OutfitVisualProfile visual) {
    return visual.dominantColors.any(
      (c) => _colorMatchesAny(c, ['أحمر', 'نبيتي', 'مرجاني', 'وردي نيون']),
    );
  }

  static bool _isDullDarkNearFace(OutfitVisualProfile visual) {
    return _hasAnyColor(visual, ['أسود', 'رمادي', 'كحلي']) &&
        visual.contrastLevel < 0.35;
  }
}

extension _FirstOrNull<E> on List<E> {
  E? get firstOrNull => isEmpty ? null : first;
}
