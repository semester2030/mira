import '../entities/outfit_analysis.dart';
import '../entities/outfit_photo_trust.dart';

/// A displayed score must come from visible styling evidence.
abstract final class OutfitScoreSupport {
  OutfitScoreSupport._();

  static bool hasStylingEvidence(OutfitAnalysis analysis) {
    return analysis.dominantColors.isNotEmpty ||
        analysis.detectedPieces.isNotEmpty ||
        analysis.clothingType.trim().isNotEmpty;
  }

  /// The style engine starts at 75 before any color evidence. That number is not a result.
  static bool showScore(OutfitAnalysis analysis, OutfitResultTrust trust) {
    if (trust.isBlocked || !hasStylingEvidence(analysis)) return false;
    if (analysis.dominantColors.isEmpty &&
        analysis.styleBalanceScore == 75 &&
        analysis.compatibilityScore == 75) {
      return false;
    }
    return analysis.compatibilityScore > 0;
  }
}
