import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/ai/models/mira_occasion.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_analysis.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_analysis_mode.dart';
import 'package:mirra/features/outfit_analysis/domain/helpers/outfit_result_sections.dart';
import 'package:mirra/features/outfit_analysis/domain/helpers/outfit_stylist_copy.dart';
import 'package:mirra/features/outfit_analysis/domain/services/deterministic_outfit_engine.dart';

void main() {
  group('OutfitResultSections', () {
    test('hides duplicate improvement section when same as mismatches', () {
      final analysis = _sampleAnalysis(
        mismatchReasons: const ['كثرة الألوان قد تشتت التنسيق'],
        recommendations: const ['كثرة الألوان قد تشتت التنسيق'],
      );

      final plan = OutfitResultSections.plan(analysis);
      expect(plan.improvements, isEmpty);
      expect(plan.mismatches, isNotEmpty);
    });

    test('shows actionable improvements when different from mismatches', () {
      final analysis = _sampleAnalysis(
        mismatchReasons: const ['كثرة الألوان قد تشتت التنسيق'],
        recommendations: const ['اختاري لونين أساسيين فقط — لون القطعة ولون الإكسسوار'],
      );

      final plan = OutfitResultSections.plan(analysis);
      expect(plan.improvements, isNotEmpty);
      expect(plan.improvements.first, contains('لونين'));
    });
  });

  group('DeterministicOutfitEngine.buildImprovementActions', () {
    test('maps color overload mismatch to actionable tip', () {
      final actions = DeterministicOutfitEngine.buildImprovementActions(
        const ['كثرة الألوان قد تشتت التنسيق'],
        MiraOccasion.evening,
      );
      expect(actions.first, contains('لونين'));
    });
  });

  group('OutfitStylistCopy.scoreSubtitle', () {
    test('uses compatibilityScore consistently', () {
      final analysis = _sampleAnalysis(compatibilityScore: 77);
      expect(OutfitStylistCopy.scoreSubtitle(analysis), contains('77/100'));
    });
  });
}

OutfitAnalysis _sampleAnalysis({
  int compatibilityScore = 70,
  List<String> mismatchReasons = const [],
  List<String> recommendations = const [],
  List<String> matchReasons = const ['أسلوب سهرة متوازن للمناسبة'],
}) {
  return OutfitAnalysis(
    mode: OutfitAnalysisMode.quick,
    occasion: MiraOccasion.evening,
    clothingType: 'فستان',
    styleType: 'سهرة',
    dominantColors: const ['أزرق'],
    compatibilityScore: compatibilityScore,
    recommendedColors: const ['كحلي'],
    rejectedColors: const [],
    suggestedAccessories: const [],
    suggestedMakeup: '',
    explanation: 'legacy',
    confidence: 70,
    matchReasons: matchReasons,
    mismatchReasons: mismatchReasons,
    recommendations: recommendations,
    styleVerdict: 'إطلالة جيدة',
    detectedPieces: const ['فستان'],
    visionLabels: const [],
    visualConfidence: 80,
    contrastLevel: '0.5',
    formalityLevel: '0.8',
    analysisSource: 'test',
    visualSource: 'test',
    skinCompatibilityScore: 0,
    occasionMatchScore: 74,
    styleBalanceScore: 72,
    colorHarmonyScore: 46,
  );
}
