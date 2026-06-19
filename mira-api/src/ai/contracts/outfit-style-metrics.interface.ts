/** Style analysis axes — higher positive = healthier, higher negative = worse issue. */
export interface OutfitStyleMetrics {
  colorHarmony: number;
  occasionFit: number;
  styleCoherence: number;
  silhouetteBalance: number;
  polish: number;
  colorClashSeverity: number;
  occasionMismatchSeverity: number;
  tonalImbalanceSeverity: number;
  accessoryOverloadSeverity: number;
  formalityGapSeverity: number;
}

export const DEFAULT_OUTFIT_STYLE_METRICS: OutfitStyleMetrics = {
  colorHarmony: 62,
  occasionFit: 60,
  styleCoherence: 58,
  silhouetteBalance: 60,
  polish: 58,
  colorClashSeverity: 35,
  occasionMismatchSeverity: 30,
  tonalImbalanceSeverity: 28,
  accessoryOverloadSeverity: 20,
  formalityGapSeverity: 25,
};
