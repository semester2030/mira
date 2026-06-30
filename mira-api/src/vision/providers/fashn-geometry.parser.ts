import {
  GeometryPayload,
  GeometrySegment,
  GeometryTopology,
  RegionRole,
  SilhouetteHint,
} from '../schema/fashion-vision-document.v1';

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function asNumber(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function normalizeRegionRole(raw: unknown): RegionRole {
  const s = String(raw ?? '').toLowerCase();
  if (s.includes('upper') || s.includes('top') || s.includes('shirt') || s.includes('blouse')) {
    return 'upper';
  }
  if (s.includes('lower') || s.includes('pant') || s.includes('skirt') || s.includes('jean')) {
    return 'lower';
  }
  if (s.includes('outer') || s.includes('jacket') || s.includes('blazer') || s.includes('coat')) {
    return 'outerwear';
  }
  if (s.includes('shoe') || s.includes('foot') || s.includes('heel')) return 'feet';
  if (s.includes('bag') || s.includes('access') || s.includes('jewel')) return 'accessory';
  if (s.includes('dress') || s.includes('full') || s.includes('one_piece')) return 'full_body';
  return 'unknown';
}

function polygonFromBbox(x: number, y: number, w: number, h: number): number[][] {
  return [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
}

function parseBbox(raw: unknown): { x: number; y: number; w: number; h: number } | null {
  if (!isRecord(raw)) return null;
  const x = clamp01(asNumber(raw.x, NaN));
  const y = clamp01(asNumber(raw.y, NaN));
  const w = clamp01(asNumber(raw.w ?? raw.width, NaN));
  const h = clamp01(asNumber(raw.h ?? raw.height, NaN));
  if (!Number.isFinite(x + y + w + h)) return null;
  return { x, y, w, h };
}

function parseSegment(raw: unknown, index: number): GeometrySegment | null {
  if (!isRecord(raw)) return null;

  const id = String(raw.id ?? raw.segmentId ?? `seg-${index + 1}`).trim();
  const regionRole = normalizeRegionRole(raw.regionRole ?? raw.role ?? raw.zone ?? raw.label);

  let polygon: number[][] = [];
  if (Array.isArray(raw.polygon)) {
    polygon = raw.polygon
      .map((pt) => {
        if (!Array.isArray(pt) || pt.length < 2) return null;
        return [clamp01(asNumber(pt[0], 0)), clamp01(asNumber(pt[1], 0))];
      })
      .filter((p): p is number[] => p != null);
  }

  let bbox = parseBbox(raw.bbox ?? raw.box ?? raw.rect ?? raw.boundingBox);
  if (!bbox && polygon.length >= 3) {
    const xs = polygon.map((p) => p[0]);
    const ys = polygon.map((p) => p[1]);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    bbox = { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }
  if (!bbox) return null;
  if (polygon.length < 3) polygon = polygonFromBbox(bbox.x, bbox.y, bbox.w, bbox.h);

  const cropRef =
    typeof raw.cropRef === 'string'
      ? raw.cropRef
      : typeof raw.crop_ref === 'string'
        ? raw.crop_ref
        : undefined;

  return { id, regionRole, polygon, bbox, cropRef };
}

function inferTopology(segments: GeometrySegment[]): GeometryTopology {
  const roles = new Set(segments.map((s) => s.regionRole));
  const hasFull = roles.has('full_body');
  const hasUpper = roles.has('upper') || roles.has('outerwear');
  const hasLower = roles.has('lower');

  let silhouetteHint: SilhouetteHint = 'unknown';
  let onePiece = false;
  let pieceCount = segments.length;

  if (hasFull || (segments.length === 1 && !hasLower)) {
    onePiece = true;
    silhouetteHint = 'one_piece';
    pieceCount = Math.max(1, pieceCount);
  } else if (hasUpper && hasLower) {
    onePiece = false;
    silhouetteHint = 'two_piece';
    pieceCount = Math.max(2, pieceCount);
  } else if (segments.length >= 3) {
    silhouetteHint = 'layered';
  }

  return { pieceCount, onePiece, silhouetteHint };
}

function extractSegmentsRoot(payload: Record<string, unknown>): unknown[] {
  const candidates = [
    payload.segments,
    isRecord(payload.geometry) ? payload.geometry.segments : null,
    isRecord(payload.data) ? payload.data.segments : null,
    isRecord(payload.result) ? payload.result.segments : null,
    isRecord(payload.data) && isRecord(payload.data.geometry)
      ? payload.data.geometry.segments
      : null,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c;
  }
  return [];
}

function extractTopologyRoot(
  payload: Record<string, unknown>,
  segments: GeometrySegment[],
): GeometryTopology {
  const raw =
    payload.topology ??
    (isRecord(payload.geometry) ? payload.geometry.topology : null) ??
    (isRecord(payload.data) ? payload.data.topology : null);

  if (isRecord(raw)) {
    const hint = String(raw.silhouetteHint ?? raw.silhouette_hint ?? 'unknown');
    const validHints = new Set(['one_piece', 'two_piece', 'layered', 'unknown']);
    return {
      pieceCount: asNumber(raw.pieceCount ?? raw.piece_count, segments.length),
      onePiece: Boolean(raw.onePiece ?? raw.one_piece),
      silhouetteHint: validHints.has(hint) ? (hint as SilhouetteHint) : 'unknown',
    };
  }
  return inferTopology(segments);
}

/** Parse FASHN (or compatible) JSON into GeometryPayload — geometry fields only. */
export function parseFashnGeometryResponse(payload: unknown): GeometryPayload {
  if (!isRecord(payload)) {
    throw new Error('FASHN response must be a JSON object');
  }

  const segmentRaw = extractSegmentsRoot(payload);
  const segments = segmentRaw
    .map((s, i) => parseSegment(s, i))
    .filter((s): s is GeometrySegment => s != null);

  if (segments.length === 0) {
    throw new Error('FASHN response contains no valid geometry segments');
  }

  return {
    segments,
    topology: extractTopologyRoot(payload, segments),
  };
}

/** Deterministic geometry for unit tests (no HTTP). */
export function buildMockFashnGeometryResponse(): Record<string, unknown> {
  return {
    segments: [
      {
        id: 'seg-upper-1',
        regionRole: 'outerwear',
        polygon: [
          [0.22, 0.18],
          [0.78, 0.18],
          [0.72, 0.52],
          [0.28, 0.52],
        ],
        bbox: { x: 0.22, y: 0.18, w: 0.56, h: 0.34 },
      },
      {
        id: 'seg-lower-1',
        regionRole: 'lower',
        polygon: [
          [0.28, 0.52],
          [0.72, 0.52],
          [0.68, 0.88],
          [0.32, 0.88],
        ],
        bbox: { x: 0.28, y: 0.52, w: 0.44, h: 0.36 },
      },
    ],
    topology: {
      pieceCount: 2,
      onePiece: false,
      silhouetteHint: 'two_piece',
    },
  };
}
