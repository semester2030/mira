import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/face_analysis_experience/presentation/result/result_mirror.dart';
import 'package:mirra/features/face_analysis_experience/projection/projection.dart';
import 'package:mirra/features/skin_analysis/domain/entities/skin_report.dart';

SkinReport _skin() => const SkinReport(
      skinType: 'مختلطة',
      score: 80,
      hydration: 70,
      oiliness: 40,
      pores: 50,
      wrinkles: 30,
      spots: 20,
      advice: 'اختبار',
    );

FacePrimaryResultVm _primary({
  FacePresentationEligibility eligibility =
      FacePresentationEligibility.display,
  String? qualifier,
}) {
  return FacePrimaryResultVm(
    resultId: 'primary_shape',
    titleAr: FaceResultCopy.primaryTitle,
    subtitleAr: 'نسب متوازنة نسبياً.',
    category: 'shape',
    valueLabelAr: 'بيضاوي',
    truthClass: FacePresentationTruthClass.derived,
    eligibility: eligibility,
    confidencePresentation: FaceConfidencePresentation.showAsQualifier,
    detailRef: const FaceDetailRef(
      id: 'detail_shape_oval',
      owner: 'shape',
      metricId: 'faceShape',
    ),
    evidenceAvailable: true,
    confidenceQualifierAr: qualifier,
  );
}

FaceInsightVm _insight({
  required String id,
  required String title,
  FacePresentationRegion region = FacePresentationRegion.jaw,
  String owner = 'geometry',
  String? body,
}) {
  return FaceInsightVm(
    id: id,
    semanticKey: 'insight:$id',
    titleAr: title,
    bodyAr: body ?? 'ملاحظة هيكلية مختصرة.',
    importance: 2,
    truthClass: FacePresentationTruthClass.derived,
    relatedRegion: region,
    detailRef: FaceDetailRef(id: 'detail_$id', owner: owner),
    confidencePresentation: FaceConfidencePresentation.detailOnly,
    eligibility: FacePresentationEligibility.display,
  );
}

FaceResultProjection _projection({
  FaceResultCompleteness completeness = FaceResultCompleteness.complete,
  FacePrimaryResultVm? primary,
  List<FaceInsightVm>? insights,
  FaceNextActionKind next = FaceNextActionKind.openGuidance,
  bool contourAllowed = true,
  List<FaceRegionAssociationVm>? regions,
}) {
  final insightList = insights ??
      [
        _insight(
          id: 'i1',
          title: 'تناسب الأثلاث',
          region: FacePresentationRegion.forehead,
        ),
        _insight(
          id: 'i2',
          title: 'تباعد العينين',
          region: FacePresentationRegion.eyes,
        ),
        _insight(
          id: 'i3',
          title: 'خط الفك',
          region: FacePresentationRegion.jaw,
        ),
      ];
  final p = primary ?? _primary();
  final summary = FaceExecutiveSummaryVm(
    id: 'face_exec_test',
    primary: completeness == FaceResultCompleteness.empty ? null : p,
    insights:
        completeness == FaceResultCompleteness.empty ? const [] : insightList,
    nextAction: FaceNextActionVm(
      id: 'next',
      kind: next,
      labelAr: next == FaceNextActionKind.retake
          ? FaceResultCopy.retakeLabel
          : FaceResultCopy.openGuidanceLabel,
    ),
    advisorEntry: const FaceAdvisorEntryVm(analysisId: 'fx1'),
    completeness: completeness,
    headlineAr: completeness == FaceResultCompleteness.empty
        ? FaceResultCopy.emptyHeadline
        : FaceResultCopy.shapeTitle('بيضاوي'),
    supportAr: completeness == FaceResultCompleteness.empty
        ? FaceResultCopy.emptySupport
        : 'ملخص تجميلي.',
  );
  return FaceResultProjection(
    projectionVersion: FaceResultProjectionVersions.projection,
    completeness: completeness,
    executiveSummary: summary,
    mirror: FaceResultMirrorVm(
      analysisId: 'fx1',
      orientation: FaceSubjectOrientation.subjectCanonical,
      contourAllowed: contourAllowed,
      anchorsAllowed: contourAllowed,
      interactiveRegionsAllowed: insightList.isNotEmpty,
      primary: summary.primary,
      insightRefs: insightList.map((i) => i.id).toList(),
      summary: summary,
    ),
    limitations: const [],
    regions: regions ??
        [
          for (final i in insightList)
            FaceRegionAssociationVm(
              region: i.relatedRegion,
              insightIds: [i.id],
            ),
        ],
    detailRefs: [
      if (summary.primary != null) summary.primary!.detailRef,
      ...insightList.map((i) => i.detailRef),
    ],
    numericVisibilityByMetric: const {},
    measurementEligible: contourAllowed,
  );
}

Future<void> _pumpMirror(
  WidgetTester tester,
  FaceResultProjection projection, {
  Size size = const Size(390, 844),
}) async {
  await tester.pumpWidget(
    MediaQuery(
      data: MediaQueryData(size: size, disableAnimations: true),
      child: MaterialApp(
        home: ResultsFaceMirrorScreen(
          report: _skin(),
          projection: projection,
        ),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
}

Future<void> _pumpSheet(
  WidgetTester tester,
  FaceDetailSheetVm vm, {
  Size size = const Size(390, 844),
}) async {
  await tester.pumpWidget(
    MediaQuery(
      data: MediaQueryData(size: size, disableAnimations: true),
      child: MaterialApp(
        home: Scaffold(
          body: FaceDetailSheet(
            vm: vm,
            onPrimaryAction: (_) {},
            onClose: () {},
          ),
        ),
      ),
    ),
  );
  await tester.pump();
}

void main() {
  group('FaceDetailTruthManifest Law #40', () {
    test('sheet components classified', () {
      expect(FaceDetailTruthManifest.entries, isNotEmpty);
      final components =
          FaceDetailTruthManifest.entries.map((e) => e.component).toSet();
      for (final c in [
        'sheet_title',
        'metric_value',
        'region_highlight_sync',
        'confidence_qualifier',
        'sheet_recommendation',
        'sheet_open_motion',
      ]) {
        expect(components.contains(c), isTrue, reason: c);
      }
    });
  });

  group('FaceDetailAssembler / Router', () {
    test('primary detail is deterministic and stable', () {
      final p = _projection();
      final a = FaceDetailRouter.resolvePrimary(p);
      final b = FaceDetailRouter.resolvePrimary(p);
      expect(a.detailId, b.detailId);
      expect(a.titleAr, FaceResultCopy.primaryTitle);
      expect(a.valueLabelAr, 'بيضاوي');
      expect(a.meaningAr.contains('أفضل'), isFalse);
      expect(a.meaningAr.contains('جاذبية'), isFalse);
    });

    test('insight detail does not invent conclusions', () {
      final p = _projection();
      final insight = p.executiveSummary.insights.first;
      final vm = FaceDetailRouter.resolveInsight(p, insight);
      expect(vm.observationAr, insight.bodyAr);
      expect(vm.detailId, insight.detailRef.id);
    });

    test('region empty does not fabricate', () {
      final p = _projection(regions: const []);
      final vm = FaceDetailRouter.resolveRegion(
        p,
        FacePresentationRegion.nose,
      );
      expect(vm.type, FaceDetailSheetType.unsupported);
      expect(vm.observationAr, FaceDetailCopy.regionEmpty);
    });

    test('region with insights aggregates existing only', () {
      final p = _projection();
      final vm =
          FaceDetailRouter.resolveRegion(p, FacePresentationRegion.jaw);
      expect(vm.detailId, isNotEmpty);
      expect(vm.observationAr.contains('خط الفك') || vm.titleAr.contains('خط الفك') || vm.selectedInsightId == 'i3', isTrue);
    });

    test('orphan detailRef fails safely', () {
      final p = _projection();
      final vm = FaceDetailRouter.resolveDetailRef(p, 'orphan_xyz');
      expect(vm.type, FaceDetailSheetType.unsupported);
      expect(vm.isEmptyContent || vm.observationAr.contains('غير متاحة'), isTrue);
    });

    test('same detailRef dedupes to same content', () {
      final p = _projection();
      final id = p.executiveSummary.insights.first.detailRef.id;
      final a = FaceDetailRouter.resolveDetailRef(p, id);
      final b = FaceDetailRouter.resolveDetailRef(p, id);
      expect(a.titleAr, b.titleAr);
      expect(a.observationAr, b.observationAr);
    });

    test('symmetry meaning never beauty ranking', () {
      final insight = _insight(
        id: 'sym',
        title: FaceResultCopy.symmetryInsightTitle,
        owner: 'symmetry',
        body: FaceResultCopy.symmetryInsightBody,
        region: FacePresentationRegion.faceGeneral,
      );
      final p = _projection(insights: [insight]);
      final vm = FaceDetailRouter.resolveInsight(p, insight);
      expect(vm.meaningAr.contains('ليست تقييمًا'), isTrue);
      expect(vm.meaningAr.contains('أفضل'), isFalse);
      expect(vm.meaningAr.contains('درجة جمال'), isFalse);
      expect(vm.primaryActionLabelAr.contains('Beauty'), isFalse);
    });

    test('qualified primary uses limited type', () {
      final p = _projection(
        primary: _primary(
          eligibility: FacePresentationEligibility.displayWithQualification,
          qualifier: 'ثقة محدودة لهذه الصورة',
        ),
      );
      final vm = FaceDetailRouter.resolvePrimary(p);
      expect(vm.type, FaceDetailSheetType.limitedResult);
      expect(vm.confidenceAr, contains('ثقة'));
    });

    test('retake next action elevates retake CTA', () {
      final p = _projection(next: FaceNextActionKind.retake);
      final vm = FaceDetailRouter.resolvePrimary(p);
      expect(vm.primaryAction, FaceDetailPrimaryActionKind.retake);
      expect(vm.primaryActionLabelAr, FaceDetailCopy.retakeLabel);
    });

    test('must-not-fake public copy', () {
      final hay = [
        FaceDetailCopy.whatHeading,
        FaceDetailCopy.symmetryMeaning,
        FaceDetailCopy.shapeMeaning,
        FaceDetailCopy.regionEmpty,
        FaceDetailCopy.askMiraAboutThis,
      ].join(' | ');
      for (final f in [
        'Beauty Score',
        'Attractiveness',
        'Golden Ratio',
        'نفحص الآن',
        'نقيس الآن',
        'تشخيص',
        'علاج',
      ]) {
        expect(hay.contains(f), isFalse, reason: f);
      }
    });
  });

  group('ResultsFaceMirrorScreen + sheets', () {
    testWidgets('primary tap opens primary detail', (tester) async {
      await _pumpMirror(tester, _projection());
      await tester.ensureVisible(find.byType(FacePrimaryResultReveal));
      await tester.tap(find.byType(FacePrimaryResultReveal));
      await tester.pumpAndSettle();
      expect(find.byType(FaceDetailSheet), findsOneWidget);
      expect(find.text(FaceDetailCopy.primaryWhat), findsOneWidget);
      await tester.ensureVisible(find.byKey(const Key('face_detail_close')));
      await tester.tap(find.byKey(const Key('face_detail_close')));
      await tester.pumpAndSettle();
      expect(find.byType(FaceDetailSheet), findsNothing);
    });

    testWidgets('التفاصيل button opens detail', (tester) async {
      await _pumpMirror(tester, _projection());
      await tester.ensureVisible(find.text('التفاصيل'));
      await tester.tap(find.text('التفاصيل'));
      await tester.pumpAndSettle();
      expect(find.byType(FaceDetailSheet), findsOneWidget);
    });

    testWidgets('close sheet restores mirror selection', (tester) async {
      await _pumpMirror(tester, _projection());
      await tester.tap(find.widgetWithText(FaceInsightChip, 'خط الفك'));
      await tester.pumpAndSettle();
      expect(find.byType(FaceDetailSheet), findsOneWidget);
      await tester.ensureVisible(find.byKey(const Key('face_detail_close')));
      await tester.tap(find.byKey(const Key('face_detail_close')));
      await tester.pumpAndSettle();
      expect(find.byType(FaceDetailSheet), findsNothing);
      expect(find.widgetWithText(FaceInsightChip, 'خط الفك'), findsOneWidget);
    });

    testWidgets('accessibility list when accessibleNavigation', (tester) async {
      await tester.pumpWidget(
        MediaQuery(
          data: const MediaQueryData(
            size: Size(390, 844),
            disableAnimations: true,
            accessibleNavigation: true,
          ),
          child: MaterialApp(
            home: ResultsFaceMirrorScreen(
              report: _skin(),
              projection: _projection(),
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.text(FaceDetailCopy.availableDetailsLabel), findsOneWidget);
    });

    testWidgets('legacy full report still available', (tester) async {
      await _pumpMirror(tester, _projection());
      expect(find.text('عرض التقرير الكامل (قديم)'), findsOneWidget);
    });

    testWidgets('RTL sheet direction', (tester) async {
      final vm = FaceDetailRouter.resolvePrimary(_projection());
      await _pumpSheet(tester, vm);
      final dir = tester.widget<Directionality>(
        find.descendant(
          of: find.byType(FaceDetailSheet),
          matching: find.byType(Directionality),
        ).first,
      );
      expect(dir.textDirection, TextDirection.rtl);
    });
  });

  group('Semantic guarantees', () {
    test('shape ≠ beauty ranking', () {
      final vm = FaceDetailRouter.resolvePrimary(_projection());
      expect(vm.meaningAr.contains('أفضل'), isFalse);
      expect(vm.meaningAr.contains('مثالي'), isFalse);
    });

    test('region association illustrative', () {
      final vm = FaceDetailRouter.resolveRegion(
        _projection(regions: const []),
        FacePresentationRegion.chin,
      );
      expect(vm.truth.truthClass, FacePresentationTruthClass.illustrative);
    });

    test('detail ≠ new analysis language', () {
      final vm = FaceDetailRouter.resolvePrimary(_projection());
      final blob = '${vm.whatAr} ${vm.observationAr} ${vm.meaningAr}';
      expect(blob.contains('نفحص'), isFalse);
      expect(blob.contains('نقيس الآن'), isFalse);
    });
  });

  group('Goldens', () {
    Future<void> golden(
      WidgetTester tester,
      String name,
      FaceDetailSheetVm vm, {
      Size size = const Size(390, 844),
    }) async {
      await _pumpSheet(tester, vm, size: size);
      await expectLater(
        find.byType(FaceDetailSheet),
        matchesGoldenFile('goldens/phase_9g_$name.png'),
      );
    }

    testWidgets('golden primary', (tester) async {
      await golden(tester, 'primary', FaceDetailRouter.resolvePrimary(_projection()));
    });

    testWidgets('golden geometry', (tester) async {
      final p = _projection();
      await golden(
        tester,
        'geometry',
        FaceDetailRouter.resolveInsight(p, p.executiveSummary.insights.first),
      );
    });

    testWidgets('golden symmetry', (tester) async {
      final insight = _insight(
        id: 'sym',
        title: FaceResultCopy.symmetryInsightTitle,
        owner: 'symmetry',
        body: FaceResultCopy.symmetryInsightBody,
      );
      final p = _projection(insights: [insight]);
      await golden(
        tester,
        'symmetry',
        FaceDetailRouter.resolveInsight(p, insight),
      );
    });

    testWidgets('golden region_empty', (tester) async {
      await golden(
        tester,
        'region_empty',
        FaceDetailRouter.resolveRegion(
          _projection(regions: const []),
          FacePresentationRegion.nose,
        ),
      );
    });

    testWidgets('golden low_confidence', (tester) async {
      await golden(
        tester,
        'low_confidence',
        FaceDetailRouter.resolvePrimary(
          _projection(
            primary: _primary(
              eligibility:
                  FacePresentationEligibility.displayWithQualification,
              qualifier: 'ثقة محدودة لهذه الصورة',
            ),
          ),
        ),
      );
    });

    testWidgets('golden retake', (tester) async {
      await golden(
        tester,
        'retake',
        FaceDetailRouter.resolvePrimary(
          _projection(next: FaceNextActionKind.retake),
        ),
      );
    });

    testWidgets('golden compact_device', (tester) async {
      await golden(
        tester,
        'compact_device',
        FaceDetailRouter.resolvePrimary(_projection()),
        size: const Size(320, 640),
      );
    });

    testWidgets('golden large_device', (tester) async {
      await golden(
        tester,
        'large_device',
        FaceDetailRouter.resolvePrimary(_projection()),
        size: const Size(430, 932),
      );
    });
  });
}
