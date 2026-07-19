import { SkinAnalysisResult } from '../../../ai/contracts/skin-analysis-result.interface';
import { mapLegacySkinToMetrics } from '../../../ports/adapters/perfect-corp-skin.adapter';
import { buildResultMeta } from '../../../ports/shared/result-meta';
import { SkinMetric } from '../../../ports/skin/skin-analysis.port';
import { runSkinIntelligencePipeline } from '../index';
import { SkinIntelligenceReportDto } from '../report.engine';

export type FixtureId =
  | 'healthy'
  | 'dry'
  | 'oily'
  | 'pigmentation'
  | 'mixed'
  | 'unavailable_heavy';

export interface AnalysisFixture {
  id: FixtureId;
  label: string;
  legacy: SkinAnalysisResult;
}

function base(): SkinAnalysisResult {
  return {
    beautyScore: 70,
    skinTypeAr: 'مختلطة',
    skinTypeEn: 'Combination',
    hydration: 70,
    oiliness: 30,
    pores: 1,
    wrinkles: 1,
    darkSpots: 1,
    acne: 0,
    redness: 1,
    undertoneAr: 'محايد',
    undertoneEn: 'Neutral',
    skinToneAr: 'متوسط',
    skinToneEn: 'Medium',
    recommendationsAr: [],
    recommendationsEn: [],
    concernScores: {},
  };
}

export const ANALYSIS_FIXTURES: AnalysisFixture[] = [
  {
    id: 'healthy',
    label: 'Healthy skin',
    legacy: {
      ...base(),
      hydration: 88,
      oiliness: 20,
      concernScores: {
        moisture: 88,
        pore: 90,
        wrinkle: 92,
        acne: 95,
        redness: 90,
        age_spot: 88,
        radiance: 86,
        firmness: 84,
        texture: 85,
        dark_circle: 88,
        oiliness: 85,
      },
    },
  },
  {
    id: 'dry',
    label: 'Dry skin',
    legacy: {
      ...base(),
      skinTypeAr: 'جافة',
      skinTypeEn: 'Dry',
      hydration: 28,
      oiliness: 15,
      concernScores: {
        moisture: 28,
        pore: 75,
        wrinkle: 55,
        acne: 80,
        redness: 60,
        age_spot: 70,
        oiliness: 82,
      },
    },
  },
  {
    id: 'oily',
    label: 'Oily skin',
    legacy: {
      ...base(),
      skinTypeAr: 'دهنية',
      skinTypeEn: 'Oily',
      hydration: 55,
      oiliness: 85,
      concernScores: {
        moisture: 55,
        pore: 35,
        wrinkle: 80,
        acne: 40,
        redness: 55,
        age_spot: 70,
        oiliness: 30,
      },
    },
  },
  {
    id: 'pigmentation',
    label: 'Pigmentation focus',
    legacy: {
      ...base(),
      concernScores: {
        moisture: 65,
        pore: 70,
        wrinkle: 75,
        acne: 80,
        redness: 70,
        age_spot: 25,
        oiliness: 70,
      },
    },
  },
  {
    id: 'mixed',
    label: 'Mixed concerns',
    legacy: {
      ...base(),
      hydration: 45,
      oiliness: 60,
      concernScores: {
        moisture: 45,
        pore: 40,
        wrinkle: 50,
        acne: 45,
        redness: 40,
        age_spot: 55,
        radiance: 48,
        firmness: 52,
        texture: 44,
        dark_circle: 38,
        oiliness: 42,
      },
    },
  },
  {
    id: 'unavailable_heavy',
    label: 'Many unavailable metrics',
    legacy: {
      ...base(),
      undertoneAr: '',
      undertoneEn: '',
      concernScores: {
        moisture: 60,
        // most others intentionally absent
      },
    },
  },
];

export function metricsForFixture(fixture: AnalysisFixture): SkinMetric[] {
  const metrics = mapLegacySkinToMetrics(fixture.legacy, 'provider_measured');
  if (fixture.id === 'unavailable_heavy') {
    return metrics.map((m) => {
      if (m.id === 'hydration') return m;
      return { ...m, available: false, value: undefined };
    });
  }
  return metrics;
}

/** Strip volatile fields for golden/snapshot compare. */
export function normalizeReportForSnapshot(
  report: SkinIntelligenceReportDto,
): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(report)) as SkinIntelligenceReportDto;
  clone.generatedAt = 'STABLE_TIMESTAMP';
  clone.analysisId = `fixture_${clone.analysisId.replace(/^fixture_/, '')}`;
  return clone as unknown as Record<string, unknown>;
}

export function runFixturePipeline(fixture: AnalysisFixture) {
  return runSkinIntelligencePipeline({
    analysisId: `fixture_${fixture.id}`,
    legacy: fixture.legacy,
    portMetrics: metricsForFixture(fixture),
    meta: buildResultMeta({
      source: 'provider_measured',
      provider: 'perfect_corp',
      providerVersion: 'youcam-s2s',
      confidence: 75,
      isMock: false,
      isProduction: false,
      calculationVersion: 'svi-v2',
    }),
    captureVersion: 'cq-thresholds-v2.1',
    qualityVersion: 'iq-v2.1+qc-v1.1',
  });
}
