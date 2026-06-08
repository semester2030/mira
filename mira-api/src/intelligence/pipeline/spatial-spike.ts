import { SpatialConfidence } from '../contracts/mira-beauty-report.interface';

export type SpatialSpikeVerdict =
  | '5b-fallback'
  | '5b-true-regional'
  | '5b-true-pixel';

export interface SpatialSpikeResult {
  hasRegionalScores: boolean;
  hasMaskOrCoordinates: boolean;
  spatialConfidence: SpatialConfidence;
  verdict: SpatialSpikeVerdict;
  notesAr: string;
}

/**
 * Phase 5a gate — inspect YouCam raw payload for regional/mask data.
 * Current S2S v2.0 skin-analysis returns global `type + ui_score` only.
 */
export function detectSpatialCapability(
  rawTaskData: unknown,
): SpatialSpikeResult {
  const data = asRecord(rawTaskData);
  const results = asRecord(data?.results);
  const output = Array.isArray(results?.output) ? results!.output : [];

  let hasRegionalScores = false;
  let hasMaskOrCoordinates = false;

  for (const item of output) {
    const row = asRecord(item);
    if (!row) continue;

    if (hasRegionalFields(row)) {
      hasRegionalScores = true;
    }
    if (hasMaskOrCoordinateFields(row)) {
      hasMaskOrCoordinates = true;
    }
  }

  if (hasMaskOrCoordinates) {
    return {
      hasRegionalScores: true,
      hasMaskOrCoordinates: true,
      spatialConfidence: 'pixel',
      verdict: '5b-true-pixel',
      notesAr:
        'YouCam أرجع mask/coordinates — Face Map الكامل مسموح (pixel confidence).',
    };
  }

  if (hasRegionalScores) {
    return {
      hasRegionalScores: true,
      hasMaskOrCoordinates: false,
      spatialConfidence: 'regional',
      verdict: '5b-true-regional',
      notesAr:
        'YouCam أرجع regional scores — soft zone highlights مسموحة (regional).',
    };
  }

  return {
    hasRegionalScores: false,
    hasMaskOrCoordinates: false,
    spatialConfidence: 'none',
    verdict: '5b-fallback',
    notesAr:
      'YouCam الحالي = global scores فقط — مسار 5b-fallback: narrative + disclaimer بدون markers.',
  };
}

function hasRegionalFields(row: Record<string, unknown>): boolean {
  const keys = [
    'regions',
    'region_scores',
    'regional_scores',
    'zones',
    'zone_scores',
    'forehead',
    'cheek',
    't_zone',
  ];
  return keys.some((k) => row[k] != null);
}

function hasMaskOrCoordinateFields(row: Record<string, unknown>): boolean {
  const keys = [
    'mask',
    'mask_url',
    'coordinates',
    'landmarks',
    'bounds',
    'polygon',
    'heatmap',
  ];
  return keys.some((k) => row[k] != null);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}
