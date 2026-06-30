import {
  FashionVisionValidationError,
  FashionVisionValidationResult,
  GeometryPayload,
  GeometrySegment,
  RegionRole,
  SilhouetteHint,
} from '../schema/fashion-vision-document.v1';

const REGION_ROLES = new Set<RegionRole>([
  'upper',
  'lower',
  'outerwear',
  'feet',
  'accessory',
  'full_body',
  'unknown',
]);

const SILHOUETTE_HINTS = new Set<SilhouetteHint>([
  'one_piece',
  'two_piece',
  'layered',
  'unknown',
]);

/** Fields that must never appear in FASHN geometry output (Phase 3). */
export const FASHN_FORBIDDEN_GEOMETRY_KEYS = [
  'compatibilityScore',
  'compatibility_score',
  'recommendation',
  'recommendations',
  'luxuryRating',
  'occasion',
  'occasionId',
  'skin',
  'userId',
] as const;

function err(path: string, code: string, message: string): FashionVisionValidationError {
  return { path, code, message };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function isFinite01(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
}

/** Reject recommendation/score fields in raw provider JSON before parsing. */
export function assertNoForbiddenFashnFields(
  payload: unknown,
  path = '$',
): FashionVisionValidationError[] {
  const errors: FashionVisionValidationError[] = [];
  if (!isRecord(payload) && !Array.isArray(payload)) return errors;

  if (isRecord(payload)) {
    for (const key of Object.keys(payload)) {
      if ((FASHN_FORBIDDEN_GEOMETRY_KEYS as readonly string[]).includes(key)) {
        errors.push(
          err(path, 'FORBIDDEN_FIELD', `FASHN geometry must not include ${key}`),
        );
      }
      const child = payload[key];
      if (isRecord(child) || Array.isArray(child)) {
        errors.push(...assertNoForbiddenFashnFields(child, `${path}.${key}`));
      }
    }
  }

  if (Array.isArray(payload)) {
    payload.forEach((item, i) => {
      errors.push(...assertNoForbiddenFashnFields(item, `${path}[${i}]`));
    });
  }

  return errors;
}

export function validateGeometryPayload(payload: GeometryPayload): FashionVisionValidationResult {
  const errors: FashionVisionValidationError[] = [];

  if (!Array.isArray(payload.segments) || payload.segments.length === 0) {
    errors.push(err('geometry.segments', 'REQUIRED', 'at least one segment required'));
  } else {
    payload.segments.forEach((seg, i) => validateSegment(seg, `geometry.segments[${i}]`, errors));
  }

  const topo = payload.topology;
  if (!topo) {
    errors.push(err('geometry.topology', 'REQUIRED', 'topology required'));
  } else {
    if (typeof topo.pieceCount !== 'number' || topo.pieceCount < 0) {
      errors.push(err('geometry.topology.pieceCount', 'RANGE', 'invalid pieceCount'));
    }
    if (typeof topo.onePiece !== 'boolean') {
      errors.push(err('geometry.topology.onePiece', 'TYPE', 'onePiece must be boolean'));
    }
    if (!SILHOUETTE_HINTS.has(topo.silhouetteHint)) {
      errors.push(err('geometry.topology.silhouetteHint', 'ENUM', 'invalid silhouetteHint'));
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateSegment(
  seg: GeometrySegment,
  path: string,
  errors: FashionVisionValidationError[],
): void {
  if (!seg.id?.trim()) {
    errors.push(err(`${path}.id`, 'REQUIRED', 'segment id required'));
  }
  if (!REGION_ROLES.has(seg.regionRole)) {
    errors.push(err(`${path}.regionRole`, 'ENUM', 'invalid regionRole'));
  }
  if (!Array.isArray(seg.polygon) || seg.polygon.length < 3) {
    errors.push(err(`${path}.polygon`, 'FORMAT', 'polygon min 3 points'));
  }
  const b = seg.bbox;
  if (!b) {
    errors.push(err(`${path}.bbox`, 'REQUIRED', 'bbox required'));
  } else {
    for (const k of ['x', 'y', 'w', 'h'] as const) {
      if (!isFinite01(b[k])) {
        errors.push(err(`${path}.bbox.${k}`, 'RANGE', `${k} must be 0..1`));
      }
    }
  }
}

export function runGeometryQualityGate(
  rawPayload: unknown,
  geometry: GeometryPayload,
): FashionVisionValidationResult {
  const forbidden = assertNoForbiddenFashnFields(rawPayload);
  if (forbidden.length > 0) {
    return { valid: false, errors: forbidden };
  }
  return validateGeometryPayload(geometry);
}
