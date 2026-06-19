import 'dart:math' as math;

import '../models/mira_occasion.dart';
import '../models/outfit_analysis_result.dart';
import '../providers/outfit_analysis_provider.dart';
import '../utils/image_seed.dart';
import '../../../features/outfit_analysis/domain/entities/outfit_style_metrics.dart';

/// Deterministic mock — simulates FASHN.ai until API key is configured.
class MockOutfitAnalysisProvider implements OutfitAnalysisProvider {
  static const _garments = [
    (ar: 'فستان', en: 'Dress'),
    (ar: 'عباءة', en: 'Abaya'),
    (ar: 'بدلة', en: 'Suit'),
    (ar: 'تنورة وبلوزة', en: 'Skirt & Blouse'),
  ];

  static const _styles = [
    (ar: 'أنيق', en: 'Elegant'),
    (ar: 'كلاسيكي', en: 'Classic'),
    (ar: 'عصري', en: 'Modern'),
    (ar: 'راقي', en: 'Refined'),
  ];

  static const _colorPalettes = [
    ['زيتوني', 'ذهبي'],
    ['وردي', 'بيج'],
    ['أسود', 'فضي'],
    ['أزرق ملكي', 'كريمي'],
    ['نبيتي', 'ذهبي'],
  ];

  @override
  Future<OutfitAnalysisResult> analyze({
    required List<int> imageBytes,
    required MiraOccasion occasion,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 850));

    final seed = seedFromImageBytes(imageBytes) ^ occasion.index * 997;
    final rng = math.Random(seed);

    final garment = _garments[seed % _garments.length];
    final style = _styles[(seed ~/ 3) % _styles.length];
    final palette = _colorPalettes[(seed ~/ 5) % _colorPalettes.length];

    final baseHealth = 52 + rng.nextInt(38);
    final styleMetrics = _buildMetrics(baseHealth, rng, occasion);
    final compatibilityScore = baseHealth.toDouble();
    final suitability = _occasionSuitability(occasion, compatibilityScore);

    return OutfitAnalysisResult(
      compatibilityScore: compatibilityScore,
      dominantColors: List<String>.from(palette),
      garmentTypeAr: garment.ar,
      garmentTypeEn: garment.en,
      styleCategoryAr: style.ar,
      styleCategoryEn: style.en,
      occasionSuitabilityAr: suitability.ar,
      occasionSuitabilityEn: suitability.en,
      alternativeColorsAr: _alternativeColorsAr(occasion),
      alternativeColorsEn: _alternativeColorsEn(occasion),
      occasion: occasion,
      styleMetrics: styleMetrics,
    );
  }

  static OutfitStyleMetrics _buildMetrics(
    int baseHealth,
    math.Random rng,
    MiraOccasion occasion,
  ) {
    int jitter(int center, int spread) =>
        (center + rng.nextInt(spread * 2 + 1) - spread).clamp(0, 100);

    var occasionFit = jitter(baseHealth, 8);
    var formalityGap = (100 - baseHealth + rng.nextInt(12)).clamp(0, 100);

    if (occasion == MiraOccasion.interview || occasion == MiraOccasion.work) {
      occasionFit = (occasionFit - 6).clamp(0, 100);
      formalityGap = (formalityGap + 8).clamp(0, 100);
    }

    return OutfitStyleMetrics(
      colorHarmony: jitter(baseHealth, 6),
      occasionFit: occasionFit,
      styleCoherence: jitter(baseHealth - 2, 7),
      silhouetteBalance: jitter(baseHealth - 3, 6),
      polish: jitter(baseHealth - 5, 8),
      colorClashSeverity: (100 - baseHealth + rng.nextInt(10)).clamp(0, 100),
      occasionMismatchSeverity: (100 - occasionFit + rng.nextInt(8)).clamp(0, 100),
      tonalImbalanceSeverity: (100 - baseHealth + rng.nextInt(14)).clamp(0, 100),
      accessoryOverloadSeverity: jitter(100 - baseHealth, 12),
      formalityGapSeverity: formalityGap,
    );
  }

  static ({String ar, String en}) _occasionSuitability(
    MiraOccasion occasion,
    double score,
  ) {
    final level = score >= 86
        ? (ar: 'ممتاز', en: 'Excellent')
        : score >= 74
            ? (ar: 'مناسب جدًا', en: 'Very suitable')
            : score >= 62
                ? (ar: 'مناسب', en: 'Suitable')
                : (ar: 'يحتاج تحسين', en: 'Needs improvement');

    return (
      ar: '${level.ar} لمناسبة ${occasion.labelAr}',
      en: '${level.en} for ${occasion.labelEn}',
    );
  }

  static List<String> _alternativeColorsAr(MiraOccasion occasion) {
    switch (occasion) {
      case MiraOccasion.wedding:
      case MiraOccasion.eid:
        return ['ذهبي', 'شامبين', 'عنابي'];
      case MiraOccasion.work:
      case MiraOccasion.interview:
        return ['كحلي', 'بيج', 'رمادي فاتح'];
      case MiraOccasion.evening:
        return ['أسود', 'ياقوتي', 'فضي'];
      default:
        return ['تركواز', 'مرجاني', 'لافندر'];
    }
  }

  static List<String> _alternativeColorsEn(MiraOccasion occasion) {
    switch (occasion) {
      case MiraOccasion.wedding:
      case MiraOccasion.eid:
        return ['Gold', 'Champagne', 'Burgundy'];
      case MiraOccasion.work:
      case MiraOccasion.interview:
        return ['Navy', 'Beige', 'Light Grey'];
      case MiraOccasion.evening:
        return ['Black', 'Ruby', 'Silver'];
      default:
        return ['Turquoise', 'Coral', 'Lavender'];
    }
  }
}
