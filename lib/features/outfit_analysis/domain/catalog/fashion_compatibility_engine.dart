import 'fashion_compatibility_data.dart';

/// Deterministic outfit pairing from compatibility.json — no AI guessing.
abstract final class FashionCompatibilityEngine {
  FashionCompatibilityEngine._();

  static int boostForPiece({
    required String pieceId,
    required Set<String> anchorIds,
  }) {
    if (anchorIds.isEmpty) return 0;

    var boost = 0;
    for (final anchor in anchorIds) {
      final pair = compatibilityByAnchor[anchor];
      if (pair == null) continue;
      if (pair.compatibleIds.contains(pieceId)) {
        boost = boost < 22 ? 22 : boost;
      }
    }

    return boost;
  }

  static String? whyForPair({
    required String pieceId,
    required Set<String> anchorIds,
  }) {
    for (final anchor in anchorIds) {
      final pair = compatibilityByAnchor[anchor];
      if (pair != null && pair.compatibleIds.contains(pieceId)) {
        return pair.whyAr;
      }
    }
    return null;
  }

  static Set<String> resolveAnchorIds({
    required Set<String> detectedLabels,
    required Iterable<String> catalogIds,
    required bool Function(String label, String catalogId) labelMatchesId,
  }) {
    final anchors = <String>{};
    for (final id in catalogIds) {
      for (final label in detectedLabels) {
        if (labelMatchesId(label, id)) {
          anchors.add(id);
          break;
        }
      }
    }
    return anchors;
  }
}

class CompatibilityPair {
  final String anchorId;
  final List<String> compatibleIds;
  final String whyAr;

  const CompatibilityPair({
    required this.anchorId,
    required this.compatibleIds,
    required this.whyAr,
  });
}
