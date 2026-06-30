import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/ai/models/mira_occasion.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_analysis.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_analysis_mode.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_compare_snapshot.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_report.dart';
import 'package:mirra/features/outfit_analysis/domain/services/outfit_color_preview_service.dart';
import 'package:mirra/features/outfit_analysis/domain/services/outfit_compare_service.dart';
import 'package:mirra/features/outfit_analysis/domain/services/outfit_occasion_scoring.dart';

OutfitAnalysis _analysis({
  MiraOccasion occasion = MiraOccasion.work,
  int occasionMatch = 82,
  String formality = 'رسمي',
}) {
  return OutfitAnalysis(
    occasion: occasion,
    mode: OutfitAnalysisMode.smart,
    clothingType: 'بلوزة',
    styleType: 'كلاسيكي',
    dominantColors: const ['أسود', 'بيج'],
    compatibilityScore: 84,
    recommendedColors: const ['كحلي', 'نبيتي', 'كريمي'],
    rejectedColors: const ['برتقالي'],
    suggestedAccessories: const [],
    suggestedMakeup: '',
    explanation: 'test',
    confidence: 80,
    formalityLevel: formality,
    contrastLevel: 'متوسط',
    occasionMatchScore: occasionMatch,
    colorHarmonyScore: 78,
    skinCompatibilityScore: 81,
    upperBodyColors: const ['أسود'],
  );
}

void main() {
  group('OutfitOccasionScoring', () {
    test('suggests different occasion when work score is high', () {
      final analysis = _analysis(occasion: MiraOccasion.work, occasionMatch: 85);
      final next = OutfitOccasionScoring.suggestNext(analysis);
      expect(next, isNotNull);
      expect(next!.isCurrent, isFalse);
    });

    test('forecasts all occasions', () {
      final forecasts = OutfitOccasionScoring.forecastAll(_analysis());
      expect(forecasts.length, MiraOccasion.values.length);
      expect(forecasts.any((f) => f.isCurrent), isTrue);
    });
  });

  group('OutfitColorPreviewService', () {
    test('builds alternatives from recommended colors', () {
      final alts = OutfitColorPreviewService.alternatives(_analysis());
      expect(alts, isNotEmpty);
      expect(alts.first.alternativeColorAr, isNotEmpty);
      expect(alts.first.pieceLabelAr, isNotEmpty);
    });
  });

  group('OutfitCompareService', () {
    test('picks winner with higher compatibility', () {
      final left = OutfitCompareSnapshot.fromAnalysis(_analysis());
      final right = OutfitCompareSnapshot(
        id: 'b',
        labelAr: 'كاجوال · فستان',
        occasion: MiraOccasion.casual,
        compatibilityScore: 70,
        occasionMatchScore: 68,
        colorHarmonyScore: 72,
      );
      final verdict = OutfitCompareService.compare(left, right);
      expect(verdict.winnerSide, 'left');
      expect(verdict.dimensions, isNotEmpty);
    });

    test('maps report snapshot', () {
      const report = OutfitReport(
        compatibilityScore: 77,
        dominantColors: ['أبيض'],
        garmentType: 'فستان',
        styleCategory: 'أنيق',
        occasionSuitability: 'مناسب',
        alternativeColors: ['كريمي'],
        occasionId: 'evening',
        occasionLabelAr: 'سهرة',
      );
      final snap = OutfitCompareSnapshot.fromReport(report);
      expect(snap.occasion, MiraOccasion.evening);
      expect(snap.compatibilityScore, 77);
    });
  });
}
