import '../contracts/result_enums.dart';
import '../contracts/result_presentation_vms.dart';
import '../versioning/results_experience_versions.dart';

/// Deterministic visibility + first-surface composition policy.
abstract final class VisibilityPolicy {
  static const String version = ResultsExperienceVersions.visibilityPolicy;

  static const int maxPriorities = 3;

  /// First future result surface hard caps (contracts only — no UI in 8B).
  static const Set<String> requiredFirstSurfaceRoles = {
    'summary',
    'priorities',
    'immediate_action',
    'routine_entry',
    'progress_entry',
    'advisor_entry',
  };

  static bool isPubliclyVisible(VisibilityState state) {
    switch (state) {
      case VisibilityState.visiblePrimary:
      case VisibilityState.visibleSecondary:
      case VisibilityState.visibleDetails:
        return true;
      case VisibilityState.hiddenLowConfidence:
      case VisibilityState.hiddenMissingEvidence:
      case VisibilityState.hiddenDuplicate:
      case VisibilityState.hiddenInternal:
      case VisibilityState.hiddenIneligible:
      case VisibilityState.unavailable:
        return false;
    }
  }

  static List<String> buildFirstSurfaceIds({
    required ResultSummaryVM summary,
    required List<ResultPriorityVM> priorities,
    required ResultActionVM? action,
    required ResultRoutinePreviewVM routine,
    required ResultProgressPreviewVM progress,
    required ResultAdvisorEntryVM advisor,
  }) {
    final ids = <String>[summary.id];
    for (final p in priorities.take(maxPriorities)) {
      if (isPubliclyVisible(p.visibility)) ids.add(p.id);
    }
    if (action != null && isPubliclyVisible(action.visibility)) {
      ids.add(action.id);
    }
    if (isPubliclyVisible(routine.visibility)) ids.add(routine.id);
    if (isPubliclyVisible(progress.visibility)) ids.add(progress.id);
    if (isPubliclyVisible(advisor.visibility)) ids.add(advisor.id);
    return List.unmodifiable(ids);
  }

  static bool firstSurfaceIncludesSkinAge(List<String> firstSurfaceIds) {
    return firstSurfaceIds.any((id) => id.contains('skin_age'));
  }

  static void assertFirstSurfaceContract({
    required List<ResultPriorityVM> priorities,
    required List<String> firstSurfaceIds,
    required ResultSkinAgeVM skinAge,
  }) {
    if (priorities.length > maxPriorities) {
      throw StateError('Priority count exceeds $maxPriorities');
    }
    if (firstSurfaceIncludesSkinAge(firstSurfaceIds)) {
      throw StateError('Skin age must not appear on first surface');
    }
    if (skinAge.visibility == VisibilityState.visiblePrimary) {
      throw StateError('Skin age cannot be visible_primary');
    }
  }
}
