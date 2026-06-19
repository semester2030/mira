import { applyBeautyScoreToSkin, computeBeautyScore } from './beauty-score-engine';
import { SkinAnalysisResult } from '../../ai/contracts/skin-analysis-result.interface';

describe('beauty-score-engine', () => {
  const problematicSkin = (): SkinAnalysisResult => ({
    beautyScore: 0,
    skinTypeAr: 'دهنية',
    skinTypeEn: 'Oily',
    hydration: 52,
    oiliness: 78,
    pores: 4,
    wrinkles: 2,
    darkSpots: 3,
    acne: 3,
    redness: 3,
    undertoneAr: 'محايد',
    undertoneEn: 'Neutral',
    skinToneAr: 'متوسط',
    skinToneEn: 'Medium',
    recommendationsAr: [],
    recommendationsEn: [],
    skinAge: 30,
    concernScores: {
      moisture: 52,
      oiliness: 22,
      pore: 38,
      wrinkle: 62,
      acne: 42,
      age_spot: 45,
      redness: 40,
      texture: 48,
      dark_circle: 44,
      radiance: 50,
      firmness: 58,
    },
  });

  it('does not inflate problematic skin into 80+', () => {
    const result = computeBeautyScore(problematicSkin());
    expect(result.finalScore).toBeLessThan(72);
    expect(result.finalScore).toBeGreaterThan(35);
  });

  it('applies compound penalties for oiliness + pores', () => {
    const highCombo = computeBeautyScore(problematicSkin());
    const lowerPores = computeBeautyScore({
      ...problematicSkin(),
      pores: 2,
      concernScores: {
        ...problematicSkin().concernScores,
        pore: 62,
      },
    });
    expect(highCombo.finalScore).toBeLessThan(lowerPores.finalScore);
    expect(highCombo.compoundPenalty).toBeGreaterThan(0);
  });

  it('smooths temporal jumps to ±4', () => {
    const healthy = computeBeautyScore({
      ...problematicSkin(),
      hydration: 70,
      oiliness: 40,
      pores: 2,
      concernScores: {
        moisture: 70,
        oiliness: 60,
        pore: 72,
        wrinkle: 74,
        acne: 76,
        age_spot: 75,
        redness: 74,
        texture: 71,
        dark_circle: 68,
        radiance: 69,
        firmness: 72,
      },
    });
    const smoothed = computeBeautyScore(
      {
        ...problematicSkin(),
        hydration: 70,
        oiliness: 40,
        pores: 2,
        concernScores: healthy.weakestAreaId
          ? {
              moisture: 70,
              oiliness: 60,
              pore: 72,
              wrinkle: 74,
              acne: 76,
              age_spot: 75,
              redness: 74,
              texture: 71,
              dark_circle: 68,
              radiance: 69,
              firmness: 72,
            }
          : {},
      },
      { previousScore: 58 },
    );
    expect(Math.abs(smoothed.finalScore - 58)).toBeLessThanOrEqual(4);
  });

  it('writes final score back to skin result', () => {
    const updated = applyBeautyScoreToSkin(problematicSkin());
    expect(updated.beautyScore).toBe(computeBeautyScore(problematicSkin()).finalScore);
  });
});
