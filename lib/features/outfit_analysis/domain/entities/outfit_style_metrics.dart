/// Style analysis axes — higher positive = healthier, higher negative = worse issue.
class OutfitStyleMetrics {
  final int colorHarmony;
  final int occasionFit;
  final int styleCoherence;
  final int silhouetteBalance;
  final int polish;
  final int colorClashSeverity;
  final int occasionMismatchSeverity;
  final int tonalImbalanceSeverity;
  final int accessoryOverloadSeverity;
  final int formalityGapSeverity;

  const OutfitStyleMetrics({
    required this.colorHarmony,
    required this.occasionFit,
    required this.styleCoherence,
    required this.silhouetteBalance,
    required this.polish,
    required this.colorClashSeverity,
    required this.occasionMismatchSeverity,
    required this.tonalImbalanceSeverity,
    required this.accessoryOverloadSeverity,
    required this.formalityGapSeverity,
  });

  Map<String, dynamic> toJson() => {
        'colorHarmony': colorHarmony,
        'occasionFit': occasionFit,
        'styleCoherence': styleCoherence,
        'silhouetteBalance': silhouetteBalance,
        'polish': polish,
        'colorClashSeverity': colorClashSeverity,
        'occasionMismatchSeverity': occasionMismatchSeverity,
        'tonalImbalanceSeverity': tonalImbalanceSeverity,
        'accessoryOverloadSeverity': accessoryOverloadSeverity,
        'formalityGapSeverity': formalityGapSeverity,
      };

  factory OutfitStyleMetrics.fromJson(Map<String, dynamic> json) {
    int v(String key, int fallback) => (json[key] as num?)?.round() ?? fallback;
    return OutfitStyleMetrics(
      colorHarmony: v('colorHarmony', 62),
      occasionFit: v('occasionFit', 60),
      styleCoherence: v('styleCoherence', 58),
      silhouetteBalance: v('silhouetteBalance', 60),
      polish: v('polish', 58),
      colorClashSeverity: v('colorClashSeverity', 35),
      occasionMismatchSeverity: v('occasionMismatchSeverity', 30),
      tonalImbalanceSeverity: v('tonalImbalanceSeverity', 28),
      accessoryOverloadSeverity: v('accessoryOverloadSeverity', 20),
      formalityGapSeverity: v('formalityGapSeverity', 25),
    );
  }
}
