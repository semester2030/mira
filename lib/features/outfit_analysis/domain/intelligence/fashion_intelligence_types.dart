/// Context signals for multi-factor fashion ranking (Phases 16–21, 26–28).
class FashionRecommendationContext {
  final String? bodyType;
  final String? season;
  final String? climate;
  final double? temperatureC;
  final double? humidity;
  final bool isRainy;
  final bool isWindy;
  final String? extendedOccasion;
  final Map<String, double> userTasteWeights;
  final Set<String> closetPieceIds;
  final Map<String, double> feedbackWeights;

  const FashionRecommendationContext({
    this.bodyType,
    this.season,
    this.climate,
    this.temperatureC,
    this.humidity,
    this.isRainy = false,
    this.isWindy = false,
    this.extendedOccasion,
    this.userTasteWeights = const {},
    this.closetPieceIds = const {},
    this.feedbackWeights = const {},
  });

  factory FashionRecommendationContext.defaults({String? season}) {
    return FashionRecommendationContext(season: season);
  }
}

/// Multi-dimensional outfit evaluation (Phase 13).
class OutfitDimensionScores {
  final double luxury;
  final double formal;
  final double business;
  final double colorHarmony;
  final double seasonMatch;
  final double bodyMatch;
  final double trend;
  final double overall;

  const OutfitDimensionScores({
    this.luxury = 0,
    this.formal = 0,
    this.business = 0,
    this.colorHarmony = 0,
    this.seasonMatch = 0,
    this.bodyMatch = 0,
    this.trend = 0,
    this.overall = 0,
  });
}

/// Explainable ranking output (Phases 26–27).
class FashionRankResult {
  final double finalScore;
  final double confidence;
  final Map<String, double> breakdown;
  final List<String> evidence;
  final String reasoningAr;

  const FashionRankResult({
    required this.finalScore,
    required this.confidence,
    required this.breakdown,
    required this.evidence,
    required this.reasoningAr,
  });
}

/// Visual similarity match (Phase 15).
class FashionSimilarityMatch {
  final String pieceId;
  final double similarity;
  final String asset;

  const FashionSimilarityMatch({
    required this.pieceId,
    required this.similarity,
    required this.asset,
  });
}
