import { IntelligenceService } from './intelligence.service';
import { SkinAnalysisResult } from '../ai/contracts/skin-analysis-result.interface';

describe('IntelligenceService age + safety', () => {
  const marketplace = {
    match: jest.fn().mockResolvedValue({ products: [], services: [] }),
  };
  const prisma = {
    skinAnalysis: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  const skin: SkinAnalysisResult = {
    beautyScore: 74,
    skinTypeAr: 'مختلطة',
    skinTypeEn: 'combination',
    hydration: 55,
    oiliness: 45,
    pores: 2,
    wrinkles: 2,
    darkSpots: 1,
    acne: 0,
    redness: 1,
    recommendationsAr: ['استخدمي واقي شمس'],
    recommendationsEn: ['Use sunscreen'],
    skinAge: 35,
    undertoneAr: 'دافئ',
    undertoneEn: 'Warm',
    skinToneAr: 'متوسط',
    skinToneEn: 'Medium',
    concernScores: { moisture: 52, wrinkle: 48 },
  };

  it('removes wrinkle concerns for minors', async () => {
    const service = new IntelligenceService(marketplace as never, prisma as never);
    const birthYear = new Date().getFullYear() - 14;
    const report = await service.buildBeautyReport(skin, { birthYear });
    expect(report.childSafety.isMinor).toBe(true);
    expect(report.mainConcerns.every((c) => c.id !== 'wrinkle')).toBe(true);
    expect(report.ageComparison.enabled).toBe(false);
    expect(report.skinAgeEstimate).toBeUndefined();
  });

  it('includes age comparison for adults with birth year', async () => {
    const service = new IntelligenceService(marketplace as never, prisma as never);
    const birthYear = new Date().getFullYear() - 30;
    const report = await service.buildBeautyReport(skin, { birthYear });
    expect(report.ageComparison.enabled).toBe(true);
    expect(report.ageComparison.deltaYears).toBe(5);
  });

  it('uses 5b-fallback concern zones without spatial data', async () => {
    const service = new IntelligenceService(marketplace as never, prisma as never);
    const report = await service.buildBeautyReport({
      ...skin,
      oiliness: 80,
      concernScores: { oiliness: 35, moisture: 50, pore: 40 },
    });
    expect(report.spatialConfidence).toBe('none');
    expect(report.faceMap.enabled).toBe(false);
    expect(report.concernZonesSection.mode).toBe('narrative_only');
    expect(report.concernZonesSection.enabled).toBe(true);
    expect(report.concernZonesSection.zones.length).toBeGreaterThan(0);
    expect(report.faceHealthMap.enabled).toBe(true);
    expect(report.faceHealthMap.mode).toBe('educational');
    expect(report.faceHealthMap.confidence).toBe('low');
    expect(report.faceHealthMap.confidenceLabelAr).toContain('ثقة منخفضة');
  });

  it('includes weekly plan with 7 days', async () => {
    const service = new IntelligenceService(marketplace as never, prisma as never);
    const report = await service.buildBeautyReport(skin);
    expect(report.weeklyPlan.enabled).toBe(true);
    expect(report.weeklyPlan.days).toHaveLength(7);
  });

  it('includes beauty journey with next goal', async () => {
    const service = new IntelligenceService(marketplace as never, prisma as never);
    const report = await service.buildBeautyReport({ ...skin, beautyScore: 67 });
    expect(report.beautyJourney.enabled).toBe(true);
    expect(report.beautyJourney.nextGoal.targetValue).toBeGreaterThan(
      report.overallBeautyScore,
    );
    expect(report.beautyJourney.priorities.length).toBeGreaterThan(0);
    expect(report.skinIntelligence).toBeDefined();
    expect(report.provenance?.calculationVersion).toBe('svi-v2');
  });

  it('includes confidence layer items', async () => {
    const service = new IntelligenceService(marketplace as never, prisma as never);
    const birthYear = new Date().getFullYear() - 30;
    const report = await service.buildBeautyReport(skin, { birthYear });
    expect(report.confidenceLayer.enabled).toBe(true);
    expect(report.confidenceLayer.items.length).toBe(5);
  });
});
