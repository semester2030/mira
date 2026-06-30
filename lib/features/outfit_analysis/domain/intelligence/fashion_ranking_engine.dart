import '../../../../core/ai/models/mira_occasion.dart';
import '../catalog/fashion_asset_catalog.dart';
import '../catalog/fashion_catalog_types.dart';
import '../catalog/fashion_color_library.dart';
import '../catalog/fashion_compatibility_engine.dart';
import '../entities/outfit_analysis.dart';
import 'fashion_color_harmony_engine.dart';
import 'fashion_context_engines.dart';
import 'fashion_intelligence_types.dart';
import 'fashion_knowledge_graph.dart';
import 'fashion_stylist_reasoning.dart';
import 'fashion_trend_engine.dart';

/// Phase 26 — unified multi-factor ranking.
abstract final class FashionRankingEngine {
  FashionRankingEngine._();

  static FashionRankResult rank({
    required CatalogPiece piece,
    required OutfitAnalysis analysis,
    required Set<String> anchorIds,
    required double formality,
    required String styleArchetype,
    required List<String> palette,
    FashionRecommendationContext context = const FashionRecommendationContext(),
  }) {
    final breakdown = <String, double>{};

    if (piece.occasions.contains(analysis.occasion)) breakdown['occasion'] = 18;
    if (formality >= piece.minFormality && formality <= piece.maxFormality) {
      breakdown['formality'] = 22;
    } else if ((formality - piece.minFormality).abs() <= 0.12) {
      breakdown['formality'] = 10;
    }

    if (piece.styleTag == styleArchetype) breakdown['style'] = 16;
    breakdown['colorDeltaE'] = FashionColorLibrary.paletteMatchScore(
      colorId: piece.colorId,
      secondaryColorId: piece.secondaryColorId,
      fallbackHex: piece.colorHex,
      palette: palette,
    );
    breakdown['colorHarmony'] = FashionColorHarmonyEngine.scorePieceAgainstPalette(
      colorId: piece.colorId,
      secondaryColorId: piece.secondaryColorId,
      palette: palette,
    ) * 0.18;

    breakdown['compatibility'] = FashionCompatibilityEngine.boostForPiece(
      pieceId: piece.id,
      anchorIds: anchorIds,
    ).toDouble();
    breakdown['graph'] = FashionKnowledgeGraph.boostForPiece(
      pieceId: piece.id,
      anchorIds: anchorIds,
    );

    breakdown['archetypeScore'] = _archetypeScore(piece, styleArchetype);
    breakdown['trend'] = FashionTrendEngine.scorePiece(piece);
    breakdown['season'] = FashionSeasonalEngine.scorePiece(piece, context);
    breakdown['bodyType'] = FashionBodyTypeEngine.scorePiece(piece, context.bodyType);
    breakdown['climate'] = FashionClimateEngine.scorePiece(piece, context);
    breakdown['extendedOccasion'] = FashionOccasionEngine.scorePiece(
      piece,
      context.extendedOccasion ?? FashionOccasionEngine.mapMiraOccasion(analysis.occasion.id),
    );

    breakdown['analysisHarmony'] = (analysis.colorHarmonyScore / 100) * 8;
    breakdown['userFeedback'] = context.feedbackWeights[piece.id] ?? 0;

    var finalScore = 48.0 + breakdown.values.fold(0.0, (a, b) => a + b);
    finalScore = finalScore.clamp(0, 98);

    final evidence = FashionStylistReasoning.buildEvidence(piece: piece, breakdown: breakdown);
    final graphWhy = FashionKnowledgeGraph.whyForEdge(pieceId: piece.id, anchorIds: anchorIds);
    final reasoningAr = FashionStylistReasoning.build(
      piece: piece,
      analysis: analysis,
      breakdown: breakdown,
      evidence: evidence,
      graphWhy: graphWhy,
    );

    return FashionRankResult(
      finalScore: finalScore,
      confidence: FashionStylistReasoning.confidenceFromBreakdown(breakdown),
      breakdown: breakdown,
      evidence: evidence,
      reasoningAr: reasoningAr,
    );
  }

  static double _archetypeScore(CatalogPiece piece, String archetype) {
    final mapped = switch (archetype) {
      'classic' || 'formal' => 'business',
      'wedding' => 'evening',
      'casual' => 'minimal',
      _ => archetype,
    };
    for (final a in piece.archetypes) {
      if (a == mapped) return (piece.scores.scoreForArchetype(a) / 100) * 14;
    }
    return 0;
  }
}
