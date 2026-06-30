import '../catalog/fashion_asset_catalog.dart';
import '../catalog/fashion_catalog_types.dart';
import 'fashion_knowledge_graph.dart';
import 'fashion_similarity_search.dart';

/// Phase 22 — capsule wardrobe outfit combinator.
abstract final class CapsuleWardrobeEngine {
  CapsuleWardrobeEngine._();

  static List<List<String>> generateOutfits({
    required Set<String> closetPieceIds,
    int targetCount = 100,
    int maxDepth = 5,
  }) {
    final outfits = <List<String>>[];
    final seen = <String>{};

    for (final id in closetPieceIds) {
      final path = FashionKnowledgeGraph.traverseOutfit(startId: id, depth: maxDepth);
      final filtered = path.where(closetPieceIds.contains).toList();
      if (filtered.length < 2) continue;
      final key = filtered.join('|');
      if (seen.contains(key)) continue;
      seen.add(key);
      outfits.add(filtered);
      if (outfits.length >= targetCount) break;
    }

    if (outfits.length < targetCount) {
      for (final anchor in FashionAssetCatalog.clothingPieces()) {
        if (!closetPieceIds.contains(anchor.id)) continue;
        for (final acc in FashionAssetCatalog.accessoryPieces()) {
          if (!closetPieceIds.contains(acc.id)) continue;
          final combo = [anchor.id, acc.id];
          final key = combo.join('|');
          if (seen.add(key)) outfits.add(combo);
          if (outfits.length >= targetCount) return outfits;
        }
      }
    }

    return outfits;
  }
}

/// Phase 23 — closet redundancy insights.
abstract final class ClosetOptimizationEngine {
  ClosetOptimizationEngine._();

  static List<String> analyzeRedundancy(Map<String, int> categoryCounts) {
    final tips = <String>[];
    final whiteShirts = categoryCounts['white_shirt'] ?? 0;
    if (whiteShirts >= 10) {
      tips.add('لديك $whiteShirts قميصًا أبيض — لا تحتاجين شراء المزيد الآن');
    }
    final blackHeels = categoryCounts['black_heels'] ?? 0;
    if (blackHeels >= 4) {
      tips.add('لديك $blackHeels أحذية سوداء — ركّزي على nude أو metallics');
    }
    return tips;
  }

  static List<CatalogPiece> unusedPieces({
    required Set<String> closetIds,
    required Set<String> wornIds,
  }) {
    return FashionAssetCatalog.all
        .where((p) => closetIds.contains(p.id) && !wornIds.contains(p.id))
        .toList();
  }
}

/// Phase 24 — duplicate detection via embedding similarity.
abstract final class DuplicateDetectionEngine {
  DuplicateDetectionEngine._();

  static bool isDuplicate({
    required String existingPieceId,
    required String candidatePieceId,
    double threshold = 0.97,
  }) {
    final a = FashionEmbeddingService.vectorFor(existingPieceId);
    final b = FashionEmbeddingService.vectorFor(candidatePieceId);
    if (a == null || b == null) return existingPieceId == candidatePieceId;
    return FashionEmbeddingService.cosineSimilarity(a, b) >= threshold;
  }
}
