import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/advisor/domain/services/fashion_advisor_route_decision.dart';
import 'package:mirra/features/face_analysis_experience/advisor_context/advisor_context.dart';
import 'package:mirra/features/face_analysis_experience/guidance/guidance.dart';
import 'package:mirra/features/face_analysis_experience/presentation/result/result_mirror.dart';
import 'package:mirra/features/face_analysis_experience/projection/projection.dart';
import 'package:mirra/features/intelligence/domain/entities/face_intelligence_report.dart';
import 'package:mirra/features/skin_analysis/domain/entities/skin_report.dart';
import 'package:mirra/core/navigation/route_args.dart';

SkinReport _skin() => const SkinReport(
      id: 'skin_1',
      skinType: 'مختلطة',
      score: 80,
      hydration: 70,
      oiliness: 40,
      pores: 50,
      wrinkles: 30,
      spots: 20,
      advice: 'اختبار',
    );

FacePrimaryResultVm _primary({String? qualifier}) {
  return FacePrimaryResultVm(
    resultId: 'primary_shape',
    titleAr: FaceResultCopy.primaryTitle,
    subtitleAr: 'نسب متوازنة نسبياً.',
    category: 'shape',
    valueLabelAr: 'بيضاوي',
    truthClass: FacePresentationTruthClass.derived,
    eligibility: qualifier == null
        ? FacePresentationEligibility.display
        : FacePresentationEligibility.displayWithQualification,
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

FaceInsightVm _insight(String id, String title) {
  return FaceInsightVm(
    id: id,
    semanticKey: 'insight:$id',
    titleAr: title,
    bodyAr: 'ملاحظة هيكلية مختصرة.',
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
  bool measurementEligible = true,
}) {
  final insightList = insights ??
      [
        _insight('i1', 'تناسب الأثلاث'),
        _insight('i2', 'خط الفك'),
      ];
  final p = primary ?? _primary();
  final summary = FaceExecutiveSummaryVm(
    id: 'face_exec_test',
    primary: completeness == FaceResultCompleteness.empty ? null : p,
    insights:
        completeness == FaceResultCompleteness.empty ? const [] : insightList,
    nextAction: const FaceNextActionVm(
      id: 'next',
      kind: FaceNextActionKind.askMira,
      labelAr: 'اسألي ميرا',
    ),
    advisorEntry: const FaceAdvisorEntryVm(
      analysisId: 'fx1',
      suggestedQuestionKeys: ['face_shape_styling'],
    ),
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

void main() {
  const assembler = FaceAdvisorContextAssembler();

  group('FaceAdvisorContextAssembler', () {
    test('general / primary without selection', () {
      final ctx = assembler.build(projection: _projection(), reportRef: 'skin_1');
      expect(ctx.contextType, FaceAdvisorContextType.primaryResult);
      expect(ctx.selectedResultId, 'primary_shape');
      expect(ctx.evidenceRefs, isNotEmpty);
      expect(ctx.contextLabelAr, FaceAdvisorContextCopy.aboutShape);
      expect(ctx.toJson().containsKey('provider'), isFalse);
    });

    test('insight selection wins', () {
      final ctx = assembler.build(
        projection: _projection(),
        selection: const FaceResultSelectionState(
          selectedInsightId: 'i2',
          selectedRegion: FacePresentationRegion.jaw,
          selectedDetailRefId: 'detail_i2',
        ),
      );
      expect(ctx.contextType, FaceAdvisorContextType.insight);
      expect(ctx.selectedInsightId, 'i2');
      expect(ctx.initialQuestionAr!.contains('خط الفك'), isTrue);
    });

    test('region remains illustrative', () {
      final ctx = assembler.build(
        projection: _projection(),
        selection: const FaceResultSelectionState(
          selectedRegion: FacePresentationRegion.jaw,
        ),
      );
      expect(ctx.contextType, FaceAdvisorContextType.region);
      final units = FaceAdvisorEvidenceMapper.map(ctx);
      expect(
        units.any((u) => u.claimKey == 'face.region.association'),
        isTrue,
      );
      expect(ctx.publicFactAr!.contains('قياس موضعي دقيق'), isFalse);
    });

    test('guidance binds frozen recommendation refs', () {
      final item = FaceGuidanceItemVm(
        guidanceId: 'guidance_rec_hairstyle_oval',
        owner: FaceGuidanceOwner.faceIntelligence,
        type: FaceGuidanceType.stylingRecommendation,
        titleAr: 'تسريحة',
        bodyAr: 'يمكنكِ تجربة طبقات خفيفة.',
        personalizationLevel: FaceGuidancePersonalizationLevel.personalized,
        reason: const FaceGuidanceReasonVm(
          labelAr: 'لماذا؟',
          explanationAr: 'لأن شكل وجهك الأقرب هو بيضاوي.',
        ),
        primaryAction: FaceGuidanceActionKind.askMira,
        primaryActionLabelAr: FaceGuidanceCopy.askMiraAction,
        priority: 10,
        eligibility: FaceGuidanceEligibility.showPrimary,
        category: 'hairstyle',
        frozenRecommendationRef: 'rec_hairstyle_oval',
        sourceResultRef: 'primary_shape',
        sourceDetailRef: 'detail_shape_oval',
      );
      final ctx = assembler.build(
        projection: _projection(),
        selectedGuidance: item,
      );
      expect(ctx.contextType, FaceAdvisorContextType.guidance);
      expect(ctx.frozenRecommendationRef, 'rec_hairstyle_oval');
      expect(ctx.reasonAr!.contains('بيضاوي'), isTrue);
    });

    test('orphan insight falls back to general/primary', () {
      final ctx = assembler.build(
        projection: _projection(),
        selection: const FaceResultSelectionState(selectedInsightId: 'missing'),
      );
      expect(
        ctx.contextType == FaceAdvisorContextType.generalFaceResult ||
            ctx.contextType == FaceAdvisorContextType.primaryResult,
        isTrue,
      );
    });

    test('low confidence qualifier preserved', () {
      final ctx = assembler.build(
        projection: _projection(primary: _primary(qualifier: 'ثقة محدودة')),
      );
      expect(ctx.confidenceQualifier, 'ثقة محدودة');
    });

    test('determinism + stable ids', () {
      final p = _projection();
      final a = assembler.build(projection: p, reportRef: 'skin_1');
      final b = assembler.build(projection: p, reportRef: 'skin_1');
      expect(a.toJson(), b.toJson());
    });

    test('no forbidden suggestion framing', () {
      final ctx = assembler.build(projection: _projection());
      for (final q in ctx.suggestedQuestionsAr) {
        for (final bad in FaceAdvisorContextCopy.forbiddenSuggestions) {
          expect(q.contains(bad), isFalse);
        }
      }
    });

    test('no cross-domain skin/fashion leak in face json', () {
      final ctx = assembler.build(projection: _projection());
      final json = ctx.toJson().toString();
      expect(json.contains('skincare'), isFalse);
      expect(json.contains('beautyScore'), isFalse);
    });
  });

  group('FaceAdvisorEvidenceMapper Law #34', () {
    test('forged claim rejected', () {
      final ctx = assembler.build(projection: _projection());
      final units = FaceAdvisorEvidenceMapper.map(ctx);
      expect(
        FaceAdvisorEvidenceMapper.allowsClaim(
          units: units,
          claimKey: 'face.attractiveness.score',
        ),
        isFalse,
      );
      expect(
        FaceAdvisorEvidenceMapper.allowsClaim(
          units: units,
          claimKey: units.first.claimKey,
        ),
        isTrue,
      );
    });

    test('9M client free text never becomes mapped evidence', () {
      final ctx = assembler.build(projection: _projection());
      // Assembler may still hold display-only publicFactAr locally.
      expect(ctx.publicFactAr, isNotNull);
      final units = FaceAdvisorEvidenceMapper.map(ctx);
      expect(
        FaceAdvisorEvidenceMapper.containsClientFreeText(
          units: units,
          ctx: ctx,
        ),
        isFalse,
      );
      // Wire payload must omit free text.
      final json = ctx.toJson();
      expect(json.containsKey('publicFactAr'), isFalse);
      expect(json.containsKey('reasonAr'), isFalse);
    });
  });

  group('FaceAdvisorRouteDecision', () {
    test('face context → advisorFaceChat (not MCE)', () {
      final ctx = assembler.build(projection: _projection());
      expect(
        FaceAdvisorRouteDecision.decide(faceContext: ctx),
        FaceAdvisorClientRoute.advisorFaceChat,
      );
      expect(
        FaceAdvisorRouteDecision.decide(faceContext: null),
        FaceAdvisorClientRoute.mceConsultation,
      );
    });

    test('skin-only fashion decision stays MCE', () {
      expect(
        FashionAdvisorRouteDecision.decide(
          fashionAdvisorV1Enabled: false,
          outfitContextPresent: false,
          fashionConversationSticky: false,
          isSkinOnlyFocus: true,
          isAtelierFocus: false,
        ),
        FashionAdvisorClientRoute.mceConsultation,
      );
    });
  });

  group('AdvisorRouteArgs.face', () {
    test('carries FaceAdvisorContext', () {
      final ctx = assembler.build(projection: _projection());
      final args = AdvisorRouteArgs.face(
        report: _skin(),
        faceContext: ctx,
      );
      expect(args.faceContext, isNotNull);
      expect(args.initialQuestion, ctx.initialQuestionAr);
      expect(args.skinReport?.id, 'skin_1');
    });
  });

  group('Widget: Ask Mira wiring', () {
    testWidgets('9F Ask Mira navigates with face context label path',
        (tester) async {
      // Assembler integration smoke — full Advisor screen needs auth/network.
      final ctx = assembler.build(
        projection: _projection(),
        selection: const FaceResultSelectionState(selectedInsightId: 'i1'),
      );
      expect(ctx.contextType, FaceAdvisorContextType.insight);
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Semantics(
              label: FaceAdvisorContextCopy.askMiraSemantics(ctx.contextLabelAr),
              child: Text(ctx.contextLabelAr),
            ),
          ),
        ),
      );
      expect(find.text(FaceAdvisorContextCopy.aboutInsight), findsOneWidget);
    });

    testWidgets('guidance Ask Mira semantics', (tester) async {
      final item = FaceGuidanceItemVm(
        guidanceId: 'guidance_rec_1',
        owner: FaceGuidanceOwner.faceIntelligence,
        type: FaceGuidanceType.stylingRecommendation,
        titleAr: 'إرشاد',
        bodyAr: 'نص',
        personalizationLevel: FaceGuidancePersonalizationLevel.personalized,
        reason: const FaceGuidanceReasonVm(
          labelAr: 'لماذا؟',
          explanationAr: 'سبب',
        ),
        primaryAction: FaceGuidanceActionKind.askMira,
        primaryActionLabelAr: FaceGuidanceCopy.askMiraAction,
        priority: 1,
        eligibility: FaceGuidanceEligibility.showPrimary,
        category: 'hairstyle',
        frozenRecommendationRef: 'rec_1',
      );
      final ctx = assembler.build(
        projection: _projection(),
        selectedGuidance: item,
      );
      await tester.pumpWidget(
        Directionality(
          textDirection: TextDirection.rtl,
          child: MaterialApp(
            home: Text(
              FaceAdvisorContextCopy.askMiraSemantics(ctx.contextLabelAr),
            ),
          ),
        ),
      );
      expect(find.textContaining('هذا الإرشاد'), findsOneWidget);
    });
  });
}
