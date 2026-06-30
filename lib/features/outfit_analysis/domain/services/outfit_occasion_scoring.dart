import '../../../../core/ai/models/mira_occasion.dart';
import '../entities/outfit_analysis.dart';
import '../entities/outfit_visual_profile.dart';
import '../helpers/outfit_visual_from_analysis.dart';

class OccasionForecast {
  final MiraOccasion occasion;
  final int projectedScore;
  final int deltaFromCurrent;
  final bool isCurrent;

  const OccasionForecast({
    required this.occasion,
    required this.projectedScore,
    required this.deltaFromCurrent,
    this.isCurrent = false,
  });
}

/// Deterministic occasion fit — mirrors [DeterministicOutfitEngine] rules.
abstract final class OutfitOccasionScoring {
  OutfitOccasionScoring._();

  static int score(MiraOccasion occasion, OutfitVisualProfile visual) {
    var score = 72.0;
    switch (occasion) {
      case MiraOccasion.interview:
      case MiraOccasion.work:
        if (visual.formalityLevel >= 0.62) score += 14;
        if (visual.formalityLevel < 0.45) score -= 18;
        if (visual.contrastLevel > 0.78) score -= 10;
        if (visual.styleTypeAr == 'بسيط' || visual.styleTypeAr == 'كلاسيكي') {
          score += 8;
        }
        if (visual.dominantColors.length > 3) score -= 8;
      case MiraOccasion.wedding:
      case MiraOccasion.eid:
        if (visual.formalityLevel >= 0.55) score += 10;
        if (_hasAnyColor(visual, ['ذهبي', 'كريمي', 'نبيتي', 'شامبين'])) score += 6;
      case MiraOccasion.evening:
        if (visual.contrastLevel >= 0.5) score += 8;
        if (visual.formalityLevel >= 0.5) score += 6;
      case MiraOccasion.university:
      case MiraOccasion.casual:
        if (visual.formalityLevel <= 0.65) score += 10;
        if (visual.formalityLevel > 0.8) score -= 6;
    }
    return score.round().clamp(0, 100);
  }

  static List<OccasionForecast> forecastAll(OutfitAnalysis analysis) {
    final visual = OutfitVisualFromAnalysis.toVisualProfile(analysis);
    final currentOccasion = analysis.occasion;
    final currentScore = analysis.occasionMatchScore;

    return MiraOccasion.values
        .map((occ) {
          final projected = score(occ, visual);
          return OccasionForecast(
            occasion: occ,
            projectedScore: projected,
            deltaFromCurrent: projected - currentScore,
            isCurrent: occ == currentOccasion,
          );
        })
        .toList()
      ..sort((a, b) => b.projectedScore.compareTo(a.projectedScore));
  }

  /// Best non-current occasion — prefers higher score, else interesting stretch.
  static OccasionForecast? suggestNext(OutfitAnalysis analysis) {
    final forecasts = forecastAll(analysis);
    final alternatives = forecasts.where((f) => !f.isCurrent).toList();
    if (alternatives.isEmpty) return null;

    final better = alternatives.where((f) => f.deltaFromCurrent >= 3).toList();
    if (better.isNotEmpty) return better.first;

    final close = alternatives.where((f) => f.deltaFromCurrent >= -5).toList();
    if (close.isNotEmpty) return close.first;

    return alternatives.last;
  }

  static bool _hasAnyColor(OutfitVisualProfile visual, List<String> tokens) {
    for (final color in visual.dominantColors) {
      for (final token in tokens) {
        if (color.contains(token)) return true;
      }
    }
    return false;
  }
}
