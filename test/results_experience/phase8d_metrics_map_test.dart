import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/results_experience/results_experience.dart';
import 'package:mirra/features/skin_analysis/domain/entities/skin_report.dart';

SkinReport _report() => const SkinReport(
      id: 'd1',
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
  bool mapEnabled = true,
  List<String> mapConcerns = const ['moisture', 'redness', 'acne'],
  int confidence = 80,
  bool includeAcne = true,
  bool includeMissing = true,
}) {
  return const ResultExperienceProjector().project(
    ResultProjectionInput(
      analysisId: 'd1',
      vitalityScore: 70,
      skinTypeAr: 'مختلطة',
      headlineAr: 'ملخص',
      summaryAr: 'شرح مختصر',
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
      metrics: [
        const FrozenMetricInput(
          id: 'moisture',
          displayNameAr: 'الترطيب',
          available: true,
          normalizedWellnessValue: 55,
          confidencePercent: 70,
          reasonAr: 'يحتاج عناية',
        ),
        const FrozenMetricInput(
          id: 'redness',
          displayNameAr: 'الاحمرار',
          available: true,
          normalizedWellnessValue: 40,
          confidencePercent: 65,
          reasonAr: 'احمرار ملحوظ',
        ),
        if (includeAcne)
          const FrozenMetricInput(
            id: 'acne',
            displayNameAr: 'مظهر الحبوب',
            available: true,
            normalizedWellnessValue: 35,
            confidencePercent: 60,
            reasonAr: 'مظهر يحتاج هدوءاً',
          ),
        if (includeMissing)
          const FrozenMetricInput(
            id: 'texture',
            displayNameAr: 'الملمس',
            available: false,
            confidencePercent: 0,
          ),
      ],
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
      mapEnabled: mapEnabled,
      mapConcernIds: mapConcerns,
    ),
    ResultProjectionContext(
      now: DateTime.utc(2026, 7, 20),
      flagVariant: 'results_v2',
    ),
  );
}

Future<void> _pumpHub(
  WidgetTester tester, {
  required ResultExperience experience,
  ResultsDetailsTab tab = ResultsDetailsTab.metrics,
  bool missingImage = false,
  bool isStale = false,
  Size size = const Size(390, 1600),
  double textScale = 1.0,
}) async {
  await tester.binding.setSurfaceSize(size);
  addTearDown(() => tester.binding.setSurfaceSize(null));
  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('ar'),
      builder: (context, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: MediaQuery(
          data: MediaQuery.of(context)
              .copyWith(textScaler: TextScaler.linear(textScale)),
          child: child!,
        ),
      ),
      home: ResultsMetricsMapHubScreen(
        report: _report(),
        experience: experience,
        initialTab: tab,
        missingImage: missingImage,
        isStale: isStale,
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
}

void main() {
  tearDown(MiraResultsExperienceFlagStore.resetToDefault);

  test('feature flag remains legacy by default', () {
    expect(MiraResultsExperienceFlagStore.current.isLegacy, isTrue);
  });

  test('acne severity is higher-worse and not wellness color', () {
    final exp = _exp();
    final acne = exp.metrics.firstWhere((m) => m.id.contains('acne'));
    expect(MetricPresentationPolicy.isSeverityPrimary(acne), isTrue);
    final primary = MetricPresentationPolicy.primaryScore(acne)!;
    expect(primary.direction, ScoreDirection.higherWorse);
    expect(primary.colorRole, ColorRole.severity);
    expect(primary.colorRole, isNot(ColorRole.wellness));
    // wellness 35 → severity 65
    expect(primary.value, 65);
  });

  test('confidence separate from condition on metrics', () {
    final exp = _exp();
    final m = exp.metrics.firstWhere((m) => m.id.contains('moisture'));
    expect(m.confidence, isNot(ConfidenceState.unavailable));
    expect(m.condition?.colorRole, ColorRole.wellness);
    expect(m.confidence, isNotNull);
  });

  test('missing metric hidden from public overview list', () {
    final exp = _exp();
    final visible = exp.metrics
        .where((m) => VisibilityPolicy.isPubliclyVisible(m.visibility))
        .toList();
    expect(visible.any((m) => m.id.contains('texture')), isFalse);
  });

  test('no filler metrics invented', () {
    final exp = _exp(includeAcne: false, includeMissing: false);
    expect(exp.metrics.length, 2);
  });

  test('one owned action per metric — no duplicate concept across visible metrics', () {
    final exp = _exp();
    final visible = exp.metrics
        .where((m) => VisibilityPolicy.isPubliclyVisible(m.visibility));
    final concepts = visible.map(MetricPresentationPolicy.adviceConceptId).toList();
    expect(AdviceOwnershipPolicy.findDuplicateOwners(concepts), isEmpty);
  });

  test('map Mode B labels and explanation', () {
    final exp = _exp();
    expect(exp.map.mode, MapPresentationMode.illustrativeUserImage);
    expect(exp.map.titleAr, 'خريطة إرشادية للبشرة');
    expect(exp.map.badgeAr, 'توضيح إرشادي');
    expect(exp.map.explanationAr, contains('توضيحية'));
    expect(exp.map.explanationAr.toLowerCase(), isNot(contains('heatmap')));
    // Required denial of measured localization must remain visible.
    expect(exp.map.explanationAr, contains('توضيحية'));
    expect(exp.map.explanationAr, contains('ولا تمثل'));
  });

  test('public language has no provider/version/MCE leaks on metrics and map', () {
    final exp = _exp();
    for (final m in exp.metrics) {
      expect(PublicLanguagePolicy.isPublicSafe(m.explanationAr, field: m.id), isTrue);
      expect(m.explanationAr.toLowerCase(), isNot(contains('provider')));
      expect(m.explanationAr.toLowerCase(), isNot(contains('mce')));
    }
    expect(exp.map.explanationAr.toLowerCase(), isNot(contains('mce')));
    expect(exp.map.explanationAr.toLowerCase(), isNot(contains('svi')));
  });

  testWidgets('metrics overview renders and opens detail sheet', (tester) async {
    final exp = _exp();
    await _pumpHub(tester, experience: exp);
    expect(find.text('المؤشرات', skipOffstage: false), findsWidgets);
    expect(find.text('الترطيب', skipOffstage: false), findsWidgets);
    expect(find.text('الملمس', skipOffstage: false), findsNothing);

    await tester.tap(find.text('الترطيب', skipOffstage: false).first);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('خطوتك المرتبطة', skipOffstage: false), findsOneWidget);
    expect(find.textContaining('اسألي مستشار ميرا', skipOffstage: false), findsWidgets);
    expect(find.textContaining('لماذا تهم', skipOffstage: false), findsOneWidget);
  });

  testWidgets('illustrative map badge and concern select', (tester) async {
    final exp = _exp();
    await _pumpHub(tester, experience: exp, tab: ResultsDetailsTab.skinMap);
    expect(find.text('خريطة إرشادية للبشرة', skipOffstage: false), findsWidgets);
    expect(find.text('توضيح إرشادي', skipOffstage: false), findsWidgets);
    expect(find.textContaining('وجه توضيحي', skipOffstage: false), findsOneWidget);
    expect(find.text('الاحمرار', skipOffstage: false), findsWidgets);

    await tester.tap(find.widgetWithText(ChoiceChip, 'الاحمرار'));
    await tester.pump();
    expect(find.textContaining('الحالة:', skipOffstage: false), findsWidgets);
  });

  testWidgets('map unavailable state', (tester) async {
    final exp = _exp(mapEnabled: false, mapConcerns: const []);
    await _pumpHub(tester, experience: exp, tab: ResultsDetailsTab.skinMap);
    expect(find.textContaining('تعذر عرض الخريطة', skipOffstage: false), findsOneWidget);
  });

  testWidgets('missing image state', (tester) async {
    final exp = _exp();
    await _pumpHub(
      tester,
      experience: exp,
      tab: ResultsDetailsTab.skinMap,
      missingImage: true,
    );
    expect(find.textContaining('صورة الوجه غير متاحة', skipOffstage: false), findsOneWidget);
  });

  testWidgets('stale map messaging', (tester) async {
    final exp = _exp(mapEnabled: false);
    await _pumpHub(
      tester,
      experience: exp,
      tab: ResultsDetailsTab.skinMap,
      isStale: true,
    );
    expect(find.textContaining('تعذر عرض الخريطة', skipOffstage: false), findsOneWidget);
  });

  testWidgets('low confidence map messaging', (tester) async {
    final exp = _exp(confidence: 20, mapEnabled: false);
    await _pumpHub(tester, experience: exp, tab: ResultsDetailsTab.skinMap);
    expect(find.textContaining('تعذر عرض الخريطة', skipOffstage: false), findsOneWidget);
  });

  testWidgets('RTL on hub', (tester) async {
    await _pumpHub(tester, experience: _exp());
    final el = tester.element(find.text('تفاصيل النتيجة', skipOffstage: false));
    expect(Directionality.of(el), TextDirection.rtl);
  });

  testWidgets('small screen + large text', (tester) async {
    await _pumpHub(
      tester,
      experience: _exp(),
      size: const Size(320, 1600),
      textScale: 1.3,
    );
    expect(find.text('المؤشرات', skipOffstage: false), findsWidgets);
  });

  test('deterministic projection for identical input', () {
    final a = _exp();
    final b = _exp();
    expect(a.metrics.map((m) => m.id).toList(), b.metrics.map((m) => m.id).toList());
    expect(a.map.concerns.map((c) => c.labelAr).toList(),
        b.map.concerns.map((c) => c.labelAr).toList());
  });

  testWidgets('executive summary has metrics and map entry points', (tester) async {
    MiraResultsExperienceFlagStore.apply(
      const MiraResultsExperienceFlag(
        variant: MiraResultsExperienceVariant.resultsV2,
      ),
    );
    final exp = _exp();
    await tester.binding.setSurfaceSize(const Size(390, 1800));
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
          experience: exp,
          showCelebration: false,
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    expect(find.text('المؤشرات', skipOffstage: false), findsOneWidget);
    expect(find.text('الخريطة الإرشادية', skipOffstage: false), findsOneWidget);
    // Still not embedding map/metrics detail content on first surface
    expect(find.text('__no_skin_map__', skipOffstage: false), findsOneWidget);
    expect(find.text('__no_metrics_detail__', skipOffstage: false), findsOneWidget);
  });
}
