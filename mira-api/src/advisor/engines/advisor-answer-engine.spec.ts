import { buildAdvisorAnswer } from './advisor-answer-engine';
import { buildAdvisorContext } from './advisor-context-builder';
import { MiraBeautyReport } from '../../intelligence/contracts/mira-beauty-report.interface';
import { WEEKLY_PLAN_EMPTY } from '../../intelligence/contracts/weekly-plan.interface';

describe('advisor-answer-engine', () => {
  const baseReport = (): MiraBeautyReport => ({
    version: 1,
    spatialConfidence: 'none',
    overallBeautyScore: 72,
    headlineAr: 'test',
    skinTypeAr: 'مختلطة',
    skinTypeEn: 'combination',
    skinAgeEstimate: 33,
    ageComparison: {
      enabled: true,
      userAge: 39,
      skinAge: 33,
      deltaYears: -6,
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
        narrativeAr: 'test',
        severity: 'moderate',
      },
    ],
    dailyRoutine: {
      morning: [
        {
          id: 'spf',
          nameAr: 'واقي شمس SPF 50',
          nameEn: 'SPF 50',
          stepAr: 'آخر خطوة صباحاً',
          period: 'am',
        },
      ],
      evening: [],
    },
    summaryAdviceAr: '',
    tipsAr: [],
    faceMap: { enabled: false, zones: [] },
    faceHealthMap: {
      enabled: false,
      confidence: 'low',
      confidenceLabelAr: '',
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
        nameAr: 'سيروم فيتامين C',
        nameEn: 'Vitamin C',
        partnerNameAr: 'شريك',
        priceLabel: '99',
        externalUrl: '',
        matchScore: 82,
      },
    ],
    weeklyPlan: WEEKLY_PLAN_EMPTY,
    progressForecast: {
      enabled: false,
      scanCount: 1,
      needsMoreScans: true,
      headlineAr: '',
      summaryAr: '',
      timeline: [],
      trends: [],
      milestones: [],
    },
  });

  it('answers serum question with context', () => {
    const ctx = buildAdvisorContext('a1', baseReport(), { userAge: 39 });
    const res = buildAdvisorAnswer(ctx, 'هل أحتاج سيروم؟');
    expect(res.intent).toBe('serum');
    expect(res.answer).toContain('مختلطة');
    expect(res.suggestedQuestions.length).toBeGreaterThan(0);
    expect(res.confidence).toBe('high');
  });

  it('explains SPF routine step', () => {
    const ctx = buildAdvisorContext('a1', baseReport());
    const res = buildAdvisorAnswer(ctx, 'لماذا وضعتِ واقي الشمس؟');
    expect(res.intent).toBe('routine_why');
    expect(res.answer).toContain('SPF');
  });
});
