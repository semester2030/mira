import { SkinAnalysisResult } from '../../ai/contracts/skin-analysis-result.interface';
import { buildTreatmentPlan } from './treatment-plan-engine';

describe('treatment-plan-engine', () => {
  const skin: SkinAnalysisResult = {
    beautyScore: 70,
    skinTypeAr: 'دهنية',
    skinTypeEn: 'Oily',
    hydration: 48,
    oiliness: 70,
    pores: 3,
    wrinkles: 1,
    darkSpots: 1,
    acne: 2,
    redness: 1,
    undertoneAr: 'محايد',
    undertoneEn: 'Neutral',
    skinToneAr: 'متوسط',
    skinToneEn: 'Medium',
    recommendationsAr: [],
    recommendationsEn: [],
    concernScores: {
      moisture: 45,
      oiliness: 42,
      pore: 50,
      acne: 48,
    },
  };

  it('returns at least 3 morning and 2 evening steps', () => {
    const plan = buildTreatmentPlan(skin);
    expect(plan.morning.length).toBeGreaterThanOrEqual(3);
    expect(plan.evening.length).toBeGreaterThanOrEqual(2);
  });

  it('always includes sunscreen in morning', () => {
    const plan = buildTreatmentPlan(skin);
    expect(plan.morning.some((s) => s.id === 'sunscreen')).toBe(true);
  });

  it('adapts cleanser for oily skin', () => {
    const plan = buildTreatmentPlan(skin);
    expect(plan.morning[0].nameAr).toContain('دهون');
  });
});
