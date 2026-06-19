/// Full output of the MIRA Beauty Score Engine.
class BeautyScoreResult {
  final int finalScore;
  final int confidence;
  final String strongestIssue;
  final String strongestIssueId;
  final String weakestArea;
  final String weakestAreaId;
  final int improvementPotential;
  final BeautySeverityLevel severityLevel;
  final bool premiumReadiness;

  /// Pre-smoothing computed score (for diagnostics).
  final int rawScore;

  /// Applied compound penalty total.
  final int compoundPenalty;

  /// Sum of individual negative penalties.
  final int negativePenalty;

  const BeautyScoreResult({
    required this.finalScore,
    required this.confidence,
    required this.strongestIssue,
    required this.strongestIssueId,
    required this.weakestArea,
    required this.weakestAreaId,
    required this.improvementPotential,
    required this.severityLevel,
    required this.premiumReadiness,
    required this.rawScore,
    required this.compoundPenalty,
    required this.negativePenalty,
  });
}

enum BeautySeverityLevel {
  severe,
  weak,
  average,
  good,
  excellent,
  premium,
  rare;

  static BeautySeverityLevel fromScore(int score) {
    if (score <= 40) return BeautySeverityLevel.severe;
    if (score <= 55) return BeautySeverityLevel.weak;
    if (score <= 68) return BeautySeverityLevel.average;
    if (score <= 78) return BeautySeverityLevel.good;
    if (score <= 86) return BeautySeverityLevel.excellent;
    if (score <= 93) return BeautySeverityLevel.premium;
    return BeautySeverityLevel.rare;
  }

  String get labelAr => switch (this) {
        BeautySeverityLevel.severe => 'مشاكل واضحة',
        BeautySeverityLevel.weak => 'بشرة تحتاج دعماً',
        BeautySeverityLevel.average => 'متوسطة',
        BeautySeverityLevel.good => 'جيدة',
        BeautySeverityLevel.excellent => 'ممتازة',
        BeautySeverityLevel.premium => 'مميزة',
        BeautySeverityLevel.rare => 'استثنائية',
      };
}
