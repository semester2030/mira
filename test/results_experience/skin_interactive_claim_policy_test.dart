import 'package:flutter_test/flutter_test.dart';

import 'package:mirra/features/results_experience/contracts/result_enums.dart';
import 'package:mirra/features/results_experience/contracts/result_presentation_vms.dart';
import 'package:mirra/features/results_experience/localization/public_language_policy.dart';
import 'package:mirra/features/results_experience/truth/skin_claim_policy.dart';
import 'package:mirra/features/results_experience/truth/skin_truth_class.dart';

void main() {
  group('SkinClaimPolicy', () {
    test('map truth is Perfect provider mask / measured', () {
      expect(SkinClaimPolicy.mapTruthVerdict, 'PROVIDER_PIXEL_MASK');
      expect(SkinClaimPolicy.mapTruthClass, SkinTruthClass.measured);
    });

    test('skin age never allowed on main report', () {
      expect(SkinClaimPolicy.allowSkinAgeOnMain(_emptyExperience()), isFalse);
    });

    test('forbidden main claims catch age and 30-day goal copy', () {
      expect(
        SkinClaimPolicy.containsForbiddenMainClaim('بشرتك تبدو 30'),
        isTrue,
      );
      expect(
        SkinClaimPolicy.containsForbiddenMainClaim('أصغر بـ 9 سنوات'),
        isTrue,
      );
      expect(
        SkinClaimPolicy.containsForbiddenMainClaim('هدفنا الوصول إلى 72'),
        isTrue,
      );
      expect(
        SkinClaimPolicy.containsForbiddenMainClaim('تحسن متوقع +4'),
        isTrue,
      );
      expect(
        SkinClaimPolicy.containsForbiddenMainClaim('provider_measured'),
        isTrue,
      );
      expect(
        SkinClaimPolicy.containsForbiddenMainClaim('الترطيب — جيد'),
        isFalse,
      );
    });

    test('journey headline strips motivational goal copy', () {
      final out = SkinClaimPolicy.sanitizeJourneyHeadlineAr(
        'هدفنا القادم: الوصول إلى 72 خلال 30 يوماً',
      );
      expect(out.contains('هدفنا'), isFalse);
      expect(out.contains('72'), isFalse);
    });

    test('linear projection copy only when visible estimate exists', () {
      final blocked = SkinClaimPolicy.linearProjectionCopyAr(
        _progress(projectionVisible: false, estimate: 72),
      );
      expect(blocked, isNull);

      final allowed = SkinClaimPolicy.linearProjectionCopyAr(
        _progress(projectionVisible: true, estimate: 72),
      );
      expect(allowed, isNotNull);
      expect(allowed!.contains('تقدير خطي'), isTrue);
      expect(allowed.contains('هدفنا'), isFalse);
    });

    test('public language policy still blocks technical leaks', () {
      expect(
        PublicLanguagePolicy.validate('raw=0.2615', field: 'main').isNotEmpty,
        isTrue,
      );
    });
  });
}

ResultProgressPreviewVM _progress({
  required bool projectionVisible,
  int? estimate,
}) {
  return ResultProgressPreviewVM(
    id: 'progress_entry',
    titleAr: 'تقدمك',
    summaryAr: 'ملخص',
    confidence: ConfidenceState.medium,
    evidenceRef: 'progress:test',
    visibility: VisibilityState.visiblePrimary,
    interaction: InteractionState.none,
    limitation: LimitationState.estimateOnly,
    comparability: ProgressComparabilityState.comparable,
    deltaVisible: false,
    projectionVisible: projectionVisible,
    projectionEstimate: estimate,
  );
}

ResultExperience _emptyExperience() {
  const score = ResultScoreView(
    category: ScoreCategory.wellnessScore,
    direction: ScoreDirection.higherBetter,
    value: 70,
    statusLabelAr: 'جيد',
    colorRole: ColorRole.wellness,
    numericVisible: true,
    accessibilityTextAr: '70',
  );
  const summary = ResultSummaryVM(
    id: 'summary',
    titleAr: 'ملخص',
    summaryAr: 'ملخص',
    confidence: ConfidenceState.medium,
    evidenceRef: 's',
    visibility: VisibilityState.visiblePrimary,
    interaction: InteractionState.none,
    limitation: LimitationState.none,
    vitality: score,
    skinTypeAr: 'مختلطة',
    headlineAr: 'ملخص',
  );
  const confidence = ResultConfidenceVM(
    id: 'confidence_overall',
    titleAr: 'ثقة',
    summaryAr: 'ثقة',
    confidence: ConfidenceState.medium,
    evidenceRef: 'c',
    visibility: VisibilityState.visibleSecondary,
    interaction: InteractionState.none,
    limitation: LimitationState.none,
    overall: ConfidenceState.medium,
    retakeSuggested: false,
  );
  const map = ResultMapVM(
    id: 'map',
    titleAr: 'خريطة',
    summaryAr: 'إرشادية',
    confidence: ConfidenceState.low,
    evidenceRef: 'm',
    visibility: VisibilityState.visiblePrimary,
    interaction: InteractionState.none,
    limitation: LimitationState.illustrativeOnly,
    mode: MapPresentationMode.illustrativeUserImage,
    badgeAr: 'توضيحي',
    explanationAr: 'توضيح',
    concerns: [],
    overlayType: 'illustrative',
    interactionEligible: false,
  );
  const progress = ResultProgressPreviewVM(
    id: 'progress_entry',
    titleAr: 'تقدمك',
    summaryAr: 'بداية',
    confidence: ConfidenceState.medium,
    evidenceRef: 'p',
    visibility: VisibilityState.visiblePrimary,
    interaction: InteractionState.none,
    limitation: LimitationState.none,
    comparability: ProgressComparabilityState.insufficientHistory,
    deltaVisible: false,
    projectionVisible: false,
  );
  const advisor = ResultAdvisorEntryVM(
    id: 'advisor',
    titleAr: 'اسألي ميرا',
    summaryAr: 'سياق',
    confidence: ConfidenceState.medium,
    evidenceRef: 'a',
    visibility: VisibilityState.visiblePrimary,
    interaction: InteractionState.navigable,
    limitation: LimitationState.none,
    publicNameAr: 'مستشار ميرا',
    suggestedQuestions: [],
  );
  const skinAge = ResultSkinAgeVM(
    id: 'skin_age',
    titleAr: 'عمر',
    summaryAr: 'تقدير',
    confidence: ConfidenceState.medium,
    evidenceRef: 'sa',
    visibility: VisibilityState.hiddenLowConfidence,
    interaction: InteractionState.none,
    limitation: LimitationState.estimateOnly,
    estimateYears: 30,
    qualificationAr: 'تقدير',
    eligibleForSecondary: true,
  );
  const personalPlan = ResultPersonalPlanVM(
    id: 'plan',
    titleAr: 'خطة',
    summaryAr: 'خطة',
    confidence: ConfidenceState.medium,
    evidenceRef: 'pl',
    visibility: VisibilityState.visiblePrimary,
    interaction: InteractionState.navigable,
    limitation: LimitationState.none,
    focusAr: 'ترطيب',
    activeStepCount: 0,
    primaryObjectiveAr: 'عناية',
    isLimited: true,
    reviewGuidanceAr: '',
    morning: ResultRoutinePeriodVM(
      period: RoutinePeriod.morning,
      titleAr: 'صباحًا',
      steps: [],
    ),
    evening: ResultRoutinePeriodVM(
      period: RoutinePeriod.evening,
      titleAr: 'مساءً',
      steps: [],
    ),
    weekly: null,
    avoidances: [],
    advisorEntry: ResultRoutineAdvisorEntryVM(
      publicNameAr: 'مستشار ميرا',
      suggestedQuestions: [],
      visibility: VisibilityState.visiblePrimary,
    ),
    todayStepId: null,
    eligible: false,
  );
  const routinePreview = ResultRoutinePreviewVM(
    id: 'routine',
    titleAr: 'روتين',
    summaryAr: 'روتين',
    confidence: ConfidenceState.medium,
    evidenceRef: 'r',
    visibility: VisibilityState.visiblePrimary,
    interaction: InteractionState.navigable,
    limitation: LimitationState.none,
    morningCount: 0,
    eveningCount: 0,
    hasSteps: false,
  );
  const retake = ResultRetakeVM(
    id: 'retake',
    titleAr: 'إعادة',
    summaryAr: '',
    confidence: ConfidenceState.medium,
    evidenceRef: 'rt',
    visibility: VisibilityState.hiddenLowConfidence,
    interaction: InteractionState.none,
    limitation: LimitationState.none,
    suggested: false,
  );

  return ResultExperience(
    id: 'test',
    projectionVersion: 'test',
    flagVariant: 'test',
    summary: summary,
    priorities: const [],
    immediateAction: null,
    routinePreview: routinePreview,
    personalPlan: personalPlan,
    progressPreview: progress,
    advisorEntry: advisor,
    metrics: const [],
    map: map,
    products: const [],
    confidence: confidence,
    limitations: const [],
    disclosures: const [],
    retake: retake,
    skinAge: skinAge,
    firstSurfaceIds: const [],
    ownedAdviceConceptIds: const [],
  );
}
