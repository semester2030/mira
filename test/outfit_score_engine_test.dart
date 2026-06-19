import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/ai/models/mira_occasion.dart';
import 'package:mirra/core/ai/models/outfit_analysis_result.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_score_result.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_style_metrics.dart';
import 'package:mirra/features/outfit_analysis/domain/services/deterministic_outfit_engine.dart';
import 'package:mirra/features/outfit_analysis/domain/services/outfit_score_engine.dart';

void main() {
  group('OutfitScoreEngine', () {
    test('weak outfits do not inflate into 80+', () {
      final outfit = _outfit(_weakMetrics(), MiraOccasion.interview);
      final result = OutfitScoreEngine.compute(outfit);

      expect(result.finalScore, lessThan(72));
      expect(result.finalScore, greaterThan(20));
      expect(result.strongestIssueId, isNotEmpty);
    });

    test('strong cohesive outfits score well without easy 93+', () {
      final outfit = _outfit(_strongMetrics(), MiraOccasion.wedding);
      final result = OutfitScoreEngine.compute(outfit);

      expect(result.finalScore, greaterThanOrEqualTo(74));
      expect(result.finalScore, lessThanOrEqualTo(93));
      expect(result.occasionReady, isTrue);
    });

    test('compound penalties reduce score vs lower mismatch', () {
      final high = OutfitScoreEngine.compute(
        _outfit(_weakMetrics(), MiraOccasion.work),
      );
      final lowerMismatch = OutfitScoreEngine.compute(
        _outfit(
          _weakMetrics().copyWith(
            occasionMismatchSeverity: 40,
            formalityGapSeverity: 35,
          ),
          MiraOccasion.work,
        ),
      );

      expect(high.finalScore, lessThan(lowerMismatch.finalScore));
      expect(high.compoundPenalty, greaterThan(0));
    });

    test('deterministic smart weighted formula matches breakdown components', () {
      const skin = 82;
      const occasion = 74;
      const style = 68;
      const harmony = 71;

      final expected = DeterministicOutfitEngine.computeWeightedFinalSmart(
        skinScore: skin,
        occasionScore: occasion,
        styleScore: style,
        colorHarmonyScore: harmony,
      );

      expect(
        expected,
        ((skin * 0.40) + (occasion * 0.35) + (style * 0.15) + (harmony * 0.10))
            .round(),
      );
    });

    test('deterministic quick weighted formula matches breakdown components', () {
      const occasion = 74;
      const style = 68;
      const harmony = 71;

      final expected = DeterministicOutfitEngine.computeWeightedFinalQuick(
        occasionScore: occasion,
        styleScore: style,
        colorHarmonyScore: harmony,
      );

      expect(
        expected,
        ((occasion * 0.45) + (style * 0.30) + (harmony * 0.25)).round(),
      );
    });

    test('temporal smoothing limits jumps to ±4', () {
      final result = OutfitScoreEngine.compute(
        _outfit(_strongMetrics(), MiraOccasion.casual),
        previousScore: 74,
      );

      expect((result.finalScore - 74).abs(), lessThanOrEqualTo(4));
    });
  });
}

OutfitStyleMetrics _weakMetrics() {
  return const OutfitStyleMetrics(
    colorHarmony: 48,
    occasionFit: 42,
    styleCoherence: 50,
    silhouetteBalance: 46,
    polish: 44,
    colorClashSeverity: 72,
    occasionMismatchSeverity: 78,
    tonalImbalanceSeverity: 65,
    accessoryOverloadSeverity: 40,
    formalityGapSeverity: 70,
  );
}

OutfitStyleMetrics _strongMetrics() {
  return const OutfitStyleMetrics(
    colorHarmony: 88,
    occasionFit: 86,
    styleCoherence: 84,
    silhouetteBalance: 82,
    polish: 80,
    colorClashSeverity: 18,
    occasionMismatchSeverity: 15,
    tonalImbalanceSeverity: 20,
    accessoryOverloadSeverity: 12,
    formalityGapSeverity: 16,
  );
}

OutfitAnalysisResult _outfit(OutfitStyleMetrics metrics, MiraOccasion occasion) {
  return OutfitAnalysisResult(
    compatibilityScore: 70,
    dominantColors: const ['زيتوني', 'ذهبي'],
    garmentTypeAr: 'فستان',
    garmentTypeEn: 'Dress',
    styleCategoryAr: 'أنيق',
    styleCategoryEn: 'Elegant',
    occasionSuitabilityAr: 'مناسب',
    occasionSuitabilityEn: 'Suitable',
    alternativeColorsAr: const ['كحلي'],
    alternativeColorsEn: const ['Navy'],
    occasion: occasion,
    styleMetrics: metrics,
  );
}

extension on OutfitStyleMetrics {
  OutfitStyleMetrics copyWith({
    int? colorHarmony,
    int? occasionFit,
    int? styleCoherence,
    int? silhouetteBalance,
    int? polish,
    int? colorClashSeverity,
    int? occasionMismatchSeverity,
    int? tonalImbalanceSeverity,
    int? accessoryOverloadSeverity,
    int? formalityGapSeverity,
  }) {
    return OutfitStyleMetrics(
      colorHarmony: colorHarmony ?? this.colorHarmony,
      occasionFit: occasionFit ?? this.occasionFit,
      styleCoherence: styleCoherence ?? this.styleCoherence,
      silhouetteBalance: silhouetteBalance ?? this.silhouetteBalance,
      polish: polish ?? this.polish,
      colorClashSeverity: colorClashSeverity ?? this.colorClashSeverity,
      occasionMismatchSeverity:
          occasionMismatchSeverity ?? this.occasionMismatchSeverity,
      tonalImbalanceSeverity:
          tonalImbalanceSeverity ?? this.tonalImbalanceSeverity,
      accessoryOverloadSeverity:
          accessoryOverloadSeverity ?? this.accessoryOverloadSeverity,
      formalityGapSeverity: formalityGapSeverity ?? this.formalityGapSeverity,
    );
  }
}
