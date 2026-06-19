import '../entities/beauty_score_result.dart';
import '../entities/capture_quality_signals.dart';
import '../entities/skin_report.dart';
import 'skin_report_matrix.dart';

/// Strict, penalty-based MIRA beauty scoring — no simple averages.
abstract final class BeautyScoreEngine {
  BeautyScoreEngine._();

  static const _positiveWeights = <String, double>{
    'hydration': 0.22,
    'firmness': 0.18,
    'smoothness': 0.16,
    'elasticity': 0.14,
    'radiance': 0.20,
  };

  static const _negativeWeights = <String, double>{
    'oiliness': 0.12,
    'pores': 0.10,
    'acne': 0.14,
    'pigmentation': 0.10,
    'redness': 0.10,
    'darkCircles': 0.08,
    'wrinkles': 0.12,
    'textureIrregularity': 0.08,
  };

  static const _issueLabelsAr = <String, String>{
    'oiliness': 'إفراز الدهون',
    'pores': 'المسام',
    'acne': 'الحبوب',
    'pigmentation': 'التصبغات',
    'redness': 'الاحمرار',
    'darkCircles': 'الهالات',
    'wrinkles': 'التجاعيد',
    'textureIrregularity': 'الملمس',
  };

  static const _positiveLabelsAr = <String, String>{
    'hydration': 'الترطيب',
    'firmness': 'المرونة',
    'smoothness': 'النعومة',
    'elasticity': 'المرونة',
    'radiance': 'الإشراق',
  };

  /// Computes a realistic beauty score from skin metrics.
  static BeautyScoreResult compute(
    SkinReport report, {
    CaptureQualitySignals captureQuality = const CaptureQualitySignals.neutral(),
    int? previousScore,
    bool forceAllowLargeDelta = false,
  }) {
    final metrics = _extractMetrics(report);
    final confidenceMultiplier = captureQuality.confidenceMultiplier;
    final confidence = captureQuality.confidencePercent;

    final positiveTotal = _positiveWeightedTotal(metrics.positive);
    final negativePenalty = _negativePenaltyTotal(metrics.negative);
    final compoundPenalty = _compoundPenalties(metrics.negative);
    final consistencyBonus = _consistencyBonus(metrics.positive);
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
        _detectSevereChange(metrics.negative, previousScore, rawBeforeSmoothing);

    final smoothed = _applyTemporalSmoothing(
      rawBeforeSmoothing,
      previousScore,
      severeChange: severeChange,
    );

    final finalScore = smoothed.clamp(0, 100);
    final strongest = _strongestIssue(metrics.negative);
    final weakest = _weakestPositive(metrics.positive);

    return BeautyScoreResult(
      finalScore: finalScore,
      confidence: confidence,
      strongestIssue: strongest.labelAr,
      strongestIssueId: strongest.id,
      weakestArea: weakest.labelAr,
      weakestAreaId: weakest.id,
      improvementPotential: _improvementPotential(finalScore, metrics.negative),
      severityLevel: BeautySeverityLevel.fromScore(finalScore),
      premiumReadiness: finalScore >= 79 &&
          confidence >= 72 &&
          strongest.severity <= 48 &&
          metrics.negative.values.every((s) => s <= 72),
      rawScore: rawBeforeSmoothing,
      compoundPenalty: compoundPenalty.round(),
      negativePenalty: negativePenalty.round(),
    );
  }

  static int scoreFor(SkinReport report, {int? previousScore}) =>
      compute(report, previousScore: previousScore).finalScore;

  static _Metrics _extractMetrics(SkinReport report) {
    final scores = {
      for (final c in SkinReportMatrix.matrixScores(report)) c.id: c.score,
    };

    int health(String id, int fallback) =>
        (scores[id] ?? fallback).clamp(0, 100);

    int severityFromHealth(int value) => (100 - value).clamp(0, 100);

    final hydration = health('moisture', report.hydration);
    final wrinkleHealth = health('wrinkle', _legacyHealth(report.wrinkles));
    final poreHealth = health('pore', _legacyHealth(report.pores));
    final textureHealth = health('texture', _blend(hydration, poreHealth));
    final firmness = health('firmness', _blend(wrinkleHealth, hydration));
    final radiance = health(
      'radiance',
      _blend(hydration, 100 - report.oiliness.clamp(0, 100)),
    );
    final smoothness = _blend(textureHealth, wrinkleHealth);
    final elasticity = _blend(firmness, wrinkleHealth);

    final oilinessSeverity = report.concernScores.isNotEmpty
        ? severityFromHealth(health('oiliness', 100 - report.oiliness))
        : report.oiliness.clamp(0, 100);

    return _Metrics(
      positive: {
        'hydration': hydration,
        'firmness': firmness,
        'smoothness': smoothness,
        'elasticity': elasticity,
        'radiance': radiance,
      },
      negative: {
        'oiliness': oilinessSeverity,
        'pores': severityFromHealth(poreHealth),
        'acne': severityFromHealth(health('acne', _legacyHealth(report.acne))),
        'pigmentation':
            severityFromHealth(health('age_spot', _legacyHealth(report.spots))),
        'redness':
            severityFromHealth(health('redness', _legacyHealth(report.redness))),
        'darkCircles': severityFromHealth(
          health('dark_circle', _blend(hydration, wrinkleHealth)),
        ),
        'wrinkles': severityFromHealth(wrinkleHealth),
        'textureIrregularity': severityFromHealth(textureHealth),
      },
    );
  }

  static int _legacyHealth(int severity0to5) =>
      ((5 - severity0to5.clamp(0, 5)) / 5 * 100).round().clamp(0, 100);

  static int _blend(int a, int b) => ((a + b) / 2).round().clamp(0, 100);

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

  static double _compoundPenalties(Map<String, int> negative) {
    var compound = 0.0;

    if (negative['oiliness']! > 70 && negative['pores']! > 70) {
      compound += 6.5;
    }
    if (negative['acne']! > 60 && negative['redness']! > 60) {
      compound += 5.5;
    }
    if (negative['pigmentation']! > 75 && negative['darkCircles']! > 70) {
      compound += 4.5;
    }
    if (negative['wrinkles']! > 65 && negative['textureIrregularity']! > 60) {
      compound += 3.5;
    }

    return compound;
  }

  static double _consistencyBonus(Map<String, int> positive) {
    final values = positive.values.toList();
    if (values.isEmpty) return 0;

    final mean = values.reduce((a, b) => a + b) / values.length;
    final variance =
        values.map((v) => (v - mean) * (v - mean)).reduce((a, b) => a + b) /
            values.length;

    if (variance <= 90 && mean >= 72) return 2.5;
    if (variance <= 140 && mean >= 65) return 1.5;
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
    // Anchor + weighted positives, then subtract issue drag — tuned for 58–82 typical range.
    final anchored = positiveTotal * 0.62 + 30;
    final issueDrag = negativePenalty * 0.38 + compoundPenalty * 0.72;
    final raw = anchored - issueDrag + consistencyBonus + improvementBonus;
    final adjusted = raw * confidenceMultiplier;

    return _compressToRealisticRange(adjusted).round();
  }

  static double _compressToRealisticRange(double raw) {
    // Soft cap above 93 — only exceptional profiles reach 94+.
    if (raw >= 93) {
      return 93 + (raw - 93).clamp(0, 7) * 0.35;
    }
    return raw.clamp(0, 100);
  }

  static bool _detectSevereChange(
    Map<String, int> negative,
    int? previousScore,
    int rawScore,
  ) {
    if (previousScore == null) return false;
    if ((rawScore - previousScore).abs() >= 12) return true;
    return negative.values.any((s) => s >= 82);
  }

  static int _applyTemporalSmoothing(
    int score,
    int? previousScore, {
    required bool severeChange,
  }) {
    if (previousScore == null || severeChange) return score;

    final delta = score - previousScore;
    if (delta.abs() <= 4) return score;
    return previousScore + delta.sign * 4;
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
      severity: bestSeverity,
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
      severity: 100 - lowest,
    );
  }

  static int _improvementPotential(int finalScore, Map<String, int> negative) {
    final topIssues = negative.values.toList()..sort((a, b) => b.compareTo(a));
    final issueLoad = topIssues.take(3).fold<int>(0, (a, b) => a + b) ~/ 3;
    final headroom = (100 - finalScore).clamp(0, 100);
    return ((headroom * 0.55) + (issueLoad * 0.45)).round().clamp(8, 92);
  }
}

class _Metrics {
  final Map<String, int> positive;
  final Map<String, int> negative;

  const _Metrics({required this.positive, required this.negative});
}

class _Issue {
  final String id;
  final String labelAr;
  final int severity;

  const _Issue({
    required this.id,
    required this.labelAr,
    required this.severity,
  });
}
