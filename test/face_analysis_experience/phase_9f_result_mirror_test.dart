import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/config/mira_features.dart';
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
    detailRef: const FaceDetailRef(id: 'detail_shape', owner: 'shape'),
    evidenceAvailable: true,
    confidenceQualifierAr: qualifier,
  );
}

FaceInsightVm _insight({
  required String id,
  required String title,
  FacePresentationRegion region = FacePresentationRegion.jaw,
}) {
  return FaceInsightVm(
    id: id,
    semanticKey: 'insight:$id',
    titleAr: title,
    bodyAr: 'ملاحظة هيكلية مختصرة.',
    importance: 2,
    truthClass: FacePresentationTruthClass.derived,
    relatedRegion: region,
    detailRef: FaceDetailRef(id: 'detail_$id', owner: 'geometry'),
    confidencePresentation: FaceConfidencePresentation.hide,
    eligibility: FacePresentationEligibility.display,
  );
}

FaceResultProjection _projection({
  FaceResultCompleteness completeness = FaceResultCompleteness.complete,
  FacePrimaryResultVm? primary,
  List<FaceInsightVm>? insights,
  FaceNextActionKind next = FaceNextActionKind.openGuidance,
  bool contourAllowed = true,
}) {
  final insightList = insights ??
      [
        _insight(id: 'i1', title: 'تناسب الأثلاث', region: FacePresentationRegion.forehead),
        _insight(id: 'i2', title: 'تباعد العينين', region: FacePresentationRegion.eyes),
        _insight(id: 'i3', title: 'خط الفك', region: FacePresentationRegion.jaw),
      ];
  final p = primary ?? _primary();
  final summary = FaceExecutiveSummaryVm(
    id: 'face_exec_test',
    primary: completeness == FaceResultCompleteness.empty ? null : p,
    insights: completeness == FaceResultCompleteness.empty ? const [] : insightList,
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
      imageRef: null,
    ),
    limitations: const [],
    regions: [
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
  FaceResultProjection projection,
) async {
  await tester.pumpWidget(
    MediaQuery(
      data: const MediaQueryData(disableAnimations: true),
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

void main() {
  group('FaceResultMirrorTruthManifest Law #40', () {
    test('all mirror components classified', () {
      expect(FaceResultMirrorTruthManifest.entries, isNotEmpty);
      final components = FaceResultMirrorTruthManifest.entries
          .map((e) => e.component)
          .toSet();
      for (final required in [
        'captured_face',
        'derived_contour',
        'high_level_region',
        'region_glow',
        'primary_result',
        'insight',
        'glass_chrome',
        'soft_laser_replay',
        'beauty_score_display',
      ]) {
        expect(components.contains(required), isTrue, reason: required);
      }
      for (final e in FaceResultMirrorTruthManifest.entries) {
        expect(e.truthClass, isNotEmpty);
        expect(e.claimForbidden, isNotEmpty);
      }
    });
  });

  group('Law #41 — no fake re-analysis language', () {
    test('public copy omits fake-analysis and beauty-score phrases', () {
      final ui = [
        FaceResultCopy.primaryTitle,
        FaceResultCopy.askMiraLabel,
        FaceResultCopy.retakeLabel,
        FaceResultCopy.exploreDetailsLabel,
        FaceResultCopy.symmetryInsightTitle,
        FaceResultCopy.symmetryInsightBody,
        FaceResultCopy.emptyHeadline,
        FaceResultCopy.partialSupport,
      ].join(' | ');
      for (final f in const [
        'نفحص الآن',
        'نقيس الآن',
        'الليزر اكتشف',
        'إعادة المسح',
        'Beauty Score',
        'Attractiveness Score',
        'Golden Ratio Beauty',
        'درجة تناسق جمالك',
      ]) {
        expect(ui.contains(f), isFalse, reason: f);
      }
      final forbidden = FaceResultMirrorTruthManifest.entries
          .where((e) => e.truthClass == 'FORBIDDEN')
          .map((e) => e.component)
          .toSet();
      expect(forbidden.contains('soft_laser_replay'), isTrue);
      expect(forbidden.contains('beauty_score_display'), isTrue);
    });
  });

  group('FaceResultRevealCoordinator', () {
    test('stages primary then insights then actions', () {
      const policy = FaceResultMotionPolicy(
        settle: Duration(milliseconds: 50),
        contourCalm: Duration(milliseconds: 50),
        primaryReveal: Duration(milliseconds: 50),
        insightStep: Duration(milliseconds: 40),
        actionsReveal: Duration(milliseconds: 40),
      );
      final c = FaceResultRevealCoordinator(policy: policy);
      c.tick(const Duration(milliseconds: 20), insightTotal: 3);
      expect(c.phase, FaceResultRevealPhase.settling);
      c.tick(const Duration(milliseconds: 80), insightTotal: 3);
      expect(c.phase, FaceResultRevealPhase.contourCalm);
      c.tick(const Duration(milliseconds: 160), insightTotal: 3);
      expect(c.showPrimary, isTrue);
      c.tick(const Duration(milliseconds: 220), insightTotal: 3);
      expect(c.insightVisibleCount, greaterThan(0));
      c.tick(const Duration(milliseconds: 400), insightTotal: 3);
      expect(c.showActions, isTrue);
    });

    test('reduce motion skips long staging', () {
      final c = FaceResultRevealCoordinator(
        policy: FaceResultMotionPolicy.reduced,
      );
      c.tick(const Duration(milliseconds: 100), insightTotal: 3);
      expect(c.showPrimary, isTrue);
      expect(c.insightVisibleCount, 3);
    });
  });

  group('FaceResultSelectionState', () {
    test('single selection deterministic', () {
      var s = FaceResultSelectionState.empty;
      s = s.selectInsight(
        insightId: 'i1',
        region: FacePresentationRegion.eyes,
      );
      expect(s.selectedInsightId, 'i1');
      s = s.selectInsight(
        insightId: 'i2',
        region: FacePresentationRegion.jaw,
      );
      expect(s.selectedInsightId, 'i2');
      expect(s.selectedRegion, FacePresentationRegion.jaw);
    });
  });

  group('FaceRegionHitGeometry', () {
    test('regions are usable fractions inside face box', () {
      const box = Rect.fromLTWH(0, 0, 200, 300);
      for (final region in FacePresentationRegion.values) {
        final r = FaceRegionHitGeometry.rectFor(region, box);
        expect(r.width, greaterThanOrEqualTo(40));
        expect(r.height, greaterThanOrEqualTo(30));
        expect(box.inflate(1).overlaps(r), isTrue);
      }
    });
  });

  group('ResultsFaceMirrorScreen widgets', () {
    testWidgets('shows primary + ≤3 insights from injected projection',
        (tester) async {
      await _pumpMirror(tester, _projection());

      expect(find.text('بيضاوي'), findsOneWidget);
      expect(find.text('تناسب الأثلاث'), findsOneWidget);
      expect(find.text('خط الفك'), findsOneWidget);
      expect(find.text('اسألي ميرا'), findsWidgets);
      expect(find.text('عرض التقرير الكامل (قديم)'), findsOneWidget);
      expect(find.textContaining('Beauty Score'), findsNothing);
      expect(find.textContaining('Attractiveness'), findsNothing);
    });

    testWidgets('retake-first surface hides insight rail', (tester) async {
      await _pumpMirror(
        tester,
        _projection(
          completeness: FaceResultCompleteness.empty,
          next: FaceNextActionKind.retake,
          contourAllowed: false,
          insights: const [],
          primary: null,
        ),
      );

      expect(find.text(FaceResultCopy.emptyHeadline), findsOneWidget);
      expect(find.text(FaceResultCopy.retakeLabel), findsOneWidget);
      expect(find.text('تناسب الأثلاث'), findsNothing);
    });

    testWidgets('selecting insight opens detail sheet', (tester) async {
      await _pumpMirror(tester, _projection());
      await tester.tap(find.widgetWithText(FaceInsightChip, 'خط الفك'));
      await tester.pumpAndSettle();
      expect(find.byType(FaceDetailSheet), findsOneWidget);
      expect(find.text('ملاحظة هيكلية مختصرة.'), findsWidgets);
      await tester.ensureVisible(find.byKey(const Key('face_detail_close')));
      await tester.tap(find.byKey(const Key('face_detail_close')));
      await tester.pumpAndSettle();
      expect(find.byType(FaceDetailSheet), findsNothing);
      expect(find.widgetWithText(FaceInsightChip, 'خط الفك'), findsOneWidget);
    });

    testWidgets('qualified primary shows qualifier copy', (tester) async {
      await _pumpMirror(
        tester,
        _projection(
          primary: _primary(
            eligibility: FacePresentationEligibility.displayWithQualification,
            qualifier: 'ثقة محدودة لهذه الصورة',
          ),
        ),
      );
      expect(find.text('ثقة محدودة لهذه الصورة'), findsOneWidget);
    });
  });

  group('FaceResultMirrorFlag', () {
    test('default OFF — production entry unchanged without dart-define', () {
      expect(FaceResultMirrorFlag.enabled, isFalse);
      expect(MiraFeatures.faceResultMirrorV1, isFalse);
    });
  });
}
