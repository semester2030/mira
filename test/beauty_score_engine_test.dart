import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/skin_analysis/domain/entities/beauty_score_result.dart';
import 'package:mirra/features/skin_analysis/domain/entities/capture_quality_signals.dart';
import 'package:mirra/features/skin_analysis/domain/entities/skin_report.dart';
import 'package:mirra/features/skin_analysis/domain/services/beauty_score_engine.dart';

void main() {
  group('BeautyScoreEngine', () {
    test('problematic skin does not inflate above realistic range', () {
      final report = _report(
        hydration: 52,
        oiliness: 78,
        pores: 4,
        wrinkles: 2,
        spots: 3,
        acne: 3,
        redness: 3,
        concernScores: {
          'moisture': 52,
          'oiliness': 22,
          'pore': 38,
          'wrinkle': 62,
          'acne': 42,
          'age_spot': 45,
          'redness': 40,
          'texture': 48,
          'dark_circle': 44,
          'radiance': 50,
          'firmness': 58,
        },
      );

      final result = BeautyScoreEngine.compute(report);
      expect(result.finalScore, lessThan(72));
      expect(result.finalScore, greaterThan(35));
      expect(result.strongestIssueId, isNotEmpty);
    });

    test('multiple severe issues land in weak or severe band', () {
      final report = _report(
        hydration: 44,
        oiliness: 82,
        pores: 5,
        wrinkles: 4,
        spots: 4,
        acne: 4,
        redness: 4,
        concernScores: {
          'moisture': 44,
          'oiliness': 18,
          'pore': 28,
          'wrinkle': 36,
          'acne': 30,
          'age_spot': 32,
          'redness': 34,
          'texture': 35,
          'dark_circle': 30,
          'radiance': 40,
          'firmness': 42,
        },
      );

      final result = BeautyScoreEngine.compute(report);
      expect(result.finalScore, lessThanOrEqualTo(55));
    });

    test('healthy skin can reach good or excellent but rarely above 93', () {
      final report = _report(
        hydration: 86,
        oiliness: 24,
        pores: 1,
        wrinkles: 1,
        spots: 1,
        acne: 0,
        redness: 1,
        concernScores: {
          'moisture': 86,
          'oiliness': 76,
          'pore': 88,
          'wrinkle': 90,
          'acne': 92,
          'age_spot': 90,
          'redness': 91,
          'texture': 87,
          'dark_circle': 84,
          'radiance': 88,
          'firmness': 89,
        },
      );

      final result = BeautyScoreEngine.compute(report);
      expect(result.finalScore, greaterThanOrEqualTo(76));
      expect(result.finalScore, lessThanOrEqualTo(93));
      expect(result.severityLevel.index, greaterThanOrEqualTo(BeautySeverityLevel.good.index));
    });

    test('compound oiliness + pores penalty reduces score', () {
      final highCombo = BeautyScoreEngine.compute(
        _report(
          hydration: 60,
          oiliness: 82,
          pores: 5,
          concernScores: {
            'moisture': 60,
            'oiliness': 18,
            'pore': 25,
            'wrinkle': 70,
            'acne': 68,
            'age_spot': 72,
            'redness': 70,
            'texture': 62,
            'dark_circle': 65,
            'radiance': 58,
            'firmness': 66,
          },
        ),
      );

      final lowerPores = BeautyScoreEngine.compute(
        _report(
          hydration: 60,
          oiliness: 82,
          pores: 2,
          concernScores: {
            'moisture': 60,
            'oiliness': 18,
            'pore': 62,
            'wrinkle': 70,
            'acne': 68,
            'age_spot': 72,
            'redness': 70,
            'texture': 62,
            'dark_circle': 65,
            'radiance': 58,
            'firmness': 66,
          },
        ),
      );

      expect(highCombo.finalScore, lessThan(lowerPores.finalScore));
      expect(highCombo.compoundPenalty, greaterThan(0));
    });

    test('poor capture quality reduces confidence and score', () {
      final baseReport = _report(
        hydration: 68,
        oiliness: 48,
        pores: 2,
        concernScores: {
          'moisture': 68,
          'oiliness': 52,
          'pore': 70,
          'wrinkle': 72,
          'acne': 75,
          'age_spot': 74,
          'redness': 73,
          'texture': 69,
          'dark_circle': 66,
          'radiance': 67,
          'firmness': 70,
        },
      );

      final goodLight = BeautyScoreEngine.compute(baseReport);
      final poorLight = BeautyScoreEngine.compute(
        baseReport,
        captureQuality: const CaptureQualitySignals(
          lightingQuality: 0.32,
          faceAngleDegrees: 26,
          blurAmount: 0.42,
        ),
      );

      expect(poorLight.confidence, lessThan(goodLight.confidence));
      expect(poorLight.finalScore, lessThan(goodLight.finalScore));
    });

    test('temporal smoothing limits jumps to ±4', () {
      final report = _report(
        hydration: 70,
        oiliness: 40,
        pores: 2,
        concernScores: {
          'moisture': 70,
          'oiliness': 60,
          'pore': 72,
          'wrinkle': 74,
          'acne': 76,
          'age_spot': 75,
          'redness': 74,
          'texture': 71,
          'dark_circle': 68,
          'radiance': 69,
          'firmness': 72,
        },
      );

      final result = BeautyScoreEngine.compute(report, previousScore: 58);
      expect((result.finalScore - 58).abs(), lessThanOrEqualTo(4));
    });

    test('never uses naive average of all metrics', () {
      final report = _report(
        hydration: 50,
        oiliness: 80,
        pores: 4,
        wrinkles: 3,
        spots: 3,
        acne: 3,
        redness: 3,
        concernScores: {
          'moisture': 50,
          'oiliness': 20,
          'pore': 35,
          'wrinkle': 45,
          'acne': 40,
          'age_spot': 42,
          'redness': 38,
          'texture': 44,
          'dark_circle': 40,
          'radiance': 46,
          'firmness': 48,
        },
      );

      final naiveAverage = report.concernScores.values.fold<int>(0, (a, b) => a + b) /
          report.concernScores.length;

      final result = BeautyScoreEngine.compute(report);
      expect(result.finalScore, isNot(naiveAverage.round()));
      expect(result.finalScore, lessThan(naiveAverage));
    });
  });
}

SkinReport _report({
  required int hydration,
  required int oiliness,
  required int pores,
  int wrinkles = 2,
  int spots = 2,
  int acne = 1,
  int redness = 1,
  Map<String, int>? concernScores,
}) {
  return SkinReport(
    skinType: 'مختلطة',
    score: 0,
    hydration: hydration,
    oiliness: oiliness,
    pores: pores,
    wrinkles: wrinkles,
    spots: spots,
    acne: acne,
    redness: redness,
    advice: '',
    concernScores: concernScores ?? const {},
  );
}
