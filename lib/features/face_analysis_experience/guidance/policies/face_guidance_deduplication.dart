import '../../../intelligence/domain/entities/face_intelligence_report.dart';

/// Semantic dedup — one concept per category family.
abstract final class FaceGuidanceDeduplication {
  FaceGuidanceDeduplication._();

  static String conceptKey(FaceIntelRecommendation rec) {
    // Stable concept: category (+ shape suffix if present in id).
    final id = rec.id;
    final shapeMatch = RegExp(r'rec_[a-z]+_([a-z]+)').firstMatch(id);
    if (shapeMatch != null && rec.category != 'educational') {
      return '${rec.category}:${shapeMatch.group(1)}';
    }
    if (rec.category == 'accessories') {
      return 'accessories:${rec.id}';
    }
    return rec.category;
  }

  static List<FaceIntelRecommendation> dedupe(
    List<FaceIntelRecommendation> recs,
  ) {
    final best = <String, FaceIntelRecommendation>{};
    for (final r in recs) {
      final key = conceptKey(r);
      final existing = best[key];
      if (existing == null) {
        best[key] = r;
        continue;
      }
      // Prefer stable lower id for determinism when same concept.
      if (r.id.compareTo(existing.id) < 0) {
        best[key] = r;
      }
    }
    final out = best.values.toList()
      ..sort((a, b) => a.id.compareTo(b.id));
    return out;
  }

  /// Drop guidance that duplicates already-visible insight titles/bodies.
  static bool overlapsInsightCopy({
    required String titleAr,
    required String bodyAr,
    required Iterable<String> insightTitles,
    required Iterable<String> insightBodies,
  }) {
    final t = titleAr.trim();
    final b = bodyAr.trim();
    for (final it in insightTitles) {
      if (it.trim() == t) return true;
    }
    for (final ib in insightBodies) {
      if (ib.trim() == b) return true;
      if (b.isNotEmpty && ib.contains(b) && b.length > 24) return true;
    }
    return false;
  }
}
