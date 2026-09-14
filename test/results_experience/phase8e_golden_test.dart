import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/results_experience/results_experience.dart';
import 'package:mirra/features/skin_analysis/domain/entities/skin_report.dart';
import 'package:shared_preferences/shared_preferences.dart';

SkinReport _report() => const SkinReport(
      id: 'g8e',
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
  int confidence = 80,
  bool withSteps = true,
  bool oneStep = false,
  bool weekly = true,
}) {
  final morning = oneStep
      ? const [
          FrozenRoutineStepInput(
            id: 'cleanser_am',
            nameAr: 'غسول لطيف',
            instructionAr: 'صباحاً',
            period: 'am',
          ),
        ]
      : const [
          FrozenRoutineStepInput(
            id: 'cleanser_am',
            nameAr: 'غسول لطيف',
            instructionAr: 'صباحاً بلطف',
            period: 'am',
          ),
          FrozenRoutineStepInput(
            id: 'moisturizer_am',
            nameAr: 'مرطب خفيف',
            instructionAr: 'بعد الغسول',
            period: 'am',
          ),
          FrozenRoutineStepInput(
            id: 'sunscreen',
            nameAr: 'واقي شمس',
            instructionAr: 'آخر خطوة',
            period: 'am',
          ),
        ];
  final evening = oneStep
      ? const <FrozenRoutineStepInput>[]
      : const [
          FrozenRoutineStepInput(
            id: 'cleanser_pm',
            nameAr: 'غسول مسائي',
            instructionAr: 'مساءً',
            period: 'pm',
          ),
          FrozenRoutineStepInput(
            id: 'moisturizer_pm',
            nameAr: 'مرطب مسائي',
            instructionAr: 'قبل النوم',
            period: 'pm',
          ),
        ];

  return const ResultExperienceProjector().project(
    ResultProjectionInput(
      analysisId: 'g8e',
      vitalityScore: 70,
      skinTypeAr: 'مختلطة',
      headlineAr: 'ملخص',
      summaryAr: 'شرح',
      overallConfidencePercent: confidence,
      priorities: withSteps
          ? const [
              FrozenPriorityInput(
                id: 'p1',
                metricId: 'moisture',
                titleAr: 'الترطيب',
                evidenceAr: 'يحتاج ترطيباً',
                severity: 'moderate',
                confidenceLevel: 'high',
              ),
            ]
          : const [],
      metrics: const [
        FrozenMetricInput(
          id: 'moisture',
          displayNameAr: 'الترطيب',
          available: true,
          normalizedWellnessValue: 50,
          confidencePercent: 70,
        ),
      ],
      products: const [],
      progress: const FrozenProgressInput(scanCount: 1, hasBaseline: false),
      advisorClaims: const [],
      morningStepCount: withSteps ? morning.length : 0,
      eveningStepCount: withSteps ? evening.length : 0,
      morningSteps: withSteps ? morning : const [],
      eveningSteps: withSteps ? evening : const [],
      weeklyPlanEnabled: weekly && withSteps,
      weeklyHeadlineAr: weekly ? 'تركيز الترطيب' : '',
      weeklySummaryAr: weekly ? 'روتين بسيط' : '',
    ),
    ResultProjectionContext(
      now: DateTime.utc(2026, 7, 20, 9),
      flagVariant: 'results_v2',
    ),
  );
}

Future<void> _pump(
  WidgetTester tester, {
  required ResultExperience exp,
  required Size size,
  double textScale = 1.0,
  DateTime? clock,
  bool evening = false,
  bool completeFirst = false,
}) async {
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();
  final store = RoutineCompletionStore(
    userId: 'golden',
    analysisId: exp.id,
    prefs: prefs,
  );
  final day = clock ?? DateTime.utc(2026, 7, 20, evening ? 20 : 9);
  if (completeFirst && exp.personalPlan.morning.steps.isNotEmpty) {
    await store.setComplete(
      exp.personalPlan.morning.steps.first.id,
      day,
      complete: true,
    );
  }
  await tester.binding.setSurfaceSize(size);
  addTearDown(() => tester.binding.setSurfaceSize(null));
  await tester.pumpWidget(
    MaterialApp(
      debugShowCheckedModeBanner: false,
      locale: const Locale('ar'),
      builder: (c, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: MediaQuery(
          data: MediaQuery.of(c).copyWith(
            textScaler: TextScaler.linear(textScale),
          ),
          child: child!,
        ),
      ),
      home: ResultsPersonalPlanScreen(
        report: _report(),
        experience: exp,
        clock: day,
        userId: 'golden',
        completionStore: store,
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 80));
  if (evening) {
    await tester.tap(find.text('المساء'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 40));
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final cases = <String, Future<void> Function(WidgetTester)>{
    'morning_standard': (t) => _pump(
          t,
          exp: _exp(),
          size: const Size(390, 844),
        ),
    'evening_standard': (t) => _pump(
          t,
          exp: _exp(),
          size: const Size(390, 844),
          evening: true,
        ),
    'one_step': (t) => _pump(
          t,
          exp: _exp(oneStep: true, weekly: false),
          size: const Size(390, 844),
        ),
    'partial_evening_empty': (t) => _pump(
          t,
          exp: _exp(oneStep: true, weekly: true),
          size: const Size(390, 844),
          evening: true,
        ),
    'low_confidence': (t) => _pump(
          t,
          exp: _exp(confidence: 25),
          size: const Size(390, 844),
        ),
    'no_eligible': (t) => _pump(
          t,
          exp: _exp(withSteps: false, weekly: false),
          size: const Size(390, 844),
        ),
    'weekly_adjustment': (t) => _pump(
          t,
          exp: _exp(),
          size: const Size(390, 1000),
        ),
    'avoidance_section': (t) => _pump(
          t,
          exp: _exp(),
          size: const Size(390, 1100),
        ),
    'completed_step': (t) => _pump(
          t,
          exp: _exp(),
          size: const Size(390, 844),
          completeFirst: true,
        ),
    'small_iphone': (t) => _pump(
          t,
          exp: _exp(),
          size: const Size(375, 667),
        ),
    'large_iphone': (t) => _pump(
          t,
          exp: _exp(),
          size: const Size(430, 932),
        ),
    'medium_android': (t) => _pump(
          t,
          exp: _exp(),
          size: const Size(360, 800),
        ),
    'arabic_rtl': (t) => _pump(
          t,
          exp: _exp(),
          size: const Size(390, 900),
        ),
    'large_text_scale': (t) => _pump(
          t,
          exp: _exp(),
          size: const Size(390, 1200),
          textScale: 1.5,
        ),
  };

  for (final e in cases.entries) {
    testWidgets('golden ${e.key}', (tester) async {
      await e.value(tester);
      await expectLater(
        find.byType(ResultsPersonalPlanScreen),
        matchesGoldenFile('goldens/phase8e_${e.key}.png'),
      );
    });
  }
}
