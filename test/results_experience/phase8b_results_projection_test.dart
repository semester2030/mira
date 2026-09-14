import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/results_experience/results_experience.dart';

void main() {
  const projector = ResultExperienceProjector();
  final context = ResultProjectionContext(
    now: DateTime.utc(2026, 7, 20, 12),
    flagVariant: 'legacy',
  );

  ResultProjectionInput base({
    List<FrozenPriorityInput>? priorities,
    List<FrozenMetricInput>? metrics,
    List<FrozenProductInput>? products,
    FrozenProgressInput? progress,
    int? skinAgeYears,
    String? skinAgeConfidenceLevel,
    int confidence = 80,
    List<FrozenAdvisorClaimInput>? claims,
  }) {
    return ResultProjectionInput(
      analysisId: 'a1',
      vitalityScore: 72,
      skinTypeAr: 'مختلطة',
      headlineAr: 'بشرتك تحتاج ترطيباً ألطف',
      summaryAr: 'ملخص واضح من التحليل',
      overallConfidencePercent: confidence,
      priorities: priorities ??
          const [
            FrozenPriorityInput(
              id: 'p1',
              metricId: 'moisture',
              titleAr: 'الترطيب',
              evidenceAr: 'انخفاض ملحوظ في الترطيب',
              severity: 'moderate',
              confidenceLevel: 'high',
              actionHintAr: 'رطّبي صباحاً ومساءً',
            ),
            FrozenPriorityInput(
              id: 'p2',
              metricId: 'pore',
              titleAr: 'المسام',
              evidenceAr: 'مظهر المسام أوضح في مناطق شائعة',
              severity: 'mild',
              confidenceLevel: 'medium',
            ),
            FrozenPriorityInput(
              id: 'p3',
              metricId: 'redness',
              titleAr: 'الاحمرار',
              evidenceAr: 'احمرار خفيف',
              severity: 'mild',
              confidenceLevel: 'medium',
            ),
            FrozenPriorityInput(
              id: 'p4',
              metricId: 'acne',
              titleAr: 'الحبوب',
              evidenceAr: 'يجب ألا يظهر كأولوية رابعة',
              severity: 'noticeable',
              confidenceLevel: 'high',
            ),
          ],
      metrics: metrics ??
          const [
            FrozenMetricInput(
              id: 'moisture',
              displayNameAr: 'الترطيب',
              available: true,
              normalizedWellnessValue: 55,
              confidencePercent: 70,
              reasonAr: 'يحتاج عناية',
            ),
            FrozenMetricInput(
              id: 'missing',
              displayNameAr: 'غير متاح',
              available: false,
              confidencePercent: 0,
            ),
          ],
      products: products ??
          const [
            FrozenProductInput(
              id: 'prod75',
              nameAr: 'مرطب تجريبي',
              brandAr: 'شريك',
              matchScore: 78,
              linkedConcernAr: 'الترطيب',
              hasRecommendationReason: true,
              recommendationReasonAr: 'يدعم الترطيب اليومي',
              stepAr: 'صباحاً',
              disclosure: 'partner',
            ),
            FrozenProductInput(
              id: 'prod70',
              nameAr: 'بديل',
              brandAr: 'شريك',
              matchScore: 70,
              linkedConcernAr: 'الترطيب',
              hasRecommendationReason: true,
              recommendationReasonAr: 'بديل محتمل',
              disclosure: 'partner',
            ),
            FrozenProductInput(
              id: 'prod50',
              nameAr: 'مخفي',
              brandAr: 'شريك',
              matchScore: 50,
              linkedConcernAr: 'الترطيب',
              hasRecommendationReason: true,
              recommendationReasonAr: 'لا يُعرض',
              disclosure: 'partner',
            ),
            FrozenProductInput(
              id: 'prodNoEv',
              nameAr: 'بلا دليل',
              brandAr: 'شريك',
              matchScore: 90,
              hasRecommendationReason: false,
              disclosure: 'partner',
            ),
          ],
      progress: progress ??
          const FrozenProgressInput(
            scanCount: 1,
            hasBaseline: false,
          ),
      advisorClaims: claims ??
          const [
            FrozenAdvisorClaimInput(
              id: 'c1',
              statementAr: 'احتياج الترطيب',
              available: true,
            ),
          ],
      morningStepCount: 3,
      eveningStepCount: 2,
      skinAgeYears: skinAgeYears ?? 28,
      skinAgeConfidenceLevel: skinAgeConfidenceLevel ?? 'high',
      mapEnabled: true,
      mapConcernIds: const ['moisture'],
    );
  }

  test('feature flag defaults to legacy', () {
    expect(MiraResultsExperienceFlag.defaults.isLegacy, isTrue);
    expect(MiraResultsExperienceFlag.defaults.isResultsV2, isFalse);
    expect(
      MiraResultsExperienceFlag.fromConfigValue(null).isLegacy,
      isTrue,
    );
    expect(
      MiraResultsExperienceFlag.fromConfigValue('results_v2').isResultsV2,
      isTrue,
    );
  });

  test('score directions: wellness higher-better, severity higher-worse', () {
    final exp = projector.project(base(), context);
    expect(exp.summary.vitality.direction, ScoreDirection.higherBetter);
    expect(exp.summary.vitality.colorRole, ColorRole.wellness);
    final sev = exp.metrics.first.severityOrWellness!;
    expect(sev.category, ScoreCategory.concernSeverity);
    expect(sev.direction, ScoreDirection.higherWorse);
    expect(sev.colorRole, isNot(ColorRole.wellness));
    // wellness 55 → severity 45
    expect(sev.value, 45);
  });

  test('high concern severity is not rendered as positive wellness', () {
    final exp = projector.project(
      base(
        metrics: const [
          FrozenMetricInput(
            id: 'acne',
            displayNameAr: 'مظهر الحبوب',
            available: true,
            normalizedWellnessValue: 30,
            confidencePercent: 80,
          ),
        ],
      ),
      context,
    );
    final sev = exp.metrics.first.severityOrWellness!;
    expect(sev.value, 70);
    expect(sev.colorRole, ColorRole.severity);
    expect(
      ScoreSemanticsContract.isPositiveAppearanceForbidden(sev.category),
      isTrue,
    );
  });

  test('confidence separated from condition', () {
    final exp = projector.project(base(), context);
    expect(exp.confidence.titleAr, isNot(exp.summary.titleAr));
    expect(exp.summary.vitality.colorRole, isNot(ColorRole.confidence));
    expect(exp.confidence.overall, ConfidenceState.high);
  });

  test('max three priorities and no filler', () {
    final exp = projector.project(base(), context);
    expect(exp.priorities.length, 3);
    expect(exp.priorities.map((p) => p.rank).toList(), [1, 2, 3]);
    expect(
      exp.priorities.every(
        (p) => p.personalization == PersonalizationClass.evidenceDerived,
      ),
      isTrue,
    );
  });

  test('fewer than three priorities when evidence lacking', () {
    final exp = projector.project(
      base(
        priorities: const [
          FrozenPriorityInput(
            id: 'only',
            metricId: 'moisture',
            titleAr: 'الترطيب',
            evidenceAr: 'دليل',
            severity: 'mild',
            confidenceLevel: 'high',
          ),
          FrozenPriorityInput(
            id: 'none',
            metricId: 'x',
            titleAr: 'متوازن',
            evidenceAr: 'لا أولوية',
            severity: 'none',
            confidenceLevel: 'high',
          ),
        ],
      ),
      context,
    );
    expect(exp.priorities.length, 1);
  });

  test('general advice classification labels', () {
    expect(
      PersonalizationLabels.ar(PersonalizationClass.generalEducation),
      'إرشاد عام',
    );
    expect(
      PersonalizationLabels.ar(PersonalizationClass.evidenceDerived),
      'بناءً على تحليلك',
    );
    expect(
      PersonalizationPolicy.mayPresent(PersonalizationClass.unsupported),
      isFalse,
    );
  });

  test('internal terminology rejected', () {
    expect(
      PublicLanguagePolicy.isPublicSafe(
        'provider_measured raw=1',
        field: 't',
      ),
      isFalse,
    );
    expect(PublicLanguagePolicy.sanitize('MCE Trends'), isNot(contains('MCE')));
    expect(PublicLanguagePolicy.sanitize('MCE Trends'), isNot(contains('Trends')));
  });

  test('Mode B wording and no measured heatmap claim', () {
    final exp = projector.project(base(), context);
    expect(exp.map.mode, MapPresentationMode.illustrativeUserImage);
    expect(exp.map.titleAr, 'خريطة إرشادية للبشرة');
    expect(exp.map.badgeAr, 'توضيح إرشادي');
    expect(exp.map.explanationAr, contains('توضيحية'));
    expect(exp.map.explanationAr.toLowerCase(), isNot(contains('heatmap')));
    expect(exp.map.limitation, LimitationState.illustrativeOnly);
  });

  test('product thresholds', () {
    final exp = projector.project(base(), context);
    final rec =
        exp.products.firstWhere((p) => p.id == 'product_prod75');
    final alt =
        exp.products.firstWhere((p) => p.id == 'product_prod70');
    final hid =
        exp.products.firstWhere((p) => p.id == 'product_prod50');
    final noEv =
        exp.products.firstWhere((p) => p.id == 'product_prodNoEv');
    expect(rec.state, ProductRecommendationState.recommended);
    expect(alt.state, ProductRecommendationState.possibleAlternative);
    expect(hid.state, ProductRecommendationState.hidden);
    expect(noEv.state, ProductRecommendationState.insufficientEvidence);
    expect(noEv.matchNumericVisible, isFalse);
  });

  test('Skin Age secondary-only', () {
    final exp = projector.project(base(), context);
    expect(exp.skinAge.visibility, isNot(VisibilityState.visiblePrimary));
    expect(
      VisibilityPolicy.firstSurfaceIncludesSkinAge(exp.firstSurfaceIds),
      isFalse,
    );
    expect(exp.skinAge.qualificationAr, contains('تجميلي'));
    final hidden = projector.project(
      base(skinAgeConfidenceLevel: 'unavailable', skinAgeYears: 28),
      context,
    );
    expect(hidden.skinAge.eligibleForSecondary, isFalse);
  });

  test('progress comparability — no fabricated trends', () {
    final insufficient = projector.project(base(), context);
    expect(
      insufficient.progressPreview.comparability,
      ProgressComparabilityState.insufficientHistory,
    );
    expect(insufficient.progressPreview.deltaVisible, isFalse);
    expect(insufficient.progressPreview.projectionVisible, isFalse);

    final ok = projector.project(
      base(
        progress: const FrozenProgressInput(
          scanCount: 2,
          hasBaseline: true,
          deltaPoints: 4,
          projectedScore30Days: 76,
          metricCompatible: true,
          modelVersionCompatible: true,
          captureQualityCompatible: true,
          confidenceAdequate: true,
          intervalDays: 14,
        ),
      ),
      context,
    );
    expect(ok.progressPreview.comparability, ProgressComparabilityState.comparable);
    expect(ok.progressPreview.deltaVisible, isTrue);
    expect(ok.progressPreview.projectionLabelAr, contains('تقدير'));
  });

  test('Advisor questions grounded; no MCE; general marked', () {
    final exp = projector.project(base(), context);
    expect(exp.advisorEntry.publicNameAr, 'مستشار ميرا');
    expect(exp.advisorEntry.titleAr.toLowerCase(), isNot(contains('mce')));
    expect(
      exp.advisorEntry.suggestedQuestions.any(
        (q) =>
            q.personalization == PersonalizationClass.evidenceDerived &&
            q.evidenceRef.isNotEmpty,
      ),
      isTrue,
    );
    expect(
      exp.advisorEntry.suggestedQuestions.any(
        (q) => q.personalization == PersonalizationClass.generalEducation,
      ),
      isTrue,
    );
  });

  test('first-surface contract limits', () {
    final exp = projector.project(base(), context);
    expect(exp.firstSurfaceIds, contains('summary'));
    expect(exp.firstSurfaceIds, contains('immediate_action'));
    expect(exp.firstSurfaceIds, contains('routine_entry'));
    expect(exp.firstSurfaceIds, contains('progress_entry'));
    expect(exp.firstSurfaceIds, contains('advisor_entry'));
    expect(exp.priorities.length <= 3, isTrue);
  });

  test('deterministic projection', () {
    final a = projector.project(base(), context);
    final b = projector.project(base(), context);
    expect(a.priorities.map((p) => p.id).toList(),
        b.priorities.map((p) => p.id).toList());
    expect(a.firstSurfaceIds, b.firstSurfaceIds);
    expect(a.products.map((p) => p.state).toList(),
        b.products.map((p) => p.state).toList());
    expect(a.projectionVersion, ResultsExperienceVersions.resultsProjection);
  });

  test('duplicate advice concept detection', () {
    expect(
      AdviceOwnershipPolicy.findDuplicateOwners(['hydration', 'hydration']),
      ['hydration'],
    );
    final exp = projector.project(base(), context);
    expect(
      AdviceOwnershipPolicy.findDuplicateOwners(exp.ownedAdviceConceptIds),
      isEmpty,
    );
  });

  test('validators pass for golden projection', () {
    final exp = projector.project(base(), context);
    final result = ResultExperienceValidators.validate(exp);
    expect(result.isValid, isTrue, reason: result.issues.toString());
  });

  test('validators fail on internal language injection via map title override simulation',
      () {
    final violations = PublicLanguagePolicy.validate(
      'Uses provider_measured and MCE',
      field: 'x',
    );
    expect(violations, isNotEmpty);
  });

  test('Arabic public copy present on summary and map', () {
    final exp = projector.project(base(), context);
    expect(exp.summary.titleAr, isNotEmpty);
    expect(exp.map.explanationAr.contains(RegExp(r'[\u0600-\u06FF]')), isTrue);
  });

}
