import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/face_analysis_experience/history/history.dart';
import 'package:mirra/features/intelligence/domain/entities/face_intelligence_report.dart';
import 'package:mirra/features/intelligence/domain/entities/mira_beauty_report.dart';
import 'package:mirra/features/intelligence/domain/services/local_mira_report_builder.dart';
import 'package:mirra/features/skin_analysis/data/models/skin_report_model.dart';
import 'package:mirra/features/skin_analysis/domain/entities/skin_report.dart';

SkinReport _baseSkin({
  String? id,
  DateTime? at,
}) =>
    SkinReport(
      id: id,
      skinType: 'مختلطة',
      score: 80,
      hydration: 70,
      oiliness: 40,
      pores: 50,
      wrinkles: 30,
      spots: 20,
      advice: 'اختبار',
      createdAt: at,
    );

FaceIntelligenceReport _face({
  String analysisId = 'fx1',
  bool eligible = true,
  String shapeId = 'oval',
  String shapeAr = 'بيضاوي',
  int confidence = 90,
  String reportVersion = 'face-report-v1',
  String shapeVersion = 'face-shape-v1',
  List<FaceIntelFinding> findings = const [],
  List<FaceIntelFinding> notable = const [],
}) {
  return FaceIntelligenceReport(
    analysisId: analysisId,
    provider: 'on_device_landmarks',
    formulaVersion: 'face-shape-hybrid-rules-v1',
    captureVersion: 'cq-thresholds-v2.1',
    faceVersion: 'face-model-v1',
    intelligenceVersion: 'face-intel-v1',
    geometryVersion: 'face-geometry-v1',
    shapeVersion: shapeVersion,
    recommendationVersion: 'face-reco-v1',
    reportVersion: reportVersion,
    generatedAt: '2026-08-11T00:00:00.000Z',
    confidence: confidence,
    limitations: const ['تحليل ملامح تجميلي — ليس تشخيصاً طبياً.'],
    language: 'ar+en',
    executiveSummaryAr: 'شكل الوجه الظاهر: $shapeAr.',
    executiveSummaryEn: shapeAr,
    measurementEligible: eligible,
    eligibilityReasonCodes: const [],
    shape: FaceIntelShape(
      availability: 'available',
      shapeId: shapeId,
      displayNameAr: shapeAr,
      displayNameEn: 'Oval',
      confidence: confidence,
      explanationAr: 'نسب متوازنة نسبياً.',
      explanationEn: 'Balanced',
    ),
    findings: findings,
    notableFindings: notable,
    metrics: const [],
    recommendations: const [],
    featureLayers: const [],
    retakeGuidanceAr: 'أعيدي الالتقاط بإضاءة أوضح.',
    retakeGuidanceEn: 'Retake',
  );
}

MiraBeautyReport _miraWithFace(FaceIntelligenceReport face) {
  final base = LocalMiraReportBuilder.fromSkinReport(_baseSkin());
  return MiraBeautyReport(
    version: base.version,
    scoreSchemaVersion: base.scoreSchemaVersion,
    spatialConfidence: base.spatialConfidence,
    overallBeautyScore: base.overallBeautyScore,
    displayScoreLabelAr: base.displayScoreLabelAr,
    displayScoreLabelEn: base.displayScoreLabelEn,
    scoreSupportingAr: base.scoreSupportingAr,
    disclaimerAr: base.disclaimerAr,
    disclaimerEn: base.disclaimerEn,
    provenance: base.provenance,
    headlineAr: base.headlineAr,
    skinTypeAr: base.skinTypeAr,
    skinTypeEn: base.skinTypeEn,
    skinAgeEstimate: base.skinAgeEstimate,
    ageComparison: base.ageComparison,
    childSafety: base.childSafety,
    mainConcerns: base.mainConcerns,
    dailyRoutine: base.dailyRoutine,
    summaryAdviceAr: base.summaryAdviceAr,
    tipsAr: base.tipsAr,
    faceMapEnabled: base.faceMapEnabled,
    concernZonesSection: base.concernZonesSection,
    faceHealthMap: base.faceHealthMap,
    concernZonesNarrative: base.concernZonesNarrative,
    recommendedProducts: base.recommendedProducts,
    weeklyPlan: base.weeklyPlan,
    progressForecast: base.progressForecast,
    beautyJourney: base.beautyJourney,
    confidenceLayer: base.confidenceLayer,
    skinIntelligence: base.skinIntelligence,
    faceIntelligence: face,
    faceIntelligenceRuntime: base.faceIntelligenceRuntime,
  );
}

SkinReportModel _report({
  required String id,
  required FaceIntelligenceReport face,
  DateTime? at,
}) {
  return SkinReportModel.fromEntity(
    _baseSkin(id: id, at: at),
    miraReport: _miraWithFace(face),
  );
}

void main() {
  const hist = FaceHistoryAssembler();
  const cmp = FaceComparisonAssembler();

  group('FaceHistoryAssembler', () {
    test('first analysis — honest empty comparison', () {
      final r = _report(
        id: 'a1',
        face: _face(analysisId: 'fx1'),
        at: DateTime(2026, 8, 1),
      );
      final surface = hist.build(reports: [r], currentReportId: 'a1');
      expect(surface.firstAnalysisOnly, isTrue);
      expect(surface.comparisonAvailable, isFalse);
      expect(surface.headlineAr, FaceHistoryCopy.firstAnalysisHeadline);
      expect(surface.entries, hasLength(1));
    });

    test('dedupe + newest-first stable sort', () {
      final a = _report(
        id: 'a1',
        face: _face(analysisId: 'fx1'),
        at: DateTime(2026, 8, 1),
      );
      final b = _report(
        id: 'a2',
        face: _face(analysisId: 'fx2'),
        at: DateTime(2026, 8, 10),
      );
      final surface = hist.build(reports: [a, b, a]);
      expect(surface.entries.map((e) => e.reportId).toList(), ['a2', 'a1']);
    });

    test('orphan / missing face → not comparable entry', () {
      final bare = SkinReportModel.fromEntity(
        _baseSkin(id: 'bare', at: DateTime(2026, 8, 1)),
      );
      final e = hist.entryFromReport(bare);
      expect(e, isNotNull);
      expect(e!.hasFaceIntelligence, isFalse);
      expect(e.selfGate, FaceComparabilityGate.notComparable);
    });

    test('low confidence → comparableWithQualification', () {
      final e = hist.entryFromReport(
        _report(
          id: 'q1',
          face: _face(analysisId: 'fxq', confidence: 40),
        ),
      );
      expect(e!.selfGate, FaceComparabilityGate.comparableWithQualification);
    });
  });

  group('FaceComparisonAssembler', () {
    test('two comparable — baseline is previous, not oldest', () {
      final older = _report(
        id: 'old',
        face: _face(analysisId: 'fx_old', shapeId: 'oval', shapeAr: 'بيضاوي'),
        at: DateTime(2026, 7, 1),
      );
      final mid = _report(
        id: 'mid',
        face: _face(analysisId: 'fx_mid', shapeId: 'round', shapeAr: 'دائري'),
        at: DateTime(2026, 8, 1),
      );
      final cur = _report(
        id: 'cur',
        face: _face(analysisId: 'fx_cur', shapeId: 'oval', shapeAr: 'بيضاوي'),
        at: DateTime(2026, 8, 11),
      );
      final surface = hist.build(reports: [older, mid, cur]);
      final currentEntry = hist.entryFromReport(cur)!;
      final baseline = cmp.selectBaseline(
        entriesNewestFirst: surface.entries,
        current: currentEntry,
      );
      expect(baseline?.reportId, 'mid');

      final vm = cmp.build(currentReport: cur, previousReport: mid);
      expect(vm.mayRender, isTrue);
      expect(vm.comparableItems, isNotEmpty);
      expect(
        vm.comparableItems.every(
          (i) =>
              !i.userLanguageAr.contains('تحسن') &&
              !i.userLanguageAr.contains('تراجع'),
        ),
        isTrue,
      );
    });

    test('incompatible versions — blocked', () {
      final a = _report(
        id: 'a',
        face: _face(analysisId: 'fxa', reportVersion: 'face-report-v1'),
        at: DateTime(2026, 8, 10),
      );
      final b = _report(
        id: 'b',
        face: _face(analysisId: 'fxb', reportVersion: 'face-report-v2'),
        at: DateTime(2026, 8, 1),
      );
      final vm = cmp.build(currentReport: a, previousReport: b);
      expect(vm.gate, FaceComparabilityGate.notComparable);
      expect(vm.mayRender, isFalse);
      expect(vm.comparableItems, isEmpty);
    });

    test('low-quality previous skipped for baseline when newer comparable exists',
        () {
      final low = _report(
        id: 'low',
        face: _face(analysisId: 'fx_low', eligible: false),
        at: DateTime(2026, 8, 5),
      );
      final good = _report(
        id: 'good',
        face: _face(analysisId: 'fx_good'),
        at: DateTime(2026, 8, 1),
      );
      final cur = _report(
        id: 'cur',
        face: _face(analysisId: 'fx_cur'),
        at: DateTime(2026, 8, 11),
      );
      final surface = hist.build(reports: [low, good, cur]);
      final baseline = cmp.selectBaseline(
        entriesNewestFirst: surface.entries,
        current: hist.entryFromReport(cur)!,
      );
      expect(baseline?.reportId, 'good');
    });

    test('shape change uses qualification — not progress', () {
      final prev = _report(
        id: 'p',
        face: _face(analysisId: 'fxp', shapeId: 'oval', shapeAr: 'بيضاوي'),
      );
      final cur = _report(
        id: 'c',
        face: _face(analysisId: 'fxc', shapeId: 'heart', shapeAr: 'قلبي'),
      );
      final vm = cmp.build(currentReport: cur, previousReport: prev);
      final shape = vm.comparableItems.firstWhere((i) => i.itemId == 'shape');
      expect(shape.comparabilityClass, FaceComparabilityClass.structural);
      expect(shape.relationship, FaceComparisonRelationship.differs);
      expect(shape.userLanguageAr, contains('لا يعني'));
      expect(shape.userLanguageAr.contains('تحسن'), isFalse);
    });

    test('symmetry difference is contextual / non-beauty', () {
      final finding = const FaceIntelFinding(
        id: 'sym1',
        category: 'symmetry_note',
        titleAr: 'تماثل ظاهر',
        titleEn: 'Sym',
        detailAr: 'ملاحظة أ',
        detailEn: 'A',
        severity: 'info',
        confidence: 'medium',
      );
      final finding2 = const FaceIntelFinding(
        id: 'sym1',
        category: 'symmetry_note',
        titleAr: 'تماثل ظاهر',
        titleEn: 'Sym',
        detailAr: 'ملاحظة ب',
        detailEn: 'B',
        severity: 'info',
        confidence: 'medium',
      );
      final prev = _report(
        id: 'p',
        face: _face(analysisId: 'fxp', findings: [finding]),
      );
      final cur = _report(
        id: 'c',
        face: _face(analysisId: 'fxc', findings: [finding2]),
      );
      final vm = cmp.build(currentReport: cur, previousReport: prev);
      final item = vm.comparableItems.firstWhere((i) => i.itemId == 'sym1');
      expect(item.comparabilityClass, FaceComparabilityClass.contextual);
      expect(item.userLanguageAr, contains('جاذبية'));
      expect(item.userLanguageAr.contains('تحسن'), isFalse);
    });

    test('determinism — same history → same baseline + comparison id', () {
      final a = _report(
        id: 'a',
        face: _face(analysisId: 'fxa'),
        at: DateTime(2026, 8, 10),
      );
      final b = _report(
        id: 'b',
        face: _face(analysisId: 'fxb'),
        at: DateTime(2026, 8, 1),
      );
      final s1 = hist.build(reports: [a, b]);
      final s2 = hist.build(reports: [b, a]);
      expect(s1.entries.map((e) => e.entryId), s2.entries.map((e) => e.entryId));
      final base1 = cmp.selectBaseline(
        entriesNewestFirst: s1.entries,
        current: hist.entryFromReport(a)!,
      );
      final base2 = cmp.selectBaseline(
        entriesNewestFirst: s2.entries,
        current: hist.entryFromReport(a)!,
      );
      expect(base1?.entryId, base2?.entryId);
      final v1 = cmp.build(currentReport: a, previousReport: b);
      final v2 = cmp.build(currentReport: a, previousReport: b);
      expect(v1.comparisonId, v2.comparisonId);
    });
  });

  group('FaceRetakePolicy', () {
    test('canonical pop token + preserve history', () {
      final req = FaceRetakePolicy.build(
        reason: FaceRetakeReason.userRequested,
        source: FaceRetakeSource.resultMirror,
        currentAnalysisRef: 'fx1',
      );
      expect(FaceRetakePolicy.popResult, 'face_retake_requested');
      expect(req.preserveHistory, isTrue);
      expect(req.recommendedCaptureGuidanceAr, isNotEmpty);
    });
  });

  group('semantic / must-not-fake', () {
    test('no beauty / attractiveness / golden-ratio language in copy', () {
      final blob = [
        FaceHistoryCopy.entryTitle,
        FaceHistoryCopy.comparisonTitle,
        FaceHistoryCopy.similar,
        FaceHistoryCopy.differs,
        FaceHistoryCopy.shapeDiffNote,
        FaceHistoryCopy.symmetryDiffNote,
      ].join(' ');
      for (final f in FaceHistoryCopy.forbiddenProgressPhrases) {
        expect(blob.contains(f), isFalse, reason: f);
      }
      expect(FaceHistoryCopy.entryTitle, isNot(contains('تقدم')));
    });

    test('IA prefers History + Comparison over Progress Score', () {
      expect(FaceHistoryCopy.entryTitle, 'سجل التحليلات');
      expect(FaceHistoryCopy.comparisonTitle, 'مقارنة التحليلات');
    });
  });

  group('widgets', () {
    testWidgets('first analysis empty comparison messaging', (tester) async {
      final r = _report(
        id: 'a1',
        face: _face(),
        at: DateTime(2026, 8, 1),
      );
      await tester.pumpWidget(
        MaterialApp(
          home: FaceHistoryScreen(
            reports: [r],
            currentReportId: 'a1',
            onOpenReport: (_) {},
          ),
        ),
      );
      expect(find.text(FaceHistoryCopy.firstAnalysisHeadline), findsOneWidget);
      expect(find.byKey(const Key('face_history_compare')), findsNothing);
    });

    testWidgets('history list + compare when comparable pair exists',
        (tester) async {
      final a = _report(
        id: 'a',
        face: _face(analysisId: 'fxa'),
        at: DateTime(2026, 8, 10),
      );
      final b = _report(
        id: 'b',
        face: _face(analysisId: 'fxb'),
        at: DateTime(2026, 8, 1),
      );
      await tester.pumpWidget(
        MaterialApp(
          home: FaceHistoryScreen(
            reports: [a, b],
            currentReportId: 'a',
            onOpenReport: (_) {},
          ),
        ),
      );
      expect(find.byKey(const Key('face_history_compare')), findsOneWidget);
      await tester.tap(find.byKey(const Key('face_history_compare')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('face_comparison_sheet')), findsOneWidget);
      expect(find.textContaining('تحسن'), findsNothing);
    });

    testWidgets('incompatible comparison shows honest empty', (tester) async {
      final a = _report(
        id: 'a',
        face: _face(analysisId: 'fxa', reportVersion: 'v1'),
        at: DateTime(2026, 8, 10),
      );
      final b = _report(
        id: 'b',
        face: _face(analysisId: 'fxb', reportVersion: 'v2'),
        at: DateTime(2026, 8, 1),
      );
      // Force open sheet with blocked VM
      final vm = cmp.build(currentReport: a, previousReport: b);
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => TextButton(
                onPressed: () => showFaceComparisonSheet(
                  context: context,
                  comparison: vm,
                ),
                child: const Text('open'),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expect(
        find.byKey(const Key('face_comparison_incompatible')),
        findsOneWidget,
      );
    });

    testWidgets('history entry chip + RTL', (tester) async {
      var tapped = false;
      await tester.pumpWidget(
        MaterialApp(
          home: Directionality(
            textDirection: TextDirection.rtl,
            child: Scaffold(
              body: FaceHistoryEntryChip(
                visible: true,
                onTap: () => tapped = true,
              ),
            ),
          ),
        ),
      );
      expect(find.byKey(const Key('face_history_entry_chip')), findsOneWidget);
      await tester.tap(find.byKey(const Key('face_history_entry_chip')));
      expect(tapped, isTrue);
    });

    testWidgets('accessibility semantics on history tile', (tester) async {
      final r = _report(
        id: 'a1',
        face: _face(shapeAr: 'بيضاوي'),
        at: DateTime(2026, 8, 1),
      );
      await tester.pumpWidget(
        MaterialApp(
          home: FaceHistoryScreen(
            reports: [r],
            currentReportId: 'a1',
            onOpenReport: (_) {},
          ),
        ),
      );
      expect(
        find.bySemanticsLabel(RegExp('شكل الوجه')),
        findsWidgets,
      );
    });

    testWidgets('goldens — first / list / compare / incompatible / RTL',
        (tester) async {
      Future<void> golden(String name, Widget child) async {
        await tester.pumpWidget(
          MaterialApp(
            theme: ThemeData(useMaterial3: true),
            home: child,
          ),
        );
        await tester.pumpAndSettle();
        await expectLater(
          find.byType(MaterialApp),
          matchesGoldenFile('goldens/$name.png'),
        );
      }

      final single = _report(
        id: 'a1',
        face: _face(),
        at: DateTime(2026, 8, 1),
      );
      await golden(
        'phase_9j_first_analysis',
        FaceHistoryScreen(
          reports: [single],
          currentReportId: 'a1',
          onOpenReport: (_) {},
        ),
      );

      final a = _report(
        id: 'a',
        face: _face(analysisId: 'fxa', shapeAr: 'بيضاوي'),
        at: DateTime(2026, 8, 10),
      );
      final b = _report(
        id: 'b',
        face: _face(analysisId: 'fxb', shapeAr: 'دائري', shapeId: 'round'),
        at: DateTime(2026, 8, 1),
      );
      await golden(
        'phase_9j_history_list',
        FaceHistoryScreen(
          reports: [a, b],
          currentReportId: 'a',
          onOpenReport: (_) {},
        ),
      );

      final ok = cmp.build(currentReport: a, previousReport: b);
      await golden(
        'phase_9j_comparison',
        Scaffold(
          backgroundColor: const Color(0xFF121014),
          body: FaceComparisonSheet(comparison: ok, onClose: () {}),
        ),
      );

      final bad = cmp.build(
        currentReport: _report(
          id: 'x',
          face: _face(reportVersion: 'v1'),
        ),
        previousReport: _report(
          id: 'y',
          face: _face(reportVersion: 'v2'),
        ),
      );
      await golden(
        'phase_9j_incompatible',
        Scaffold(
          backgroundColor: const Color(0xFF121014),
          body: FaceComparisonSheet(comparison: bad, onClose: () {}),
        ),
      );

      await golden(
        'phase_9j_rtl_chip',
        Directionality(
          textDirection: TextDirection.rtl,
          child: Scaffold(
            backgroundColor: const Color(0xFF121014),
            body: Center(
              child: FaceHistoryEntryChip(visible: true, onTap: () {}),
            ),
          ),
        ),
      );
    });
  });
}
