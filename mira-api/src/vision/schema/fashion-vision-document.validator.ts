import {
  FASHION_VISION_SCHEMA_VERSION,
  FashionVisionDocument,
  FashionVisionValidationError,
  FashionVisionValidationResult,
} from './fashion-vision-document.v1';
import {
  FashionOntologyRegistry,
  isKnownArchetypeId,
  isKnownCategoryId,
  isKnownColorId,
  isKnownGarmentTypeId,
  loadFashionOntologyRegistry,
} from './fashion-ontology.registry';

const ANALYSIS_GATES = new Set(['proceed', 'blocked', 'degraded']);
const REGION_ROLES = new Set([
  'upper',
  'lower',
  'outerwear',
  'feet',
  'accessory',
  'full_body',
  'unknown',
]);
const SILHOUETTE_HINTS = new Set([
  'one_piece',
  'two_piece',
  'layered',
  'unknown',
]);
const CONFLICT_SEVERITIES = new Set(['low', 'medium', 'high']);

export interface ValidateFashionVisionOptions {
  registry?: FashionOntologyRegistry;
  /** Minimum overallConfidence when analysisGate is proceed (Quality Gate). */
  minProceedConfidence?: number;
}

function err(
  path: string,
  code: string,
  message: string,
): FashionVisionValidationError {
  return { path, code, message };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function isFinite01(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
}

function isIsoTimestamp(s: unknown): boolean {
  if (typeof s !== 'string' || s.trim().length === 0) return false;
  return !Number.isNaN(Date.parse(s));
}

/**
 * Quality Gate + ontology validation for FashionVisionDocument v1.
 * Phase 1 — no provider calls; validates structure and taxonomy ids.
 */
export function validateFashionVisionDocument(
  input: unknown,
  options: ValidateFashionVisionOptions = {},
): FashionVisionValidationResult {
  const errors: FashionVisionValidationError[] = [];
  const registry = options.registry ?? loadFashionOntologyRegistry();
  const minProceed = options.minProceedConfidence ?? 0.5;

  if (!isRecord(input)) {
    return {
      valid: false,
      errors: [err('$', 'INVALID_ROOT', 'Document must be a JSON object')],
    };
  }

  const doc = input;

  if (doc.schemaVersion !== FASHION_VISION_SCHEMA_VERSION) {
    errors.push(
      err(
        'schemaVersion',
        'SCHEMA_VERSION',
        `Expected ${FASHION_VISION_SCHEMA_VERSION}`,
      ),
    );
  }

  if (!ANALYSIS_GATES.has(String(doc.analysisGate))) {
    errors.push(err('analysisGate', 'ANALYSIS_GATE', 'Invalid analysisGate'));
  }

  validateProvenance(doc.provenance, errors);
  validateGeometry(doc.geometry, errors);
  validateSemantics(doc.semantics, errors, registry);
  validateFusion(doc.fusion, errors, registry);

  if (doc.analysisGate === 'proceed') {
    const fusion = doc.fusion;
    if (isRecord(fusion) && isFinite01(fusion.overallConfidence)) {
      if ((fusion.overallConfidence as number) < minProceed) {
        errors.push(
          err(
            'fusion.overallConfidence',
            'CONFIDENCE_TOO_LOW',
            `proceed requires confidence >= ${minProceed}`,
          ),
        );
      }
    }
  }

  if (doc.analysisGate === 'blocked' && isRecord(doc.semantics)) {
    const garments = doc.semantics.garments;
    if (Array.isArray(garments) && garments.length === 0) {
      // blocked with empty garments is ok
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateProvenance(
  value: unknown,
  errors: FashionVisionValidationError[],
): void {
  if (!isRecord(value)) {
    errors.push(err('provenance', 'REQUIRED', 'provenance is required'));
    return;
  }
  if (
    !Array.isArray(value.providers) ||
    value.providers.length === 0 ||
    !value.providers.every((p) => typeof p === 'string' && p.length > 0)
  ) {
    errors.push(err('provenance.providers', 'REQUIRED', 'providers required'));
  }
  if (!isIsoTimestamp(value.timestamp)) {
    errors.push(
      err('provenance.timestamp', 'FORMAT', 'timestamp must be ISO-8601'),
    );
  }
  if (typeof value.orchestratorVersion !== 'string' || !value.orchestratorVersion) {
    errors.push(
      err(
        'provenance.orchestratorVersion',
        'REQUIRED',
        'orchestratorVersion required',
      ),
    );
  }
  if (value.pipelinePhase != null && typeof value.pipelinePhase !== 'string') {
    errors.push(err('provenance.pipelinePhase', 'TYPE', 'pipelinePhase must be string'));
  }
  if (value.normalizationNotes != null) {
    if (
      !Array.isArray(value.normalizationNotes) ||
      !value.normalizationNotes.every((n) => typeof n === 'string')
    ) {
      errors.push(
        err('provenance.normalizationNotes', 'TYPE', 'normalizationNotes must be string[]'),
      );
    }
  }
  if (value.rejectReasons != null) {
    if (!Array.isArray(value.rejectReasons)) {
      errors.push(err('provenance.rejectReasons', 'TYPE', 'rejectReasons must be array'));
    } else {
      value.rejectReasons.forEach((r, i) => {
        if (!isRecord(r) || typeof r.code !== 'string' || typeof r.message !== 'string') {
          errors.push(
            err(`provenance.rejectReasons[${i}]`, 'TYPE', 'reject reason must have code+message'),
          );
        }
      });
    }
  }
}

function validateGeometry(
  value: unknown,
  errors: FashionVisionValidationError[],
): void {
  if (!isRecord(value)) {
    errors.push(err('geometry', 'REQUIRED', 'geometry is required'));
    return;
  }

  if (!Array.isArray(value.segments)) {
    errors.push(err('geometry.segments', 'REQUIRED', 'segments must be array'));
    return;
  }

  value.segments.forEach((seg, i) => {
    const base = `geometry.segments[${i}]`;
    if (!isRecord(seg)) {
      errors.push(err(base, 'TYPE', 'segment must be object'));
      return;
    }
    if (typeof seg.id !== 'string' || !seg.id) {
      errors.push(err(`${base}.id`, 'REQUIRED', 'id required'));
    }
    if (!REGION_ROLES.has(String(seg.regionRole))) {
      errors.push(err(`${base}.regionRole`, 'ENUM', 'invalid regionRole'));
    }
    if (!Array.isArray(seg.polygon) || seg.polygon.length < 3) {
      errors.push(err(`${base}.polygon`, 'FORMAT', 'polygon min 3 points'));
    }
    validateBbox(seg.bbox, `${base}.bbox`, errors);
  });

  const topo = value.topology;
  if (!isRecord(topo)) {
    errors.push(err('geometry.topology', 'REQUIRED', 'topology required'));
    return;
  }
  if (typeof topo.pieceCount !== 'number' || topo.pieceCount < 0) {
    errors.push(err('geometry.topology.pieceCount', 'RANGE', 'invalid pieceCount'));
  }
  if (typeof topo.onePiece !== 'boolean') {
    errors.push(err('geometry.topology.onePiece', 'TYPE', 'onePiece must be boolean'));
  }
  if (!SILHOUETTE_HINTS.has(String(topo.silhouetteHint))) {
    errors.push(
      err('geometry.topology.silhouetteHint', 'ENUM', 'invalid silhouetteHint'),
    );
  }
}

function validateBbox(
  value: unknown,
  path: string,
  errors: FashionVisionValidationError[],
): void {
  if (!isRecord(value)) {
    errors.push(err(path, 'REQUIRED', 'bbox required'));
    return;
  }
  for (const key of ['x', 'y', 'w', 'h'] as const) {
    if (!isFinite01(value[key])) {
      errors.push(err(`${path}.${key}`, 'RANGE', `${key} must be 0..1`));
    }
  }
}

function validateSemantics(
  value: unknown,
  errors: FashionVisionValidationError[],
  registry: FashionOntologyRegistry,
): void {
  if (!isRecord(value)) {
    errors.push(err('semantics', 'REQUIRED', 'semantics is required'));
    return;
  }

  if (!Array.isArray(value.garments) || value.garments.length === 0) {
    errors.push(err('semantics.garments', 'REQUIRED', 'at least one garment'));
    return;
  }

  value.garments.forEach((g, i) => {
    const base = `semantics.garments[${i}]`;
    if (!isRecord(g)) {
      errors.push(err(base, 'TYPE', 'garment must be object'));
      return;
    }
    validateGarmentIds(g, base, errors, registry);
    if (!Array.isArray(g.colors) || g.colors.length === 0) {
      errors.push(err(`${base}.colors`, 'REQUIRED', 'colors required'));
    } else {
      g.colors.forEach((c, ci) => {
        if (typeof c !== 'string' || !isKnownColorId(registry, c)) {
          errors.push(
            err(`${base}.colors[${ci}]`, 'ONTOLOGY', `unknown color id: ${c}`),
          );
        }
      });
    }
    if (!isFinite01(g.providerConfidence)) {
      errors.push(
        err(`${base}.providerConfidence`, 'RANGE', 'confidence 0..1'),
      );
    }
  });

  if (value.styleArchetypeId != null) {
    const id = String(value.styleArchetypeId);
    if (!isKnownArchetypeId(registry, id)) {
      errors.push(
        err('semantics.styleArchetypeId', 'ONTOLOGY', `unknown archetype: ${id}`),
      );
    }
  }

  if (!Array.isArray(value.layering)) {
    errors.push(err('semantics.layering', 'REQUIRED', 'layering must be array'));
  }

  validateColorIdList(value.dominantColorIds, 'semantics.dominantColorIds', errors, registry);
  validateColorIdList(value.secondaryColorIds, 'semantics.secondaryColorIds', errors, registry);

  if (Array.isArray(value.accessories)) {
    value.accessories.forEach((a, i) => {
      const base = `semantics.accessories[${i}]`;
      if (!isRecord(a)) {
        errors.push(err(base, 'TYPE', 'accessory must be object'));
        return;
      }
      validateGarmentIds(a, base, errors, registry);
      if (!isFinite01(a.providerConfidence)) {
        errors.push(err(`${base}.providerConfidence`, 'RANGE', 'confidence 0..1'));
      }
    });
  }
}

function validateGarmentIds(
  g: Record<string, unknown>,
  base: string,
  errors: FashionVisionValidationError[],
  registry: FashionOntologyRegistry,
): void {
  const categoryId = String(g.categoryId ?? '');
  const typeId = String(g.typeId ?? '');
  if (!categoryId || !isKnownCategoryId(registry, categoryId)) {
    errors.push(
      err(`${base}.categoryId`, 'ONTOLOGY', `unknown category: ${categoryId}`),
    );
  }
  if (!typeId || !isKnownGarmentTypeId(registry, typeId)) {
    errors.push(err(`${base}.typeId`, 'ONTOLOGY', `unknown type: ${typeId}`));
  }
}

function validateColorIdList(
  value: unknown,
  path: string,
  errors: FashionVisionValidationError[],
  registry: FashionOntologyRegistry,
): void {
  if (!Array.isArray(value)) {
    errors.push(err(path, 'REQUIRED', 'must be array'));
    return;
  }
  value.forEach((c, i) => {
    if (typeof c !== 'string' || !isKnownColorId(registry, c)) {
      errors.push(err(`${path}[${i}]`, 'ONTOLOGY', `unknown color id: ${c}`));
    }
  });
}

function validateFusion(
  value: unknown,
  errors: FashionVisionValidationError[],
  registry: FashionOntologyRegistry,
): void {
  if (!isRecord(value)) {
    errors.push(err('fusion', 'REQUIRED', 'fusion is required'));
    return;
  }

  if (!Array.isArray(value.resolvedGarments)) {
    errors.push(err('fusion.resolvedGarments', 'REQUIRED', 'array required'));
  } else {
    value.resolvedGarments.forEach((g, i) => {
      const base = `fusion.resolvedGarments[${i}]`;
      if (!isRecord(g)) {
        errors.push(err(base, 'TYPE', 'object required'));
        return;
      }
      validateGarmentIds(g, base, errors, registry);
      if (!isFinite01(g.confidence)) {
        errors.push(err(`${base}.confidence`, 'RANGE', 'confidence 0..1'));
      }
    });
  }

  if (!Array.isArray(value.conflicts)) {
    errors.push(err('fusion.conflicts', 'REQUIRED', 'conflicts array required'));
  } else {
    value.conflicts.forEach((c, i) => {
      const base = `fusion.conflicts[${i}]`;
      if (!isRecord(c)) {
        errors.push(err(base, 'TYPE', 'object required'));
        return;
      }
      if (typeof c.code !== 'string' || !c.code) {
        errors.push(err(`${base}.code`, 'REQUIRED', 'code required'));
      }
      if (!CONFLICT_SEVERITIES.has(String(c.severity))) {
        errors.push(err(`${base}.severity`, 'ENUM', 'invalid severity'));
      }
    });
  }

  if (!Array.isArray(value.fieldConfidence)) {
    errors.push(err('fusion.fieldConfidence', 'REQUIRED', 'array required'));
  }

  if (!isFinite01(value.overallConfidence)) {
    errors.push(
      err('fusion.overallConfidence', 'RANGE', 'overallConfidence 0..1'),
    );
  }
}

/** Example valid document for tests and orchestrator stub (Phase 2). */
export function buildSampleFashionVisionDocument(): FashionVisionDocument {
  return {
    schemaVersion: FASHION_VISION_SCHEMA_VERSION,
    analysisGate: 'proceed',
    provenance: {
      providers: ['fashn-geometry', 'openai-semantic'],
      timestamp: new Date().toISOString(),
      orchestratorVersion: '1.0.0',
    },
    geometry: {
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
      ],
      topology: {
        pieceCount: 2,
        onePiece: false,
        silhouetteHint: 'two_piece',
      },
    },
    semantics: {
      garments: [
        {
          categoryId: 'outerwear',
          typeId: 'blazer',
          sleeve: 'long',
          neckline: 'notched_lapel',
          fit: 'tailored',
          colors: ['black_pure'],
          material: 'wool_blend',
          providerConfidence: 0.71,
        },
      ],
      accessories: [],
      styleArchetypeId: 'business',
      layering: ['base', 'outerwear'],
      dominantColorIds: ['black_pure'],
      secondaryColorIds: [],
    },
    fusion: {
      resolvedGarments: [
        { categoryId: 'outerwear', typeId: 'blazer', confidence: 0.68 },
      ],
      conflicts: [],
      fieldConfidence: [
        { field: 'semantics.garments[0].typeId', confidence: 0.68 },
      ],
      overallConfidence: 0.68,
    },
  };
}
