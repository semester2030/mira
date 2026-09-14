import '../contracts/result_enums.dart';
import '../contracts/result_presentation_vms.dart';
import '../flags/mira_results_experience_flag.dart';
import '../localization/confidence_labels.dart';
import '../localization/personalization_labels.dart';
import '../localization/public_language_policy.dart';
import '../semantics/score_semantics_contract.dart';
import '../versioning/results_experience_versions.dart';
import '../visibility/advice_ownership_policy.dart';
import '../semantics/personal_plan_policy.dart';
import '../semantics/metric_presentation_policy.dart';
import '../visibility/visibility_policy.dart';
import 'result_projection_input.dart';

/// Deterministic Result Projection Layer.
/// Selects / labels / hides — never recalculates frozen intelligence.
class ResultExperienceProjector {
  const ResultExperienceProjector();

  ResultExperience project(
    ResultProjectionInput input,
    ResultProjectionContext context,
  ) {
    final confidence = ConfidencePresentationContract.fromPercent(
      input.overallConfidencePercent,
    );
    final confidenceSpec =
        ConfidencePresentationContract.forState(confidence);

    final summary = _summary(input, confidence);
    final priorities = _priorities(input);
    final metrics = _metrics(input);
    final personalPlan = _personalPlan(input, priorities, confidence);
    final immediate = _immediateAction(input, priorities, personalPlan, confidence);
    final routine = _routine(input, personalPlan, confidence);
    final progress = _progress(input, confidence);
    final map = _map(input, confidence);
    final products = _products(input, confidence);
    final skinAge = _skinAge(input, confidence);
    final advisor = _advisor(input, priorities, confidence);
    final retake = _retake(input, confidence, confidenceSpec);
    final confidenceVm = ResultConfidenceVM(
      id: 'confidence_overall',
      titleAr: 'ثقة التحليل',
      summaryAr: confidenceSpec.explanationAr,
      confidence: confidence,
      evidenceRef: 'confidence:${input.analysisId}',
      visibility: VisibilityState.visibleSecondary,
      interaction: InteractionState.expandable,
      limitation: confidence == ConfidenceState.low
          ? LimitationState.lowConfidence
          : LimitationState.none,
      overall: confidence,
      retakeSuggested: confidenceSpec.retakeEligible,
    );
    final disclosures = [
      ResultDisclosureVM(
        id: 'disclosure_cosmetic',
        titleAr: 'إخلاء مسؤولية',
        summaryAr: PublicLanguagePolicy.sanitize(input.disclaimerAr),
        confidence: ConfidenceState.high,
        evidenceRef: 'disclosure:cosmetic',
        visibility: VisibilityState.visibleSecondary,
        interaction: InteractionState.expandable,
        limitation: LimitationState.advisory,
      ),
    ];
    final limitations = <ResultLimitationVM>[
      if (confidence == ConfidenceState.low ||
          confidence == ConfidenceState.unavailable)
        ResultLimitationVM(
          id: 'limitation_confidence',
          titleAr: 'حدود الثقة',
          summaryAr: confidenceSpec.explanationAr,
          confidence: confidence,
          evidenceRef: 'limitation:confidence',
          visibility: VisibilityState.visibleDetails,
          interaction: InteractionState.none,
          limitation: LimitationState.lowConfidence,
        ),
    ];

    final owned = <String>[
      if (immediate != null) immediate.adviceConceptId,
      ...PersonalPlanPolicy.ownedConceptsFromPlan(personalPlan),
      ...priorities.map((p) => 'priority_${p.id}'),
    ];

    final firstSurface = VisibilityPolicy.buildFirstSurfaceIds(
      summary: summary,
      priorities: priorities,
      action: immediate,
      routine: routine,
      progress: progress,
      advisor: advisor,
    );

    VisibilityPolicy.assertFirstSurfaceContract(
      priorities: priorities,
      firstSurfaceIds: firstSurface,
      skinAge: skinAge,
    );

    final experience = ResultExperience(
      id: 'result_${input.analysisId}',
      projectionVersion: ResultsExperienceVersions.resultsProjection,
      flagVariant: context.flagVariant,
      summary: summary,
      priorities: priorities,
      immediateAction: immediate,
      routinePreview: routine,
      personalPlan: personalPlan,
      progressPreview: progress,
      advisorEntry: advisor,
      metrics: metrics,
      map: map,
      products: products,
      confidence: confidenceVm,
      limitations: limitations,
      disclosures: disclosures,
      retake: retake,
      skinAge: skinAge,
      firstSurfaceIds: firstSurface,
      ownedAdviceConceptIds: owned,
    );

    return experience;
  }

  ResultSummaryVM _summary(
    ResultProjectionInput input,
    ConfidenceState confidence,
  ) {
    final score = input.vitalityScore.toDouble().clamp(0, 100).toDouble();
    final status = ScoreSemanticsContract.wellnessStatusAr(score);
    return ResultSummaryVM(
      id: 'summary',
      titleAr: ScoreSemanticsContract.wellness.publicLabelAr,
      summaryAr: PublicLanguagePolicy.sanitize(input.summaryAr).isEmpty
          ? PublicLanguagePolicy.sanitize(input.headlineAr)
          : PublicLanguagePolicy.sanitize(input.summaryAr),
      confidence: confidence,
      evidenceRef: 'vitality:${input.analysisId}',
      visibility: VisibilityState.visiblePrimary,
      interaction: InteractionState.tappable,
      limitation: LimitationState.none,
      vitality: ResultScoreView(
        category: ScoreCategory.wellnessScore,
        direction: ScoreDirection.higherBetter,
        value: score,
        statusLabelAr: status,
        colorRole: ColorRole.wellness,
        numericVisible: true,
        accessibilityTextAr:
            '${ScoreSemanticsContract.wellness.accessibilityHintAr}. $status',
      ),
      skinTypeAr: input.skinTypeAr,
      headlineAr: PublicLanguagePolicy.sanitize(input.headlineAr),
    );
  }

  List<ResultPriorityVM> _priorities(ResultProjectionInput input) {
    final eligible = input.priorities.where((p) {
      final sev = p.severity.toLowerCase();
      return sev != 'none' && sev.isNotEmpty;
    }).toList();

    final out = <ResultPriorityVM>[];
    var rank = 1;
    for (final p in eligible.take(VisibilityPolicy.maxPriorities)) {
      final conf = ConfidencePresentationContract.fromLegacyLevel(
        p.confidenceLevel,
      );
      final action = p.actionHintAr?.trim().isNotEmpty == true
          ? p.actionHintAr!.trim()
          : 'ابدئي بخطوة عناية واحدةحدة مرتبطة بهذا الاحتياج';
      out.add(
        ResultPriorityVM(
          id: 'priority_$rank',
          titleAr: PublicLanguagePolicy.sanitize(p.titleAr),
          summaryAr: PublicLanguagePolicy.sanitize(p.evidenceAr),
          confidence: conf,
          evidenceRef: 'priority:${p.id}',
          visibility: VisibilityState.visiblePrimary,
          interaction: InteractionState.tappable,
          limitation: conf == ConfidenceState.low
              ? LimitationState.lowConfidence
              : LimitationState.none,
          rank: rank,
          concernLabelAr: PublicLanguagePolicy.sanitize(p.titleAr),
          actionId: 'action_${p.metricId.isEmpty ? p.id : p.metricId}',
          actionLabelAr: PublicLanguagePolicy.sanitize(action),
          eligibilityReasonAr: 'من أولويات التحليل المتاحة',
          personalization: PersonalizationClass.evidenceDerived,
          analyticsId: 'results_priority_$rank',
        ),
      );
      rank++;
    }
    return List.unmodifiable(out);
  }

  List<ResultMetricVM> _metrics(ResultProjectionInput input) {
    return input.metrics.map((m) {
      if (!m.available || m.normalizedWellnessValue == null) {
        return ResultMetricVM(
          id: 'metric_${m.id}',
          titleAr: m.displayNameAr,
          summaryAr: 'هذا المؤشر غير متاح حالياً',
          confidence: ConfidenceState.unavailable,
          evidenceRef: 'metric:${m.id}',
          visibility: VisibilityState.hiddenMissingEvidence,
          interaction: InteractionState.disabled,
          limitation: LimitationState.missingEvidence,
          condition: null,
          severityOrWellness: null,
          statusLabelAr: 'غير متاح',
          explanationAr: 'لا نقدّر بديلاً عند غياب الدليل',
          evidenceAvailable: false,
          comparisonEligible: false,
        );
      }

      final wellness = m.normalizedWellnessValue!.clamp(0, 100).toDouble();
      final severity =
          ScoreSemanticsContract.wellnessUiToSeverity(wellness);
      final conf =
          ConfidencePresentationContract.fromPercent(m.confidencePercent);
      final status = ScoreSemanticsContract.concernSeverityStatusAr(severity);
      final explanation = PublicLanguagePolicy.sanitize(
        m.reasonAr?.trim().isNotEmpty == true
            ? m.reasonAr!
            : (m.levelAr ?? status),
      );

      return ResultMetricVM(
        id: 'metric_${m.id}',
        titleAr: m.displayNameAr,
        summaryAr: explanation,
        confidence: conf,
        evidenceRef: 'metric:${m.id}',
        visibility: VisibilityState.visibleDetails,
        interaction: InteractionState.expandable,
        limitation: LimitationState.none,
        condition: ResultScoreView(
          category: ScoreCategory.wellnessScore,
          direction: ScoreDirection.higherBetter,
          value: wellness,
          statusLabelAr: ScoreSemanticsContract.wellnessStatusAr(wellness),
          colorRole: ColorRole.wellness,
          numericVisible: true,
          accessibilityTextAr:
              ScoreSemanticsContract.wellness.accessibilityHintAr,
        ),
        severityOrWellness: ResultScoreView(
          category: ScoreCategory.concernSeverity,
          direction: ScoreDirection.higherWorse,
          value: severity,
          statusLabelAr: status,
          colorRole: ColorRole.severity,
          numericVisible: true,
          accessibilityTextAr:
              ScoreSemanticsContract.concernSeverity.accessibilityHintAr,
        ),
        statusLabelAr: status,
        explanationAr: explanation,
        recommendedActionAr: MetricPresentationPolicy.actionForId(m.id),
        evidenceAvailable: true,
        comparisonEligible: conf != ConfidenceState.unavailable,
      );
    }).toList(growable: false);
  }

  ResultActionVM? _immediateAction(
    ResultProjectionInput input,
    List<ResultPriorityVM> priorities,
    ResultPersonalPlanVM plan,
    ConfidenceState confidence,
  ) {
    if (!plan.eligible || plan.todayStepId == null) {
      if (priorities.isEmpty) return null;
      // No routine step — safe unavailable today action omitted (no filler).
      return null;
    }
    final step = [...plan.morning.steps, ...plan.evening.steps]
        .where((s) => s.id == plan.todayStepId)
        .firstOrNull;
    if (step == null) return null;

    return ResultActionVM(
      id: 'immediate_action',
      titleAr: 'خطوتك اليوم',
      summaryAr: step.instructionAr.isNotEmpty ? step.instructionAr : step.titleAr,
      confidence: step.confidence,
      evidenceRef: step.evidenceRef,
      visibility: VisibilityState.visiblePrimary,
      interaction: InteractionState.tappable,
      limitation: plan.isLimited
          ? LimitationState.lowConfidence
          : LimitationState.none,
      personalization: step.personalization,
      adviceConceptId: 'today_focus',
      owner: AdviceOwner.immediateAction,
      avoidAr: const [],
      routineStepId: step.id,
    );
  }

  ResultRoutinePreviewVM _routine(
    ResultProjectionInput input,
    ResultPersonalPlanVM plan,
    ConfidenceState confidence,
  ) {
    final has = plan.eligible && plan.activeStepCount > 0;
    return ResultRoutinePreviewVM(
      id: 'routine_entry',
      titleAr: 'روتينك',
      summaryAr: has
          ? 'خطة عناية شخصية — صباح ومساء'
          : 'الروتين غير متاح حالياً',
      confidence: confidence,
      evidenceRef: 'routine:${input.analysisId}',
      visibility: has
          ? VisibilityState.visiblePrimary
          : VisibilityState.unavailable,
      interaction:
          has ? InteractionState.navigable : InteractionState.disabled,
      limitation: has
          ? (plan.isLimited
              ? LimitationState.lowConfidence
              : LimitationState.none)
          : LimitationState.missingEvidence,
      morningCount: plan.morning.steps.length,
      eveningCount: plan.evening.steps.length,
      hasSteps: has,
    );
  }

  ResultPersonalPlanVM _personalPlan(
    ResultProjectionInput input,
    List<ResultPriorityVM> priorities,
    ConfidenceState confidence,
  ) {
    final morningRaw = input.morningSteps.isNotEmpty
        ? input.morningSteps
        : List.generate(
            input.morningStepCount,
            (i) => FrozenRoutineStepInput(
              id: 'morning_$i',
              nameAr: 'خطوة صباحية',
              instructionAr: '',
              period: 'am',
            ),
          );
    final eveningRaw = input.eveningSteps.isNotEmpty
        ? input.eveningSteps
        : List.generate(
            input.eveningStepCount,
            (i) => FrozenRoutineStepInput(
              id: 'evening_$i',
              nameAr: 'خطوة مسائية',
              instructionAr: '',
              period: 'pm',
            ),
          );

    // Do not invent filler when counts exist without step payloads and count is 0.
    final morningSelected = PersonalPlanPolicy.selectPeriodSteps(
      raw: morningRaw.where((s) => s.nameAr != 'خطوة صباحية' || s.instructionAr.isNotEmpty).toList(),
      confidence: confidence,
      max: PersonalPlanPolicy.maxMorningSteps,
    );
    // If only counts were provided (legacy tests), synthesize barrier-safe caps from counts.
    final morningFinal = morningSelected.isNotEmpty
        ? morningSelected
        : _synthesizeFromCount(
            count: input.morningStepCount.clamp(0, PersonalPlanPolicy.maxMorningSteps),
            period: 'am',
            confidence: confidence,
          );
    final eveningSelected = PersonalPlanPolicy.selectPeriodSteps(
      raw: eveningRaw
          .where((s) => s.nameAr != 'خطوة مسائية' || s.instructionAr.isNotEmpty)
          .toList(),
      confidence: confidence,
      max: PersonalPlanPolicy.maxEveningSteps,
    );
    final eveningFinal = eveningSelected.isNotEmpty
        ? eveningSelected
        : _synthesizeFromCount(
            count: input.eveningStepCount.clamp(0, PersonalPlanPolicy.maxEveningSteps),
            period: 'pm',
            confidence: confidence,
          );

    final hasMetricEvidence = input.metrics.any((m) => m.available) ||
        priorities.isNotEmpty;

    ResultRoutineStepVM mapStep(
      FrozenRoutineStepInput s,
      RoutinePeriod period,
      int sequence,
    ) {
      final concept = PersonalPlanPolicy.conceptForStep(s);
      final pers = PersonalPlanPolicy.classifyStep(
        step: s,
        hasMetricEvidence: hasMetricEvidence,
        confidence: confidence,
      );
      final reason = PersonalPlanPolicy.reasonForStep(
        concept: concept,
        priorities: input.priorities,
        confidence: confidence,
      );
      return ResultRoutineStepVM(
        id: s.id,
        titleAr: PublicLanguagePolicy.sanitize(s.nameAr),
        summaryAr: PublicLanguagePolicy.sanitize(
          s.instructionAr.isNotEmpty ? s.instructionAr : s.nameAr,
        ),
        confidence: confidence,
        evidenceRef: 'routine_step:${s.id}:${input.analysisId}',
        visibility: pers == PersonalizationClass.unsupported
            ? VisibilityState.hiddenIneligible
            : VisibilityState.visiblePrimary,
        interaction: InteractionState.tappable,
        limitation: confidence == ConfidenceState.low
            ? LimitationState.lowConfidence
            : LimitationState.none,
        period: period,
        sequence: sequence,
        instructionAr: PublicLanguagePolicy.sanitize(
          s.instructionAr.isNotEmpty ? s.instructionAr : s.nameAr,
        ),
        reasonAr: reason,
        personalization: pers,
        adviceConceptId: concept,
        completionEligible: pers != PersonalizationClass.unsupported,
        advisorEligible: pers == PersonalizationClass.evidenceDerived ||
            pers == PersonalizationClass.profileDerived ||
            pers == PersonalizationClass.contextDerived,
        analyticsId: 'routine_step_${s.id}',
      );
    }

    final morningSteps = <ResultRoutineStepVM>[
      for (var i = 0; i < morningFinal.length; i++)
        mapStep(morningFinal[i], RoutinePeriod.morning, i + 1),
    ].where((s) => s.visibility != VisibilityState.hiddenIneligible).toList();

    final eveningSteps = <ResultRoutineStepVM>[
      for (var i = 0; i < eveningFinal.length; i++)
        mapStep(eveningFinal[i], RoutinePeriod.evening, i + 1),
    ].where((s) => s.visibility != VisibilityState.hiddenIneligible).toList();

    final weekly = PersonalPlanPolicy.weeklyAdjustment(
      input: input,
      confidence: confidence,
      priorities: priorities,
    );
    final avoid = PersonalPlanPolicy.avoidances(
      input: input,
      confidence: confidence,
      priorities: priorities,
    );

    final allSteps = [...morningSteps, ...eveningSteps];
    final eligible = allSteps.isNotEmpty;
    final todayStepId = eligible ? _pickTodayStepId(allSteps, priorities) : null;

    final focus = priorities.isNotEmpty
        ? priorities.first.concernLabelAr
        : (eligible ? 'روتين لطيف ومتسق' : 'لا توجد خطة');

    final limited = confidence == ConfidenceState.low ||
        confidence == ConfidenceState.unavailable ||
        !eligible;

    final advisorQs = <ResultAdvisorQuestionVM>[
      if (todayStepId != null)
        ResultAdvisorQuestionVM(
          id: 'rq_why_step',
          textAr: 'لماذا أضفتِ هذه الخطوة إلى روتيني؟',
          personalization: PersonalizationClass.evidenceDerived,
          evidenceRef: 'advisor:routine:$todayStepId',
          visibility: VisibilityState.visiblePrimary,
        ),
      ResultAdvisorQuestionVM(
        id: 'rq_am_pm',
        textAr: 'هل أستخدم هذه الخطوة صباحاً أم مساءً؟',
        personalization: PersonalizationClass.evidenceDerived,
        evidenceRef: 'advisor:routine:period',
        visibility: VisibilityState.visiblePrimary,
      ),
      ResultAdvisorQuestionVM(
        id: 'rq_irritation',
        textAr: 'ماذا أفعل إذا سببت الخطوة تهيجاً؟',
        personalization: PersonalizationClass.generalEducation,
        evidenceRef: 'advisor:routine:safety',
        visibility: VisibilityState.visibleSecondary,
      ),
      if (limited)
        ResultAdvisorQuestionVM(
          id: 'rq_simplify',
          textAr: 'لماذا نصحتني ميرا بتبسيط الروتين؟',
          personalization: PersonalizationClass.contextDerived,
          evidenceRef: 'advisor:routine:simplify',
          visibility: VisibilityState.visiblePrimary,
        ),
    ];

    return ResultPersonalPlanVM(
      id: 'personal_plan',
      titleAr: 'خطتك الشخصية',
      summaryAr: eligible
          ? (limited
              ? 'خطة مبسّطة بسبب حدود الثقة أو الأدلة. راجعي الخطوات اللطيفة أو أعيدي التحليل لاحقاً.'
              : 'خطة عناية قصيرة: خطوات صباح ومساء مع تركيز أسبوعي واحد.')
          : 'لا تتوفر أدلة كافية لإنشاء روتين شخصي كامل حالياً. يمكنك مراجعة الإرشادات العامة أو إعادة التحليل في ظروف أوضح.',
      confidence: confidence,
      evidenceRef: 'personal_plan:${input.analysisId}',
      visibility: eligible
          ? VisibilityState.visiblePrimary
          : VisibilityState.unavailable,
      interaction:
          eligible ? InteractionState.navigable : InteractionState.disabled,
      limitation: limited
          ? (eligible
              ? LimitationState.lowConfidence
              : LimitationState.missingEvidence)
          : LimitationState.none,
      focusAr: focus,
      activeStepCount: allSteps.length,
      primaryObjectiveAr: eligible
          ? 'نفّذي روتيناً لطيفاً ومتسقاً دون تكرار النصائح'
          : 'أعيدي التحليل لبناء خطة أوضح',
      isLimited: limited,
      reviewGuidanceAr: confidence == ConfidenceState.low
          ? 'يُفضّل إعادة التحليل عندما تكون الإضاءة أوضح'
          : 'راجعي الخطة بعد أسبوع من الالتزام الثابت',
      morning: ResultRoutinePeriodVM(
        period: RoutinePeriod.morning,
        titleAr: 'الصباح',
        steps: morningSteps,
      ),
      evening: ResultRoutinePeriodVM(
        period: RoutinePeriod.evening,
        titleAr: 'المساء',
        steps: eveningSteps,
      ),
      weekly: weekly,
      avoidances: avoid,
      advisorEntry: ResultRoutineAdvisorEntryVM(
        publicNameAr: 'مستشار ميرا',
        suggestedQuestions: advisorQs,
        visibility: VisibilityState.visiblePrimary,
      ),
      todayStepId: todayStepId,
      eligible: eligible,
    );
  }

  List<FrozenRoutineStepInput> _synthesizeFromCount({
    required int count,
    required String period,
    required ConfidenceState confidence,
  }) {
    if (count <= 0) return const [];
    // Barrier-safe defaults only — never invent aggressive actives.
    final templates = period == 'am'
        ? const [
            FrozenRoutineStepInput(
              id: 'cleanser_am',
              nameAr: 'غسول لطيف',
              instructionAr: 'صباحاً — بلطف لمدة قصيرة',
              period: 'am',
            ),
            FrozenRoutineStepInput(
              id: 'moisturizer_am',
              nameAr: 'مرطب خفيف',
              instructionAr: 'بعد الغسول — طبقة خفيفة',
              period: 'am',
            ),
            FrozenRoutineStepInput(
              id: 'sunscreen',
              nameAr: 'واقي شمس',
              instructionAr: 'آخر خطوة صباحاً',
              period: 'am',
            ),
          ]
        : const [
            FrozenRoutineStepInput(
              id: 'cleanser_pm',
              nameAr: 'غسول مسائي',
              instructionAr: 'مساءً — تنظيف لطيف',
              period: 'pm',
            ),
            FrozenRoutineStepInput(
              id: 'moisturizer_pm',
              nameAr: 'مرطب مسائي',
              instructionAr: 'قبل النوم — طبقة مريحة',
              period: 'pm',
            ),
          ];
    final take = count.clamp(0, templates.length);
    final selected = templates.take(take).toList();
    if (confidence == ConfidenceState.low ||
        confidence == ConfidenceState.unavailable) {
      return PersonalPlanPolicy.selectPeriodSteps(
        raw: selected,
        confidence: confidence,
        max: take,
      );
    }
    return selected;
  }

  String? _pickTodayStepId(
    List<ResultRoutineStepVM> steps,
    List<ResultPriorityVM> priorities,
  ) {
    if (steps.isEmpty) return null;
    if (priorities.isEmpty) return steps.first.id;
    final concern = priorities.first.concernLabelAr;
    for (final s in steps) {
      final c = s.adviceConceptId;
      if (concern.contains('ترطيب') &&
          (c == 'moisturizer' || c == 'hydration')) {
        return s.id;
      }
      if (concern.contains('حبوب') && c == 'acne_care') return s.id;
      if (concern.contains('احمرار') && c == 'redness_care') return s.id;
      if (concern.contains('مسام') && c == 'pore_care') return s.id;
      if (c == 'sunscreen' && concern.contains('تصبغ')) return s.id;
    }
    // Prefer sunscreen in morning set, else first incomplete-eligible step.
    final spf = steps.where((s) => s.adviceConceptId == 'sunscreen');
    if (spf.isNotEmpty) return spf.first.id;
    return steps.first.id;
  }

  ResultProgressPreviewVM _progress(
    ResultProjectionInput input,
    ConfidenceState confidence,
  ) {
    final p = input.progress;
    final comparability = _comparability(p);
    final canShowDelta =
        comparability == ProgressComparabilityState.comparable &&
            p.deltaPoints != null;
    final canShowProjection =
        comparability == ProgressComparabilityState.comparable &&
            p.projectedScore30Days != null &&
            p.confidenceAdequate;

    String summary;
    switch (comparability) {
      case ProgressComparabilityState.insufficientHistory:
        summary =
            'بعد تحليل إضافي متسق يمكن عرض المقارنة. لا نقدّم تحسناً أو تراجعاً الآن.';
      case ProgressComparabilityState.notComparable:
        summary =
            'التحليلات غير متوافقة للمقارنة حالياً. أعيدي التحليل بظروف متقاربة.';
      case ProgressComparabilityState.partiallyComparable:
        summary =
            'مقارنة جزئية فقط — لا نعرض تغييراً رقمياً حتى تكتمل شروط المقارنة.';
      case ProgressComparabilityState.comparable:
        summary = canShowDelta
            ? 'تغيير ضمن مقارنة صالحة بين تحليلين.'
            : 'مقارنة متاحة دون رقم واضح.';
    }

    return ResultProgressPreviewVM(
      id: 'progress_entry',
      titleAr: 'تقدمك',
      summaryAr: summary,
      confidence: confidence,
      evidenceRef: 'progress:${input.analysisId}',
      visibility: VisibilityState.visiblePrimary,
      interaction: InteractionState.navigable,
      limitation: canShowProjection
          ? LimitationState.estimateOnly
          : LimitationState.none,
      comparability: comparability,
      deltaVisible: canShowDelta,
      projectionVisible: canShowProjection,
      deltaPoints: canShowDelta ? p.deltaPoints : null,
      projectionEstimate: canShowProjection ? p.projectedScore30Days : null,
      projectionLabelAr: 'تقدير مستقبلي وليس قياساً',
    );
  }

  ProgressComparabilityState _comparability(FrozenProgressInput p) {
    if (p.scanCount < 2 || !p.hasBaseline) {
      return ProgressComparabilityState.insufficientHistory;
    }
    final hardFail = !p.metricCompatible ||
        !p.modelVersionCompatible ||
        !p.captureQualityCompatible ||
        !p.confidenceAdequate;
    if (hardFail) return ProgressComparabilityState.notComparable;
    if (p.intervalDays != null && p.intervalDays! < 1) {
      return ProgressComparabilityState.partiallyComparable;
    }
    return ProgressComparabilityState.comparable;
  }

  ResultMapVM _map(
    ResultProjectionInput input,
    ConfidenceState confidence,
  ) {
    const title = 'خريطة إرشادية للبشرة';
    const badge = 'توضيح إرشادي';
    const explanation =
        'تعرض الخريطة مناطق الوجه المرتبطة بنتيجة التحليل بصورة '
        'توضيحية، ولا تمثل قياسًا موضعيًا دقيقًا أو خريطة طبية.';

    final concerns = input.mapConcernIds
        .map(
          (id) => ResultMapConcernVM(
            id: id,
            labelAr: MetricPresentationPolicy.publicLabelAr(id),
            evidenceRef: 'map_concern:$id',
            visibility: input.mapEnabled
                ? VisibilityState.visibleSecondary
                : VisibilityState.hiddenMissingEvidence,
          ),
        )
        .toList(growable: false);

    return ResultMapVM(
      id: 'skin_map',
      titleAr: title,
      summaryAr: explanation,
      confidence: confidence,
      evidenceRef: 'map:${input.analysisId}',
      visibility: input.mapEnabled
          ? VisibilityState.visibleSecondary
          : VisibilityState.unavailable,
      interaction: input.mapEnabled
          ? InteractionState.tappable
          : InteractionState.disabled,
      limitation: LimitationState.illustrativeOnly,
      mode: MapPresentationMode.illustrativeUserImage,
      badgeAr: badge,
      explanationAr: explanation,
      concerns: concerns,
      overlayType: 'illustrative_regions',
      interactionEligible: input.mapEnabled,
    );
  }

  List<ResultProductVM> _products(
    ResultProjectionInput input,
    ConfidenceState confidence,
  ) {
    final out = <ResultProductVM>[];
    for (final p in input.products) {
      final disclosure = _disclosure(p.disclosure);
      final hasEvidence = p.hasRecommendationReason &&
          (p.recommendationReasonAr?.trim().isNotEmpty ?? false) &&
          (p.linkedConcernAr?.trim().isNotEmpty ?? false);

      if (!hasEvidence || p.matchScore <= 0) {
        out.add(_productVm(
          p,
          ProductRecommendationState.insufficientEvidence,
          VisibilityState.hiddenMissingEvidence,
          confidence,
          disclosure,
          skinTypeAr: input.skinTypeAr,
          matchVisible: false,
          match: null,
          qualification: 'الدليل غير كافٍ لعرض توصية',
        ));
        continue;
      }

      if (p.matchScore >= 75) {
        out.add(_productVm(
          p,
          ProductRecommendationState.recommended,
          VisibilityState.visibleSecondary,
          confidence,
          disclosure,
          skinTypeAr: input.skinTypeAr,
          matchVisible: true,
          match: p.matchScore,
        ));
      } else if (p.matchScore >= 65) {
        out.add(_productVm(
          p,
          ProductRecommendationState.possibleAlternative,
          VisibilityState.visibleDetails,
          confidence,
          disclosure,
          skinTypeAr: input.skinTypeAr,
          matchVisible: true,
          match: p.matchScore,
          qualification:
              'بديل محتمل — ملاءمة متوسطة، للتفاصيل فقط',
        ));
      } else {
        out.add(_productVm(
          p,
          ProductRecommendationState.hidden,
          VisibilityState.hiddenIneligible,
          confidence,
          disclosure,
          skinTypeAr: input.skinTypeAr,
          matchVisible: false,
          match: null,
          qualification: 'أقل من حد العرض العام',
        ));
      }
    }
    return List.unmodifiable(out);
  }

  ResultProductVM _productVm(
    FrozenProductInput p,
    ProductRecommendationState state,
    VisibilityState visibility,
    ConfidenceState confidence,
    ProductDisclosure disclosure, {
    required String skinTypeAr,
    required bool matchVisible,
    required int? match,
    String? qualification,
  }) {
    return ResultProductVM(
      id: 'product_${p.id}',
      titleAr: p.nameAr,
      summaryAr: PublicLanguagePolicy.sanitize(
        p.recommendationReasonAr ?? qualification ?? '',
      ),
      confidence: confidence,
      evidenceRef: 'product:${p.id}',
      visibility: visibility,
      interaction: visibility == VisibilityState.visibleSecondary ||
              visibility == VisibilityState.visibleDetails
          ? InteractionState.tappable
          : InteractionState.disabled,
      limitation: state == ProductRecommendationState.possibleAlternative
          ? LimitationState.advisory
          : LimitationState.none,
      brandAr: p.brandAr,
      state: state,
      matchPercent: match,
      matchNumericVisible: matchVisible,
      linkedConcernAr: p.linkedConcernAr ?? '',
      recommendationReasonAr: PublicLanguagePolicy.sanitize(
        p.recommendationReasonAr ?? '',
      ),
      usageContextAr: p.stepAr ?? '',
      disclosure: disclosure,
      skinTypeAr: skinTypeAr,
      ingredientEvidenceAr: p.ingredientEvidenceAr,
      qualificationReasonAr: qualification,
      analyticsId: 'results_product_${p.id}',
    );
  }

  ProductDisclosure _disclosure(String raw) {
    switch (raw.toLowerCase()) {
      case 'sponsored':
        return ProductDisclosure.sponsored;
      case 'independent':
        return ProductDisclosure.independent;
      case 'partner':
        return ProductDisclosure.partner;
      default:
        return ProductDisclosure.unknown;
    }
  }

  ResultSkinAgeVM _skinAge(
    ResultProjectionInput input,
    ConfidenceState overall,
  ) {
    const qualification =
        'تقدير تجميلي تقريبي مبني على الصورة، وليس قياسًا للعمر '
        'البيولوجي للبشرة.';
    final ageConf = ConfidencePresentationContract.fromLegacyLevel(
      input.skinAgeConfidenceLevel,
    );
    final eligible = input.skinAgeYears != null &&
        (ageConf == ConfidenceState.high ||
            ageConf == ConfidenceState.medium) &&
        overall != ConfidenceState.unavailable;

    return ResultSkinAgeVM(
      id: 'skin_age',
      titleAr: 'تقدير المظهر العمري',
      summaryAr: qualification,
      confidence: ageConf,
      evidenceRef: 'skin_age:${input.analysisId}',
      visibility: eligible
          ? VisibilityState.visibleDetails
          : VisibilityState.hiddenLowConfidence,
      interaction: InteractionState.none,
      limitation: LimitationState.estimateOnly,
      estimateYears: eligible ? input.skinAgeYears : null,
      qualificationAr: qualification,
      eligibleForSecondary: eligible,
    );
  }

  ResultAdvisorEntryVM _advisor(
    ResultProjectionInput input,
    List<ResultPriorityVM> priorities,
    ConfidenceState confidence,
  ) {
    final questions = <ResultAdvisorQuestionVM>[];

    // Envelope-grounded personalized questions only from available claims /
    // eligible priorities (presentation projection — does not call Advisor).
    for (final claim in input.advisorClaims.where((c) => c.available)) {
      final text = PublicLanguagePolicy.sanitize(
        'اشرحي لي: ${claim.statementAr}',
      );
      if (text.toLowerCase().contains('mce')) continue;
      questions.add(
        ResultAdvisorQuestionVM(
          id: 'aq_${claim.id}',
          textAr: text,
          personalization: PersonalizationClass.evidenceDerived,
          evidenceRef: 'envelope:${claim.id}',
          visibility: VisibilityState.visiblePrimary,
        ),
      );
      if (questions.length >= 2) break;
    }

    for (final p in priorities) {
      if (questions.length >= 3) break;
      questions.add(
        ResultAdvisorQuestionVM(
          id: 'aq_priority_${p.rank}',
          textAr: 'ماذا أفعل بخصوص ${p.concernLabelAr}؟',
          personalization: PersonalizationClass.evidenceDerived,
          evidenceRef: p.evidenceRef,
          visibility: VisibilityState.visiblePrimary,
        ),
      );
    }

    // Explicit general education — never framed as personalized AI.
    questions.add(
      const ResultAdvisorQuestionVM(
        id: 'aq_general_spf',
        textAr: 'ما أهمية واقي الشمس في الروتين اليومي؟',
        personalization: PersonalizationClass.generalEducation,
        evidenceRef: 'education:sunscreen',
        visibility: VisibilityState.visibleSecondary,
      ),
    );

    return ResultAdvisorEntryVM(
      id: 'advisor_entry',
      titleAr: 'مستشار ميرا',
      summaryAr: 'أسئلة مبنية على أدلة تقريرك المتاحة',
      confidence: confidence,
      evidenceRef: 'advisor:${input.analysisId}',
      visibility: VisibilityState.visiblePrimary,
      interaction: InteractionState.navigable,
      limitation: LimitationState.none,
      publicNameAr: 'مستشار ميرا',
      suggestedQuestions: List.unmodifiable(questions),
    );
  }

  ResultRetakeVM _retake(
    ResultProjectionInput input,
    ConfidenceState confidence,
    ConfidencePresentationSpec spec,
  ) {
    final suggested = spec.retakeEligible;
    return ResultRetakeVM(
      id: 'retake',
      titleAr: 'إعادة التحليل',
      summaryAr: PublicLanguagePolicy.sanitize(
        input.retakeGuidanceAr?.trim().isNotEmpty == true
            ? input.retakeGuidanceAr!
            : (suggested
                ? 'يمكنك إعادة التحليل لتحسين وضوح النتيجة.'
                : 'يمكنك إعادة التحليل في أي وقت بظروف إضاءة ثابتة.'),
      ),
      confidence: confidence,
      evidenceRef: 'retake:${input.analysisId}',
      visibility: suggested
          ? VisibilityState.visibleSecondary
          : VisibilityState.visibleDetails,
      interaction: InteractionState.navigable,
      limitation:
          suggested ? LimitationState.retakeSuggested : LimitationState.none,
      suggested: suggested,
    );
  }
}

/// Personalization helper used by validators/tests.
abstract final class PersonalizationPolicy {
  static String labelAr(PersonalizationClass c) =>
      PersonalizationLabels.ar(c);

  static bool mayPresent(PersonalizationClass c) =>
      c != PersonalizationClass.unsupported;
}
