enum OutfitSeverityLevel {
  severe,
  weak,
  average,
  good,
  excellent,
  premium,
  rare;

  static OutfitSeverityLevel fromScore(int score) {
    if (score <= 40) return OutfitSeverityLevel.severe;
    if (score <= 55) return OutfitSeverityLevel.weak;
    if (score <= 68) return OutfitSeverityLevel.average;
    if (score <= 78) return OutfitSeverityLevel.good;
    if (score <= 86) return OutfitSeverityLevel.excellent;
    if (score <= 93) return OutfitSeverityLevel.premium;
    return OutfitSeverityLevel.rare;
  }

  String get labelAr => switch (this) {
        OutfitSeverityLevel.severe => 'تحتاج تعديلاً واضحاً',
        OutfitSeverityLevel.weak => 'تحتاج دعماً',
        OutfitSeverityLevel.average => 'متوسطة',
        OutfitSeverityLevel.good => 'جيدة',
        OutfitSeverityLevel.excellent => 'ممتازة',
        OutfitSeverityLevel.premium => 'مميزة',
        OutfitSeverityLevel.rare => 'استثنائية',
      };
}

class OutfitScoreResult {
  final int finalScore;
  final int confidence;
  final String strongestIssueAr;
  final String strongestIssueId;
  final String weakestAreaAr;
  final String weakestAreaId;
  final int improvementPotential;
  final OutfitSeverityLevel severityLevel;
  final bool occasionReady;
  final int rawScore;
  final int compoundPenalty;
  final int negativePenalty;

  const OutfitScoreResult({
    required this.finalScore,
    required this.confidence,
    required this.strongestIssueAr,
    required this.strongestIssueId,
    required this.weakestAreaAr,
    required this.weakestAreaId,
    required this.improvementPotential,
    required this.severityLevel,
    required this.occasionReady,
    required this.rawScore,
    required this.compoundPenalty,
    required this.negativePenalty,
  });
}
