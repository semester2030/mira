/// Phase 29 — wardrobe & recommendation analytics dashboard data.
class FashionAnalyticsSnapshot {
  final Map<String, int> pieceUsageCounts;
  final Map<String, int> colorPreferenceCounts;
  final int savedOutfits;
  final List<String> unusedPieceIds;
  final double avgRecommendationScore;
  final double aiAcceptRate;
  final Map<String, double> tasteTrendOverTime;

  const FashionAnalyticsSnapshot({
    this.pieceUsageCounts = const {},
    this.colorPreferenceCounts = const {},
    this.savedOutfits = 0,
    this.unusedPieceIds = const [],
    this.avgRecommendationScore = 0,
    this.aiAcceptRate = 0,
    this.tasteTrendOverTime = const {},
  });
}

abstract final class FashionAnalyticsEngine {
  FashionAnalyticsEngine._();

  static FashionAnalyticsSnapshot build({
    required List<double> recommendationScores,
    required int accepted,
    required int rejected,
    required Map<String, int> usage,
    required Map<String, int> colors,
    required Set<String> unused,
    int saved = 0,
  }) {
    final total = accepted + rejected;
    return FashionAnalyticsSnapshot(
      pieceUsageCounts: usage,
      colorPreferenceCounts: colors,
      savedOutfits: saved,
      unusedPieceIds: unused.toList(),
      avgRecommendationScore: recommendationScores.isEmpty
          ? 0
          : recommendationScores.reduce((a, b) => a + b) / recommendationScores.length,
      aiAcceptRate: total == 0 ? 0 : accepted / total,
    );
  }
}
