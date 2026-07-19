import { CanonicalGarment } from './canonical-garment';
import { assertNoFashionProviderLeakage } from '../runtime/fashion-runtime-state';
import {
  isKnownCategoryId,
  isKnownColorId,
  isKnownGarmentTypeId,
  loadFashionOntologyRegistry,
} from '../../vision/schema/fashion-ontology.registry';
import {
  CatalogResolutionEngine,
  catalogOwnedCategoryIds,
} from './catalog-resolution-engine';
import { ConfidenceEngine } from './confidence-engine';

export interface GarmentValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface GarmentValidationResult {
  valid: boolean;
  issues: GarmentValidationIssue[];
}

/**
 * Garment validators — ontology, colors, leakage, duplicates, fabrication guards.
 */
export function validateCanonicalGarment(
  garment: CanonicalGarment,
  opts?: { catalog?: CatalogResolutionEngine },
): GarmentValidationResult {
  const issues: GarmentValidationIssue[] = [];
  const ontology = loadFashionOntologyRegistry();
  const catalog = opts?.catalog ?? new CatalogResolutionEngine();
  const confidence = new ConfidenceEngine();

  if (!garment.garmentId) {
    issues.push({ code: 'missing_id', path: 'garmentId', message: 'garmentId required' });
  }
  if (garment.version !== 'garment-schema-v1') {
    issues.push({
      code: 'invalid_version',
      path: 'version',
      message: 'Expected garment-schema-v1',
    });
  }

  const cat = garment.identity.categoryId;
  const type = garment.identity.typeId;
  if (
    cat !== 'unknown' &&
    !isKnownCategoryId(ontology, cat) &&
    !catalogOwnedCategoryIds().has(cat)
  ) {
    issues.push({
      code: 'invalid_category',
      path: 'identity.categoryId',
      message: `Unknown category ${cat}`,
    });
  }
  if (type !== 'unknown' && !isKnownGarmentTypeId(ontology, type)) {
    issues.push({
      code: 'invalid_type',
      path: 'identity.typeId',
      message: `Unknown type ${type}`,
    });
  }

  for (const color of garment.attributes.colors) {
    if (!isKnownColorId(ontology, color)) {
      issues.push({
        code: 'invalid_color',
        path: 'attributes.colors',
        message: `Unknown color ${color}`,
      });
    }
  }

  if (
    garment.attributes.material.kind === 'measured' &&
    !garment.attributes.material.value
  ) {
    issues.push({
      code: 'invalid_material',
      path: 'attributes.material',
      message: 'Measured material requires value',
    });
  }

  if (
    garment.identity.catalogPieceId &&
    !catalog.validatePieceId(garment.identity.catalogPieceId)
  ) {
    issues.push({
      code: 'broken_catalog_ref',
      path: 'identity.catalogPieceId',
      message: 'catalogPieceId not in catalog',
    });
  }

  if (!confidence.validate(garment.confidence)) {
    issues.push({
      code: 'invalid_confidence',
      path: 'confidence',
      message: 'Confidence must be 0..1',
    });
  }

  if (typeof garment.runtime?.retryable !== 'boolean') {
    issues.push({
      code: 'invalid_runtime',
      path: 'runtime.retryable',
      message: 'retryable required',
    });
  }

  // Fabrication guard: pattern without evidence limitation is suspicious if pattern set
  // but we allow pattern only when attrs engine set it with evidence — check material measured without estimate flag
  if (
    garment.attributes.material.kind === 'measured' &&
    garment.source === 'vision'
  ) {
    issues.push({
      code: 'fabricated_material_kind',
      path: 'attributes.material.kind',
      message: 'Vision source must not claim measured material',
    });
  }

  try {
    assertNoFashionProviderLeakage(garment);
  } catch (e) {
    issues.push({
      code: 'provider_leakage',
      path: '$',
      message: e instanceof Error ? e.message : String(e),
    });
  }

  return { valid: issues.length === 0, issues };
}

export function validateCanonicalGarmentSet(
  garments: CanonicalGarment[],
): GarmentValidationResult {
  const issues: GarmentValidationIssue[] = [];
  const ids = new Set<string>();
  for (const [i, g] of garments.entries()) {
    if (ids.has(g.garmentId)) {
      issues.push({
        code: 'duplicate_garment_id',
        path: `garments[${i}].garmentId`,
        message: `Duplicate ${g.garmentId}`,
      });
    }
    ids.add(g.garmentId);
    const r = validateCanonicalGarment(g);
    for (const issue of r.issues) {
      issues.push({
        ...issue,
        path: `garments[${i}].${issue.path}`,
      });
    }
  }
  return { valid: issues.length === 0, issues };
}

export function assertValidGarments(garments: CanonicalGarment[]): void {
  const r = validateCanonicalGarmentSet(garments);
  if (!r.valid) {
    throw new Error(
      `Garment validation failed: ${r.issues.map((i) => i.code).join(',')}`,
    );
  }
}

/** Proceed gate must not succeed with an empty canonical set. */
export function assertNonEmptyOnProceed(
  garments: CanonicalGarment[],
  analysisGate: string,
): void {
  if (analysisGate === 'proceed' && garments.length === 0) {
    throw new Error('Garment validation failed: empty_garments_on_proceed');
  }
}
