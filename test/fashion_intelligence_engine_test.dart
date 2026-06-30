import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/outfit_analysis/domain/catalog/fashion_catalog_types.dart';
import 'package:mirra/features/outfit_analysis/domain/catalog/fashion_color_library_data.dart';
import 'package:mirra/features/outfit_analysis/domain/intelligence/fashion_color_harmony_engine.dart';
import 'package:mirra/features/outfit_analysis/domain/intelligence/fashion_knowledge_graph.dart';
import 'package:mirra/features/outfit_analysis/domain/intelligence/fashion_similarity_search.dart';

void main() {
  group('FashionColorHarmonyEngine', () {
    test('beige and navy score well (complementary-ish)', () {
      final beige = colorEntries['beige_linen']!;
      final navy = colorEntries['navy_deep']!;
      final score = FashionColorHarmonyEngine.scorePair(beige, navy);
      expect(score, greaterThan(0));
    });

    test('monochrome cream/beige scores high', () {
      final cream = colorEntries['cream_soft']!;
      final beige = colorEntries['beige_linen']!;
      final score = FashionColorHarmonyEngine.scorePair(cream, beige);
      expect(score, greaterThan(50));
    });
  });

  group('FashionKnowledgeGraph', () {
    test('blazer traverses to related pieces', () {
      final path = FashionKnowledgeGraph.traverseOutfit(startId: 'blazer_beige_001');
      expect(path.length, greaterThan(1));
      expect(path.first, 'blazer_beige_001');
    });

    test('boosts compatible trousers from blazer anchor', () {
      final boost = FashionKnowledgeGraph.boostForPiece(
        pieceId: 'trousers_navy_001',
        anchorIds: {'blazer_beige_001'},
      );
      expect(boost, greaterThan(0));
    });
  });

  group('FashionSimilaritySearch', () {
    test('finds similar pieces for blazer', () {
      final matches = FashionSimilaritySearch.findSimilar(
        queryPieceId: 'blazer_beige_001',
        limit: 5,
        minSimilarity: 0,
      );
      expect(matches, isNotEmpty);
      expect(matches.every((m) => m.similarity >= 0 && m.similarity <= 1), isTrue);
    });
  });
}
