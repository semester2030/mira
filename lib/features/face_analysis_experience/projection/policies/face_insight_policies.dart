import '../contracts/face_result_enums.dart';
import '../contracts/face_result_vms.dart';

/// Deterministic semantic deduplication for insights.
abstract final class FaceInsightDeduplication {
  FaceInsightDeduplication._();

  /// Normalize title/body into a semantic key for shape/geometry concepts.
  static String semanticKey({
    required String? shapeId,
    required String? metricId,
    required String category,
    required String titleAr,
  }) {
    if (shapeId != null && shapeId.isNotEmpty) {
      return 'shape:$shapeId';
    }
    if (metricId != null && metricId.isNotEmpty) {
      return 'metric:$metricId';
    }
    final normalized = titleAr
        .replaceAll(RegExp(r'\s+'), ' ')
        .replaceAll('شكل وجهك', 'شكل الوجه')
        .replaceAll('الوجه البيضاوي', 'شكل الوجه بيضاوي')
        .trim()
        .toLowerCase();
    return 'text:$category:$normalized';
  }

  static List<FaceInsightVm> dedupe(List<FaceInsightVm> insights) {
    final seen = <String>{};
    final out = <FaceInsightVm>[];
    for (final i in insights) {
      if (seen.add(i.semanticKey)) {
        out.add(i);
      }
    }
    return out;
  }
}

/// Insight priority: shape → meaningful geometry → structural note.
/// Never prioritizes beauty/attractiveness drama.
abstract final class FaceInsightPriorityPolicy {
  FaceInsightPriorityPolicy._();

  static const maxInsights = 3;

  static int importanceFor({
    required String semanticKey,
    required String category,
  }) {
    if (semanticKey.startsWith('shape:')) return 100;
    if (semanticKey.contains('facialThirdsBalance')) return 80;
    if (semanticKey.contains('faceWidthHeightRatio')) return 75;
    if (semanticKey.contains('eyeSpacingRatio')) return 70;
    if (semanticKey.contains('symmetryCautious') ||
        category == 'symmetry_note') {
      return 55; // structural, not beauty
    }
    if (semanticKey.contains('noseToFaceWidthRatio') ||
        semanticKey.contains('mouthToFaceWidthRatio')) {
      return 50;
    }
    return 40;
  }

  static List<FaceInsightVm> selectTop(List<FaceInsightVm> candidates) {
    final sorted = [...candidates]
      ..sort((a, b) {
        final c = b.importance.compareTo(a.importance);
        if (c != 0) return c;
        return a.id.compareTo(b.id);
      });
    return sorted.take(maxInsights).toList(growable: false);
  }
}

abstract final class FaceRegionMapping {
  FaceRegionMapping._();

  static FacePresentationRegion forMetric(String metricId) {
    switch (metricId) {
      case 'facialThirdsBalance':
        return FacePresentationRegion.faceGeneral;
      case 'eyeSpacingRatio':
        return FacePresentationRegion.eyes;
      case 'noseToFaceWidthRatio':
        return FacePresentationRegion.nose;
      case 'mouthToFaceWidthRatio':
        return FacePresentationRegion.mouth;
      case 'faceWidthHeightRatio':
      case 'symmetryCautious':
      case 'faceShape':
        return FacePresentationRegion.faceGeneral;
      default:
        return FacePresentationRegion.faceGeneral;
    }
  }
}
