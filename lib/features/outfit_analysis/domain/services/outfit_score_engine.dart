import '../../../../core/ai/models/mira_occasion.dart';
import '../../../../core/ai/models/outfit_analysis_result.dart';
import '../entities/outfit_capture_signals.dart';
import '../entities/outfit_score_result.dart';
import '../entities/outfit_style_metrics.dart';

/// Strict penalty-based MIRA outfit scoring — no naive averages.
abstract final class OutfitScoreEngine {
  OutfitScoreEngine._();

  static const _positiveWeights = <String, double>{
    'colorHarmony': 0.28,
    'occasionFit': 0.26,
    'styleCoherence': 0.18,
    'silhouetteBalance': 0.14,
    'polish': 0.14,
  };

  static const _negativeWeights = <String, double>{
    'colorClash': 0.18,
    'occasionMismatch': 0.22,
    'tonalImbalance': 0.14,
    'accessoryOverload': 0.10,
    'formalityGap': 0.12,
  };

  static const _issueLabelsAr = <String, String>{
    'colorClash': 'تضارب الألوان',
    'occasionMismatch': 'ملاءمة المناسبة',
    'tonalImbalance': 'توازن الألوان',
    'accessoryOverload': 'كثرة الإكسسوارات',
    'formalityGap': 'فجوة الرسمية',
  };

  static const _positiveLabelsAr = <String, String>{
    'colorHarmony': 'انسجام الألوان',
    'occasionFit': 'ملاءمة المناسبة',
    'styleCoherence': 'تماسك الأسلوب',
    'silhouetteBalance': 'توازن القصّة',
    'polish': 'اللمسة النهائية',
  };

  static OutfitScoreResult compute(
    OutfitAnalysisResult outfit, {
    OutfitCaptureSignals captureQuality = const OutfitCaptureSignals.neutral(),
    int? previousScore,
    bool forceAllowLargeDelta = false,
  }) {
    final metrics = outfit.styleMetrics ?? _deriveFromLegacy(outfit.compatibilityScore);
    final confidenceMultiplier = captureQuality.confidenceMultiplier;
    final confidence = captureQuality.confidencePercent;

    final positive = {
      'colorHarmony': metrics.colorHarmony.clamp(0, 100),
      'occasionFit': metrics.occasionFit.clamp(0, 100),
      'styleCoherence': metrics.styleCoherence.clamp(0, 100),
      'silhouetteBalance': metrics.silhouetteBalance.clamp(0, 100),
      'polish': metrics.polish.clamp(0, 100),
    };

    final negative = {
      'colorClash': metrics.colorClashSeverity.clamp(0, 100),
      'occasionMismatch': metrics.occasionMismatchSeverity.clamp(0, 100),
      'tonalImbalance': metrics.tonalImbalanceSeverity.clamp(0, 100),
      'accessoryOverload': metrics.accessoryOverloadSeverity.clamp(0, 100),
      'formalityGap': metrics.formalityGapSeverity.clamp(0, 100),
    };

    final positiveTotal = _positiveWeightedTotal(positive);
    final negativePenalty = _negativePenaltyTotal(negative);
    final compoundPenalty = _compoundPenalties(negative, outfit.occasion);
    final consistencyBonus = _consistencyBonus(positive);
    final improvementBonus = _improvementBonus(
      positiveTotal - negativePenalty - compoundPenalty,
      previousScore,
    );

    final rawBeforeSmoothing = _composeRawScore(
      positiveTotal: positiveTotal,
      negativePenalty: negativePenalty,
      compoundPenalty: compoundPenalty,
      consistencyBonus: consistencyBonus,
      improvementBonus: improvementBonus,
      confidenceMultiplier: confidenceMultiplier,
    );

    final severeChange = forceAllowLargeDelta ||
        _detectSevereChange(negative, previousScore, rawBeforeSmoothing);

    final finalScore = _applyTemporalSmoothing(
      rawBeforeSmoothing,
      previousScore,
      severeChange: severeChange,
    );

    final strongest = _strongestIssue(negative);
    final weakest = _weakestPositive(positive);

    return OutfitScoreResult(
      finalScore: finalScore,
      confidence: confidence,
      strongestIssueAr: strongest.labelAr,
      strongestIssueId: strongest.id,
      weakestAreaAr: weakest.labelAr,
      weakestAreaId: weakest.id,
      improvementPotential: _improvementPotential(finalScore, negative),
      severityLevel: OutfitSeverityLevel.fromScore(finalScore),
      occasionReady: finalScore >= 72 &&
          confidence >= 70 &&
          negative['occasionMismatch']! <= 55 &&
          negative['colorClash']! <= 60,
      rawScore: rawBeforeSmoothing,
      compoundPenalty: compoundPenalty.round(),
      negativePenalty: negativePenalty.round(),
    );
  }

  static OutfitStyleMetrics _deriveFromLegacy(double score) {
    final health = score.round().clamp(0, 100);
    final severity = (100 - health).clamp(0, 100);
    return OutfitStyleMetrics(
      colorHarmony: health,
      occasionFit: (health - 4).clamp(0, 100),
      styleCoherence: (health - 2).clamp(0, 100),
      silhouetteBalance: (health - 3).clamp(0, 100),
      polish: (health - 5).clamp(0, 100),
      colorClashSeverity: severity,
      occasionMismatchSeverity: (severity - 8).clamp(0, 100),
      tonalImbalanceSeverity: (severity - 12).clamp(0, 100),
      accessoryOverloadSeverity: (severity - 18).clamp(0, 100),
      formalityGapSeverity: (severity - 10).clamp(0, 100),
    );
  }

  static double _positiveWeightedTotal(Map<String, int> positive) {
    var total = 0.0;
    for (final entry in _positiveWeights.entries) {
      total += positive[entry.key]! * entry.value;
    }
    return total;
  }

  static double _negativePenaltyTotal(Map<String, int> negative) {
    var total = 0.0;
    for (final entry in _negativeWeights.entries) {
      total += negative[entry.key]! * entry.value;
    }
    return total;
  }

  static double _compoundPenalties(Map<String, int> negative, MiraOccasion occasion) {
    var compound = 0.0;
    if (negative['colorClash']! > 65 && negative['tonalImbalance']! > 58) {
      compound += 5.5;
    }
    if (negative['occasionMismatch']! > 68 && negative['formalityGap']! > 58) {
      compound += 6;
    }
    if (negative['accessoryOverload']! > 62 && negative['colorClash']! > 55) {
      compound += 3.5;
    }
    if (occasion == MiraOccasion.interview || occasion == MiraOccasion.work) {
      if (negative['formalityGap']! > 62) compound += 2.5;
    }
    return compound;
  }

  static double _consistencyBonus(Map<String, int> positive) {
    final values = positive.values.toList();
    final mean = values.reduce((a, b) => a + b) / values.length;
    final variance =
        values.map((v) => (v - mean) * (v - mean)).reduce((a, b) => a + b) /
            values.length;
    if (variance <= 85 && mean >= 74) return 2.5;
    if (variance <= 130 && mean >= 66) return 1.5;
    return 0;
  }

  static double _improvementBonus(double rawBase, int? previousScore) {
    if (previousScore == null) return 0;
    final delta = rawBase - previousScore;
    if (delta <= 0) return 0;
    return delta.clamp(0, 2).toDouble();
  }

  static int _composeRawScore({
    required double positiveTotal,
    required double negativePenalty,
    required double compoundPenalty,
    required double consistencyBonus,
    required double improvementBonus,
    required double confidenceMultiplier,
  }) {
    final anchored = positiveTotal * 0.6 + 28;
    final issueDrag = negativePenalty * 0.4 + compoundPenalty * 0.75;
    final raw = anchored - issueDrag + consistencyBonus + improvementBonus;
    return _compressToRealisticRange(raw * confidenceMultiplier).round();
  }

  static double _compressToRealisticRange(double raw) {
    if (raw >= 92) return 92 + (raw - 92).clamp(0, 8) * 0.35;
    return raw.clamp(0, 100);
  }

  static bool _detectSevereChange(
    Map<String, int> negative,
    int? previousScore,
    int rawScore,
  ) {
    if (previousScore == null) return false;
    if ((rawScore - previousScore).abs() >= 12) return true;
    return negative.values.any((s) => s >= 80);
  }

  static int _applyTemporalSmoothing(
    int score,
    int? previousScore, {
    required bool severeChange,
  }) {
    if (previousScore == null || severeChange) return score.clamp(0, 100);
    final delta = score - previousScore;
    if (delta.abs() <= 4) return score.clamp(0, 100);
    return (previousScore + delta.sign * 4).clamp(0, 100);
  }

  static _Issue _strongestIssue(Map<String, int> negative) {
    var bestId = negative.keys.first;
    var bestSeverity = -1;
    for (final entry in negative.entries) {
      if (entry.value > bestSeverity) {
        bestSeverity = entry.value;
        bestId = entry.key;
      }
    }
    return _Issue(
      id: bestId,
      labelAr: _issueLabelsAr[bestId] ?? bestId,
    );
  }

  static _Issue _weakestPositive(Map<String, int> positive) {
    var bestId = positive.keys.first;
    var lowest = 101;
    for (final entry in positive.entries) {
      if (entry.value < lowest) {
        lowest = entry.value;
        bestId = entry.key;
      }
    }
    return _Issue(
      id: bestId,
      labelAr: _positiveLabelsAr[bestId] ?? bestId,
    );
  }

  static int _improvementPotential(int finalScore, Map<String, int> negative) {
    final topIssues = negative.values.toList()..sort((a, b) => b.compareTo(a));
    final issueLoad = topIssues.take(3).fold<int>(0, (a, b) => a + b) ~/ 3;
    final headroom = (100 - finalScore).clamp(0, 100);
    return ((headroom * 0.55) + (issueLoad * 0.4)).round().clamp(8, 90);
  }
}

class _Issue {
  final String id;
  final String labelAr;
  const _Issue({required this.id, required this.labelAr});
}
