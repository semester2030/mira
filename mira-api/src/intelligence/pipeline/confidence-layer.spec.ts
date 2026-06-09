import { buildConfidenceLayer } from './confidence-layer';
import { buildBeautyJourney } from './beauty-journey-engine';
import { MiraBeautyReport } from '../contracts/mira-beauty-report.interface';
import { buildProgressForecast } from './progress-engine';
import { WEEKLY_PLAN_EMPTY } from '../contracts/weekly-plan.interface';

function sampleReport(overrides: Partial<MiraBeautyReport> = {}): MiraBeautyReport {
  const progressForecast = buildProgressForecast([]);
  const base: MiraBeautyReport = {
    version: 1,
    spatialConfidence: 'none',
    overallBeautyScore: 74,
    headlineAr: '',
    skinTypeAr: '',
    skinTypeEn: '',
    ageComparison: {
      enabled: true,
      userAge: 39,
      skinAge: 33,
      deltaYears: 6,
      headlineAr: 'بشرتك تبدو أصغر',
      summaryAr: '',
      causesAr: [],
      opportunitiesAr: [],
      insights: [],
    },
    childSafety: {
      isMinor: false,
      ageThreshold: 16,
      restrictionsApplied: [],
    },
    mainConcerns: [],
    dailyRoutine: { morning: [], evening: [] },
    summaryAdviceAr: '',
    tipsAr: [],
    faceMap: { enabled: false, zones: [] },
    faceHealthMap: {
      enabled: true,
      confidence: 'low',
      confidenceLabelAr: 'ثقة منخفضة — استرشادي',
      mode: 'educational',
      titleAr: '',
      subtitleAr: '',
      disclaimerAr: '',
      zones: [],
      insightCards: [],
    },
    concernZonesSection: {
      enabled: false,
      mode: 'narrative_only',
      spatialConfidence: 'none',
      titleAr: '',
      disclaimerAr: '',
      zones: [],
    },
    concernZonesNarrative: [],
    recommendedProducts: [
      {
        id: 'p1',
        nameAr: 'X',
        nameEn: 'X',
        partnerNameAr: 'Y',
        priceLabel: '100',
        externalUrl: 'https://example.com',
        stepAr: null,
        matchScore: 82,
      },
    ],
    weeklyPlan: WEEKLY_PLAN_EMPTY,
    progressForecast,
    beautyJourney: buildBeautyJourney({} as MiraBeautyReport),
    confidenceLayer: {
      enabled: true,
      headlineAr: '',
      summaryAr: '',
      items: [],
    },
    ...overrides,
  };
  base.beautyJourney = buildBeautyJourney(base);
  return base;
}

describe('confidence-layer', () => {
  it('assigns medium confidence to strong age delta on first scan', () => {
    const layer = buildConfidenceLayer(sampleReport());
    const age = layer.items.find((i) => i.id === 'age_comparison');
    expect(age?.level).toBe('medium');
  });

  it('low confidence for journey goal on single scan', () => {
    const layer = buildConfidenceLayer(sampleReport());
    const journey = layer.items.find((i) => i.id === 'journey_goal');
    expect(journey?.level).toBe('low');
  });

  it('high confidence for recommendations with strong match', () => {
    const layer = buildConfidenceLayer(sampleReport());
    const rec = layer.items.find((i) => i.id === 'recommendations');
    expect(rec?.level).toBe('high');
  });
});
