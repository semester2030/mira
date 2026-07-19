import { SkinAnalysisResult } from '../../ai/contracts/skin-analysis-result.interface';
import { SkinMetric } from '../../ports/skin/skin-analysis.port';
import { ResultMeta } from '../../ports/shared/result-meta';
import {
  CANONICAL_METRIC_CATALOG,
  CanonicalMetricId,
  CanonicalSkinMetric,
  CanonicalSkinModel,
  SKIN_MODEL_VERSION,
  unavailableMetric,
} from './canonical-skin.model';

const ALL_IDS = Object.keys(CANONICAL_METRIC_CATALOG) as CanonicalMetricId[];

/** Port metric id → canonical id */
const PORT_TO_CANONICAL: Record<string, CanonicalMetricId> = {
  hydration: 'hydration',
  oiliness: 'oiliness',
  pores: 'pores',
  wrinkles: 'wrinkles',
  acne: 'acne',
  redness: 'redness',
  pigmentation: 'pigmentation',
  radiance: 'radiance',
  firmness: 'firmness',
  texture: 'texture',
  dark_circles: 'darkCircles',
  darkCircles: 'darkCircles',
};

/**
 * Perfect/YouCam concernScores are 0–100 higher=healthier.
 * Legacy severity scalars on SkinAnalysisResult are 0–5 higher=worse.
 * Port metrics from mapLegacySkinToMetrics mix both — we only trust 0–100 when
 * concernScores present, else convert 0–5 → health.
 */
function normalizeHealthFromPort(
  id: CanonicalMetricId,
  value: number,
  fromConcernScore: boolean,
): number {
  if (fromConcernScore || value > 5) {
    return clamp(value, 0, 100);
  }
  // 0–5 severity → health
  return clamp(((5 - clamp(value, 0, 5)) / 5) * 100, 0, 100);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function buildMetric(
  id: CanonicalMetricId,
  opts: {
    providerValue?: number;
    normalizedValue?: number;
    categoricalValue?: string;
    confidence: number;
    source: CanonicalSkinMetric['source'];
    provider?: string;
    limitations: string[];
    recommendationEligible: boolean;
  },
): CanonicalSkinMetric {
  const cat = CANONICAL_METRIC_CATALOG[id];
  const available = opts.normalizedValue != null || opts.categoricalValue != null;
  return {
    id,
    displayNameAr: cat.displayNameAr,
    displayNameEn: cat.displayNameEn,
    providerValue: opts.providerValue,
    normalizedValue: opts.normalizedValue,
    categoricalValue: opts.categoricalValue,
    confidence: available ? opts.confidence : 0,
    availability: available ? 'available' : 'unavailable',
    source: available ? opts.source : 'unavailable',
    provider: opts.provider,
    limitations: opts.limitations,
    recommendationEligible: available && opts.recommendationEligible,
  };
}

/**
 * Map Phase 1 port metrics + optional legacy skin → canonical model.
 * Never invents missing metrics.
 */
export function mapToCanonicalSkinModel(input: {
  portMetrics?: SkinMetric[];
  legacy?: SkinAnalysisResult;
  meta?: ResultMeta;
}): CanonicalSkinModel {
  const provider = input.meta?.provider ?? 'unknown';
  const providerVersion = input.meta?.providerVersion;
  const isMock = input.meta?.isMock === true;
  const sourceBase: CanonicalSkinMetric['source'] = isMock
    ? 'mock'
    : input.meta?.source === 'provider_measured'
      ? 'provider_measured'
      : input.meta?.source === 'mock'
        ? 'mock'
        : 'provider_measured';

  const byPort = new Map<string, SkinMetric>();
  for (const m of input.portMetrics ?? []) {
    byPort.set(m.id, m);
  }

  const concern = input.legacy?.concernScores ?? {};
  const hasConcern = Object.keys(concern).length > 0;

  const metrics: CanonicalSkinMetric[] = [];

  for (const id of ALL_IDS) {
    if (id === 'undertone') {
      const ar = input.legacy?.undertoneAr?.trim();
      const en = input.legacy?.undertoneEn?.trim();
      if (ar || en) {
        metrics.push(
          buildMetric(id, {
            categoricalValue: en || ar,
            confidence: 65,
            source: sourceBase,
            provider,
            limitations: [
              'Undertone is cosmetic classification from provider labels, not lab colorimetry.',
            ],
            recommendationEligible: true,
          }),
        );
      } else {
        metrics.push(
          unavailableMetric(id, ['Undertone not provided by provider']),
        );
      }
      continue;
    }

    // Prefer port metric when available
    const portId = Object.entries(PORT_TO_CANONICAL).find(([, c]) => c === id)?.[0];
    const port = portId ? byPort.get(portId) : undefined;

    if (port?.available && port.value != null && Number.isFinite(port.value)) {
      const cKey = concernKeyFor(id);
      const concernValue =
        cKey && concern[cKey] != null && Number.isFinite(concern[cKey])
          ? concern[cKey]
          : undefined;
      // Prefer explicit 0–100 concern score when present; else infer scale from magnitude.
      const onHundredScale =
        concernValue != null ||
        port.value > 5 ||
        id === 'hydration' ||
        id === 'oiliness';

      let health: number;
      if (id === 'oiliness') {
        if (concern.oiliness != null) {
          // YouCam oiliness concern score = healthier balance when higher
          health = clamp(concern.oiliness, 0, 100);
        } else if (onHundredScale) {
          // Legacy oiliness amount 0–100 → invert to health-oriented
          health = clamp(100 - clamp(port.value, 0, 100), 0, 100);
        } else {
          health = normalizeHealthFromPort(id, port.value, false);
        }
      } else {
        health = normalizeHealthFromPort(id, port.value, onHundredScale);
      }

      metrics.push(
        buildMetric(id, {
          providerValue: port.value,
          normalizedValue: health,
          confidence: port.confidence ?? 70,
          source: (port.source as CanonicalSkinMetric['source']) || sourceBase,
          provider,
          limitations: port.limitations ?? [
            'Mapped from provider; lighting and capture quality may influence the reading.',
          ],
          recommendationEligible: true,
        }),
      );
      continue;
    }

    // Fallback: concernScores only (never invent)
    const concernKey = concernKeyFor(id);
    if (concernKey && concern[concernKey] != null && Number.isFinite(concern[concernKey])) {
      metrics.push(
        buildMetric(id, {
          providerValue: concern[concernKey],
          normalizedValue: clamp(concern[concernKey], 0, 100),
          confidence: 70,
          source: sourceBase,
          provider,
          limitations: ['From provider concern score map.'],
          recommendationEligible: true,
        }),
      );
      continue;
    }

    // fineLines / elasticity / sensitivity / toneUniformity — unavailable unless present
    metrics.push(
      unavailableMetric(id, [
        `Metric ${id} not provided by current provider mapping — left unavailable.`,
      ]),
    );
  }

  return {
    version: SKIN_MODEL_VERSION,
    metrics,
    skinTypeAr: input.legacy?.skinTypeAr,
    skinTypeEn: input.legacy?.skinTypeEn,
    undertoneAr: input.legacy?.undertoneAr,
    undertoneEn: input.legacy?.undertoneEn,
    provider,
    providerVersion,
    isMock,
    limitations: [
      ...(input.meta?.limitations ?? []),
      'Canonical model never fabricates missing metrics.',
    ],
  };
}

function concernKeyFor(id: CanonicalMetricId): string | null {
  switch (id) {
    case 'hydration':
      return 'moisture';
    case 'pores':
      return 'pore';
    case 'wrinkles':
      return 'wrinkle';
    case 'pigmentation':
      return 'age_spot';
    case 'darkCircles':
      return 'dark_circle';
    case 'acne':
      return 'acne';
    case 'redness':
      return 'redness';
    case 'oiliness':
      return 'oiliness';
    case 'texture':
      return 'texture';
    case 'radiance':
      return 'radiance';
    case 'firmness':
      return 'firmness';
    default:
      return null;
  }
}
