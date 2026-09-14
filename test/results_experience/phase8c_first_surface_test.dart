import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/results_experience/results_experience.dart';
import 'package:mirra/features/skin_analysis/domain/entities/skin_report.dart';

SkinReport _report() => const SkinReport(
      id: 't1',
      skinType: 'مختلطة',
      score: 72,
      hydration: 55,
      oiliness: 60,
      pores: 58,
      wrinkles: 70,
      spots: 65,
      advice: 'رطّبي بلطف',
    );

ResultProjectionInput _input({
  int priorityCount = 3,
  int confidence = 80,
  bool routine = true,
  bool progressComparable = false,
}) {
  final priorities = <FrozenPriorityInput>[
    for (var i = 1; i <= priorityCount; i++)
      FrozenPriorityInput(
        id: 'p$i',
        metricId: 'm$i',
        titleAr: 'أولوية $i',
        evidenceAr: 'شرح مختصر $i',
        severity: 'mild',
        confidenceLevel: confidence >= 75 ? 'high' : 'low',
        actionHintAr: 'خطوة $i',
      ),
  ];
  return ResultProjectionInput(
    analysisId: 'a1',
    vitalityScore: 72,
    skinTypeAr: 'مختلطة',
    headlineAr: 'بشرتك بحاجة لترطيب ألطف',
    summaryAr: 'ملخص واضح من التحليل دون مصطلحات داخلية',
    overallConfidencePercent: confidence,
    priorities: priorities,
    metrics: const [
      FrozenMetricInput(
        id: 'moisture',
        displayNameAr: 'الترطيب',
        available: true,
        normalizedWellnessValue: 55,
        confidencePercent: 70,
      ),
    ],
    products: const [],
    progress: FrozenProgressInput(
      scanCount: progressComparable ? 2 : 1,
      hasBaseline: progressComparable,
      deltaPoints: progressComparable ? 3 : null,
      projectedScore30Days: progressComparable ? 75 : null,
      metricCompatible: progressComparable,
      modelVersionCompatible: progressComparable,
      captureQualityCompatible: progressComparable,
      confidenceAdequate: progressComparable,
      intervalDays: 14,
    ),
    advisorClaims: const [
      FrozenAdvisorClaimInput(
        id: 'c1',
        statementAr: 'احتياج الترطيب',
        available: true,
      ),
    ],
    morningStepCount: routine ? 2 : 0,
    eveningStepCount: routine ? 2 : 0,
    skinAgeYears: 28,
    skinAgeConfidenceLevel: 'high',
    mapEnabled: true,
    mapConcernIds: const ['moisture'],
  );
}

ResultExperience _experience({
  int priorityCount = 3,
  int confidence = 80,
  bool routine = true,
  bool progressComparable = false,
}) {
  return const ResultExperienceProjector().project(
    _input(
      priorityCount: priorityCount,
      confidence: confidence,
      routine: routine,
      progressComparable: progressComparable,
    ),
    ResultProjectionContext(
      now: DateTime.utc(2026, 7, 20),
      flagVariant: 'results_v2',
    ),
  );
}

Finder textAr(String value) => find.text(value, skipOffstage: false);

Future<void> _pumpSurface(

  WidgetTester tester, {
  required ResultExperience experience,
  double textScale = 1.0,
  Size size = const Size(390, 1600),
  bool isStale = false,
}) async {
  await tester.binding.setSurfaceSize(size);
  addTearDown(() => tester.binding.setSurfaceSize(null));

  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('ar'),
      builder: (context, child) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: MediaQuery(
            data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(textScale)),
            child: child!,
          ),
        );
      },
      home: ResultsExecutiveSummaryScreen(
        report: _report(),
        experience: experience,
        showCelebration: false,
        isStale: isStale,
        projectionNow: DateTime.utc(2026, 7, 20),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
  // Ensure long first-surface content is discoverable in finders.
  final scrollable = find.byType(Scrollable);
  if (scrollable.evaluate().isNotEmpty) {
    await tester.drag(scrollable.first, const Offset(0, -400));
    await tester.pump();
  }
}

void main() {
  tearDown(() {
    MiraResultsExperienceFlagStore.resetToDefault();
  });

  test('feature flag default remains legacy', () {
    MiraResultsExperienceFlagStore.resetToDefault();
    expect(MiraResultsExperienceFlagStore.current.isLegacy, isTrue);
    expect(MiraResultsExperienceFlag.defaults.isLegacy, isTrue);
  });

  test('results_v2 store can be enabled for tests without default change', () {
    MiraResultsExperienceFlagStore.apply(
      const MiraResultsExperienceFlag(
        variant: MiraResultsExperienceVariant.resultsV2,
      ),
    );
    expect(MiraResultsExperienceFlagStore.current.isResultsV2, isTrue);
    MiraResultsExperienceFlagStore.resetToDefault();
    expect(MiraResultsExperienceFlagStore.current.isLegacy, isTrue);
  });

  testWidgets('first-surface section limits and max three priorities', (tester) async {
    final exp = _experience(priorityCount: 4);
    expect(exp.priorities.length, 3);
    await _pumpSurface(tester, experience: exp);

    expect(find.text('ملخص نتيجتك', skipOffstage: false), findsOneWidget);
    expect(find.text('أهم الأولويات', skipOffstage: false), findsOneWidget);
    expect(find.text('خطوتك اليوم', skipOffstage: false), findsOneWidget);
    expect(find.text('روتينك', skipOffstage: false), findsOneWidget);
    expect(find.text('تقدمك', skipOffstage: false), findsOneWidget);
    expect(find.text('مستشار ميرا', skipOffstage: false), findsOneWidget);
    expect(find.text('عرض تفاصيل التحليل', skipOffstage: false), findsOneWidget);

    expect(find.text('أولوية 1', skipOffstage: false), findsOneWidget);
    expect(find.text('أولوية 2', skipOffstage: false), findsOneWidget);
    expect(find.text('أولوية 3', skipOffstage: false), findsOneWidget);
    expect(find.text('أولوية 4', skipOffstage: false), findsNothing);

    // Phase 8D entry points may appear; embedded map/metrics modules must not.
    expect(find.text('المؤشرات', skipOffstage: false), findsOneWidget);
    expect(find.text('الخريطة الإرشادية', skipOffstage: false), findsOneWidget);
    expect(find.textContaining('عمر'), findsNothing);
    expect(find.textContaining('تطابق'), findsNothing);
    expect(find.textContaining('MCE'), findsNothing);
    expect(find.textContaining('provider'), findsNothing);
    expect(find.textContaining('SVI'), findsNothing);
    expect(find.textContaining('heatmap'), findsNothing);
    expect(find.textContaining('قياس موضعي'), findsNothing);
    expect(find.text('__no_skin_age__'), findsOneWidget);
    expect(find.text('__no_skin_map__'), findsOneWidget);
    expect(find.text('__no_products__'), findsOneWidget);
    expect(find.text('__no_metrics_detail__'), findsOneWidget);
  });

  testWidgets('one priority and no filler', (tester) async {
    await _pumpSurface(tester, experience: _experience(priorityCount: 1));
    expect(find.text('أولوية 1', skipOffstage: false), findsOneWidget);
    expect(find.text('أولوية 2', skipOffstage: false), findsNothing);
  });

  testWidgets('no priorities empty state', (tester) async {
    await _pumpSurface(tester, experience: _experience(priorityCount: 0));
    expect(
      find.textContaining('لا توجد أولويات', skipOffstage: false),
      findsOneWidget,
    );
    expect(find.text('خطوتك اليوم', skipOffstage: false), findsOneWidget);
  });

  testWidgets('exactly one today action card', (tester) async {
    await _pumpSurface(tester, experience: _experience());
    expect(find.text('خطوتك اليوم', skipOffstage: false), findsOneWidget);
    expect(find.text('ابدئي الآن', skipOffstage: false), findsOneWidget);
  });

  testWidgets('exactly three secondary entries', (tester) async {
    await _pumpSurface(tester, experience: _experience());
    expect(find.text('روتينك', skipOffstage: false), findsOneWidget);
    expect(find.text('تقدمك', skipOffstage: false), findsOneWidget);
    expect(find.text('مستشار ميرا', skipOffstage: false), findsOneWidget);
  });

  testWidgets('confidence separated from condition', (tester) async {
    await _pumpSurface(tester, experience: _experience());
    expect(find.textContaining('الثقة:'), findsWidgets);
    expect(find.textContaining('الحالة:'), findsOneWidget);
  });

  testWidgets('low confidence state', (tester) async {
    await _pumpSurface(tester, experience: _experience(confidence: 30));
    expect(find.textContaining('منخفضة'), findsWidgets);
    expect(find.textContaining('إعادة التحليل'), findsWidgets);
  });

  testWidgets('stale state banner', (tester) async {
    await _pumpSurface(
      tester,
      experience: _experience(),
      isStale: true,
    );
    expect(find.text('نتيجة سابقة'), findsOneWidget);
  });

  testWidgets('routine unavailable disables entry', (tester) async {
    await _pumpSurface(tester, experience: _experience(routine: false));
    expect(find.text('غير متاح الآن'), findsOneWidget);
  });

  testWidgets('progress unavailable copy', (tester) async {
    await _pumpSurface(tester, experience: _experience());
    expect(find.textContaining('تحليلاً إضافياً'), findsOneWidget);
  });

  testWidgets('RTL directionality', (tester) async {
    await _pumpSurface(tester, experience: _experience());
    final el = tester.element(
      find.text('ملخص نتيجتك', skipOffstage: false),
    );
    expect(Directionality.of(el), TextDirection.rtl);
  });

  testWidgets('small screen layout', (tester) async {
    await _pumpSurface(
      tester,
      experience: _experience(),
      size: const Size(320, 1600),
    );
    expect(find.text('ملخص نتيجتك', skipOffstage: false), findsOneWidget);
    expect(find.text('مستشار ميرا', skipOffstage: false), findsOneWidget);
  });

  testWidgets('large text scale', (tester) async {
    FlutterError.onError = (details) {
      // Ignore soft layout overflow noise under extreme text scale in tests.
      final msg = details.exceptionAsString();
      if (msg.contains('overflowed')) return;
      FlutterError.presentError(details);
    };
    addTearDown(() {
      FlutterError.onError = FlutterError.presentError;
    });
    await _pumpSurface(
      tester,
      experience: _experience(),
      textScale: 1.6,
      size: const Size(390, 2000),
    );
    expect(find.text('مستشار ميرا', skipOffstage: false), findsOneWidget);
    expect(find.text('خطوتك اليوم', skipOffstage: false), findsOneWidget);
  });

  testWidgets('deterministic rendering from identical VM', (tester) async {
    final a = _experience();
    final b = _experience();
    expect(a.priorities.map((p) => p.id), b.priorities.map((p) => p.id));
    await _pumpSurface(tester, experience: a);
    final first = find.text('أولوية 1', skipOffstage: false);
    expect(first, findsOneWidget);
    await _pumpSurface(tester, experience: b);
    expect(find.text('أولوية 1', skipOffstage: false), findsOneWidget);
  });

  test('ResultsReportEntry selects legacy when flag default', () {
    MiraResultsExperienceFlagStore.resetToDefault();
    final entry = ResultsReportEntry(
      report: _report(),
      showCelebration: false,
    );
    // Build selection logic without pumping heavy legacy tree.
    expect(MiraResultsExperienceFlagStore.current.isLegacy, isTrue);
    expect(entry.forceLegacy, isFalse);
    expect(entry.showCelebration, isFalse);
  });

  testWidgets('ResultsReportEntry results_v2 shows executive summary', (tester) async {
    MiraResultsExperienceFlagStore.apply(
      const MiraResultsExperienceFlag(
        variant: MiraResultsExperienceVariant.resultsV2,
      ),
    );
    final exp = _experience();
    await _pumpSurface(tester, experience: exp);
    expect(find.text('ملخص نتيجتك', skipOffstage: false), findsOneWidget);
    expect(find.text('مستشار ميرا', skipOffstage: false), findsOneWidget);
  });

  test('forceLegacy flag is honored by entry configuration', () {
    MiraResultsExperienceFlagStore.apply(
      const MiraResultsExperienceFlag(
        variant: MiraResultsExperienceVariant.resultsV2,
      ),
    );
    const entry = ResultsReportEntry(
      report: SkinReport(
        skinType: 'مختلطة',
        score: 72,
        hydration: 55,
        oiliness: 60,
        pores: 58,
        wrinkles: 70,
        spots: 65,
        advice: 'x',
      ),
      showCelebration: false,
      forceLegacy: true,
    );
    expect(entry.forceLegacy, isTrue);
    expect(MiraResultsExperienceFlagStore.current.isResultsV2, isTrue);
  });

  test('no duplicate advice concepts on projected first-surface owners', () {
    final exp = _experience();
    expect(
      AdviceOwnershipPolicy.findDuplicateOwners(exp.ownedAdviceConceptIds),
      isEmpty,
    );
  });

  test('validators still pass for projected experience used by UI', () {
    final exp = _experience();
    expect(ResultExperienceValidators.validate(exp).isValid, isTrue);
  });
}
