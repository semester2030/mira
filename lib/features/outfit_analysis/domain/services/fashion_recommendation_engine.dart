import '../../../../core/ai/models/mira_occasion.dart';
import '../catalog/fashion_asset_catalog.dart';
import '../entities/outfit_analysis.dart';
import '../entities/suggested_piece_model.dart';
import '../helpers/outfit_fashion_taxonomy.dart';
import '../intelligence/fashion_context_engines.dart';
import '../intelligence/fashion_intelligence_types.dart';
import '../intelligence/fashion_ranking_engine.dart';
import '../catalog/fashion_compatibility_engine.dart';

/// Deterministic stylist picks — unified ranking engine (Phases 26–27).
abstract final class FashionRecommendationEngine {
  FashionRecommendationEngine._();

  static const minCompatibility = 62.0;

  static List<SuggestedPieceModel> suggestClothing(
    OutfitAnalysis analysis, {
    FashionRecommendationContext? context,
  }) {
    return _recommend(
      analysis: analysis,
      pool: FashionAssetCatalog.clothingPieces(),
      limit: 4,
      context: context ?? _defaultContext(analysis),
    );
  }

  static List<SuggestedPieceModel> suggestAccessories(
    OutfitAnalysis analysis, {
    FashionRecommendationContext? context,
  }) {
    final ctx = context ?? _defaultContext(analysis);
    final fromEngine = _recommend(
      analysis: analysis,
      pool: FashionAssetCatalog.accessoryPieces(),
      limit: 5,
      context: ctx,
    );
    if (fromEngine.isNotEmpty) return fromEngine;

    return _fromTextSuggestions(analysis).take(5).toList();
  }

  static FashionRecommendationContext _defaultContext(OutfitAnalysis analysis) {
    return FashionRecommendationContext(
      season: FashionSeasonalEngine.currentSeason(),
      extendedOccasion: FashionOccasionEngine.mapMiraOccasion(analysis.occasion.id),
      climate: FashionClimateEngine.inferClimate(),
    );
  }

  static List<SuggestedPieceModel> _recommend({
    required OutfitAnalysis analysis,
    required List<CatalogPiece> pool,
    required int limit,
    required FashionRecommendationContext context,
  }) {
    final formality = _formalityScore(analysis);
    final styleArchetype = _styleArchetype(analysis);
    final palette = _palette(analysis);
    final detected = _detectedLabels(analysis);
    final anchorIds = FashionCompatibilityEngine.resolveAnchorIds(
      detectedLabels: detected,
      catalogIds: FashionAssetCatalog.all.map((p) => p.id),
      labelMatchesId: _labelMatchesId,
    );

    final scored = <SuggestedPieceModel>[];
    for (final piece in pool) {
      if (_isDuplicate(piece, detected)) continue;

      final rank = FashionRankingEngine.rank(
        piece: piece,
        analysis: analysis,
        anchorIds: anchorIds,
        formality: formality,
        styleArchetype: styleArchetype,
        palette: palette,
        context: context,
      );

      if (rank.finalScore < minCompatibility) continue;
      if (piece.whyAr.trim().isEmpty && rank.reasoningAr.trim().isEmpty) continue;

      scored.add(piece.toModel(
        rank.finalScore,
        whyOverride: rank.reasoningAr,
        confidence: rank.confidence,
        evidence: rank.evidence,
        scoreBreakdown: rank.breakdown,
      ));
    }

    scored.sort((a, b) => b.compatibilityScore.compareTo(a.compatibilityScore));
    return _dedupeByCategory(scored).take(limit).toList();
  }

  static List<SuggestedPieceModel> _fromTextSuggestions(OutfitAnalysis analysis) {
    final out = <SuggestedPieceModel>[];
    for (final label in analysis.suggestedAccessories) {
      final match = FashionAssetCatalog.accessoryPieces().where((piece) {
        return _labelMatchesPiece(label, piece);
      }).firstOrNull;
      if (match == null) continue;
      out.add(match.toModel(minCompatibility + 8));
    }
    return out;
  }

  static String _styleArchetype(OutfitAnalysis analysis) {
    final style = analysis.styleType.toLowerCase();
    if (analysis.occasion == MiraOccasion.wedding) return 'wedding';
    if (analysis.occasion == MiraOccasion.casual ||
        analysis.occasion == MiraOccasion.university) {
      return 'casual';
    }
    if (style.contains('كلاس') ||
        style.contains('أنيق') ||
        style.contains('classic') ||
        analysis.styleVerdict.contains('أناقة')) {
      return 'classic';
    }
    if (style.contains('رسم') ||
        style.contains('formal') ||
        _formalityScore(analysis) >= 0.72) {
      return 'formal';
    }
    return switch (analysis.occasion) {
      MiraOccasion.work || MiraOccasion.interview => 'formal',
      MiraOccasion.evening || MiraOccasion.eid => 'classic',
      _ => 'casual',
    };
  }

  static double _formalityScore(OutfitAnalysis analysis) {
    final level = analysis.formalityLevel.toLowerCase();
    if (level.contains('عال') || level.contains('formal') || level.contains('رسم')) {
      return 0.88;
    }
    if (level.contains('متوسط') || level.contains('medium')) return 0.58;
    if (level.contains('منخف') || level.contains('casual') || level.contains('كاج')) {
      return 0.32;
    }
    return switch (analysis.occasion) {
      MiraOccasion.wedding => 0.92,
      MiraOccasion.work || MiraOccasion.interview => 0.82,
      MiraOccasion.evening || MiraOccasion.eid => 0.72,
      MiraOccasion.university => 0.45,
      MiraOccasion.casual => 0.28,
    };
  }

  static List<String> _palette(OutfitAnalysis analysis) {
    final garment = analysis.segmentMap?.garmentPalette.ordered ?? const [];
    if (garment.isNotEmpty) return garment;
    return analysis.dominantColors;
  }

  static bool _isDuplicate(CatalogPiece piece, Set<String> detected) {
    for (final label in detected) {
      if (_labelMatchesPiece(label, piece)) return true;
    }
    return false;
  }

  static bool _labelMatchesId(String label, String catalogId) {
    final piece = FashionAssetCatalog.byId(catalogId);
    if (piece == null) return false;
    return _labelMatchesPiece(label, piece);
  }

  static bool _labelMatchesPiece(String label, CatalogPiece piece) {
    final l = label.toLowerCase();
    final title = piece.titleAr.toLowerCase();
    if (title.contains(l) || l.contains(title)) return true;

    if (piece.category == 'bags' && (l.contains('حقيب') || l.contains('كلات'))) return true;
    if (piece.category == 'heels' && l.contains('حذ')) return true;
    if (piece.category == 'jewelry' &&
        (l.contains('عقد') || l.contains('قرط') || l.contains('سوار'))) {
      return true;
    }
    if (piece.category == 'watch' && l.contains('ساع')) return true;
    if (piece.category == 'scarves' && l.contains('وشاح')) return true;
    if (piece.category == 'tops' &&
        (OutfitFashionTaxonomy.isClothing(label) && !l.contains('تن'))) {
      return title.contains(l);
    }
    if (piece.subcategory.isNotEmpty && l.contains(piece.subcategory)) return true;
    if (l.contains('بدلة') && piece.id.contains('blazer')) return true;
    if (l.contains('قميص') && piece.subcategory == 'blouse') return true;
    if (l.contains('تن') && piece.category == 'bottoms') return true;
    return false;
  }

  static Set<String> _detectedLabels(OutfitAnalysis analysis) {
    final labels = <String>{
      ...analysis.detectedPieces,
      analysis.clothingType,
    };
    final regions = analysis.segmentMap?.regions ?? const [];
    for (final region in regions) {
      labels.add(region.labelAr);
    }
    labels.removeWhere((e) => e.trim().isEmpty);
    return labels;
  }

  static List<SuggestedPieceModel> _dedupeByCategory(List<SuggestedPieceModel> items) {
    final seenCategories = <String>{};
    final out = <SuggestedPieceModel>[];
    for (final item in items) {
      final key = item.category;
      if (seenCategories.contains(key)) continue;
      seenCategories.add(key);
      out.add(item);
    }
    return out;
  }
}

extension _FirstOrNull<E> on Iterable<E> {
  E? get firstOrNull {
    final it = iterator;
    if (!it.moveNext()) return null;
    return it.current;
  }
}
