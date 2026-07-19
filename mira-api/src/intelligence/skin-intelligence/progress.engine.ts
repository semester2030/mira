import { CanonicalSkinModel, CanonicalMetricId } from './canonical-skin.model';
import { SviV2Result } from './svi-v2.engine';

export type TrendDirection = 'improved' | 'stable' | 'declined' | 'unknown';

export interface ProgressSnapshot {
  analysisId: string;
  generatedAt: string;
  provider: string;
  providerVersion?: string;
  captureVersion?: string;
  qualityVersion?: string;
  sviScore: number;
  sviConfidence: number;
  /** Metric id → normalized health 0–100 when available */
  metrics: Partial<Record<CanonicalMetricId, number>>;
}

export interface MetricTrend {
  metricId: string;
  labelAr: string;
  labelEn: string;
  previous?: number;
  current?: number;
  delta?: number;
  trend: TrendDirection;
  comparable: boolean;
  reasonAr: string;
  reasonEn: string;
}

export interface ProgressComparison {
  comparable: boolean;
  unavailableReasonAr?: string;
  unavailableReasonEn?: string;
  overallTrend: TrendDirection;
  previousSvi?: number;
  currentSvi?: number;
  sviDelta?: number;
  metricTrends: MetricTrend[];
  limitations: string[];
  version: 'progress-v1';
}

const STABLE_BAND = 3;

function direction(delta: number): TrendDirection {
  if (Math.abs(delta) <= STABLE_BAND) return 'stable';
  return delta > 0 ? 'improved' : 'declined';
}

/**
 * Longitudinal progress — compare only when capture quality & provider are compatible.
 */
export function compareProgress(input: {
  previous?: ProgressSnapshot | null;
  current: ProgressSnapshot;
  sameCaptureQuality: boolean;
  compatibleProvider: boolean;
}): ProgressComparison {
  const { previous, current } = input;

  if (!previous) {
    return {
      comparable: false,
      unavailableReasonAr: 'لا يوجد تحليل سابق للمقارنة.',
      unavailableReasonEn: 'No previous analysis available for comparison.',
      overallTrend: 'unknown',
      currentSvi: current.sviScore,
      metricTrends: [],
      limitations: ['Need at least two compatible analyses for trends.'],
      version: 'progress-v1',
    };
  }

  if (!input.sameCaptureQuality) {
    return {
      comparable: false,
      unavailableReasonAr:
        'المقارنة غير متاحة — جودة الالتقاط غير متكافئة بين الجلستين.',
      unavailableReasonEn:
        'Comparison unavailable — capture quality is not equivalent between sessions.',
      overallTrend: 'unknown',
      previousSvi: previous.sviScore,
      currentSvi: current.sviScore,
      metricTrends: [],
      limitations: [
        'Progress requires same capture quality class.',
        'Retake with similar lighting for fair comparison.',
      ],
      version: 'progress-v1',
    };
  }

  if (!input.compatibleProvider) {
    return {
      comparable: false,
      unavailableReasonAr:
        'المقارنة غير متاحة — مزود التحليل غير متوافق بين الجلستين.',
      unavailableReasonEn:
        'Comparison unavailable — analysis provider is not compatible across sessions.',
      overallTrend: 'unknown',
      previousSvi: previous.sviScore,
      currentSvi: current.sviScore,
      metricTrends: [],
      limitations: ['Progress requires a compatible provider.'],
      version: 'progress-v1',
    };
  }

  const sviDelta = current.sviScore - previous.sviScore;
  const metricTrends: MetricTrend[] = [];
  const ids = new Set([
    ...Object.keys(previous.metrics),
    ...Object.keys(current.metrics),
  ]) as Set<string>;

  for (const id of ids) {
    const prev = previous.metrics[id as CanonicalMetricId];
    const cur = current.metrics[id as CanonicalMetricId];
    if (prev == null || cur == null) {
      metricTrends.push({
        metricId: id,
        labelAr: id,
        labelEn: id,
        previous: prev,
        current: cur,
        trend: 'unknown',
        comparable: false,
        reasonAr: 'المؤشر غير متاح في إحدى الجلستين — لا تُخترع قيمة.',
        reasonEn: 'Metric missing in one session — value is not invented.',
      });
      continue;
    }
    const delta = cur - prev;
    metricTrends.push({
      metricId: id,
      labelAr: id,
      labelEn: id,
      previous: prev,
      current: cur,
      delta: Math.round(delta * 10) / 10,
      trend: direction(delta),
      comparable: true,
      reasonAr: `تغيّر ${Math.round(delta)} نقطة على المقياس الموحّد.`,
      reasonEn: `Changed by ${Math.round(delta)} points on the unified scale.`,
    });
  }

  return {
    comparable: true,
    overallTrend: direction(sviDelta),
    previousSvi: previous.sviScore,
    currentSvi: current.sviScore,
    sviDelta: Math.round(sviDelta * 10) / 10,
    metricTrends,
    limitations: [
      'Trends are cosmetic appearance changes between comparable captures.',
      'Not clinical outcome measurement.',
    ],
    version: 'progress-v1',
  };
}

export function snapshotFromModel(input: {
  analysisId: string;
  model: CanonicalSkinModel;
  svi: SviV2Result;
  generatedAt: string;
  captureVersion?: string;
  qualityVersion?: string;
}): ProgressSnapshot {
  const metrics: ProgressSnapshot['metrics'] = {};
  for (const m of input.model.metrics) {
    if (m.availability === 'available' && m.normalizedValue != null) {
      metrics[m.id] = m.normalizedValue;
    }
  }
  return {
    analysisId: input.analysisId,
    generatedAt: input.generatedAt,
    provider: input.model.provider,
    providerVersion: input.model.providerVersion,
    captureVersion: input.captureVersion,
    qualityVersion: input.qualityVersion,
    sviScore: input.svi.score,
    sviConfidence: input.svi.confidence,
    metrics,
  };
}

export function providersCompatible(a: string, b: string): boolean {
  const norm = (p: string) => p.replace(/_skin$/, '').toLowerCase();
  if (norm(a) === 'mock' || norm(b) === 'mock') return false;
  return norm(a) === norm(b);
}
