import 'dart:math' as math;

/// Rule 3 — preserve user trust; never punish clearly good outfits.
abstract final class OutfitTrustScoring {
  OutfitTrustScoring._();

  static const strongFitMinScore = 70;
  static const harmonyBoostMinScore = 68;

  /// Applies psychological score floors after weighted breakdown.
  static int applyFinalScore({
    required int rawScore,
    required int occasionScore,
    required int styleScore,
    required int colorHarmonyScore,
  }) {
    var score = rawScore;

    if (occasionScore > 80 && styleScore > 75) {
      score = math.max(score, strongFitMinScore);
    }

    if (colorHarmonyScore > 85 && occasionScore > 70) {
      score = math.max(score, harmonyBoostMinScore);
    }

    if (occasionScore > 85 && styleScore > 70 && colorHarmonyScore > 75) {
      score = math.max(score, 72);
    }

    return score.clamp(0, 100);
  }

  /// Boost confidence when harmony is strong — feels more trustworthy.
  static int applyConfidence({
    required int baseConfidence,
    required int colorHarmonyScore,
    required int occasionScore,
    required int styleScore,
  }) {
    var confidence = baseConfidence;
    if (colorHarmonyScore > 85) confidence += 6;
    if (occasionScore > 80) confidence += 4;
    if (styleScore > 75 && occasionScore > 75) confidence += 3;
    return confidence.clamp(55, 98);
  }
}
