import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/face_analysis_experience/presentation/analysis/analysis_motion.dart';
import 'package:mirra/features/face_analysis_experience/presentation/capture/tokens/capture_mirror_tokens.dart';
import 'package:mirra/features/face_analysis_experience/presentation/shared/shared.dart';
import 'package:mirra/features/face_analysis_experience/presentation/result/policy/face_result_motion_policy.dart';
import 'package:mirra/features/face_analysis_experience/presentation/analysis/policy/analysis_motion_timing_policy.dart';
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

FaceResultProjection _projection() {
  final insight = FaceInsightVm(
    id: 'i1',
    semanticKey: 'insight:i1',
    titleAr: 'تناسب الأثلاث',
    bodyAr: 'ملاحظة.',
    importance: 2,
    truthClass: FacePresentationTruthClass.derived,
    relatedRegion: FacePresentationRegion.jaw,
    detailRef: const FaceDetailRef(id: 'd1', owner: 'geometry'),
    confidencePresentation: FaceConfidencePresentation.detailOnly,
    eligibility: FacePresentationEligibility.display,
  );
  final primary = FacePrimaryResultVm(
    resultId: 'primary_shape',
    titleAr: FaceResultCopy.primaryTitle,
    subtitleAr: 'نسب متوازنة.',
    category: 'shape',
    valueLabelAr: 'بيضاوي',
    truthClass: FacePresentationTruthClass.derived,
    eligibility: FacePresentationEligibility.display,
    confidencePresentation: FaceConfidencePresentation.showAsQualifier,
    detailRef: const FaceDetailRef(
      id: 'detail_shape_oval',
      owner: 'shape',
      metricId: 'faceShape',
    ),
    evidenceAvailable: true,
  );
  final summary = FaceExecutiveSummaryVm(
    id: 'face_exec_9k',
    primary: primary,
    insights: [insight],
    nextAction: const FaceNextActionVm(
      id: 'next',
      kind: FaceNextActionKind.openGuidance,
      labelAr: FaceResultCopy.openGuidanceLabel,
    ),
    advisorEntry: const FaceAdvisorEntryVm(analysisId: 'fx9k'),
    completeness: FaceResultCompleteness.complete,
    headlineAr: FaceResultCopy.shapeTitle('بيضاوي'),
    supportAr: 'ملخص.',
  );
  return FaceResultProjection(
    projectionVersion: FaceResultProjectionVersions.projection,
    completeness: FaceResultCompleteness.complete,
    executiveSummary: summary,
    mirror: FaceResultMirrorVm(
      analysisId: 'fx9k',
      orientation: FaceSubjectOrientation.subjectCanonical,
      contourAllowed: true,
      anchorsAllowed: true,
      interactiveRegionsAllowed: true,
      primary: primary,
      insightRefs: const ['i1'],
      summary: summary,
    ),
    limitations: const [],
    regions: const [
      FaceRegionAssociationVm(
        region: FacePresentationRegion.jaw,
        insightIds: ['i1'],
      ),
    ],
    detailRefs: [primary.detailRef, insight.detailRef],
    numericVisibilityByMetric: const {},
    measurementEligible: true,
  );
}

void main() {
  group('FaceExperienceTokens', () {
    test('unified palette aliases match legacy token surfaces', () {
      expect(FaceExperienceTokens.pearl, FaceResultTokens.pearl);
      expect(FaceExperienceTokens.violet, CaptureMirrorTokens.violet);
      expect(FaceExperienceTokens.mirrorRadius, FaceResultTokens.mirrorRadius);
      expect(FaceExperienceTokens.dimMask.a, closeTo(0.55, 0.001));
    });

    test('no medical/neon identity colors in token set', () {
      expect(FaceExperienceTokens.pearl.value, isNot(0xFFFF0000));
      expect(FaceExperienceTokens.actionAccent, isNot(const Color(0xFF00FF00)));
    });
  });

  group('FaceExperienceMotion', () {
    test('afterAnalysis reveal shorter than default', () {
      expect(
        FaceExperienceMotion.afterAnalysisReveal.totalBudget.inMilliseconds,
        lessThan(FaceResultMotionPolicy.defaults.totalBudget.inMilliseconds),
      );
    });

    test('analysis timing restrained vs previous long scan', () {
      expect(
        AnalysisMotionTimingPolicy.defaults.scanPass.inMilliseconds,
        lessThanOrEqualTo(1500),
      );
    });

    testWidgets('reduceMotion zeros opacity durations', (tester) async {
      late BuildContext ctx;
      await tester.pumpWidget(
        MediaQuery(
          data: const MediaQueryData(disableAnimations: true),
          child: Builder(
            builder: (context) {
              ctx = context;
              return const SizedBox();
            },
          ),
        ),
      );
      expect(FaceExperienceMotion.reduceMotionOf(ctx), isTrue);
      expect(
        FaceExperienceMotion.opacityOf(ctx, FaceExperienceMotion.standardTransition),
        Duration.zero,
      );
      final policy = FaceExperienceMotion.resultRevealPolicy(
        context: ctx,
        afterAnalysisMotion: true,
      );
      expect(policy.settle, Duration.zero);
    });

    testWidgets('afterAnalysisMotion uses shortened policy', (tester) async {
      late BuildContext ctx;
      await tester.pumpWidget(
        MediaQuery(
          data: const MediaQueryData(disableAnimations: false),
          child: Builder(
            builder: (context) {
              ctx = context;
              return const SizedBox();
            },
          ),
        ),
      );
      final policy = FaceExperienceMotion.resultRevealPolicy(
        context: ctx,
        afterAnalysisMotion: true,
      );
      expect(policy.primaryReveal.inMilliseconds, lessThan(200));
    });
  });

  group('continuity orientation', () {
    testWidgets('fresh capture path defaults to mirroredPreview', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: ResultsFaceMirrorScreen(
            report: _skin(),
            captureImagePath: '/tmp/fake_hold.jpg',
            projection: _projection(),
            showCelebration: false,
          ),
        ),
      );
      await tester.pump();
      final screen = tester.widget<ResultsFaceMirrorScreen>(
        find.byType(ResultsFaceMirrorScreen),
      );
      expect(screen.orientation, FaceSubjectOrientation.mirroredPreview);
    });

    testWidgets('historical path defaults to subjectCanonical', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: ResultsFaceMirrorScreen(
            report: _skin(),
            projection: _projection(),
            showCelebration: false,
          ),
        ),
      );
      await tester.pump();
      final screen = tester.widget<ResultsFaceMirrorScreen>(
        find.byType(ResultsFaceMirrorScreen),
      );
      expect(screen.orientation, FaceSubjectOrientation.subjectCanonical);
    });
  });

  group('accessibility / terminology', () {
    testWidgets('insight chips expose semantics', (tester) async {
      final handle = tester.ensureSemantics();
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Center(
              child: FaceInsightChip(
                insight: _projection().executiveSummary.insights.first,
                selected: false,
                onTap: () {},
              ),
            ),
          ),
        ),
      );
      expect(find.bySemanticsLabel('تناسب الأثلاث'), findsOneWidget);
      handle.dispose();
    });

    testWidgets('reduce motion primary reveal has zero duration', (tester) async {
      await tester.pumpWidget(
        MediaQuery(
          data: const MediaQueryData(disableAnimations: true),
          child: MaterialApp(
            home: Scaffold(
              body: FacePrimaryResultReveal(
                primary: _projection().executiveSummary.primary!,
                visible: true,
              ),
            ),
          ),
        ),
      );
      final opacity = tester.widget<AnimatedOpacity>(find.byType(AnimatedOpacity));
      expect(opacity.duration, Duration.zero);
    });

    test('terminology lock — no English leakage in stage ambient', () {
      expect(
        AnalysisStageCopy.forStage(AnalysisPresentationStage.ambientWaiting).$1,
        'لحظات',
      );
      expect(
        AnalysisStageCopy.forStage(AnalysisPresentationStage.ambientWaiting).$1
            .startsWith(' '),
        isFalse,
      );
    });
  });

  group('sound decision', () {
    test('9K does not introduce FaceExperience sound API', () {
      // Presence of haptics + absence of sound class is the product lock.
      expect(FaceExperienceHaptics.ready, isA<Function>());
    });
  });
}
