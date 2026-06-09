import { ConcernSeverity } from '../contracts/mira-beauty-report.interface';
import {
  FaceHealthConcernOverlay,
  FaceHealthSpatialMarker,
  FaceHealthZoneId,
} from '../contracts/face_health_map.interface';

const REGION_KEY_MAP: Record<string, FaceHealthZoneId> = {
  forehead: 'forehead',
  brow: 'forehead',
  t_zone: 't_zone',
  tzone: 't_zone',
  't-zone': 't_zone',
  nose: 'nose',
  chin: 'chin',
  jaw: 'jawline',
  jawline: 'jawline',
  cheek: 'cheek_left',
  cheek_left: 'cheek_left',
  left_cheek: 'cheek_left',
  cheek_l: 'cheek_left',
  cheek_right: 'cheek_right',
  right_cheek: 'cheek_right',
  cheek_r: 'cheek_right',
  under_eye: 'under_eye',
  undereye: 'under_eye',
  eye: 'under_eye',
  eyes: 'under_eye',
  dark_circle: 'under_eye',
};

const CONCERN_LABELS: Record<string, { ar: string; en: string; color: string }> = {
  oiliness: { ar: 'الدهون', en: 'Oiliness', color: '#F5A623' },
  pore: { ar: 'المسام', en: 'Pores', color: '#9B59B6' },
  moisture: { ar: 'الترطيب', en: 'Moisture', color: '#3498DB' },
  redness: { ar: 'الاحمرار', en: 'Redness', color: '#E74C3C' },
  wrinkle: { ar: 'التجاعيد', en: 'Wrinkles', color: '#8E44AD' },
  acne: { ar: 'الحبوب', en: 'Acne', color: '#E67E22' },
  age_spot: { ar: 'التصبغات', en: 'Spots', color: '#D35400' },
  texture: { ar: 'الملمس', en: 'Texture', color: '#16A085' },
  dark_circle: { ar: 'الهالات', en: 'Dark circles', color: '#7F8C8D' },
};

const DEFAULT_HIGHLIGHT_ZONES: Record<string, FaceHealthZoneId[]> = {
  oiliness: ['t_zone', 'forehead', 'nose', 'chin'],
  pore: ['t_zone', 'nose', 'chin'],
  moisture: ['cheek_left', 'cheek_right'],
  redness: ['cheek_left', 'cheek_right', 'nose'],
  wrinkle: ['forehead', 'under_eye', 'cheek_left', 'cheek_right'],
  acne: ['cheek_left', 'cheek_right', 'chin', 'forehead'],
  age_spot: ['cheek_left', 'cheek_right', 'forehead'],
  texture: ['cheek_left', 'cheek_right', 'forehead'],
  dark_circle: ['under_eye'],
};

export interface ParsedYouCamSpatial {
  concernOverlays: FaceHealthConcernOverlay[];
  markers: FaceHealthSpatialMarker[];
  defaultConcernId: string;
}

export function parseYouCamSpatial(
  rawTaskData: unknown,
  globalScores: Record<string, number>,
  mode: 'educational' | 'regional' | 'spatial',
): ParsedYouCamSpatial {
  const output = extractOutput(rawTaskData);
  const overlays: FaceHealthConcernOverlay[] = [];
  const markers: FaceHealthSpatialMarker[] = [];

  const concernIds = new Set<string>([
    ...Object.keys(globalScores),
    ...output.map((row) => normalizeConcernId(String(row.type ?? ''))),
  ]);

  for (const concernId of concernIds) {
    if (!concernId || concernId === 'unknown') continue;
    const row = output.find(
      (r) => normalizeConcernId(String(r.type ?? '')) === concernId,
    );
    const globalScore = Math.round(
      globalScores[concernId] ??
        (typeof row?.ui_score === 'number' ? row.ui_score : 72),
    );
    const labels = CONCERN_LABELS[concernId] ?? {
      ar: concernId,
      en: concernId,
      color: '#C19EE0',
    };

    const zoneScores = mode !== 'educational' ? extractZoneScores(row) : {};
    const hasRegionalData = Object.keys(zoneScores).length > 0;
    const highlightZoneIds = hasRegionalData
      ? pickWorstZones(zoneScores, 4)
      : (DEFAULT_HIGHLIGHT_ZONES[concernId] ?? ['forehead']);

    if (mode === 'spatial' && row) {
      markers.push(...extractMarkers(row, concernId));
    }

    overlays.push({
      concernId,
      labelAr: labels.ar,
      labelEn: labels.en,
      globalScore,
      severity: severityFromUi(globalScore),
      zoneScores,
      highlightZoneIds,
      highlightColor: labels.color,
      hasRegionalData,
    });
  }

  overlays.sort((a, b) => a.globalScore - b.globalScore);

  const defaultConcernId =
    overlays.find((o) => o.globalScore < 65)?.concernId ??
    overlays[0]?.concernId ??
    'oiliness';

  return {
    concernOverlays: overlays,
    markers,
    defaultConcernId,
  };
}

function extractOutput(rawTaskData: unknown): Array<Record<string, unknown>> {
  const data = asRecord(rawTaskData);
  const results = asRecord(data?.results);
  const output = results?.output;
  if (!Array.isArray(output)) return [];
  return output
    .map((item) => asRecord(item))
    .filter((row): row is Record<string, unknown> => row != null);
}

function extractZoneScores(
  row: Record<string, unknown> | undefined,
): Partial<Record<FaceHealthZoneId, number>> {
  if (!row) return {};

  const scores: Partial<Record<FaceHealthZoneId, number>> = {};
  const candidates = [
    row.region_scores,
    row.regional_scores,
    row.zones,
    row.zone_scores,
    row.regions,
  ];

  for (const candidate of candidates) {
    const map = asRecord(candidate);
    if (!map) continue;
    for (const [key, value] of Object.entries(map)) {
      const zoneId = mapRegionKey(key);
      const score = asNumber(value);
      if (zoneId && score != null) {
        scores[zoneId] = Math.round(score);
      }
    }
  }

  for (const key of ['forehead', 'cheek', 't_zone', 'nose', 'chin', 'under_eye']) {
    if (row[key] != null) {
      const zoneId = mapRegionKey(key);
      const score = asNumber(row[key]);
      if (zoneId && score != null) {
        scores[zoneId] = Math.round(score);
      }
    }
  }

  return scores;
}

function extractMarkers(
  row: Record<string, unknown>,
  concernId: string,
): FaceHealthSpatialMarker[] {
  const markers: FaceHealthSpatialMarker[] = [];

  const coordSources = [row.coordinates, row.landmarks, row.points, row.bounds];
  for (const source of coordSources) {
    if (Array.isArray(source)) {
      for (const point of source) {
        const p = asRecord(point);
        if (!p) continue;
        const x = normalizeCoord(p.x ?? p.left ?? p.cx);
        const y = normalizeCoord(p.y ?? p.top ?? p.cy);
        if (x == null || y == null) continue;
        markers.push({
          concernId,
          zoneId: inferZoneFromPoint(x, y),
          x,
          y,
          severity: asNumber(p.severity ?? p.score) ?? 3,
        });
      }
    }
  }

  return markers.slice(0, 24);
}

function pickWorstZones(
  zoneScores: Partial<Record<FaceHealthZoneId, number>>,
  limit: number,
): FaceHealthZoneId[] {
  return Object.entries(zoneScores)
    .sort(([, a], [, b]) => (a ?? 100) - (b ?? 100))
    .slice(0, limit)
    .map(([id]) => id as FaceHealthZoneId);
}

function inferZoneFromPoint(x: number, y: number): FaceHealthZoneId {
  if (y < 0.28) return 'forehead';
  if (y < 0.38 && (x < 0.35 || x > 0.65)) return 'under_eye';
  if (y >= 0.72) return 'chin';
  if (x >= 0.42 && x <= 0.58 && y >= 0.38 && y <= 0.62) return 'nose';
  if (x < 0.5) return 'cheek_left';
  return 'cheek_right';
}

function mapRegionKey(key: string): FaceHealthZoneId | null {
  const normalized = key.toLowerCase().replace(/\s+/g, '_');
  return REGION_KEY_MAP[normalized] ?? null;
}

function normalizeConcernId(type: string): string {
  const t = type.toLowerCase();
  if (t === 'dark_circle' || t === 'dark_circle_v2') return 'dark_circle';
  if (t === 'age_spot') return 'age_spot';
  return t;
}

function severityFromUi(uiScore: number): ConcernSeverity {
  if (uiScore >= 70) return 'mild';
  if (uiScore >= 55) return 'moderate';
  if (uiScore >= 40) return 'noticeable';
  return 'noticeable';
}

function normalizeCoord(value: unknown): number | null {
  const n = asNumber(value);
  if (n == null) return null;
  if (n > 1 && n <= 100) return n / 100;
  if (n > 100) return null;
  return clamp(n, 0, 1);
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
