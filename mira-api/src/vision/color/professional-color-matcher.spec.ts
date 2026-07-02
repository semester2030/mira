import { matchRgb, rgbToLab, deltaE2000 } from './professional-color-matcher';

describe('professional-color-matcher', () => {
  it('maps emerald pixel to emerald family', () => {
    const m = matchRgb(13, 92, 74);
    expect(m.nameAr).toMatch(/زمرد/);
    expect(m.deltaE).toBeLessThan(12);
    expect(m.confidence).toBeGreaterThan(0.8);
  });

  it('deltaE2000 is zero for identical lab', () => {
    const lab = rgbToLab(13, 92, 74);
    expect(deltaE2000(lab, lab)).toBeLessThan(0.01);
  });
});
