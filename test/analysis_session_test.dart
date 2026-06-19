import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/ai/models/mira_occasion.dart';
import 'package:mirra/core/session/analysis_session.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_analysis.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_analysis_mode.dart';
import 'package:mirra/features/outfit_analysis/domain/helpers/outfit_analysis_mapper.dart';
import 'package:mirra/features/skin_analysis/domain/entities/skin_report.dart';

void main() {
  setUp(AnalysisSession.clear);

  test('hasSkinReport reflects lastSkin', () {
    expect(AnalysisSession.hasSkinReport, isFalse);
    AnalysisSession.setSkin(_skin());
    expect(AnalysisSession.hasSkinReport, isTrue);
  });

  test('canBuildFullRecommendation requires skin and outfit', () {
    AnalysisSession.setSkin(_skin());
    expect(AnalysisSession.canBuildFullRecommendation, isFalse);

    AnalysisSession.setOutfit(
      OutfitAnalysisMapper.toLegacyReport(_quickOutfit()),
    );
    expect(AnalysisSession.canBuildFullRecommendation, isTrue);
  });
}

SkinReport _skin() {
  return SkinReport(
    skinType: 'مختلطة',
    score: 72,
    hydration: 58,
    oiliness: 45,
    pores: 2,
    wrinkles: 1,
    spots: 1,
    acne: 1,
    redness: 1,
    undertone: 'دافئ',
    undertoneEn: 'Warm',
    skinTone: 'متوسط',
    skinToneEn: 'Medium',
    advice: 'روتين',
  );
}

OutfitAnalysis _quickOutfit() {
  return OutfitAnalysis(
    occasion: MiraOccasion.casual,
    mode: OutfitAnalysisMode.quick,
    clothingType: 'فستان',
    styleType: 'كلاسيكي',
    dominantColors: const ['كحلي'],
    compatibilityScore: 78,
    recommendedColors: const [],
    rejectedColors: const [],
    suggestedAccessories: const ['حقيبة'],
    suggestedMakeup: '',
    explanation: 'quick',
    confidence: 72,
  );
}
