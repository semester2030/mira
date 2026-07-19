import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/intelligence/domain/entities/result_provenance.dart';
import 'package:mirra/features/intelligence/data/mappers/mira_beauty_report_mapper.dart';
import 'package:mirra/features/skin_analysis/domain/entities/skin_report.dart';
import 'package:mirra/features/skin_analysis/domain/services/beauty_score_engine.dart';

void main() {
  group('Phase 0 — truth & Skin Vitality Index', () {
    test('Skin Vitality Index remains deterministic', () {
      final report = SkinReport(
        id: 't1',
        createdAt: DateTime(2026, 1, 1),
        skinType: 'مختلطة',
        skinTypeEn: 'Combination',
        score: 60,
        hydration: 60,
        oiliness: 40,
        pores: 2,
        wrinkles: 1,
        spots: 1,
        acne: 1,
        redness: 1,
        advice: '',
        concernScores: const {
          'moisture': 60,
          'oiliness': 60,
          'pore': 70,
          'wrinkle': 80,
          'acne': 80,
          'age_spot': 75,
          'redness': 75,
          'texture': 65,
          'dark_circle': 70,
          'radiance': 62,
          'firmness': 68,
        },
      );
      final a = BeautyScoreEngine.compute(report);
      final b = BeautyScoreEngine.compute(report);
      expect(a.finalScore, b.finalScore);
    });

    test('mock provenance cannot display in production semantics', () {
      final prov = ResultProvenance(
        resultSource: ResultSource.mock,
        provider: 'mock_skin',
        calculationVersion: 'svi-v1',
        confidence: 90,
        confidenceLevel: ProvenanceConfidenceLevel.unavailable,
        generatedAt: DateTime.now(),
        limitations: const [],
        isMock: true,
        canDisplay: false,
        unavailableReason: 'Mock results cannot be displayed in production',
      );
      expect(prov.isMock, isTrue);
      expect(prov.canDisplay, isFalse);
    });

    test('historical overallBeautyScore still readable with SVI labels', () {
      final mira = MiraBeautyReportMapper.fromJson({
        'version': 1,
        'overallBeautyScore': 71,
        'spatialConfidence': 'none',
        'headlineAr': 'تاريخي',
        'skinTypeAr': 'عادية',
        'skinTypeEn': 'Normal',
        'mainConcerns': [],
        'dailyRoutine': {'morning': [], 'evening': []},
        'summaryAdviceAr': '',
        'tipsAr': [],
        'recommendedProducts': [],
      });
      expect(mira.overallBeautyScore, 71);
      expect(mira.skinVitalityIndex, 71);
      expect(mira.displayScoreLabelAr, CosmeticCopy.skinVitalityIndexAr);
      expect(mira.disclaimerAr, contains('تشخيصاً طبياً'));
      expect(mira.disclaimerAr.toLowerCase(), isNot(contains('scientific beauty')));
    });

    test('user-facing copy avoids objective beauty claim strings', () {
      expect(CosmeticCopy.skinVitalityIndexAr, isNot(contains('درجة الجمال')));
      expect(CosmeticCopy.disclaimerAr, contains('تجميلي'));
      expect(CosmeticCopy.disclaimerEn.toLowerCase(), contains('not a medical diagnosis'));
    });
  });
}
