import {
  buildProgressForecast,
  ProgressHistoryEntry,
} from './progress-engine';
import { ConcernNarrative } from '../contracts/mira-beauty-report.interface';

describe('progress-engine', () => {
  const concern = (
    id: string,
    severity: 'none' | 'mild' | 'moderate' | 'noticeable',
  ): ConcernNarrative => ({
    id,
    titleAr: id,
    narrativeAr: 'test',
    severity,
  });

  const baseReport = (score: number, moisture: ConcernNarrative['severity']) => ({
    version: 1 as const,
    spatialConfidence: 'none' as const,
    overallBeautyScore: score,
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
    mainConcerns: [concern('moisture', moisture), concern('pore', 'mild')],
    dailyRoutine: { morning: [], evening: [] },
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
    recommendedProducts: [],
    weeklyPlan: {
      enabled: false,
      headlineAr: '',
      summaryAr: '',
      days: [],
    },
    progressForecast: buildProgressForecast([]),
  } as MiraBeautyReport);

  it('needs more scans when history < 2', () => {
    const result = buildProgressForecast([
      {
        id: 'a1',
        createdAt: new Date('2026-01-01'),
        miraReport: baseReport(68, 'moderate'),
      },
    ]);
    expect(result.needsMoreScans).toBe(true);
    expect(result.enabled).toBe(false);
  });

  it('shows improvement trends after second scan', () => {
    const history: ProgressHistoryEntry[] = [
      {
        id: 'a1',
        createdAt: new Date('2026-01-01'),
        miraReport: baseReport(68, 'moderate'),
      },
      {
        id: 'a2',
        createdAt: new Date('2026-02-01'),
        miraReport: baseReport(74, 'mild'),
      },
    ];
    const result = buildProgressForecast(history);
    expect(result.enabled).toBe(true);
    expect(result.trends.length).toBeGreaterThan(0);
    expect(result.trends.some((t) => t.direction === 'improved')).toBe(true);
    expect(result.timeline.map((p) => p.overallScore)).toEqual([68, 74]);
  });
});
