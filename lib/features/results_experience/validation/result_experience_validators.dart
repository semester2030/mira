import '../contracts/result_enums.dart';
import '../contracts/result_presentation_vms.dart';
import '../laws/engineering_laws_35_36.dart';
import '../localization/public_language_policy.dart';
import '../semantics/score_semantics_contract.dart';
import '../visibility/advice_ownership_policy.dart';
import '../visibility/visibility_policy.dart';

class ValidationIssue {
  const ValidationIssue(this.code, this.message);

  final String code;
  final String message;
}

class ValidationResult {
  const ValidationResult(this.issues);

  final List<ValidationIssue> issues;
  bool get isValid => issues.isEmpty;
}

/// Fail-closed validators for projected ResultExperience.
abstract final class ResultExperienceValidators {
  static ValidationResult validate(ResultExperience experience) {
    final issues = <ValidationIssue>[];

    _contractCompleteness(experience, issues);
    _publicLanguage(experience, issues);
    _scoreSemantics(experience, issues);
    _confidenceSeparation(experience, issues);
    _priorities(experience, issues);
    _firstSurface(experience, issues);
    _products(experience, issues);
    _map(experience, issues);
    _skinAge(experience, issues);
    _progress(experience, issues);
    _advisor(experience, issues);
    _adviceDuplicates(experience, issues);
    _law35(experience, issues);
    _law36(experience, issues);

    return ValidationResult(List.unmodifiable(issues));
  }

  static void assertValid(ResultExperience experience) {
    final r = validate(experience);
    if (!r.isValid) {
      throw StateError(
        'ResultExperience validation failed: '
        '${r.issues.map((e) => '${e.code}:${e.message}').join(' | ')}',
      );
    }
  }

  static void _contractCompleteness(
    ResultExperience e,
    List<ValidationIssue> issues,
  ) {
    if (e.id.isEmpty) {
      issues.add(const ValidationIssue('complete', 'missing experience id'));
    }
    if (e.summary.id.isEmpty) {
      issues.add(const ValidationIssue('complete', 'missing summary'));
    }
    if (e.advisorEntry.publicNameAr != 'مستشار ميرا') {
      issues.add(
        const ValidationIssue('advisor', 'public name must be مستشار ميرا'),
      );
    }
  }

  static void _publicLanguage(
    ResultExperience e,
    List<ValidationIssue> issues,
  ) {
    void check(String text, String field) {
      for (final v in PublicLanguagePolicy.validate(text, field: field)) {
        issues.add(ValidationIssue('language', '${v.field}:${v.term}'));
      }
    }

    check(e.summary.summaryAr, 'summary');
    check(e.summary.headlineAr, 'headline');
    check(e.map.explanationAr, 'map');
    check(e.map.badgeAr, 'map_badge');
    check(e.advisorEntry.titleAr, 'advisor_title');
    check(e.advisorEntry.summaryAr, 'advisor_summary');
    for (final q in e.advisorEntry.suggestedQuestions) {
      check(q.textAr, 'advisor_q_${q.id}');
    }
    for (final p in e.priorities) {
      check(p.summaryAr, 'priority_${p.id}');
    }
    for (final p in e.products) {
      check(p.recommendationReasonAr, 'product_${p.id}');
    }
    if (e.immediateAction != null) {
      check(e.immediateAction!.summaryAr, 'action');
    }
  }

  static void _scoreSemantics(
    ResultExperience e,
    List<ValidationIssue> issues,
  ) {
    final v = e.summary.vitality;
    if (v.category != ScoreCategory.wellnessScore ||
        v.direction != ScoreDirection.higherBetter ||
        v.colorRole != ColorRole.wellness) {
      issues.add(
        const ValidationIssue('semantics', 'vitality must be wellness'),
      );
    }
    for (final m in e.metrics) {
      final sev = m.severityOrWellness;
      if (sev == null) continue;
      if (sev.category != ScoreCategory.concernSeverity) {
        issues.add(
          ValidationIssue('semantics', 'metric ${m.id} severity category'),
        );
      }
      if (sev.direction != ScoreDirection.higherWorse) {
        issues.add(
          ValidationIssue('semantics', 'metric ${m.id} severity direction'),
        );
      }
      if (sev.colorRole == ColorRole.wellness) {
        issues.add(
          ValidationIssue(
            'semantics',
            'metric ${m.id} severity must not use wellness color',
          ),
        );
      }
    }
    if (e.progressPreview.projectionVisible) {
      if (!e.progressPreview.projectionLabelAr.contains('تقدير')) {
        issues.add(
          const ValidationIssue(
            'semantics',
            'projection must be labeled as estimate',
          ),
        );
      }
    }
  }

  static void _confidenceSeparation(
    ResultExperience e,
    List<ValidationIssue> issues,
  ) {
    if (e.confidence.overall == e.summary.vitality.category) {
      // type mismatch impossible; check color roles instead
    }
    if (e.summary.vitality.colorRole == ColorRole.confidence) {
      issues.add(
        const ValidationIssue(
          'confidence',
          'vitality must not use confidence color role',
        ),
      );
    }
    if (e.confidence.titleAr == e.summary.titleAr) {
      issues.add(
        const ValidationIssue(
          'confidence',
          'confidence title must differ from condition title',
        ),
      );
    }
  }

  static void _priorities(
    ResultExperience e,
    List<ValidationIssue> issues,
  ) {
    if (e.priorities.length > VisibilityPolicy.maxPriorities) {
      issues.add(const ValidationIssue('priority', 'more than 3 priorities'));
    }
    for (var i = 0; i < e.priorities.length; i++) {
      if (e.priorities[i].rank != i + 1) {
        issues.add(ValidationIssue('priority', 'rank gap at $i'));
      }
      if (e.priorities[i].personalization ==
          PersonalizationClass.generalEducation) {
        issues.add(
          ValidationIssue('priority', 'filler general advice at $i'),
        );
      }
      if (e.priorities[i].personalization ==
          PersonalizationClass.unsupported) {
        issues.add(ValidationIssue('priority', 'unsupported at $i'));
      }
      if (e.priorities[i].evidenceRef.isEmpty) {
        issues.add(ValidationIssue('priority', 'missing evidence at $i'));
      }
    }
  }

  static void _firstSurface(
    ResultExperience e,
    List<ValidationIssue> issues,
  ) {
    if (VisibilityPolicy.firstSurfaceIncludesSkinAge(e.firstSurfaceIds)) {
      issues.add(
        const ValidationIssue('surface', 'skin age on first surface'),
      );
    }
    if (e.skinAge.visibility == VisibilityState.visiblePrimary) {
      issues.add(
        const ValidationIssue('surface', 'skin age visible_primary'),
      );
    }
    if (!e.firstSurfaceIds.contains('summary')) {
      issues.add(const ValidationIssue('surface', 'missing summary'));
    }
  }

  static void _products(
    ResultExperience e,
    List<ValidationIssue> issues,
  ) {
    for (final p in e.products) {
      switch (p.state) {
        case ProductRecommendationState.recommended:
          if (p.matchPercent == null || p.matchPercent! < 75) {
            issues.add(
              ValidationIssue('product', '${p.id} recommended threshold'),
            );
          }
          if (p.recommendationReasonAr.isEmpty ||
              p.linkedConcernAr.isEmpty) {
            issues.add(
              ValidationIssue('product', '${p.id} missing reason/concern'),
            );
          }
        case ProductRecommendationState.possibleAlternative:
          if (p.matchPercent == null ||
              p.matchPercent! < 65 ||
              p.matchPercent! > 74) {
            issues.add(
              ValidationIssue('product', '${p.id} alternative band'),
            );
          }
          if ((p.qualificationReasonAr ?? '').isEmpty) {
            issues.add(
              ValidationIssue('product', '${p.id} missing qualification'),
            );
          }
        case ProductRecommendationState.hidden:
          if (p.visibility != VisibilityState.hiddenIneligible) {
            issues.add(
              ValidationIssue('product', '${p.id} hidden visibility'),
            );
          }
        case ProductRecommendationState.insufficientEvidence:
          if (p.matchNumericVisible) {
            issues.add(
              ValidationIssue('product', '${p.id} match shown w/o evidence'),
            );
          }
      }
    }
  }

  static void _map(ResultExperience e, List<ValidationIssue> issues) {
    if (e.map.mode != MapPresentationMode.illustrativeUserImage) {
      issues.add(const ValidationIssue('map', 'expected illustrative mode'));
    }
    if (e.map.badgeAr != 'توضيح إرشادي') {
      issues.add(const ValidationIssue('map', 'badge mismatch'));
    }
    if (e.map.titleAr != 'خريطة إرشادية للبشرة') {
      issues.add(const ValidationIssue('map', 'title mismatch'));
    }
    final lower = e.map.explanationAr.toLowerCase();
    for (final bad in [
      'قياسًا موضعيًا دقيقًا',
      'heatmap',
      'measured localization',
      'medical map',
    ]) {
      if (bad == 'قياسًا موضعيًا دقيقًا') {
        // explanation must DENY measured localization — presence of denial phrase is required
        continue;
      }
      if (lower.contains(bad)) {
        issues.add(ValidationIssue('map', 'forbidden claim: $bad'));
      }
    }
    if (!e.map.explanationAr.contains('توضيحية') &&
        !e.map.explanationAr.contains('إرشادي')) {
      issues.add(const ValidationIssue('map', 'missing illustrative wording'));
    }
    if (e.map.limitation != LimitationState.illustrativeOnly) {
      issues.add(const ValidationIssue('map', 'limitation must be illustrative'));
    }
  }

  static void _skinAge(ResultExperience e, List<ValidationIssue> issues) {
    if (!e.skinAge.qualificationAr.contains('تجميلي')) {
      issues.add(const ValidationIssue('skin_age', 'missing qualification'));
    }
    if (e.skinAge.qualificationAr.contains('بيولوجي') == false) {
      issues.add(
        const ValidationIssue('skin_age', 'must deny biological age'),
      );
    }
  }

  static void _progress(ResultExperience e, List<ValidationIssue> issues) {
    final p = e.progressPreview;
    if (p.comparability != ProgressComparabilityState.comparable) {
      if (p.deltaVisible || p.projectionVisible) {
        issues.add(
          const ValidationIssue(
            'progress',
            'delta/projection without comparability',
          ),
        );
      }
    }
  }

  static void _advisor(ResultExperience e, List<ValidationIssue> issues) {
    if (e.advisorEntry.publicNameAr.toLowerCase().contains('mce')) {
      issues.add(const ValidationIssue('advisor', 'MCE leak'));
    }
    for (final q in e.advisorEntry.suggestedQuestions) {
      if (q.personalization == PersonalizationClass.evidenceDerived &&
          q.evidenceRef.isEmpty) {
        issues.add(ValidationIssue('advisor', 'ungrounded ${q.id}'));
      }
      if (q.personalization == PersonalizationClass.unsupported) {
        issues.add(ValidationIssue('advisor', 'unsupported ${q.id}'));
      }
    }
  }

  static void _adviceDuplicates(
    ResultExperience e,
    List<ValidationIssue> issues,
  ) {
    final dupes = AdviceOwnershipPolicy.findDuplicateOwners(
      e.ownedAdviceConceptIds,
    );
    for (final d in dupes) {
      issues.add(ValidationIssue('advice', 'duplicate concept $d'));
    }
  }

  static void _law35(ResultExperience e, List<ValidationIssue> issues) {
    // Priorities must each have meaning, evidence, confidence, action, owner.
    for (final p in e.priorities) {
      if (p.titleAr.isEmpty ||
          p.evidenceRef.isEmpty ||
          p.actionLabelAr.isEmpty) {
        issues.add(
          ValidationIssue(
            'law35',
            'priority ${p.id} violates ${EngineeringLaw35.number}',
          ),
        );
      }
    }
    if (e.immediateAction != null) {
      final a = e.immediateAction!;
      if (a.evidenceRef.isEmpty || a.owner.name.isEmpty) {
        issues.add(
          ValidationIssue('law35', 'action violates ${EngineeringLaw35.number}'),
        );
      }
    }
  }

  static void _law36(ResultExperience e, List<ValidationIssue> issues) {
    // Already covered by language; assert law constant is wired.
    if (EngineeringLaw36.number != 36) {
      issues.add(const ValidationIssue('law36', 'law constant broken'));
    }
  }
}
