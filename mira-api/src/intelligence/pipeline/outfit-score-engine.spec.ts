import { MiraOccasion } from '../../ai/contracts/mira-occasion';
import { OutfitStyleMetrics } from '../../ai/contracts/outfit-style-metrics.interface';
import { computeOutfitScore } from './outfit-score-engine';

describe('outfit-score-engine', () => {
  const weakMetrics = (): OutfitStyleMetrics => ({
    colorHarmony: 48,
    occasionFit: 42,
    styleCoherence: 50,
    silhouetteBalance: 46,
    polish: 44,
    colorClashSeverity: 72,
    occasionMismatchSeverity: 78,
    tonalImbalanceSeverity: 65,
    accessoryOverloadSeverity: 40,
    formalityGapSeverity: 70,
  });

  const strongMetrics = (): OutfitStyleMetrics => ({
    colorHarmony: 88,
    occasionFit: 86,
    styleCoherence: 84,
    silhouetteBalance: 82,
    polish: 80,
    colorClashSeverity: 18,
    occasionMismatchSeverity: 15,
    tonalImbalanceSeverity: 20,
    accessoryOverloadSeverity: 12,
    formalityGapSeverity: 16,
  });

  it('does not inflate weak outfits into 80+', () => {
    const result = computeOutfitScore(weakMetrics(), {
      occasion: MiraOccasion.Interview,
    });
    expect(result.finalScore).toBeLessThan(72);
    expect(result.finalScore).toBeGreaterThan(30);
  });

  it('rewards strong cohesive outfits without exceeding 93 easily', () => {
    const result = computeOutfitScore(strongMetrics(), {
      occasion: MiraOccasion.Wedding,
    });
    expect(result.finalScore).toBeGreaterThanOrEqualTo(74);
    expect(result.finalScore).toBeLessThanOrEqualTo(93);
    expect(result.occasionReady).toBe(true);
  });

  it('applies compound penalties for clash + mismatch', () => {
    const high = computeOutfitScore(weakMetrics(), {
      occasion: MiraOccasion.Work,
    });
    const lowerMismatch = computeOutfitScore(
      { ...weakMetrics(), occasionMismatchSeverity: 40, formalityGapSeverity: 35 },
      { occasion: MiraOccasion.Work },
    );
    expect(high.finalScore).toBeLessThan(lowerMismatch.finalScore);
    expect(high.compoundPenalty).toBeGreaterThan(0);
  });

  it('smooths temporal jumps to ±4', () => {
    const result = computeOutfitScore(strongMetrics(), { previousScore: 58 });
    expect(Math.abs(result.finalScore - 58)).toBeLessThanOrEqualTo(4);
  });
});
