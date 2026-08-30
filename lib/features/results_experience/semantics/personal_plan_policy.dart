import '../contracts/result_enums.dart';
import '../contracts/result_presentation_vms.dart';
import '../localization/public_language_policy.dart';
import '../projection/result_projection_input.dart';
import '../visibility/advice_ownership_policy.dart';

/// Phase 8E — presentation-level routine safety, classification, and caps.
abstract final class PersonalPlanPolicy {
  static const maxMorningSteps = 3;
  static const maxEveningSteps = 3;
  static const maxAvoidances = 3;

  /// Aggressive / active tokens blocked under low confidence.
  static const _aggressiveTokens = [
    'bha',
    'aha',
    'مقشر',
    'ريتين',
    'retinol',
    'معالجة الحبوب',
    'treatment',
  ];

  static const _unsafeMedical = [
    'تشخيص',
    'وصفة',
    'دواء',
    'علاج طبي',
    'guarantee',
    'شفاء',
  ];

  static String conceptForStep(FrozenRoutineStepInput step) {
    final blob = '${step.id} ${step.nameAr} ${step.instructionAr}'.toLowerCase();
    if (blob.contains('sun') || blob.contains('spf') || blob.contains('واقي')) {
      return 'sunscreen';
    }
    if (blob.contains('clean') || blob.contains('غسول')) {
      return 'gentle_cleanser';
    }
    if (blob.contains('acne') || blob.contains('حبوب') || blob.contains('نياسين')) {
      return 'acne_care';
    }
    if (blob.contains('red') || blob.contains('احمرار') || blob.contains('مهدئ')) {
      return 'redness_care';
    }
    if (blob.contains('pore') || blob.contains('مسام') || blob.contains('bha')) {
      return 'pore_care';
    }
    if (blob.contains('serum') ||
        blob.contains('moist') ||
        blob.contains('مرطب') ||
        blob.contains('ترطيب') ||
        blob.contains('كريم')) {
      return 'moisturizer';
    }
    return 'moisturizer';
  }

  static bool isAggressive(FrozenRoutineStepInput step) {
    final blob = '${step.id} ${step.nameAr} ${step.instructionAr}'.toLowerCase();
    return _aggressiveTokens.any(blob.contains);
  }

  static bool passesSafety(FrozenRoutineStepInput step) {
    final blob = '${step.nameAr} ${step.instructionAr}';
    if (!PublicLanguagePolicy.isPublicSafe(blob, field: 'routine_step')) {
      return false;
    }
    for (final t in _unsafeMedical) {
      if (blob.toLowerCase().contains(t)) return false;
    }
    return true;
  }

  static PersonalizationClass classifyStep({
    required FrozenRoutineStepInput step,
    required bool hasMetricEvidence,
    required ConfidenceState confidence,
  }) {
    if (confidence == ConfidenceState.unavailable) {
      return PersonalizationClass.unsupported;
    }
    if (hasMetricEvidence && confidence != ConfidenceState.low) {
      return PersonalizationClass.evidenceDerived;
    }
    if (hasMetricEvidence && confidence == ConfidenceState.low) {
      return PersonalizationClass.contextDerived;
    }
    // Core barrier steps without strong metric still profile/context safe.
    final concept = conceptForStep(step);
    if (concept == 'gentle_cleanser' ||
        concept == 'sunscreen' ||
        concept == 'moisturizer') {
      return PersonalizationClass.profileDerived;
    }
    return PersonalizationClass.generalEducation;
  }

  static List<FrozenRoutineStepInput> selectPeriodSteps({
    required List<FrozenRoutineStepInput> raw,
    required ConfidenceState confidence,
    required int max,
  }) {
    final out = <FrozenRoutineStepInput>[];
    final seenConcepts = <String>{};
    for (final step in raw) {
      if (out.length >= max) break;
      if (!passesSafety(step)) continue;
      if (confidence == ConfidenceState.low ||
          confidence == ConfidenceState.unavailable) {
        if (isAggressive(step)) continue;
      }
      final concept = conceptForStep(step);
      if (!seenConcepts.add(concept)) continue;
      out.add(step);
    }
    return out;
  }

  static String reasonForStep({
    required String concept,
    required List<FrozenPriorityInput> priorities,
    required ConfidenceState confidence,
  }) {
    if (confidence == ConfidenceState.low) {
      return 'خطوة بسيطة وآمنة لدعم حاجز البشرة مع ثقة تحليل محدودة.';
    }
    for (final p in priorities) {
      final t = p.titleAr;
      if (concept == 'moisturizer' || concept == 'hydration') {
        if (t.contains('ترطيب') || t.contains('جفاف')) {
          return 'مرتبطة بأولوية الترطيب في تحليلك.';
        }
      }
      if (concept == 'acne_care' && (t.contains('حبوب') || t.contains('acne'))) {
        return 'مرتبطة بأولوية مظهر الحبوب في تحليلك.';
      }
      if (concept == 'redness_care' && t.contains('احمرار')) {
        return 'مرتبطة بأولوية تهدئة الاحمرار الظاهر.';
      }
      if (concept == 'pore_care' && t.contains('مسام')) {
        return 'مرتبطة بأولوية مظهر المسام.';
      }
      if (concept == 'sunscreen') {
        return 'حماية يومية ثابتة تدعم مظهر البشرة.';
      }
      if (concept == 'gentle_cleanser') {
        return 'تنظيف لطيف أساس روتين آمن ومتسق.';
      }
    }
    switch (concept) {
      case 'sunscreen':
        return 'حماية يومية ثابتة تدعم مظهر البشرة.';
      case 'gentle_cleanser':
        return 'تنظيف لطيف أساس روتين آمن ومتسق.';
      case 'moisturizer':
        return 'ترطيب يدعم راحة البشرة وحاجزها.';
      default:
        return 'خطوة مرتبطة بخطة العناية الحالية.';
    }
  }

  static ResultWeeklyAdjustmentVM? weeklyAdjustment({
    required ResultProjectionInput input,
    required ConfidenceState confidence,
    required List<ResultPriorityVM> priorities,
  }) {
    if (confidence == ConfidenceState.unavailable) return null;

    String title;
    String instruction;
    String reason;
    PersonalizationClass pers;

    if (input.weeklyPlanEnabled &&
        input.weeklyHeadlineAr.trim().isNotEmpty) {
      title = PublicLanguagePolicy.sanitize(input.weeklyHeadlineAr);
      reason = PublicLanguagePolicy.sanitize(
        input.weeklySummaryAr.isNotEmpty
            ? input.weeklySummaryAr
            : 'تركيز أسبوعي واحد بدل تكرار يومي.',
      );
      instruction = confidence == ConfidenceState.low
          ? 'حافظي على روتين بسيط هذا الأسبوع دون إضافة خطوات قوية.'
          : reason;
      pers = PersonalizationClass.evidenceDerived;
    } else if (priorities.isNotEmpty) {
      final top = priorities.first;
      title = 'تركيز الأسبوع: ${top.concernLabelAr}';
      instruction =
          'ركّزي على خطوة واحدة مرتبطة بـ${top.concernLabelAr} دون تعقيد الروتين.';
      reason = top.summaryAr;
      pers = PersonalizationClass.evidenceDerived;
    } else if (confidence == ConfidenceState.low) {
      title = 'تبسيط الروتين هذا الأسبوع';
      instruction = 'التزمي بخطوات لطيفة قليلة حتى تتضح صورة التحليل.';
      reason = 'ثقة التحليل محدودة — الأفضل عدم إضافة منتجات أو أحماض جديدة.';
      pers = PersonalizationClass.contextDerived;
    } else {
      return null;
    }

    return ResultWeeklyAdjustmentVM(
      id: 'weekly_primary',
      titleAr: title,
      summaryAr: reason,
      confidence: confidence,
      evidenceRef: 'weekly:${input.analysisId}',
      visibility: VisibilityState.visiblePrimary,
      interaction: InteractionState.expandable,
      limitation: confidence == ConfidenceState.low
          ? LimitationState.lowConfidence
          : LimitationState.none,
      frequencyAr: 'مرة هذا الأسبوع',
      instructionAr: instruction,
      successSignalAr: 'روتين ثابت وبسيط دون تهيج ظاهر',
      personalization: pers,
    );
  }

  static List<ResultAvoidanceVM> avoidances({
    required ResultProjectionInput input,
    required ConfidenceState confidence,
    required List<ResultPriorityVM> priorities,
  }) {
    if (confidence == ConfidenceState.unavailable) return const [];
    final out = <ResultAvoidanceVM>[];
    final concepts = <String>{};

    void add({
      required String id,
      required String title,
      required String summary,
      required String concept,
      required PersonalizationClass pers,
    }) {
      if (out.length >= maxAvoidances) return;
      if (!concepts.add(concept)) return;
      out.add(
        ResultAvoidanceVM(
          id: id,
          titleAr: title,
          summaryAr: summary,
          confidence: confidence,
          evidenceRef: 'avoid:$id:${input.analysisId}',
          visibility: VisibilityState.visibleSecondary,
          interaction: InteractionState.none,
          limitation: LimitationState.advisory,
          personalization: pers,
          adviceConceptId: concept,
          analyticsId: 'avoid_$id',
        ),
      );
    }

    final blob = priorities.map((p) => p.concernLabelAr).join(' ');
    if (blob.contains('احمرار') || confidence == ConfidenceState.low) {
      add(
        id: 'aggressive_exfoliation',
        title: 'تجنّبي التقشير القوي',
        summary: 'قلّلي الأحماض والتقشير الخشن حتى تهدأ البشرة.',
        concept: 'avoidance',
        pers: blob.contains('احمرار')
            ? PersonalizationClass.evidenceDerived
            : PersonalizationClass.generalEducation,
      );
    }
    if (blob.contains('حبوب') || blob.contains('ترطيب')) {
      add(
        id: 'too_many_new',
        title: 'لا تضيفي عدة منتجات جديدة معاً',
        summary: 'أدخلي تغييراً واحداً في كل مرة لتفهمي استجابة بشرتك.',
        concept: 'avoidance_new_products',
        pers: PersonalizationClass.generalEducation,
      );
    }
    add(
      id: 'skip_spf',
      title: 'لا تهملي واقي الشمس نهاراً',
      summary: 'الحماية اليومية تدعم مظهر البشرة وتقلل تفاقم التصبغ الظاهر.',
      concept: 'avoidance_spf',
      pers: PersonalizationClass.generalEducation,
    );

    return out;
  }

  static List<String> ownedConceptsFromPlan(ResultPersonalPlanVM plan) {
    final ids = <String>[
      for (final s in plan.morning.steps) s.adviceConceptId,
      for (final s in plan.evening.steps) s.adviceConceptId,
      if (plan.weekly != null) 'weekly_adjustment',
      for (final a in plan.avoidances) a.adviceConceptId,
    ];
    return AdviceOwnershipPolicy.findDuplicateOwners(ids).isEmpty
        ? ids.toSet().toList(growable: false)
        : ids.toSet().toList(growable: false);
  }
}
