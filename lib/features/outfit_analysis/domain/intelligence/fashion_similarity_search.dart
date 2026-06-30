import 'dart:math' as math;

import '../catalog/fashion_asset_catalog.dart';
import '../catalog/fashion_catalog_types.dart';
import 'fashion_embedding_data.dart';
import 'fashion_intelligence_types.dart';

/// Phase 25 — embedding-backed similarity (stub vectors until ML model).
abstract final class FashionEmbeddingService {
  FashionEmbeddingService._();

  static List<double>? vectorFor(String pieceId) => pieceEmbeddings[pieceId];

  static double cosineSimilarity(List<double> a, List<double> b) {
    if (a.length != b.length || a.isEmpty) return 0;
    var dot = 0.0;
    var na = 0.0;
    var nb = 0.0;
    for (var i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    if (na == 0 || nb == 0) return 0;
    return dot / (math.sqrt(na) * math.sqrt(nb));
  }
}

/// Phase 15 — visual similarity search over catalog embeddings.
abstract final class FashionSimilaritySearch {
  FashionSimilaritySearch._();

  static List<FashionSimilarityMatch> findSimilar({
    required String queryPieceId,
    int limit = 50,
    double minSimilarity = 0.75,
  }) {
    final query = FashionEmbeddingService.vectorFor(queryPieceId);
    if (query == null) return const [];

    final matches = <FashionSimilarityMatch>[];
    for (final piece in FashionAssetCatalog.all) {
      if (piece.id == queryPieceId) continue;
      final vec = FashionEmbeddingService.vectorFor(piece.id);
      if (vec == null) continue;
      final sim = FashionEmbeddingService.cosineSimilarity(query, vec);
      if (sim < minSimilarity) continue;
      matches.add(FashionSimilarityMatch(
        pieceId: piece.id,
        similarity: sim,
        asset: piece.asset,
      ));
    }

    matches.sort((a, b) => b.similarity.compareTo(a.similarity));
    return matches.take(limit).toList();
  }

  static List<FashionSimilarityMatch> findSimilarToVector({
    required List<double> queryVector,
    int limit = 50,
  }) {
    final matches = <FashionSimilarityMatch>[];
    for (final piece in FashionAssetCatalog.all) {
      final vec = FashionEmbeddingService.vectorFor(piece.id);
      if (vec == null) continue;
      final sim = FashionEmbeddingService.cosineSimilarity(queryVector, vec);
      matches.add(FashionSimilarityMatch(
        pieceId: piece.id,
        similarity: sim,
        asset: piece.asset,
      ));
    }
    matches.sort((a, b) => b.similarity.compareTo(a.similarity));
    return matches.take(limit).toList();
  }
}
