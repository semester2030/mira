import '../contracts/result_enums.dart';
import '../versioning/results_experience_versions.dart';

/// Formal Score Semantics Contract — presentation only.
class ScoreSemanticsSpec {
  const ScoreSemanticsSpec({
    required this.category,
    required this.direction,
    required this.min,
    required this.max,
    required this.higherIsBetter,
    required this.publicLabelAr,
    required this.publicLabelEn,
    required this.colorRole,
    required this.numericVisibleByDefault,
    required this.comparisonEligibleByDefault,
    required this.accessibilityHintAr,
    required this.fallbackLabelAr,
  });

  final ScoreCategory category;
  final ScoreDirection direction;
  final double min;
  final double max;
  final bool higherIsBetter;
  final String publicLabelAr;
  final String publicLabelEn;
  final ColorRole colorRole;
  final bool numericVisibleByDefault;
  final bool comparisonEligibleByDefault;
  final String accessibilityHintAr;
  final String fallbackLabelAr;
}

abstract final class ScoreSemanticsContract {
  static const String version = ResultsExperienceVersions.scoreSemantics;

  static const ScoreSemanticsSpec wellness = ScoreSemanticsSpec(
    category: ScoreCategory.wellnessScore,
    direction: ScoreDirection.higherBetter,
    min: 0,
    max: 100,
    higherIsBetter: true,
    publicLabelAr: 'مؤشر حيوية البشرة',
    publicLabelEn: 'Skin vitality',
    colorRole: ColorRole.wellness,
    numericVisibleByDefault: true,
    comparisonEligibleByDefault: true,
    accessibilityHintAr: 'رقم أعلى يعني حالة أفضل',
    fallbackLabelAr: 'غير متاح',
  );

  static const ScoreSemanticsSpec concernSeverity = ScoreSemanticsSpec(
    category: ScoreCategory.concernSeverity,
    direction: ScoreDirection.higherWorse,
    min: 0,
    max: 100,
    higherIsBetter: false,
    publicLabelAr: 'مستوى الاحتياج',
    publicLabelEn: 'Need level',
    colorRole: ColorRole.severity,
    numericVisibleByDefault: true,
    comparisonEligibleByDefault: true,
    accessibilityHintAr: 'رقم أعلى يعني احتياجاً أوضح للعناية',
    fallbackLabelAr: 'غير متاح',
  );

  static const ScoreSemanticsSpec confidence = ScoreSemanticsSpec(
    category: ScoreCategory.confidenceScore,
    direction: ScoreDirection.higherBetter,
    min: 0,
    max: 100,
    higherIsBetter: true,
    publicLabelAr: 'ثقة التحليل',
    publicLabelEn: 'Analysis confidence',
    colorRole: ColorRole.confidence,
    numericVisibleByDefault: false,
    comparisonEligibleByDefault: false,
    accessibilityHintAr: 'ثقة التحليل منفصلة عن حالة البشرة',
    fallbackLabelAr: 'ثقة غير متاحة',
  );

  static const ScoreSemanticsSpec progressDelta = ScoreSemanticsSpec(
    category: ScoreCategory.progressDelta,
    direction: ScoreDirection.higherBetter,
    min: -100,
    max: 100,
    higherIsBetter: true,
    publicLabelAr: 'التغيير',
    publicLabelEn: 'Change',
    colorRole: ColorRole.wellness,
    numericVisibleByDefault: true,
    comparisonEligibleByDefault: true,
    accessibilityHintAr: 'يظهر فقط عند مقارنة صالحة',
    fallbackLabelAr: 'لا مقارنة بعد',
  );

  static const ScoreSemanticsSpec projection = ScoreSemanticsSpec(
    category: ScoreCategory.projection,
    direction: ScoreDirection.higherBetter,
    min: 0,
    max: 100,
    higherIsBetter: true,
    publicLabelAr: 'تقدير مستقبلي',
    publicLabelEn: 'Future estimate',
    colorRole: ColorRole.projection,
    numericVisibleByDefault: true,
    comparisonEligibleByDefault: false,
    accessibilityHintAr: 'تقدير وليس قياساً',
    fallbackLabelAr: 'لا تقدير',
  );

  static const ScoreSemanticsSpec productMatch = ScoreSemanticsSpec(
    category: ScoreCategory.productMatch,
    direction: ScoreDirection.higherBetter,
    min: 0,
    max: 100,
    higherIsBetter: true,
    publicLabelAr: 'مدى الملاءمة',
    publicLabelEn: 'Match suitability',
    colorRole: ColorRole.match,
    numericVisibleByDefault: true,
    comparisonEligibleByDefault: false,
    accessibilityHintAr: 'نسبة الملاءمة ليست ضماناً للنتيجة',
    fallbackLabelAr: 'ملاءمة غير كافية',
  );

  static const ScoreSemanticsSpec estimatedSkinAge = ScoreSemanticsSpec(
    category: ScoreCategory.estimatedSkinAge,
    direction: ScoreDirection.neutral,
    min: 0,
    max: 120,
    higherIsBetter: false,
    publicLabelAr: 'تقدير تجميلي للعمر الظاهري',
    publicLabelEn: 'Cosmetic appearance estimate',
    colorRole: ColorRole.neutral,
    numericVisibleByDefault: true,
    comparisonEligibleByDefault: false,
    accessibilityHintAr: 'تقدير تجميلي تقريبي وليس عمراً بيولوجياً',
    fallbackLabelAr: 'غير معروض',
  );

  static const ScoreSemanticsSpec nonPublicTechnical = ScoreSemanticsSpec(
    category: ScoreCategory.nonPublicTechnicalScore,
    direction: ScoreDirection.neutral,
    min: 0,
    max: 100,
    higherIsBetter: false,
    publicLabelAr: '',
    publicLabelEn: '',
    colorRole: ColorRole.hidden,
    numericVisibleByDefault: false,
    comparisonEligibleByDefault: false,
    accessibilityHintAr: '',
    fallbackLabelAr: '',
  );

  static ScoreSemanticsSpec forCategory(ScoreCategory category) {
    switch (category) {
      case ScoreCategory.wellnessScore:
        return wellness;
      case ScoreCategory.concernSeverity:
        return concernSeverity;
      case ScoreCategory.confidenceScore:
        return confidence;
      case ScoreCategory.progressDelta:
        return progressDelta;
      case ScoreCategory.projection:
        return projection;
      case ScoreCategory.productMatch:
        return productMatch;
      case ScoreCategory.estimatedSkinAge:
        return estimatedSkinAge;
      case ScoreCategory.nonPublicTechnicalScore:
        return nonPublicTechnical;
    }
  }

  /// Converts a wellness-style UI score (higher better) into concern severity
  /// (higher worse) for public presentation. Does not alter frozen intelligence.
  static double wellnessUiToSeverity(double uiScore) {
    final clamped = uiScore.clamp(0, 100).toDouble();
    return 100 - clamped;
  }

  /// Status label for concern severity (higher = more need).
  static String concernSeverityStatusAr(double severity) {
    if (severity < 22) return 'متوازن';
    if (severity < 35) return 'خفيف';
    if (severity < 50) return 'متوسط';
    return 'واضح';
  }

  /// Status label for wellness (higher better).
  static String wellnessStatusAr(double score) {
    if (score >= 78) return 'ممتاز';
    if (score >= 65) return 'جيد';
    if (score >= 50) return 'يحتاج عناية';
    return 'يحتاج تركيزاً';
  }

  /// Ensures severity color role is never treated as wellness positive.
  static bool isPositiveAppearanceForbidden(ScoreCategory category) {
    return category == ScoreCategory.concernSeverity;
  }
}
