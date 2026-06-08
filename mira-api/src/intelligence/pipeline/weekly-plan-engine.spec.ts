import { SkinAnalysisResult } from '../../ai/contracts/skin-analysis-result.interface';
import { buildWeeklyPlan } from './weekly-plan-engine';

describe('weekly-plan-engine', () => {
  const skin: SkinAnalysisResult = {
    beautyScore: 72,
    skinTypeAr: 'مختلطة',
    skinTypeEn: 'combination',
    hydration: 52,
    oiliness: 48,
    pores: 2,
    wrinkles: 1,
    darkSpots: 1,
    acne: 1,
    redness: 1,
    undertoneAr: 'محايد',
    undertoneEn: 'Neutral',
    skinToneAr: 'متوسط',
    skinToneEn: 'Medium',
    recommendationsAr: [],
    recommendationsEn: [],
    concernScores: { moisture: 50, pore: 45, acne: 48 },
  };

  it('builds 7-day structured plan', () => {
    const plan = buildWeeklyPlan(skin);
    expect(plan.enabled).toBe(true);
    expect(plan.days).toHaveLength(7);
    expect(plan.days[0].labelAr).toBe('الأحد');
    expect(plan.days.every((d) => d.stepsAr.length > 0)).toBe(true);
  });
});
