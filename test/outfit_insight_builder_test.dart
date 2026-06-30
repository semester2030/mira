import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/ai/models/mira_occasion.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_analysis.dart';
import 'package:mirra/features/outfit_analysis/presentation/widgets/outfit_insight/outfit_insight_builder.dart';

void main() {
  test('clothing pieces use asset-backed suggested piece models', () {
    final analysis = OutfitAnalysis(
      occasion: MiraOccasion.work,
      clothingType: 'بدلة',
      styleType: 'رسمي',
      dominantColors: const ['كحلي'],
      compatibilityScore: 82,
      recommendedColors: const ['بيج', 'فضي'],
      rejectedColors: const [],
      suggestedAccessories: const ['ساعة'],
      suggestedMakeup: '',
      explanation: '',
      confidence: 80,
      formalityLevel: 'عالي',
      detectedPieces: const ['بدلة'],
      colorHarmonyScore: 76,
    );

    final pieces = OutfitInsightBuilder.clothingPieces(analysis);
    expect(pieces, isNotEmpty);
    expect(pieces.first.imageAsset, startsWith('assets/fashion/'));
    expect(pieces.first.compatibilityPercent, greaterThanOrEqualTo(62));
  });

  test('accessories return asset cards not generic placeholders', () {
    final analysis = OutfitAnalysis(
      occasion: MiraOccasion.evening,
      clothingType: 'فستان',
      styleType: 'أنيق',
      dominantColors: const ['أسود', 'ذهبي'],
      compatibilityScore: 86,
      recommendedColors: const ['فضي'],
      rejectedColors: const [],
      suggestedAccessories: const ['عقد'],
      suggestedMakeup: '',
      explanation: '',
      confidence: 84,
      formalityLevel: 'عالي',
      detectedPieces: const ['فستان'],
      colorHarmonyScore: 82,
    );

    final acc = OutfitInsightBuilder.accessories(analysis);
    expect(acc, isNotEmpty);
    expect(acc.every((a) => a.imageAsset.contains('assets/fashion/')), isTrue);
    expect(acc.every((a) => a.title.isNotEmpty), isTrue);
  });
}
