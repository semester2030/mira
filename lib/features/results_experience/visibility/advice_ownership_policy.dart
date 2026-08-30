import '../contracts/result_enums.dart';
import '../versioning/results_experience_versions.dart';

class AdviceConceptOwnership {
  const AdviceConceptOwnership({
    required this.conceptId,
    required this.owner,
    required this.allowDuplicateWithDocumentedTask,
  });

  final String conceptId;
  final AdviceOwner owner;
  final bool allowDuplicateWithDocumentedTask;
}

/// Every advice concept has exactly one public presentation owner.
abstract final class AdviceOwnershipPolicy {
  static const String version = ResultsExperienceVersions.adviceOwnership;

  static const Map<String, AdviceOwner> owners = {
    // Phase 8E — Personal Plan owns core routine actions.
    'hydration': AdviceOwner.routine,
    'moisturizer': AdviceOwner.routine,
    'sunscreen': AdviceOwner.routine,
    'gentle_cleanser': AdviceOwner.routine,
    'weekly_adjustment': AdviceOwner.routine,
    'avoidance': AdviceOwner.routine,
    // Today action may point at a step; care concepts remain routine-owned.
    'today_focus': AdviceOwner.immediateAction,
    'acne_care': AdviceOwner.routine,
    'redness_care': AdviceOwner.routine,
    'pigmentation_care': AdviceOwner.routine,
    'pore_care': AdviceOwner.routine,
    'sleep': AdviceOwner.educationalAdvice,
    'water_intake': AdviceOwner.educationalAdvice,
    'retake': AdviceOwner.immediateAction,
    'progress': AdviceOwner.advisorContext,
    'product_usage': AdviceOwner.productExplanation,
  };

  static AdviceOwner ownerFor(String conceptId) {
    return owners[conceptId] ?? AdviceOwner.educationalAdvice;
  }

  static bool isGeneralEducationConcept(String conceptId) {
    return conceptId == 'sleep' || conceptId == 'water_intake';
  }

  /// Detect duplicate concept ownership attempts in a projected set.
  static List<String> findDuplicateOwners(Iterable<String> conceptIds) {
    final seen = <String>{};
    final dupes = <String>[];
    for (final id in conceptIds) {
      if (!seen.add(id)) dupes.add(id);
    }
    return dupes;
  }
}
