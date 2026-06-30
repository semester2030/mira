import '../catalog/fashion_asset_catalog.dart';
import '../catalog/fashion_catalog_types.dart';
import 'fashion_knowledge_graph_data.dart';

/// Phase 12 — graph traversal for outfit pairing.
abstract final class FashionKnowledgeGraph {
  FashionKnowledgeGraph._();

  static double boostForPiece({
    required String pieceId,
    required Set<String> anchorIds,
    String relation = 'works_with',
  }) {
    if (anchorIds.isEmpty) return 0;
    var boost = 0.0;
    for (final anchor in anchorIds) {
      final edges = graphEdgesFrom[anchor] ?? const [];
      for (final edge in edges) {
        if (edge.relation != relation) continue;
        if (edge.to == pieceId) {
          boost = boost < edge.weight * 24 ? edge.weight * 24 : boost;
        }
      }
    }
    return boost;
  }

  static String? whyForEdge({
    required String pieceId,
    required Set<String> anchorIds,
  }) {
    for (final anchor in anchorIds) {
      for (final edge in graphEdgesFrom[anchor] ?? const []) {
        if (edge.to == pieceId && edge.whyAr.isNotEmpty) return edge.whyAr;
      }
    }
    return null;
  }

  static List<String> traverseOutfit({
    required String startId,
    int depth = 4,
  }) {
    final path = <String>[startId];
    var current = startId;
    for (var i = 0; i < depth; i++) {
      final edges = graphEdgesFrom[current] ?? const [];
      if (edges.isEmpty) break;
      final best = edges.reduce((a, b) => a.weight >= b.weight ? a : b);
      if (path.contains(best.to)) break;
      path.add(best.to);
      current = best.to;
    }
    return path;
  }

  static List<String> relatedPieces(String pieceId, {int limit = 6}) {
    final edges = graphEdgesFrom[pieceId] ?? const [];
    return edges.take(limit).map((e) => e.to).toList();
  }
}

class GraphEdge {
  final String from;
  final String to;
  final String relation;
  final double weight;
  final String whyAr;

  const GraphEdge({
    required this.from,
    required this.to,
    required this.relation,
    required this.weight,
    required this.whyAr,
  });
}

/// Phase 11 — ontology path for a catalog piece.
abstract final class FashionOntologyEngine {
  FashionOntologyEngine._();

  static List<String> pathFor(CatalogPiece piece) {
    final path = <String>[
      piece.kind.name,
      piece.category,
      if (piece.subcategory.isNotEmpty) piece.subcategory,
      ...piece.styles,
      ...piece.archetypes,
      piece.brandStyle,
      piece.priceLevel,
    ];
    if (piece.seasons.isNotEmpty) path.add(piece.seasons.first);
    return path;
  }

  static bool matchesArchetype(CatalogPiece piece, String archetype) {
    return piece.archetypes.contains(archetype) || piece.styleTag == archetype;
  }
}
