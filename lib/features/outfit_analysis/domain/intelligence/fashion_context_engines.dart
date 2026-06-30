import '../catalog/fashion_asset_catalog.dart';
import '../catalog/fashion_catalog_types.dart';
import 'fashion_intelligence_types.dart';

/// Phase 16 — seasonal + cultural occasion matching.
abstract final class FashionSeasonalEngine {
  FashionSeasonalEngine._();

  static const culturalOccasions = {
    'ramadan': ['light', 'modest', 'elegant'],
    'eid': ['formal', 'luxury', 'gold'],
    'wedding': ['formal', 'pearl', 'ivory'],
  };

  static double scorePiece(CatalogPiece piece, FashionRecommendationContext ctx) {
    var score = 0.0;
    final season = ctx.season;
    if (season != null && piece.seasons.contains(season)) score += 14;

    final ext = ctx.extendedOccasion;
    if (ext != null) {
      if (ext == 'beach' && piece.archetypes.contains('resort')) score += 12;
      if (ext == 'ramadan' && piece.texture != 'satin') score += 8;
      if (ext == 'wedding' && piece.archetypes.contains('wedding')) score += 16;
    }

    return score.clamp(0, 18);
  }

  static String currentSeason({DateTime? now}) {
    final month = (now ?? DateTime.now()).month;
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'autumn';
    return 'winter';
  }
}

/// Phase 19 — body type fit scoring.
abstract final class FashionBodyTypeEngine {
  FashionBodyTypeEngine._();

  static double scorePiece(CatalogPiece piece, String? bodyType) {
    if (bodyType == null || piece.recommendedFor.isEmpty) return 0;
    if (piece.recommendedFor.contains(bodyType)) return 16;
    if (piece.recommendedFor.contains('all')) return 8;
    return 0;
  }
}

/// Phase 20 — extended occasion engine.
abstract final class FashionOccasionEngine {
  FashionOccasionEngine._();

  static double scorePiece(CatalogPiece piece, String? occasion) {
    if (occasion == null) return 0;
    if (piece.extendedOccasions.contains(occasion)) return 18;
    return 0;
  }

  static String? mapMiraOccasion(String occasionId) => switch (occasionId) {
        'work' => 'office',
        'interview' => 'interview',
        'wedding' => 'wedding',
        'evening' => 'dinner',
        'casual' => 'airport',
        'university' => 'party',
        'eid' => 'eid',
        _ => null,
      };
}

/// Phase 21 — climate-aware recommendations.
abstract final class FashionClimateEngine {
  FashionClimateEngine._();

  static double scorePiece(CatalogPiece piece, FashionRecommendationContext ctx) {
    var score = 0.0;
    final temp = ctx.temperatureC;
    if (temp != null) {
      if (temp >= 30 && piece.material == 'linen') score += 10;
      if (temp >= 30 && piece.material == 'silk') score += 6;
      if (temp <= 12 && (piece.material == 'wool' || piece.material == 'cashmere')) score += 12;
    }
    if (ctx.isRainy && piece.category == 'outerwear') score += 8;
    if (ctx.isWindy && piece.category == 'scarves') score += 10;
    if (ctx.climate == 'hot_humid' && piece.texture == 'matte') score += 6;
    return score.clamp(0, 16);
  }

  static String inferClimate({double? temp, double? humidity, bool rainy = false}) {
    if (rainy) return 'rainy';
    if (temp == null) return 'mild';
    if (temp >= 30 && (humidity ?? 0) >= 60) return 'hot_humid';
    if (temp >= 30) return 'hot_dry';
    if (temp <= 12) return 'cold';
    return 'mild';
  }
}
