import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/results_experience/results_experience.dart';
import 'package:mirra/features/skin_analysis/domain/entities/skin_report.dart';

SkinReport _report() => const SkinReport(
      skinType: 'مختلطة',
      score: 70,
      hydration: 50,
      oiliness: 55,
      pores: 60,
      wrinkles: 65,
      spots: 58,
      advice: 'x',
    );

ResultExperience _exp({
  bool mapEnabled = true,
  List<String> concerns = const ['moisture', 'redness', 'acne'],
  int confidence = 80,
  bool partial = false,
}) {
  return const ResultExperienceProjector().project(
    ResultProjectionInput(
      analysisId: 'g8d',
      vitalityScore: 70,
      skinTypeAr: 'مختلطة',
      headlineAr: 'ملخص',
      summaryAr: 'شرح',
      overallConfidencePercent: confidence,
      priorities: const [],
      metrics: [
        const FrozenMetricInput(
          id: 'moisture',
          displayNameAr: 'الترطيب',
          available: true,
          normalizedWellnessValue: 55,
          confidencePercent: 70,
          reasonAr: 'يحتاج عناية',
        ),
        FrozenMetricInput(
          id: 'redness',
          displayNameAr: 'الاحمرار',
          available: true,
          normalizedWellnessValue: 40,
          confidencePercent: confidence,
          reasonAr: 'احمرار',
        ),
        const FrozenMetricInput(
          id: 'acne',
          displayNameAr: 'مظهر الحبوب',
          available: true,
          normalizedWellnessValue: 35,
          confidencePercent: 60,
          reasonAr: 'مظهر الحبوب',
        ),
        if (partial)
          const FrozenMetricInput(
            id: 'texture',
            displayNameAr: 'الملمس',
            available: false,
            confidencePercent: 0,
          ),
      ],
      products: const [],
      progress: const FrozenProgressInput(scanCount: 1, hasBaseline: false),
      advisorClaims: const [],
      mapEnabled: mapEnabled,
      mapConcernIds: concerns,
      morningStepCount: 1,
      eveningStepCount: 1,
    ),
    ResultProjectionContext(
      now: DateTime.utc(2026, 7, 20),
      flagVariant: 'results_v2',
    ),
  );
}

Future<void> _pump(
  WidgetTester tester, {
  required ResultExperience exp,
  required ResultsDetailsTab tab,
  required Size size,
  double textScale = 1.0,
  bool missingImage = false,
}) async {
  await tester.binding.setSurfaceSize(size);
  addTearDown(() => tester.binding.setSurfaceSize(null));
  await tester.pumpWidget(
    MaterialApp(
      debugShowCheckedModeBanner: false,
      locale: const Locale('ar'),
      builder: (c, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: MediaQuery(
          data: MediaQuery.of(c).copyWith(textScaler: TextScaler.linear(textScale)),
          child: child!,
        ),
      ),
      home: ResultsMetricsMapHubScreen(
        report: _report(),
        experience: exp,
        initialTab: tab,
        missingImage: missingImage,
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 80));
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final cases = <String, Future<void> Function(WidgetTester)>{
    'metrics_overview_standard': (t) => _pump(
          t,
          exp: _exp(),
          tab: ResultsDetailsTab.metrics,
          size: const Size(390, 844),
        ),
    'metrics_overview_partial': (t) => _pump(
          t,
          exp: _exp(partial: true),
          tab: ResultsDetailsTab.metrics,
          size: const Size(390, 844),
        ),
    'low_confidence_metric': (t) => _pump(
          t,
          exp: _exp(confidence: 25),
          tab: ResultsDetailsTab.metrics,
          size: const Size(390, 844),
        ),
    'map_hydration': (t) => _pump(
          t,
          exp: _exp(concerns: const ['moisture']),
          tab: ResultsDetailsTab.skinMap,
          size: const Size(390, 900),
        ),
    'map_redness': (t) => _pump(
          t,
          exp: _exp(concerns: const ['redness']),
          tab: ResultsDetailsTab.skinMap,
          size: const Size(390, 900),
        ),
    'map_acne': (t) => _pump(
          t,
          exp: _exp(concerns: const ['acne']),
          tab: ResultsDetailsTab.skinMap,
          size: const Size(390, 900),
        ),
    'map_unavailable': (t) => _pump(
          t,
          exp: _exp(mapEnabled: false, concerns: const []),
          tab: ResultsDetailsTab.skinMap,
          size: const Size(390, 844),
        ),
    'small_iphone': (t) => _pump(
          t,
          exp: _exp(),
          tab: ResultsDetailsTab.metrics,
          size: const Size(375, 667),
        ),
    'large_iphone': (t) => _pump(
          t,
          exp: _exp(),
          tab: ResultsDetailsTab.skinMap,
          size: const Size(430, 932),
        ),
    'medium_android': (t) => _pump(
          t,
          exp: _exp(),
          tab: ResultsDetailsTab.metrics,
          size: const Size(360, 800),
        ),
    'large_text_scale': (t) => _pump(
          t,
          exp: _exp(),
          tab: ResultsDetailsTab.metrics,
          size: const Size(390, 1200),
          textScale: 1.5,
        ),
    'arabic_rtl': (t) => _pump(
          t,
          exp: _exp(),
          tab: ResultsDetailsTab.skinMap,
          size: const Size(390, 900),
        ),
  };

  for (final e in cases.entries) {
    testWidgets('golden ${e.key}', (tester) async {
      await e.value(tester);
      await expectLater(
        find.byType(ResultsMetricsMapHubScreen),
        matchesGoldenFile('goldens/phase8d_${e.key}.png'),
      );
    });
  }

  testWidgets('golden one_metric_detail', (tester) async {
    await _pump(
      tester,
      exp: _exp(),
      tab: ResultsDetailsTab.metrics,
      size: const Size(390, 844),
    );
    await tester.tap(find.text('الترطيب').first);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 120));
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('goldens/phase8d_one_metric_detail.png'),
    );
  });
}
