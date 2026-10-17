import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/ai/mocks/mock_skin_analysis_provider.dart';
import 'package:mirra/features/intelligence/domain/constants/report_face_map_spec.dart';
import 'package:mirra/features/intelligence/domain/entities/result_provenance.dart';
import 'package:mirra/features/skin_analysis/domain/image_quality/image_quality_evaluator.dart';
import 'package:mirra/features/skin_analysis/domain/entities/skin_report.dart';
import 'package:mirra/features/skin_analysis/domain/services/beauty_score_engine.dart';
import 'package:mirra/features/skin_analysis/domain/services/skin_report_matrix.dart';

SkinReport report({
  int? skinAge,
  Map<String, int> concernScores = const {},
  int? hydration = 100,
}) {
  return SkinReport(
    skinType: 'عادية',
    score: 0,
    hydration: hydration,
    oiliness: 0,
    pores: 0,
    wrinkles: 0,
    spots: 0,
    advice: '',
    skinAge: skinAge,
    concernScores: concernScores,
  );
}

void main() {
  test('missing skin age is filled from radar scores of 70', () {
    final age = SkinReportMatrix.skinAge(
      report(concernScores: const {'moisture': 100}),
    );
    expect(age, 36);
  });

  test('a stored skin age is kept and the radar fallback is not applied', () {
    final age = SkinReportMatrix.skinAge(
      report(skinAge: 28, concernScores: const {'moisture': 100}),
    );
    expect(age, 28);
  });

  test('vitality label is an estimate index, and missing smoothness still changes the number', () {
    const scores = {
      'moisture': 100,
      'oiliness': 100,
      'pore': 100,
      'wrinkle': 0,
      'texture': 0,
      'acne': 100,
      'redness': 100,
      'age_spot': 100,
    };
    final source = report(skinAge: 30, concernScores: scores);
    expect(source.concernScores.containsKey('smoothness'), isFalse);
    expect(source.concernScores.containsKey('elasticity'), isFalse);
    final scored = BeautyScoreEngine.compute(source);
    expect(scored.finalScore, lessThan(90));
    expect(scored.overallScoreAvailable, isTrue);
    expect(CosmeticCopy.skinVitalityIndexAr, 'مؤشر حيوية البشرة');
    expect(ReportFaceMapSpec.estimateAr, 'مؤشر تقديري من الصورة');
  });

  test('quality gate rejects five bytes before a generator result', () async {
    final file = File('${Directory.systemTemp.path}/mira-rc2-five-bytes.bin');
    await file.writeAsBytes(const [1, 2, 3, 4, 5]);
    addTearDown(file.delete);
    Object? thrown;
    try {
      await SkinCaptureQualityGate.assertProviderReady(file);
    } catch (error) {
      thrown = error;
    }
    expect(thrown, isA<RangeError>());
    final log = File('tmp-risk-rc5/audit/results/guest-five-bytes.txt');
    await log.parent.create(recursive: true);
    await log.writeAsString('${thrown.runtimeType}: $thrown\n');
  });

  test('generator alone is deterministic and is not the app gate', () async {
    const bytes = [1, 2, 3, 4, 5];
    final provider = MockSkinAnalysisProvider();
    final first = await provider.analyze(bytes);
    final second = await provider.analyze(bytes);
    expect(first.hydration, second.hydration);
    expect(first.skinTypeAr, second.skinTypeAr);
    expect(first.skinAge, inInclusiveRange(26, 39));
  });
}
