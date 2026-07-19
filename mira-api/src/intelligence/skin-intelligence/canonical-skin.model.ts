/**
 * Phase 3 — provider-independent canonical skin domain model.
 * Never invent values: unavailable metrics stay unavailable.
 */

export const SKIN_MODEL_VERSION = 'skin-model-v1';
export const SKIN_INTELLIGENCE_VERSION = 'skin-intel-v1';

export type MetricAvailability = 'available' | 'unavailable';
export type MetricSource =
  | 'provider_measured'
  | 'locally_calculated'
  | 'inferred'
  | 'unavailable'
  | 'mock';

export type CanonicalMetricId =
  | 'hydration'
  | 'radiance'
  | 'texture'
  | 'pores'
  | 'acne'
  | 'wrinkles'
  | 'fineLines'
  | 'pigmentation'
  | 'redness'
  | 'darkCircles'
  | 'oiliness'
  | 'firmness'
  | 'elasticity'
  | 'sensitivity'
  | 'toneUniformity'
  | 'undertone';

/** Higher normalizedValue = healthier / more favorable (0–100), except categorical undertone. */
export interface CanonicalSkinMetric {
  id: CanonicalMetricId;
  displayNameAr: string;
  displayNameEn: string;
  /** Raw provider value when present (provider scale). */
  providerValue?: number;
  /** Normalized 0–100 health-oriented score when available. */
  normalizedValue?: number;
  /** Categorical value (e.g. undertone). */
  categoricalValue?: string;
  confidence: number;
  availability: MetricAvailability;
  source: MetricSource;
  provider?: string;
  limitations: string[];
  recommendationEligible: boolean;
}

export interface CanonicalSkinModel {
  version: typeof SKIN_MODEL_VERSION;
  metrics: CanonicalSkinMetric[];
  skinTypeAr?: string;
  skinTypeEn?: string;
  undertoneAr?: string;
  undertoneEn?: string;
  provider: string;
  providerVersion?: string;
  isMock: boolean;
  limitations: string[];
}

export const CANONICAL_METRIC_CATALOG: Record<
  CanonicalMetricId,
  { displayNameAr: string; displayNameEn: string; polarity: 'positive' | 'negative' | 'neutral' }
> = {
  hydration: { displayNameAr: 'الترطيب', displayNameEn: 'Hydration', polarity: 'positive' },
  radiance: { displayNameAr: 'الإشراق', displayNameEn: 'Radiance', polarity: 'positive' },
  texture: { displayNameAr: 'الملمس', displayNameEn: 'Texture', polarity: 'positive' },
  pores: { displayNameAr: 'المسام', displayNameEn: 'Pores', polarity: 'negative' },
  acne: { displayNameAr: 'مظهر الحبوب', displayNameEn: 'Acne appearance', polarity: 'negative' },
  wrinkles: { displayNameAr: 'التجاعيد', displayNameEn: 'Wrinkles', polarity: 'negative' },
  fineLines: { displayNameAr: 'الخطوط الدقيقة', displayNameEn: 'Fine lines', polarity: 'negative' },
  pigmentation: { displayNameAr: 'التصبغات', displayNameEn: 'Pigmentation', polarity: 'negative' },
  redness: { displayNameAr: 'الاحمرار', displayNameEn: 'Redness', polarity: 'negative' },
  darkCircles: { displayNameAr: 'الهالات', displayNameEn: 'Dark circles', polarity: 'negative' },
  oiliness: { displayNameAr: 'إفراز الدهون', displayNameEn: 'Oiliness', polarity: 'negative' },
  firmness: { displayNameAr: 'الثبات', displayNameEn: 'Firmness', polarity: 'positive' },
  elasticity: { displayNameAr: 'المرونة', displayNameEn: 'Elasticity', polarity: 'positive' },
  sensitivity: { displayNameAr: 'الحساسية الظاهرة', displayNameEn: 'Sensitivity', polarity: 'negative' },
  toneUniformity: {
    displayNameAr: 'انتظام اللون',
    displayNameEn: 'Tone uniformity',
    polarity: 'positive',
  },
  undertone: { displayNameAr: 'الأساس اللوني', displayNameEn: 'Undertone', polarity: 'neutral' },
};

export function metricById(
  model: CanonicalSkinModel,
  id: CanonicalMetricId,
): CanonicalSkinMetric | undefined {
  return model.metrics.find((m) => m.id === id);
}

export function unavailableMetric(id: CanonicalMetricId, limitations: string[]): CanonicalSkinMetric {
  const cat = CANONICAL_METRIC_CATALOG[id];
  return {
    id,
    displayNameAr: cat.displayNameAr,
    displayNameEn: cat.displayNameEn,
    confidence: 0,
    availability: 'unavailable',
    source: 'unavailable',
    limitations,
    recommendationEligible: false,
  };
}
