/// Honest outfit score / confidence — no artificial inflation floors or boosts.
///
/// Compatibility (fit) and detection confidence are separate signals.
/// Callers must not reuse [applyConfidence] as a stand-in for piece-match %.
abstract final class OutfitTrustScoring {
  OutfitTrustScoring._();

  /// Pass-through of the weighted breakdown (0–100). No psychological floors.
  static int applyFinalScore({
    required int rawScore,
    required int occasionScore,
    required int styleScore,
    required int colorHarmonyScore,
  }) {
    // Parameters retained for call-site compatibility / future diagnostics.
    // ignore: unused_local_variable
    final _ = (occasionScore, styleScore, colorHarmonyScore);
    return rawScore.clamp(0, 100);
  }

  /// Detection / analysis confidence only — no harmony boosts, no 55–98 clamp.
  static int applyConfidence({
    required int baseConfidence,
    required int colorHarmonyScore,
    required int occasionScore,
    required int styleScore,
  }) {
    // Harmony / occasion / style must not inflate "ثقة التحليل".
    // ignore: unused_local_variable
    final _ = (colorHarmonyScore, occasionScore, styleScore);
    return baseConfidence.clamp(0, 100);
  }
}
