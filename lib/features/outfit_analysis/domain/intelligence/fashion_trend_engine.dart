import '../catalog/fashion_asset_catalog.dart';
import '../catalog/fashion_catalog_types.dart';
import '../entities/outfit_analysis.dart';
import 'fashion_intelligence_types.dart';
import 'fashion_trends_data.dart';

/// Phase 17 — trend-aware scoring.
abstract final class FashionTrendEngine {
  FashionTrendEngine._();

  static double scorePiece(CatalogPiece piece) {
    var score = 0.0;

    for (final trend in trendColors) {
      if (piece.colorId != null && piece.colorId == trend.id) {
        score += trend.weight * 12;
      }
      if (piece.colorHex.toLowerCase() == trend.hex.toLowerCase()) {
        score += trend.weight * 10;
      }
    }

    for (final style in trendStyles) {
      if (piece.archetypes.contains(style.id) || piece.styles.contains(style.id)) {
        score += style.weight * 10;
      }
    }

    for (final mat in trendMaterials) {
      if (piece.material.toLowerCase() == mat.id) {
        score += mat.weight * 6;
      }
    }

    return score.clamp(0, 22);
  }

  static double scoreOutfit(OutfitAnalysis analysis) {
    var score = 0.0;
    for (final style in trendStyles) {
      if (analysis.styleType.toLowerCase().contains(style.id.replaceAll('_', ' ')) ||
          analysis.styleVerdict.contains(style.nameAr)) {
        score += style.weight * 8;
      }
    }
    return score.clamp(0, 15);
  }
}

class TrendColor {
  final String id;
  final String nameAr;
  final String hex;
  final double weight;

  const TrendColor({
    required this.id,
    required this.nameAr,
    required this.hex,
    required this.weight,
  });
}

class TrendStyle {
  final String id;
  final String nameAr;
  final double weight;

  const TrendStyle({required this.id, required this.nameAr, required this.weight});
}

class TrendMaterial {
  final String id;
  final double weight;

  const TrendMaterial({required this.id, required this.weight});
}
