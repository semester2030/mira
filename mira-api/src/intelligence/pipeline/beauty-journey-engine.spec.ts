import { buildBeautyJourney } from './beauty-journey-engine';
import { MiraBeautyReport } from '../contracts/mira-beauty-report.interface';
import { buildProgressForecast } from './progress-engine';
import { WEEKLY_PLAN_EMPTY } from '../contracts/weekly-plan.interface';

function sampleReport(overrides: Partial<MiraBeautyReport> = {}): MiraBeautyReport {
  const progressForecast = buildProgressForecast([]);
  const base: MiraBeautyReport = {
    version: 1,
    spatialConfidence: 'none',
    overallBeautyScore: 67,
    headlineAr: 'test',
    skinTypeAr: 'مختلطة',
    skinTypeEn: 'combination',
    ageComparison: {
      enabled: false,
      headlineAr: '',
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
    mainConcerns: [
      {
        id: 'pore',
        titleAr: 'المسام',
        narrativeAr: 'المسام بارزة',
        severity: 'moderate',
      },
      {
        id: 'dark_circle',
        titleAr: 'الهالات',
        narrativeAr: 'هالات متوسطة',
        severity: 'mild',
      },
    ],
    dailyRoutine: { morning: [], evening: [] },
    summaryAdviceAr: '',
    tipsAr: [],
    faceMap: { enabled: false, zones: [] },
    faceHealthMap: {
      enabled: true,
      confidence: 'low',
      confidenceLabelAr: 'ثقة منخفضة',
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
    recommendedProducts: [],
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

describe('beauty-journey-engine', () => {
  it('builds next goal from current score 67 → 72 in 30 days', () => {
    const journey = buildBeautyJourney(sampleReport());
    expect(journey.enabled).toBe(true);
    expect(journey.currentOverallScore).toBe(67);
    expect(journey.nextGoal.targetValue).toBe(72);
    expect(journey.nextGoal.horizonDays).toBe(30);
    expect(journey.nextGoal.headlineAr).toContain('72');
  });

  it('sets top opportunity to lowest-scoring concern', () => {
    const journey = buildBeautyJourney(sampleReport());
    expect(journey.topOpportunity?.concernId).toBe('pore');
    expect(journey.topOpportunity?.expectedGainPoints).toBe(6);
    expect(journey.priorities).toHaveLength(2);
    expect(journey.priorities[1].concernId).toBe('dark_circle');
  });

  it('uses projected score when progress history exists', () => {
    const history = [
      {
        id: 'a1',
        createdAt: new Date('2026-01-01'),
        miraReport: sampleReport({ overallBeautyScore: 60 }),
      },
      {
        id: 'a2',
        createdAt: new Date('2026-01-15'),
        miraReport: sampleReport({ overallBeautyScore: 65 }),
      },
    ];
    const pf = buildProgressForecast(history);
    const journey = buildBeautyJourney(
      sampleReport({
        overallBeautyScore: 65,
        progressForecast: pf,
      }),
    );
    expect(journey.nextGoal.targetValue).toBeGreaterThanOrEqual(65);
  });
});
