import '../entities/outfit_analysis.dart';
import 'outfit_stylist_copy.dart';

/// Dedupes result-screen sections so users never see the same bullet twice.
abstract final class OutfitResultSections {
  OutfitResultSections._();

  static OutfitResultSectionPlan plan(OutfitAnalysis analysis) {
    final whyThisWorks = OutfitStylistCopy.whyThisWorks(analysis);

    final strengths = analysis.matchReasons
        .where((reason) => !_isDuplicateOfAny(reason, whyThisWorks))
        .take(3)
        .toList();

    final mismatches = analysis.mismatchReasons;
    final improvements = _uniqueImprovements(
      mismatches: mismatches,
      recommendations: analysis.recommendations,
    );

    return OutfitResultSectionPlan(
      whyThisWorks: whyThisWorks,
      strengths: strengths,
      mismatches: mismatches,
      improvements: improvements,
    );
  }

  static List<String> _uniqueImprovements({
    required List<String> mismatches,
    required List<String> recommendations,
  }) {
    if (recommendations.isEmpty) return const [];

    if (_sameContent(mismatches, recommendations)) return const [];

    return recommendations
        .where((item) => !_isDuplicateOfAny(item, mismatches))
        .take(4)
        .toList();
  }

  static bool _sameContent(List<String> a, List<String> b) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i].trim() != b[i].trim()) return false;
    }
    return a.isNotEmpty;
  }

  static bool _isDuplicateOfAny(String needle, List<String> haystack) {
    final n = _normalize(needle);
    if (n.isEmpty) return true;
    for (final item in haystack) {
      final h = _normalize(item);
      if (h == n || h.contains(n) || n.contains(h)) return true;
    }
    return false;
  }

  static String _normalize(String value) =>
      value.trim().replaceAll(RegExp(r'\s+'), ' ');
}

class OutfitResultSectionPlan {
  final List<String> whyThisWorks;
  final List<String> strengths;
  final List<String> mismatches;
  final List<String> improvements;

  const OutfitResultSectionPlan({
    required this.whyThisWorks,
    required this.strengths,
    required this.mismatches,
    required this.improvements,
  });
}
