import { OutfitAnalysisResult } from '../../ai/contracts/outfit-analysis-result.interface';
import { SkinAnalysisResult } from '../../ai/contracts/skin-analysis-result.interface';
import { MiraOccasion } from '../../ai/contracts/mira-occasion';
import { buildStyleFusion } from './fusion-engine';

describe('fusion-engine', () => {
  const skin = (undertoneEn: string): SkinAnalysisResult => ({
    beautyScore: 78,
    skinTypeAr: 'مختلطة',
    skinTypeEn: 'combination',
    hydration: 60,
    oiliness: 45,
    pores: 2,
    wrinkles: 1,
    darkSpots: 1,
    acne: 0,
    redness: 1,
    undertoneAr: undertoneEn === 'Warm' ? 'دافئ' : 'بارد',
    undertoneEn,
    skinToneAr: 'متوسط',
    skinToneEn: 'Medium',
    recommendationsAr: [],
    recommendationsEn: [],
  });

  const outfit = (colors: string[]): OutfitAnalysisResult => ({
    compatibilityScore: 82,
    dominantColors: colors,
    garmentTypeAr: 'فستان',
    garmentTypeEn: 'Dress',
    styleCategoryAr: 'كلاسيك',
    styleCategoryEn: 'Classic',
    occasionSuitabilityAr: 'مناسبة للسهرة',
    occasionSuitabilityEn: 'Evening ready',
    alternativeColorsAr: ['بيج', 'زيتوني', 'ذهبي'],
    alternativeColorsEn: ['Beige', 'Olive', 'Gold'],
    occasion: MiraOccasion.Evening,
  });

  it('recommends warm palette for warm undertone', () => {
    const fusion = buildStyleFusion(skin('Warm'), outfit(['بيج', 'ذهبي']));
    expect(fusion.recommendedColorsAr.some((c) => c.includes('بيج'))).toBe(true);
    expect(fusion.recommendedColorsAr.some((c) => c.includes('زيتون'))).toBe(true);
    expect(fusion.enabled).toBe(true);
  });

  it('detects clash for warm undertone with cold gray outfit', () => {
    const fusion = buildStyleFusion(skin('Warm'), outfit(['رمادي', 'فضي']));
    expect(fusion.headlineAr).toContain('undertone');
  });
});
