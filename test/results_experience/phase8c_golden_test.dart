import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/results_experience/results_experience.dart';
import 'package:mirra/features/skin_analysis/domain/entities/skin_report.dart';

SkinReport _report() => const SkinReport(
      id: 'g1',
      skinType: 'مختلطة',
      score: 72,
      hydration: 55,
      oiliness: 60,
      pores: 58,
      wrinkles: 70,
      spots: 65,
      advice: 'رطّبي بلطف',
    );

ResultExperience _exp({int priorities = 3, int confidence = 80}) {
  return const ResultExperienceProjector().project(
    ResultProjectionInput(
      analysisId: 'gold',
      vitalityScore: 72,
      skinTypeAr: 'مختلطة',
      headlineAr: 'بشرتك بحاجة لترطيب ألطف',
      summaryAr: 'ملخص واضح ومختصر من التحليل',
      overallConfidencePercent: confidence,
      priorities: [
        for (var i = 1; i <= priorities; i++)
          FrozenPriorityInput(
            id: 'p$i',
            metricId: 'm$i',
            titleAr: 'أولوية $i',
            evidenceAr: 'شرح $i',
            severity: 'mild',
            confidenceLevel: 'high',
            actionHintAr: 'خطوة $i',
          ),
      ],
      metrics: const [],
      products: const [],
      progress: const FrozenProgressInput(scanCount: 1, hasBaseline: false),
      advisorClaims: const [
        FrozenAdvisorClaimInput(
          id: 'c1',
          statementAr: 'الترطيب',
          available: true,
        ),
      ],
      morningStepCount: 2,
      eveningStepCount: 2,
    ),
    ResultProjectionContext(
      now: DateTime.utc(2026, 7, 20),
      flagVariant: 'results_v2',
    ),
  );
}

Future<void> _pumpGolden(
  WidgetTester tester, {
  required ResultExperience experience,
  required Size size,
  double textScale = 1.0,
}) async {
  await tester.binding.setSurfaceSize(size);
  addTearDown(() => tester.binding.setSurfaceSize(null));
  await tester.pumpWidget(
    MaterialApp(
      debugShowCheckedModeBanner: false,
      locale: const Locale('ar'),
      builder: (context, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: MediaQuery(
          data: MediaQuery.of(context)
              .copyWith(textScaler: TextScaler.linear(textScale)),
          child: child!,
        ),
      ),
      home: ResultsExecutiveSummaryScreen(
        report: _report(),
        experience: experience,
        showCelebration: false,
        projectionNow: DateTime.utc(2026, 7, 20),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final cases = <String, Future<void> Function(WidgetTester)>{
    'standard_result': (t) => _pumpGolden(
          t,
          experience: _exp(),
          size: const Size(390, 844),
        ),
    'one_priority': (t) => _pumpGolden(
          t,
          experience: _exp(priorities: 1),
          size: const Size(390, 844),
        ),
    'three_priorities': (t) => _pumpGolden(
          t,
          experience: _exp(priorities: 3),
          size: const Size(390, 844),
        ),
    'low_confidence': (t) => _pumpGolden(
          t,
          experience: _exp(confidence: 30),
          size: const Size(390, 844),
        ),
    'no_progress': (t) => _pumpGolden(
          t,
          experience: _exp(),
          size: const Size(390, 844),
        ),
    'small_iphone': (t) => _pumpGolden(
          t,
          experience: _exp(),
          size: const Size(375, 667),
        ),
    'large_iphone': (t) => _pumpGolden(
          t,
          experience: _exp(),
          size: const Size(430, 932),
        ),
    'medium_android': (t) => _pumpGolden(
          t,
          experience: _exp(),
          size: const Size(360, 800),
        ),
    'large_text_scale': (t) => _pumpGolden(
          t,
          experience: _exp(),
          size: const Size(390, 844),
          textScale: 1.5,
        ),
    'arabic_rtl': (t) => _pumpGolden(
          t,
          experience: _exp(),
          size: const Size(390, 844),
        ),
  };

  for (final entry in cases.entries) {
    testWidgets('golden ${entry.key}', (tester) async {
      await entry.value(tester);
      await expectLater(
        find.byType(ResultsExecutiveSummaryScreen),
        matchesGoldenFile('goldens/phase8c_${entry.key}.png'),
      );
    });
  }
}
