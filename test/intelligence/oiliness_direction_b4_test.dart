import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/intelligence/domain/services/local_mira_report_builder.dart';
import 'package:mirra/features/skin_analysis/domain/entities/skin_report.dart';
import 'package:mirra/features/skin_analysis/domain/services/beauty_score_engine.dart';
import 'package:mirra/features/skin_analysis/domain/services/skin_report_matrix.dart';

void main() {
  test('the same oiliness ui_score has one severity in a stored map and a legacy field', () {
    for (final score in [35, 64, 65, 80]) {
      final legacyReport = _report(score, const {});
      final sameMeasurements = {
        for (final item in SkinReportMatrix.matrixScores(legacyReport)) item.id: item.score,
      };
      final legacy = BeautyScoreEngine.compute(legacyReport);
      final modern = BeautyScoreEngine.compute(_report(score, sameMeasurements));
      expect(modern.negativePenalty, legacy.negativePenalty, reason: 'score $score');
      expect(modern.strongestIssueId, legacy.strongestIssueId, reason: 'score $score');
    }
    final oily = BeautyScoreEngine.compute(_report(35, const {}));
    final clear = BeautyScoreEngine.compute(_report(80, const {}));
    expect(oily.negativePenalty, greaterThan(clear.negativePenalty));
    expect(oily.strongestIssueId, 'oiliness');
    expect(
      LocalMiraReportBuilder.fromSkinReport(_report(35, const {})).dailyRoutine.morning.first.nameAr,
      'غسول توازن الدهون',
    );
    expect(
      LocalMiraReportBuilder.fromSkinReport(_report(35, {'oiliness': 35, 'moisture': 80})).dailyRoutine.morning.first.nameAr,
      'غسول توازن الدهون',
    );
    expect(
      LocalMiraReportBuilder.fromSkinReport(_report(80, const {})).dailyRoutine.morning.first.nameAr,
      'غسول لطيف',
    );
    expect(
      LocalMiraReportBuilder.fromSkinReport(_report(64, {'oiliness': 64, 'moisture': 80})).dailyRoutine.morning.first.nameAr,
      'غسول لطيف',
    );
  });

  test('a missing concern key uses the stored field, and 101 is not read as high oil', () {
    final legacyReport = _report(35, const {});
    final withoutOilinessKey = {
      for (final item in SkinReportMatrix.matrixScores(legacyReport)) item.id: item.score,
    }..remove('oiliness');
    final missingKey = BeautyScoreEngine.compute(_report(35, withoutOilinessKey));
    final fieldOnly = BeautyScoreEngine.compute(legacyReport);
    expect(missingKey.negativePenalty, fieldOnly.negativePenalty);
    expect(
      LocalMiraReportBuilder.fromSkinReport(_report(35, withoutOilinessKey)).dailyRoutine.morning.first.nameAr,
      'غسول توازن الدهون',
    );
    final invalidLegacy = _report(101, const {});
    final invalidScores = {
      for (final item in SkinReportMatrix.matrixScores(invalidLegacy)) item.id: item.score,
    };
    final invalid = BeautyScoreEngine.compute(invalidLegacy);
    final invalidMapped = BeautyScoreEngine.compute(_report(101, invalidScores));
    final healthy = BeautyScoreEngine.compute(_report(80, const {}));
    expect(invalid.negativePenalty, invalidMapped.negativePenalty);
    expect(invalid.negativePenalty, lessThan(healthy.negativePenalty));
  });

  test('SkinReportMatrix.dailyRoutine uses the health-score cutoff for the oil-free step', () {
    final oily = SkinReportMatrix.dailyRoutine(_report(35, const {}));
    final clear = SkinReportMatrix.dailyRoutine(_report(80, const {}));
    expect(oily.map((step) => step.id), contains('moisturizer_light'));
    expect(clear.map((step) => step.id), isNot(contains('moisturizer_light')));
  });
}

SkinReport _report(int oiliness, Map<String, int> concernScores) {
  return SkinReport(
    skinType: 'اختبار',
    score: 0,
    hydration: 80,
    oiliness: oiliness,
    pores: 0,
    wrinkles: 0,
    spots: 0,
    acne: 0,
    redness: 0,
    advice: '',
    concernScores: concernScores,
  );
}
