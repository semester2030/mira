import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/ai/models/mira_occasion.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_analysis.dart';
import 'package:mirra/features/outfit_analysis/domain/services/fashion_recommendation_engine.dart';

void main() {
  group('FashionRecommendationEngine', () {
    test('classic work outfit suggests structured blazer not duplicates', () {
      final analysis = OutfitAnalysis(
        occasion: MiraOccasion.work,
        clothingType: 'بدلة',
        styleType: 'كلاسيكي',
        dominantColors: const ['كحلي', 'أبيض'],
        compatibilityScore: 84,
        recommendedColors: const ['بيج', 'فضي'],
        rejectedColors: const [],
        suggestedAccessories: const ['ساعة'],
        suggestedMakeup: '',
        explanation: '',
        confidence: 82,
        formalityLevel: 'عالي',
        styleVerdict: 'أناقة كلاسيكية',
        detectedPieces: const ['بدلة', 'قميص'],
        colorHarmonyScore: 78,
      );

      final clothing = FashionRecommendationEngine.suggestClothing(analysis);
      expect(clothing, isNotEmpty);
      expect(clothing.every((p) => p.compatibilityScore >= 62), isTrue);
      expect(clothing.every((p) => p.imageAsset.startsWith('assets/fashion/')), isTrue);
      expect(clothing.every((p) => p.whyAr.isNotEmpty), isTrue);
    });

    test('wedding occasion prioritizes pearl and shawl accessories', () {
      final analysis = OutfitAnalysis(
        occasion: MiraOccasion.wedding,
        clothingType: 'فستان',
        styleType: 'أنيق',
        dominantColors: const ['أبيض', 'ذهبي'],
        compatibilityScore: 90,
        recommendedColors: const ['فضي', 'كريمي'],
        rejectedColors: const [],
        suggestedAccessories: const [],
        suggestedMakeup: '',
        explanation: '',
        confidence: 88,
        formalityLevel: 'عالي',
        detectedPieces: const ['فستان'],
        colorHarmonyScore: 85,
      );

      final accessories = FashionRecommendationEngine.suggestAccessories(analysis);
      expect(accessories, isNotEmpty);
      expect(
        accessories.any((a) => a.id.contains('pearl') || a.id.contains('shawl') || a.id.contains('clutch')),
        isTrue,
      );
    });

    test('casual occasion avoids formal-only heels when score is low', () {
      final analysis = OutfitAnalysis(
        occasion: MiraOccasion.casual,
        clothingType: 'تيشيرت',
        styleType: 'كاجوال',
        dominantColors: const ['أزرق'],
        compatibilityScore: 72,
        recommendedColors: const ['بيج'],
        rejectedColors: const [],
        suggestedAccessories: const [],
        suggestedMakeup: '',
        explanation: '',
        confidence: 70,
        formalityLevel: 'منخفض',
        detectedPieces: const ['تيشيرت', 'جينز'],
        colorHarmonyScore: 65,
      );

      final clothing = FashionRecommendationEngine.suggestClothing(analysis);
      final accessories = FashionRecommendationEngine.suggestAccessories(analysis);

      expect(clothing.any((c) => c.styleTag == 'casual' || c.id.contains('cardigan')), isTrue);
      expect(accessories.any((a) => a.id.contains('tote') || a.id.contains('sunglasses')), isTrue);
    });

    test('rejects pieces without why text', () {
      final pieces = FashionRecommendationEngine.suggestClothing(
        OutfitAnalysis(
          occasion: MiraOccasion.evening,
          clothingType: 'فستان',
          styleType: 'أنيق',
          dominantColors: const ['أسود'],
          compatibilityScore: 88,
          recommendedColors: const ['فضي'],
          rejectedColors: const [],
          suggestedAccessories: const [],
          suggestedMakeup: '',
          explanation: '',
          confidence: 85,
          detectedPieces: const ['فستان'],
          colorHarmonyScore: 80,
        ),
      );

      expect(pieces.every((p) => p.whyAr.trim().isNotEmpty), isTrue);
    });
  });
}
