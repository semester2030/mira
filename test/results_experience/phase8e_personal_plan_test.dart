import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/results_experience/results_experience.dart';
import 'package:mirra/features/skin_analysis/domain/entities/skin_report.dart';
import 'package:shared_preferences/shared_preferences.dart';

SkinReport _report() => const SkinReport(
      id: 'u_e1',
      skinType: 'مختلطة',
      score: 70,
      hydration: 50,
      oiliness: 55,
      pores: 60,
      wrinkles: 65,
      spots: 58,
      advice: 'عناية لطيفة',
    );

ResultExperience _exp({
  int confidence = 80,
  bool withSteps = true,
  bool weekly = true,
  List<FrozenRoutineStepInput>? morning,
  List<FrozenRoutineStepInput>? evening,
  int morningCount = 2,
  int eveningCount = 2,
}) {
  return const ResultExperienceProjector().project(
    ResultProjectionInput(
      analysisId: 'e1',
      vitalityScore: 70,
      skinTypeAr: 'مختلطة',
      headlineAr: 'ملخص',
      summaryAr: 'شرح',
      overallConfidencePercent: confidence,
      priorities: const [
        FrozenPriorityInput(
          id: 'p1',
          metricId: 'moisture',
          titleAr: 'الترطيب',
          evidenceAr: 'يحتاج ترطيباً',
          severity: 'moderate',
          confidenceLevel: 'high',
          actionHintAr: 'رطّبي',
        ),
      ],
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
      advisorClaims: const [
        FrozenAdvisorClaimInput(id: 'c1', statementAr: 'ترطيب', available: true),
      ],
      morningStepCount: withSteps ? morningCount : 0,
      eveningStepCount: withSteps ? eveningCount : 0,
      morningSteps: morning ??
          (withSteps
              ? const [
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
                  FrozenRoutineStepInput(
                    id: 'extra_am',
                    nameAr: 'خطوة زائدة',
                    instructionAr: 'لا تظهر',
                    period: 'am',
                  ),
                ]
              : const []),
      eveningSteps: evening ??
          (withSteps
              ? const [
                  FrozenRoutineStepInput(
                    id: 'cleanser_pm',
                    nameAr: 'غسول مسائي',
                    instructionAr: 'مساءً',
                    period: 'pm',
                  ),
                  FrozenRoutineStepInput(
                    id: 'treatment_pores',
                    nameAr: 'مقشر BHA خفيف',
                    instructionAr: 'مرتين أسبوعياً',
                    period: 'pm',
                  ),
                  FrozenRoutineStepInput(
                    id: 'moisturizer_pm',
                    nameAr: 'مرطب مسائي',
                    instructionAr: 'قبل النوم',
                    period: 'pm',
                  ),
                ]
              : const []),
      weeklyPlanEnabled: weekly,
      weeklyHeadlineAr: weekly ? 'تركيز الترطيب هذا الأسبوع' : '',
      weeklySummaryAr: weekly ? 'التزمي بروتين بسيط' : '',
    ),
    ResultProjectionContext(
      now: DateTime.utc(2026, 7, 20, 9),
      flagVariant: 'results_v2',
    ),
  );
}

Future<void> _pumpPlan(
  WidgetTester tester, {
  required ResultExperience experience,
  DateTime? clock,
  RoutineCompletionStore? store,
  Size size = const Size(390, 1600),
  double textScale = 1.0,
}) async {
  SharedPreferences.setMockInitialValues({});
  await tester.binding.setSurfaceSize(size);
  addTearDown(() => tester.binding.setSurfaceSize(null));
  await tester.pumpWidget(
    MaterialApp(
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
        experience: experience,
        clock: clock ?? DateTime.utc(2026, 7, 20, 9),
        userId: 'test_user',
        completionStore: store,
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('feature flag remains legacy by default', () {
    MiraResultsExperienceFlagStore.resetToDefault();
    expect(MiraResultsExperienceFlagStore.current.isLegacy, isTrue);
    expect(MiraResultsExperienceFlag.defaults.isLegacy, isTrue);
  });

  test('max three morning and evening core steps', () {
    final plan = _exp().personalPlan;
    expect(plan.morning.steps.length, lessThanOrEqualTo(3));
    expect(plan.evening.steps.length, lessThanOrEqualTo(3));
    expect(plan.morning.steps.length, 3);
  });

  test('no filler when no steps', () {
    final plan = _exp(withSteps: false, weekly: false).personalPlan;
    expect(plan.eligible, isFalse);
    expect(plan.morning.steps, isEmpty);
    expect(plan.evening.steps, isEmpty);
  });

  test('one primary weekly adjustment', () {
    final plan = _exp().personalPlan;
    expect(plan.weekly, isNotNull);
    expect(plan.weekly!.titleAr, contains('ترطيب'));
  });

  test('no duplicate advice concepts within the same period', () {
    final plan = _exp().personalPlan;
    expect(
      AdviceOwnershipPolicy.findDuplicateOwners(
        plan.morning.steps.map((s) => s.adviceConceptId),
      ),
      isEmpty,
    );
    expect(
      AdviceOwnershipPolicy.findDuplicateOwners(
        plan.evening.steps.map((s) => s.adviceConceptId),
      ),
      isEmpty,
    );
  });

  test('personalization labels present and general not as AI personalized', () {
    final plan = _exp().personalPlan;
    for (final s in [...plan.morning.steps, ...plan.evening.steps]) {
      final label = PersonalizationLabels.ar(s.personalization);
      expect(label, isNotEmpty);
      expect(s.personalization, isNot(PersonalizationClass.unsupported));
    }
    for (final a in plan.avoidances) {
      if (a.personalization == PersonalizationClass.generalEducation) {
        expect(PersonalizationLabels.ar(a.personalization), 'إرشاد عام');
      }
    }
  });

  test('today action maps to one routine step', () {
    final exp = _exp();
    expect(exp.immediateAction, isNotNull);
    expect(exp.immediateAction!.routineStepId, isNotNull);
    expect(exp.immediateAction!.routineStepId, exp.personalPlan.todayStepId);
    expect(exp.immediateAction!.adviceConceptId, 'today_focus');
  });

  test('low confidence filters aggressive actives', () {
    final plan = _exp(confidence: 25).personalPlan;
    final titles = [
      ...plan.morning.steps,
      ...plan.evening.steps,
    ].map((s) => s.titleAr).join(' ');
    expect(titles.toLowerCase().contains('bha'), isFalse);
    expect(titles.contains('مقشر'), isFalse);
    expect(plan.isLimited, isTrue);
  });

  test('no product or progress language in plan summary', () {
    final plan = _exp().personalPlan;
    final blob =
        '${plan.summaryAr} ${plan.primaryObjectiveAr} ${plan.focusAr}';
    expect(blob.toLowerCase().contains('mce'), isFalse);
    expect(blob.toLowerCase().contains('provider'), isFalse);
    expect(blob.contains('heatmap'), isFalse);
  });

  test('routine ownership for cleanser moisturizer sunscreen', () {
    expect(AdviceOwnershipPolicy.ownerFor('gentle_cleanser'), AdviceOwner.routine);
    expect(AdviceOwnershipPolicy.ownerFor('moisturizer'), AdviceOwner.routine);
    expect(AdviceOwnershipPolicy.ownerFor('sunscreen'), AdviceOwner.routine);
  });

  testWidgets('personal plan screen renders morning steps', (tester) async {
    await _pumpPlan(tester, experience: _exp());
    expect(find.text('خطتك الشخصية', skipOffstage: false), findsOneWidget);
    expect(find.textContaining('غسول لطيف', skipOffstage: false), findsWidgets);
    expect(find.text('__no_products__'), findsOneWidget);
    expect(find.text('__no_progress__'), findsOneWidget);
  });

  testWidgets('weekly and avoidance sections', (tester) async {
    await _pumpPlan(tester, experience: _exp());
    expect(find.textContaining('تعديل الأسبوع', skipOffstage: false), findsOneWidget);
    expect(find.textContaining('ما يجب تجنبه', skipOffstage: false), findsOneWidget);
  });

  testWidgets('no eligible plan state', (tester) async {
    await _pumpPlan(tester, experience: _exp(withSteps: false, weekly: false));
    expect(
      find.textContaining('لا تتوفر أدلة كافية', skipOffstage: false),
      findsOneWidget,
    );
  });

  testWidgets('completion and undo with date binding', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final store = RoutineCompletionStore(
      userId: 'test_user',
      analysisId: 'result_e1',
      prefs: prefs,
    );
    final exp = _exp();
    final day = DateTime.utc(2026, 7, 20, 9);
    await _pumpPlan(tester, experience: exp, clock: day, store: store);
    final stepId = exp.personalPlan.morning.steps.first.id;
    expect(await store.isComplete(stepId, day), isFalse);

    await tester.tap(find.byIcon(Icons.circle_outlined).first);
    await tester.pump();
    expect(await store.isComplete(stepId, day), isTrue);

    await tester.tap(find.byIcon(Icons.check_circle_rounded).first);
    await tester.pump();
    expect(await store.isComplete(stepId, day), isFalse);

    // Day rollover — previous day not carried.
    final next = DateTime.utc(2026, 7, 21, 9);
    expect(await store.isComplete(stepId, next), isFalse);
  });

  testWidgets('RTL on personal plan', (tester) async {
    await _pumpPlan(tester, experience: _exp());
    final el = tester.element(find.text('خطتك الشخصية', skipOffstage: false));
    expect(Directionality.of(el), TextDirection.rtl);
  });

  testWidgets('executive summary opens personal plan not marketplace dump',
      (tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.binding.setSurfaceSize(const Size(390, 1600));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('ar'),
        builder: (c, child) => Directionality(
          textDirection: TextDirection.rtl,
          child: child!,
        ),
        home: ResultsExecutiveSummaryScreen(
          report: _report(),
          experience: _exp(),
          showCelebration: false,
          projectionNow: DateTime.utc(2026, 7, 20, 9),
        ),
      ),
    );
    await tester.pump();
    await tester.tap(find.text('روتينك', skipOffstage: false));
    await tester.pumpAndSettle();
    expect(find.text('خطتك الشخصية', skipOffstage: false), findsOneWidget);
    expect(find.text('__no_products__'), findsOneWidget);
  });

  test('deterministic ordering', () {
    final a = _exp();
    final b = _exp();
    expect(
      a.personalPlan.morning.steps.map((s) => s.id).toList(),
      b.personalPlan.morning.steps.map((s) => s.id).toList(),
    );
    expect(a.personalPlan.todayStepId, b.personalPlan.todayStepId);
  });
}
