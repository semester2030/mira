import '../catalog/fashion_asset_catalog.dart';
import '../entities/outfit_analysis.dart';
import 'fashion_context_engines.dart';
import 'fashion_color_harmony_engine.dart';
import 'fashion_intelligence_types.dart';
import 'fashion_trend_engine.dart';

/// Phase 13 — multi-dimensional outfit scoring.
abstract final class FashionOutfitScorer {
  FashionOutfitScorer._();

  static OutfitDimensionScores score({
    required OutfitAnalysis analysis,
    required List<CatalogPiece> suggestedPieces,
    FashionRecommendationContext context = const FashionRecommendationContext(),
  }) {
    final luxury = _avgPieceScore(suggestedPieces, (p) => p.scores.luxury.toDouble());
    final formal = _avgPieceScore(suggestedPieces, (p) => p.scores.formal.toDouble());
    final business = _avgPieceScore(suggestedPieces, (p) => p.scores.business.toDouble());

    final palette = analysis.segmentMap?.garmentPalette.ordered ?? analysis.dominantColors;
    var harmonySum = 0.0;
    for (final piece in suggestedPieces) {
      harmonySum += FashionColorHarmonyEngine.scorePieceAgainstPalette(
        colorId: piece.colorId,
        secondaryColorId: piece.secondaryColorId,
        palette: palette,
      );
    }
    final colorHarmony = suggestedPieces.isEmpty
        ? analysis.colorHarmonyScore.toDouble()
        : harmonySum / suggestedPieces.length;

    final seasonMatch = suggestedPieces.isEmpty
        ? 70.0
        : suggestedPieces
                .where((p) => p.seasons.contains(context.season ?? FashionSeasonalEngine.currentSeason()))
                .length /
            suggestedPieces.length *
            100;

    final bodyMatch = context.bodyType == null
        ? 75.0
        : suggestedPieces
                .where((p) => p.recommendedFor.contains(context.bodyType!) || p.recommendedFor.contains('all'))
                .length /
            suggestedPieces.length *
            100;

    final trend = FashionTrendEngine.scoreOutfit(analysis) + _avgPieceScore(suggestedPieces, FashionTrendEngine.scorePiece);

    final overall = (
      luxury * 0.14 +
      formal * 0.12 +
      business * 0.10 +
      colorHarmony * 0.18 +
      seasonMatch * 0.10 +
      bodyMatch * 0.08 +
      trend * 0.08 +
      analysis.compatibilityScore * 0.12 +
      analysis.colorHarmonyScore * 0.08
    ).clamp(0, 100);

    return OutfitDimensionScores(
      luxury: luxury,
      formal: formal,
      business: business,
      colorHarmony: colorHarmony,
      seasonMatch: seasonMatch,
      bodyMatch: bodyMatch,
      trend: trend,
      overall: overall.toDouble(),
    );
  }
}

double _avgPieceScore(List<CatalogPiece> pieces, double Function(CatalogPiece) fn) {
  if (pieces.isEmpty) return 0;
  return pieces.map(fn).reduce((a, b) => a + b) / pieces.length;
}
