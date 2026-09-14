import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/face_analysis_experience/guidance/guidance.dart';
import 'package:mirra/features/face_analysis_experience/presentation/result/result_mirror.dart';
import 'package:mirra/features/face_analysis_experience/projection/projection.dart';
import 'package:mirra/features/intelligence/domain/entities/face_intelligence_report.dart';
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
  FacePresentationEligibility eligibility = FacePresentationEligibility.display,
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
  String? body,
}) {
  return FaceInsightVm(
    id: id,
    semanticKey: 'insight:$id',
    titleAr: title,
    bodyAr: body ?? 'ملاحظة هيكلية مختصرة.',
    importance: 2,
    truthClass: FacePresentationTruthClass.derived,
    relatedRegion: FacePresentationRegion.jaw,
    detailRef: FaceDetailRef(id: 'detail_$id', owner: 'geometry'),
    confidencePresentation: FaceConfidencePresentation.detailOnly,
    eligibility: FacePresentationEligibility.display,
  );
}

FaceResultProjection _projection({
  FaceResultCompleteness completeness = FaceResultCompleteness.complete,
  FacePrimaryResultVm? primary,
  List<FaceInsightVm>? insights,
  FaceNextActionKind next = FaceNextActionKind.openGuidance,
  bool measurementEligible = true,
}) {
  final insightList = insights ??
      [
        _insight(id: 'i1', title: 'تناسب الأثلاث'),
        _insight(id: 'i2', title: 'تباعد العينين'),
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
      contourAllowed: measurementEligible,
      anchorsAllowed: measurementEligible,
      interactiveRegionsAllowed: insightList.isNotEmpty,
      primary: summary.primary,
      insightRefs: insightList.map((i) => i.id).toList(),
      summary: summary,
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
    measurementEligible: measurementEligible,
  );
}

FaceIntelRecommendation _rec({
  required String id,
  required String category,
  String? titleAr,
  String? bodyAr,
}) {
  return FaceIntelRecommendation(
    id: id,
    category: category,
    titleAr: titleAr ?? 'عنوان $category',
    titleEn: category,
    bodyAr: bodyAr ?? 'يمكنكِ تجربة خيار مناسب لهذا التحليل.',
    bodyEn: 'Try an option',
  );
}

void main() {
  const assembler = FaceGuidanceAssembler();

  group('FaceGuidanceTruthManifest Law #40', () {
    test('components classified', () {
      final components =
          FaceGuidanceTruthManifest.entries.map((e) => e.component).toSet();
      for (final c in [
        'guidance_title',
        'guidance_body',
        'guidance_reason',
        'personalization_badge',
        'educational_label',
        'retake_guidance',
        'empty_state',
        'guidance_open_motion',
      ]) {
        expect(components.contains(c), isTrue, reason: c);
      }
    });
  });

  group('FaceGuidanceAssembler', () {
    test('strong personalized recommendation has owner + source + reason', () {
      final surface = assembler.build(
        projection: _projection(),
        recommendations: [
          _rec(id: 'rec_hairstyle_oval', category: 'hairstyle'),
        ],
      );
      expect(surface.empty, isFalse);
      expect(surface.primary, isNotNull);
      expect(surface.primary!.owner, FaceGuidanceOwner.faceIntelligence);
      expect(
        surface.primary!.personalizationLevel,
        FaceGuidancePersonalizationLevel.personalized,
      );
      expect(surface.primary!.frozenRecommendationRef, 'rec_hairstyle_oval');
      expect(surface.primary!.sourceResultRef, 'primary_shape');
      expect(surface.primary!.reason.explanationAr.contains('بيضاوي'), isTrue);
      expect(surface.primary!.guidanceId, 'guidance_rec_hairstyle_oval');
    });

    test('cap ≤3 and one primary', () {
      final surface = assembler.build(
        projection: _projection(),
        recommendations: [
          _rec(id: 'rec_hairstyle_oval', category: 'hairstyle'),
          _rec(id: 'rec_makeup_oval', category: 'makeup_contour'),
          _rec(id: 'rec_eyewear_oval', category: 'eyewear'),
          _rec(id: 'rec_accessories_1', category: 'accessories'),
          _rec(id: 'rec_edu_1', category: 'educational'),
        ],
      );
      expect(surface.allItems.length, lessThanOrEqualTo(3));
      expect(surface.primary, isNotNull);
      expect(surface.secondary.length, lessThanOrEqualTo(2));
    });

    test('semantic dedup keeps one concept per category', () {
      final surface = assembler.build(
        projection: _projection(),
        recommendations: [
          _rec(id: 'rec_hairstyle_oval_a', category: 'hairstyle'),
          _rec(id: 'rec_hairstyle_oval_b', category: 'hairstyle'),
        ],
      );
      expect(surface.allItems.length, 1);
    });

    test('general / unsupported owner never personalized', () {
      final surface = assembler.build(
        projection: _projection(),
        recommendations: [
          _rec(id: 'rec_skin_rx', category: 'skincare_treatment'),
          _rec(id: 'rec_fashion', category: 'clothing'),
        ],
      );
      expect(surface.empty, isTrue);
      expect(
        surface.allItems.any(
          (i) =>
              i.personalizationLevel ==
              FaceGuidancePersonalizationLevel.personalized,
        ),
        isFalse,
      );
    });

    test('educational labeled educational not personalized', () {
      final surface = assembler.build(
        projection: _projection(),
        recommendations: [
          _rec(
            id: 'rec_edu_shape',
            category: 'educational',
            titleAr: 'ما معنى شكل الوجه؟',
            bodyAr: 'شكل الوجه وصف هيكلي — ليس تقييم جاذبية.',
          ),
        ],
      );
      expect(surface.primary, isNotNull);
      expect(
        surface.primary!.personalizationLevel,
        FaceGuidancePersonalizationLevel.educational,
      );
    });

    test('low confidence demotes personalized strength', () {
      final surface = assembler.build(
        projection: _projection(
          primary: _primary(
            eligibility:
                FacePresentationEligibility.displayWithQualification,
            qualifier: 'ثقة محدودة',
          ),
        ),
        recommendations: [
          _rec(id: 'rec_hairstyle_oval', category: 'hairstyle'),
        ],
      );
      expect(surface.primary, isNotNull);
      expect(
        surface.primary!.eligibility,
        FaceGuidanceEligibility.showSecondary,
      );
      expect(surface.primary!.confidencePresentationAr, isNotNull);
    });

    test('retake supersedes ordinary guidance', () {
      final surface = assembler.build(
        projection: _projection(
          completeness: FaceResultCompleteness.empty,
          next: FaceNextActionKind.retake,
          measurementEligible: false,
        ),
        recommendations: [
          _rec(id: 'rec_hairstyle_oval', category: 'hairstyle'),
        ],
      );
      expect(surface.retakeSupersedes, isTrue);
      expect(surface.primary!.type, FaceGuidanceType.retake);
      expect(surface.secondary, isEmpty);
    });

    test('limitation / no measurement → no personalized filler', () {
      final surface = assembler.build(
        projection: _projection(measurementEligible: false),
        recommendations: [
          _rec(id: 'rec_hairstyle_oval', category: 'hairstyle'),
        ],
      );
      expect(surface.retakeSupersedes, isTrue);
    });

    test('orphan unsupported category omitted safely', () {
      final surface = assembler.build(
        projection: _projection(),
        recommendations: [
          _rec(id: 'rec_unknown', category: 'mystery'),
        ],
      );
      expect(surface.empty, isTrue);
    });

    test('no recommendations → honest empty', () {
      final surface = assembler.build(
        projection: _projection(),
        recommendations: const [],
      );
      expect(surface.empty, isTrue);
      expect(surface.emptyHeadlineAr, FaceGuidanceCopy.emptyHeadline);
    });

    test('partial guidance shows one without forcing three', () {
      final surface = assembler.build(
        projection: _projection(),
        recommendations: [
          _rec(id: 'rec_eyewear_oval', category: 'eyewear'),
        ],
      );
      expect(surface.allItems.length, 1);
      expect(surface.secondary, isEmpty);
    });

    test('stable ids + determinism', () {
      final p = _projection();
      final recs = [
        _rec(id: 'rec_makeup_oval', category: 'makeup_contour'),
        _rec(id: 'rec_hairstyle_oval', category: 'hairstyle'),
      ];
      final a = assembler.build(projection: p, recommendations: recs);
      final b = assembler.build(projection: p, recommendations: recs);
      expect(a.surfaceId, b.surfaceId);
      expect(
        a.allItems.map((i) => i.guidanceId).toList(),
        b.allItems.map((i) => i.guidanceId).toList(),
      );
      expect(a.primary!.category, 'hairstyle');
    });

    test('insight copy overlap is deduped', () {
      final surface = assembler.build(
        projection: _projection(
          insights: [
            _insight(
              id: 'i1',
              title: 'تسريحة ناعمة',
              body: 'يمكنكِ تجربة طبقات خفيفة حول الوجه.',
            ),
          ],
        ),
        recommendations: [
          _rec(
            id: 'rec_hairstyle_oval',
            category: 'hairstyle',
            titleAr: 'تسريحة ناعمة',
            bodyAr: 'يمكنكِ تجربة طبقات خفيفة حول الوجه.',
          ),
        ],
      );
      expect(surface.empty, isTrue);
    });

    test('forbidden content rejected', () {
      expect(
        () => FaceGuidanceValidators.assertNoForbidden(
          FaceGuidanceItemVm(
            guidanceId: 'bad',
            owner: FaceGuidanceOwner.faceIntelligence,
            type: FaceGuidanceType.stylingRecommendation,
            titleAr: 'اصلحي وجهك',
            bodyAr: 'عالجي',
            personalizationLevel: FaceGuidancePersonalizationLevel.general,
            reason: const FaceGuidanceReasonVm(
              labelAr: 'لماذا؟',
              explanationAr: 'x',
            ),
            primaryAction: FaceGuidanceActionKind.close,
            primaryActionLabelAr: 'إغلاق',
            priority: 1,
            eligibility: FaceGuidanceEligibility.hide,
            category: 'hairstyle',
          ),
        ),
        throwsStateError,
      );
    });

    test('advisor context carries refs not invented authority', () {
      final surface = assembler.build(
        projection: _projection(),
        recommendations: [
          _rec(id: 'rec_hairstyle_oval', category: 'hairstyle'),
        ],
      );
      final ctx = FaceGuidanceAdvisorContext.fromItem(
        analysisId: 'fx1',
        item: surface.primary!,
      );
      expect(ctx.frozenRecommendationRef, 'rec_hairstyle_oval');
      expect(ctx.sourceResultRef, 'primary_shape');
      expect(ctx.evidenceRefs, isNotEmpty);
    });

    test('ownership registry does not absorb skin/fashion', () {
      expect(
        FaceGuidanceOwnershipPolicy.domainOwners['skin_treatment'],
        FaceGuidanceOwner.skin,
      );
      expect(
        FaceGuidanceOwnershipPolicy.domainOwners['fashion_style'],
        FaceGuidanceOwner.fashion,
      );
      expect(
        FaceGuidanceOwnershipPolicy.ownerForCategory('hairstyle'),
        FaceGuidanceOwner.faceIntelligence,
      );
    });

    test('semantic: face shape ≠ problem / no medical', () {
      final surface = assembler.build(
        projection: _projection(),
        recommendations: [
          _rec(
            id: 'rec_hairstyle_oval',
            category: 'hairstyle',
            bodyAr: 'قد يناسب هذا الخيار ملامحك إذا كان هدفك تنسيقًا أنعم.',
          ),
        ],
      );
      final blob =
          '${surface.primary!.titleAr} ${surface.primary!.bodyAr} ${surface.primary!.reason.explanationAr}';
      expect(blob.contains('عيب'), isFalse);
      expect(blob.contains('تشخيص'), isFalse);
      expect(blob.contains('درجة جمال'), isFalse);
      expect(blob.contains('يجب'), isFalse);
    });
  });

  group('FaceGuidanceSheet widgets', () {
    Future<void> pumpSheet(
      WidgetTester tester,
      FaceGuidanceSurfaceVm surface, {
      Size size = const Size(390, 844),
    }) async {
      await tester.binding.setSurfaceSize(size);
      addTearDown(() async {
        await tester.binding.setSurfaceSize(null);
      });
      await tester.pumpWidget(
        MediaQuery(
          data: MediaQueryData(size: size, disableAnimations: true),
          child: MaterialApp(
            home: Scaffold(
              body: FaceGuidanceSheet(
                surface: surface,
                onAction: (_) {},
                onClose: () {},
              ),
            ),
          ),
        ),
      );
      await tester.pump();
    }

    testWidgets('primary + reason expansion + action', (tester) async {
      final surface = assembler.build(
        projection: _projection(),
        recommendations: [
          _rec(id: 'rec_hairstyle_oval', category: 'hairstyle'),
        ],
      );
      await pumpSheet(tester, surface);
      expect(find.byKey(const Key('face_guidance_primary')), findsOneWidget);
      expect(find.text(FaceGuidanceCopy.personalizedBadge), findsOneWidget);
      await tester.tap(
        find.byKey(Key('face_guidance_reason_${surface.primary!.guidanceId}')),
      );
      await tester.pump();
      expect(find.textContaining('بيضاوي'), findsWidgets);
      expect(
        find.byKey(Key('face_guidance_action_${surface.primary!.guidanceId}')),
        findsOneWidget,
      );
    });

    testWidgets('three guidance max UI', (tester) async {
      final surface = assembler.build(
        projection: _projection(),
        recommendations: [
          _rec(id: 'rec_hairstyle_oval', category: 'hairstyle'),
          _rec(id: 'rec_makeup_oval', category: 'makeup_contour'),
          _rec(id: 'rec_eyewear_oval', category: 'eyewear'),
          _rec(id: 'rec_accessories_1', category: 'accessories'),
        ],
      );
      await pumpSheet(tester, surface);
      expect(surface.allItems.length, 3);
      expect(find.text(FaceGuidanceCopy.secondaryHeading), findsOneWidget);
    });

    testWidgets('educational label', (tester) async {
      final surface = assembler.build(
        projection: _projection(),
        recommendations: [
          _rec(id: 'rec_edu_1', category: 'educational'),
        ],
      );
      await pumpSheet(tester, surface);
      expect(find.text(FaceGuidanceCopy.educationalBadge), findsOneWidget);
    });

    testWidgets('empty state', (tester) async {
      final surface = assembler.build(
        projection: _projection(),
        recommendations: const [],
      );
      await pumpSheet(tester, surface);
      expect(find.byKey(const Key('face_guidance_empty')), findsOneWidget);
      expect(find.text(FaceGuidanceCopy.emptyHeadline), findsOneWidget);
    });

    testWidgets('retake state', (tester) async {
      final surface = assembler.build(
        projection: _projection(
          completeness: FaceResultCompleteness.empty,
          next: FaceNextActionKind.retake,
          measurementEligible: false,
        ),
        recommendations: [
          _rec(id: 'rec_hairstyle_oval', category: 'hairstyle'),
        ],
      );
      await pumpSheet(tester, surface);
      expect(find.text(FaceGuidanceCopy.retakeHeadline), findsOneWidget);
    });

    testWidgets('RTL directionality', (tester) async {
      final surface = assembler.build(
        projection: _projection(),
        recommendations: [
          _rec(id: 'rec_hairstyle_oval', category: 'hairstyle'),
        ],
      );
      await pumpSheet(tester, surface);
      final sheet = tester.widget<FaceGuidanceSheet>(
        find.byType(FaceGuidanceSheet),
      );
      expect(sheet, isNotNull);
      final rtl = find.descendant(
        of: find.byType(FaceGuidanceSheet),
        matching: find.byWidgetPredicate(
          (w) => w is Directionality && w.textDirection == TextDirection.rtl,
        ),
      );
      expect(rtl, findsOneWidget);
    });

    testWidgets('reduce motion usable', (tester) async {
      final surface = assembler.build(
        projection: _projection(),
        recommendations: [
          _rec(id: 'rec_hairstyle_oval', category: 'hairstyle'),
        ],
      );
      await pumpSheet(tester, surface);
      expect(find.byKey(const Key('face_guidance_primary')), findsOneWidget);
      expect(find.byKey(const Key('face_guidance_close')), findsOneWidget);
    });

    testWidgets('accessibility semantics present', (tester) async {
      final surface = assembler.build(
        projection: _projection(),
        recommendations: [
          _rec(id: 'rec_hairstyle_oval', category: 'hairstyle'),
        ],
      );
      await pumpSheet(tester, surface);
      expect(find.text(FaceGuidanceCopy.entryTitle), findsOneWidget);
      expect(find.text(FaceGuidanceCopy.whyLabel), findsOneWidget);
      expect(find.text(FaceGuidanceCopy.askMiraAction), findsOneWidget);
    });

    testWidgets('goldens — personalized / empty / retake / compact / large',
        (tester) async {
      Future<void> golden(
        String name,
        FaceGuidanceSurfaceVm surface, {
        Size size = const Size(390, 844),
      }) async {
        await pumpSheet(tester, surface, size: size);
        await expectLater(
          find.byType(FaceGuidanceSheet),
          matchesGoldenFile('goldens/$name.png'),
        );
      }

      await golden(
        'phase_9h_one_personalized',
        assembler.build(
          projection: _projection(),
          recommendations: [
            _rec(id: 'rec_hairstyle_oval', category: 'hairstyle'),
          ],
        ),
      );
      await golden(
        'phase_9h_three_max',
        assembler.build(
          projection: _projection(),
          recommendations: [
            _rec(id: 'rec_hairstyle_oval', category: 'hairstyle'),
            _rec(id: 'rec_makeup_oval', category: 'makeup_contour'),
            _rec(id: 'rec_eyewear_oval', category: 'eyewear'),
          ],
        ),
      );
      await golden(
        'phase_9h_empty',
        assembler.build(
          projection: _projection(),
          recommendations: const [],
        ),
      );
      await golden(
        'phase_9h_retake',
        assembler.build(
          projection: _projection(
            completeness: FaceResultCompleteness.empty,
            next: FaceNextActionKind.retake,
            measurementEligible: false,
          ),
          recommendations: [
            _rec(id: 'rec_hairstyle_oval', category: 'hairstyle'),
          ],
        ),
      );
      await golden(
        'phase_9h_educational',
        assembler.build(
          projection: _projection(),
          recommendations: [
            _rec(id: 'rec_edu_1', category: 'educational'),
          ],
        ),
      );
      await golden(
        'phase_9h_low_confidence',
        assembler.build(
          projection: _projection(
            primary: _primary(
              eligibility:
                  FacePresentationEligibility.displayWithQualification,
              qualifier: 'ثقة محدودة',
            ),
          ),
          recommendations: [
            _rec(id: 'rec_hairstyle_oval', category: 'hairstyle'),
          ],
        ),
      );
      await golden(
        'phase_9h_compact_device',
        assembler.build(
          projection: _projection(),
          recommendations: [
            _rec(id: 'rec_hairstyle_oval', category: 'hairstyle'),
          ],
        ),
        size: const Size(320, 640),
      );
      await golden(
        'phase_9h_large_device',
        assembler.build(
          projection: _projection(),
          recommendations: [
            _rec(id: 'rec_hairstyle_oval', category: 'hairstyle'),
            _rec(id: 'rec_makeup_oval', category: 'makeup_contour'),
          ],
        ),
        size: const Size(428, 926),
      );
    });
  });

  group('9F guidance entry integration', () {
    testWidgets('entry visible and opens sheet', (tester) async {
      const size = Size(390, 844);
      await tester.binding.setSurfaceSize(size);
      addTearDown(() async {
        await tester.binding.setSurfaceSize(null);
      });
      await tester.pumpWidget(
        MediaQuery(
          data: const MediaQueryData(
            size: size,
            disableAnimations: true,
          ),
          child: MaterialApp(
            home: ResultsFaceMirrorScreen(
              report: _skin(),
              projection: _projection(),
              recommendations: [
                _rec(id: 'rec_hairstyle_oval', category: 'hairstyle'),
              ],
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(find.byKey(const Key('face_guidance_entry')), findsOneWidget);
      expect(find.text(FaceGuidanceCopy.entryTitle), findsOneWidget);
      await tester.ensureVisible(find.byKey(const Key('face_guidance_entry')));
      await tester.pump();
      await tester.tap(find.byKey(const Key('face_guidance_entry')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('face_guidance_primary')), findsOneWidget);
    });
  });
}
