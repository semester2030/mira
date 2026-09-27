import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/ai/models/mira_occasion.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_analysis.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_analysis_mode.dart';
import 'package:mirra/features/outfit_analysis/domain/helpers/outfit_stylist_copy.dart';
import 'package:mirra/features/outfit_analysis/domain/services/outfit_trust_scoring.dart';

OutfitAnalysis _sample() {
  return OutfitAnalysis(
    occasion: MiraOccasion.evening,
    mode: OutfitAnalysisMode.smart,
    clothingType: 'فستان',
    styleType: 'كلاسيكي',
    dominantColors: const ['أسود', 'ذهبي'],
    compatibilityScore: 82,
    recommendedColors: const ['كريمي', 'نبيتي'],
    rejectedColors: const ['برتقالي'],
    suggestedAccessories: const [],
    suggestedMakeup: '',
    explanation: '',
    confidence: 80,
    occasionMatchScore: 86,
    styleBalanceScore: 78,
    colorHarmonyScore: 88,
    skinCompatibilityScore: 81,
    formalityLevel: 'رسمي',
  );
}

void main() {
  group('OutfitTrustScoring', () {
    test('does not raise raw score with psychological floors', () {
      final adjusted = OutfitTrustScoring.applyFinalScore(
        rawScore: 49,
        occasionScore: 85,
        styleScore: 78,
        colorHarmonyScore: 70,
      );
      expect(adjusted, 49);
    });

    test('does not boost confidence from harmony / occasion', () {
      final c = OutfitTrustScoring.applyConfidence(
        baseConfidence: 72,
        colorHarmonyScore: 90,
        occasionScore: 82,
        styleScore: 76,
      );
      expect(c, 72);
    });

    test('clamps to 0–100 without artificial 55–98 band', () {
      expect(
        OutfitTrustScoring.applyConfidence(
          baseConfidence: 40,
          colorHarmonyScore: 99,
          occasionScore: 99,
          styleScore: 99,
        ),
        40,
      );
      expect(
        OutfitTrustScoring.applyConfidence(
          baseConfidence: 100,
          colorHarmonyScore: 0,
          occasionScore: 0,
          styleScore: 0,
        ),
        100,
      );
    });

    test('passes weak outfits unchanged', () {
      final adjusted = OutfitTrustScoring.applyFinalScore(
        rawScore: 42,
        occasionScore: 55,
        styleScore: 50,
        colorHarmonyScore: 48,
      );
      expect(adjusted, 42);
    });
  });

  group('OutfitStylistCopy', () {
    test('hero copy includes title and occasion line', () {
      final copy = OutfitStylistCopy.hero(_sample());
      expect(copy.outfitTitle, contains('كلاسيكي'));
      expect(copy.occasionMatchLine, contains('سهرة'));
      expect(copy.eleganceLevel, isNotEmpty);
    });

    test('color insights include why text', () {
      final insights = OutfitStylistCopy.colorHarmonyInsights(_sample());
      expect(insights, isNotEmpty);
      expect(insights.first.whyAr, isNotEmpty);
    });

    test('why this works returns human lines', () {
      final lines = OutfitStylistCopy.whyThisWorks(_sample());
      expect(lines, isNotEmpty);
      expect(lines.length, lessThanOrEqualTo(5));
    });
  });
}
