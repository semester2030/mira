import { SkinAnalysisResult } from '../../ai/contracts/skin-analysis-result.interface';
import {
  buildConcernNarratives,
  buildHeadlineAr,
  buildTipsAr,
} from './narrative-engine';

describe('narrative-engine', () => {
  const baseSkin: SkinAnalysisResult = {
    beautyScore: 74,
    skinTypeAr: 'مختلطة',
    skinTypeEn: 'Combination',
    hydration: 55,
    oiliness: 62,
    pores: 2,
    wrinkles: 1,
    darkSpots: 1,
    acne: 1,
    redness: 1,
    undertoneAr: 'محايد',
    undertoneEn: 'Neutral',
    skinToneAr: 'متوسط',
    skinToneEn: 'Medium',
    recommendationsAr: ['استخدمي واقي الشمس يومياً.'],
    recommendationsEn: ['Use sunscreen daily.'],
    skinAge: 32,
    concernScores: {
      moisture: 52,
      oiliness: 48,
      pore: 58,
      wrinkle: 75,
    },
  };

  it('builds human Arabic narratives without numeric metrics', () => {
    const items = buildConcernNarratives(baseSkin);
    expect(items.length).toBeGreaterThanOrEqual(3);
    for (const item of items) {
      expect(item.narrativeAr).not.toMatch(/\d{2,}/);
      expect(item.titleAr.length).toBeGreaterThan(0);
    }
  });

  it('flags low moisture with moderate or higher severity', () => {
    const moisture = buildConcernNarratives(baseSkin).find(
      (c) => c.id === 'moisture',
    );
    expect(moisture?.severity).not.toBe('none');
    expect(moisture?.narrativeAr).toContain('ترطيب');
  });

  it('builds headline from beauty score bands', () => {
    expect(buildHeadlineAr({ ...baseSkin, beautyScore: 85 })).toContain('جيدة');
    expect(buildHeadlineAr({ ...baseSkin, beautyScore: 55 })).toContain('اهتمام');
  });

  it('includes provider tips in buildTipsAr', () => {
    const tips = buildTipsAr(baseSkin);
    expect(tips.some((t) => t.includes('واقي'))).toBe(true);
  });
});
