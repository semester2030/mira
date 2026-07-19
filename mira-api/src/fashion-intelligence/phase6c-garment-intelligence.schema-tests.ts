/**
 * Phase 6C / 6C.1 — Garment Intelligence tests (+ remediation).
 * Run: npm run test:phase6c
 */
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import {
  FashionVisionDocument,
  SemanticGarment,
  ResolvedGarment,
} from '../vision/schema/fashion-vision-document.v1';
import {
  GarmentMappingEngine,
  pairObservations,
  pickGeometryRef,
} from './garment/mapping-engine';
import { ClassificationEngine } from './garment/classification-engine';
import {
  normalizeCategoryId,
  normalizeColorId,
  normalizeTypeId,
} from './garment/normalization-engine';
import { AttributeResolutionEngine } from './garment/attribute-resolution-engine';
import { ConfidenceEngine } from './garment/confidence-engine';
import { LimitationEngine } from './garment/limitation-engine';
import {
  assertNoFashionProviderLeakage,
  FASHION_RUNTIME_STATUS_CATALOG,
} from './runtime/fashion-runtime-state';
import {
  assertNonEmptyOnProceed,
  assertValidGarments,
  validateCanonicalGarment,
  validateCanonicalGarmentSet,
} from './garment/garment-validators';
import { GarmentIntelligenceService } from './garment/garment-intelligence.service';
import { getFashionCapability } from './capability/fashion-capability-catalog';
import { FASHION_GARMENT_SCHEMA_VERSION } from './release';
import {
  CanonicalGarment,
  FASHION_GARMENT_MAPPING_VERSION as MAP_V,
} from './garment/canonical-garment';
import { WardrobeService } from './service/wardrobe.service';
import { InMemoryWardrobeRepository } from './repository/in-memory.repository';
import {
  CatalogResolutionEngine,
  resetCatalogIndexCache,
} from './garment/catalog-resolution-engine';
import {
  deterministicGarmentId,
  GARMENT_MAPPING_EPOCH_ISO,
} from './garment/garment-identity';
import { ProviderPortError } from '../ports/shared/provider-error';
import { VisionFashionAdapter } from '../ports/adapters/vision-fashion.adapter';

function fakeConfig(overrides: Record<string, string> = {}): ConfigService {
  return {
    get: (key: string, def?: string) =>
      overrides[key] ?? process.env[key] ?? def,
  } as ConfigService;
}

function loadGoldenVision(): FashionVisionDocument {
  const p = path.join(__dirname, 'garment/goldens/blazer_beige.vision.json');
  const srcFallback = path.join(
    process.cwd(),
    'src/fashion-intelligence/garment/goldens/blazer_beige.vision.json',
  );
  const file = fs.existsSync(p) ? p : srcFallback;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as FashionVisionDocument;
}

function cloneDoc(doc: FashionVisionDocument): FashionVisionDocument {
  return JSON.parse(JSON.stringify(doc)) as FashionVisionDocument;
}

function testNormalization(): void {
  assert.equal(normalizeCategoryId('TOP'), 'tops');
  assert.equal(normalizeTypeId('Blazers'), 'blazer');
  assert.equal(normalizeColorId('beige'), 'beige_linen');
  console.log('ok normalization');
}

function testClassification(): void {
  const eng = new ClassificationEngine();
  const r = eng.classify({ categoryId: 'tops', typeId: 'blazer' });
  assert.equal(r.categoryId, 'tops');
  assert.equal(r.typeId, 'blazer');
  assert.equal(r.entityClass, 'garment');
  assert.equal(r.knownType, true);
  const unk = eng.classify({ categoryId: 'xyzzy', typeId: 'nope' });
  assert.equal(unk.categoryId, 'unknown');
  assert.equal(unk.typeId, 'unknown');
  console.log('ok classification');
}

function testAttributesNoFabrication(): void {
  const eng = new AttributeResolutionEngine();
  const r = eng.resolve({
    colors: ['beige'],
    material: 'wool',
    fit: 'tailored',
  });
  assert.ok(r.colors.includes('beige_linen'));
  assert.equal(r.material.kind, 'estimated');
  assert.equal(r.pattern, undefined);
  assert.ok(r.limitationCodes.includes('pattern_missing'));
  assert.ok(r.limitationCodes.includes('season_not_evidenced'));
  assert.ok(r.limitationCodes.includes('occasion_not_evidenced'));
  console.log('ok attributes_no_fabrication');
}

function testConfidence(): void {
  const eng = new ConfidenceEngine();
  const r = eng.aggregate({
    fusionOverall: 0.8,
    providerConfidence: 0.82,
    fieldConfidence: [{ field: 'color:beige_linen', confidence: 0.85 }],
    fusionFieldConfidence: [
      { field: 'typeId', confidence: 0.8 },
      { field: 'categoryId', confidence: 0.85 },
    ],
    classificationKnown: true,
    mappingComplete: true,
  });
  assert.ok(eng.validate(r.overall));
  assert.ok(r.overall > 0.5);
  assert.ok(r.fields.some((f) => f.field === 'typeId'));
  console.log('ok confidence');
}

function testLimitations(): void {
  const eng = new LimitationEngine();
  const lines = eng.build(['pattern_missing', 'material_estimated']);
  assert.ok(lines.some((l: string) => l.includes('pattern_missing')));
  assert.ok(lines.some((l: string) => l.includes('estimated')));
  console.log('ok limitations');
}

function testMappingGolden(): void {
  const doc = loadGoldenVision();
  const mapper = new GarmentMappingEngine();
  const result = mapper.mapFromVisionDocument(doc);
  assert.equal(result.mappingVersion, MAP_V);
  assert.ok(result.garments.length >= 1);
  const g = result.garments[0];
  assert.equal(g.version, FASHION_GARMENT_SCHEMA_VERSION);
  assert.equal(g.identity.typeId, 'blazer');
  assert.equal(g.identity.categoryId, 'tops');
  assert.equal(g.attributes.material.kind, 'estimated');
  assert.equal(g.attributes.pattern, undefined);
  assert.ok(g.limitations.some((l: string) => l.includes('pattern_missing')));
  assert.ok(g.explainability.length >= 1);
  assert.ok(g.explainability[0].reasonAr.length > 0);
  assertNoFashionProviderLeakage(g);
  const v = validateCanonicalGarment(g);
  assert.equal(v.valid, true, JSON.stringify(v.issues));
  assert.ok(FASHION_RUNTIME_STATUS_CATALOG[g.runtime.status] !== undefined);
  assert.equal(g.source, 'vision');
  assert.ok(g.confidence > 0);
  assert.equal(g.createdAt, GARMENT_MAPPING_EPOCH_ISO);
  console.log('ok mapping_golden');
}

function testDeterministicIdentity(): void {
  const doc = loadGoldenVision();
  const mapper = new GarmentMappingEngine();
  const a = mapper.mapFromVisionDocument(doc);
  const b = mapper.mapFromVisionDocument(doc);
  assert.equal(a.garments[0].garmentId, b.garments[0].garmentId);
  assert.ok(a.garments[0].garmentId.startsWith('garm_'));
  assert.equal(a.garments[0].garmentId, b.garments[0].garmentId);
  // Content-addressed helper stability
  const id1 = deterministicGarmentId({
    slot: 'g0',
    categoryId: 'tops',
    typeId: 'blazer',
    colors: ['beige_linen'],
    material: 'wool',
    fit: 'tailored',
    segmentId: 'seg_upper_1',
  });
  const id2 = deterministicGarmentId({
    slot: 'g0',
    categoryId: 'tops',
    typeId: 'blazer',
    colors: ['beige_linen'],
    material: 'wool',
    fit: 'tailored',
    segmentId: 'seg_upper_1',
  });
  assert.equal(id1, id2);
  assert.equal(a.garments[0].garmentId, id1);
  console.log('ok deterministic_identity');
}

function testGeometryMapping(): void {
  const doc = loadGoldenVision();
  const mapped = new GarmentMappingEngine().mapFromVisionDocument(doc);
  const g = mapped.garments[0];
  assert.ok(g.geometryRef);
  assert.equal(g.geometryRef?.segmentId, 'seg_upper_1');
  assert.equal(g.geometryRef?.regionRole, 'upper');
  const picked = pickGeometryRef(doc.geometry.segments, 'tops', 0);
  assert.equal(picked?.segmentId, 'seg_upper_1');
  console.log('ok geometry_mapping');
}

function testFieldConfidenceFusion(): void {
  const mapped = new GarmentMappingEngine().mapFromVisionDocument(
    loadGoldenVision(),
  );
  const fields = mapped.garments[0].fieldConfidence;
  assert.ok(fields.some((f) => f.field === 'typeId' || f.field === 'categoryId'));
  console.log('ok field_confidence_fusion');
}

function testMultiGarmentOrdering(): void {
  const resolved: ResolvedGarment[] = [
    { categoryId: 'bottoms', typeId: 'pants', confidence: 0.7 },
    { categoryId: 'tops', typeId: 'blazer', confidence: 0.8 },
  ];
  const semantics: SemanticGarment[] = [
    {
      categoryId: 'tops',
      typeId: 'blazer',
      colors: ['beige'],
      material: 'wool',
      providerConfidence: 0.8,
    },
    {
      categoryId: 'bottoms',
      typeId: 'pants',
      colors: ['black'],
      providerConfidence: 0.7,
    },
  ];
  const pairs = pairObservations(resolved, semantics);
  assert.equal(pairs.length, 2);
  assert.equal(pairs[0].resolved?.typeId, 'pants');
  assert.equal(pairs[0].semantic?.typeId, 'pants');
  assert.equal(pairs[1].resolved?.typeId, 'blazer');
  assert.equal(pairs[1].semantic?.typeId, 'blazer');

  const doc = cloneDoc(loadGoldenVision());
  doc.fusion.resolvedGarments = resolved;
  doc.semantics.garments = semantics;
  doc.geometry.segments = [
    {
      id: 'seg_lower',
      regionRole: 'lower',
      polygon: [
        [0, 0.5],
        [0.4, 0.5],
        [0.4, 0.9],
        [0, 0.9],
      ],
      bbox: { x: 0, y: 0.5, w: 0.4, h: 0.4 },
    },
    {
      id: 'seg_upper_1',
      regionRole: 'upper',
      polygon: [
        [0.1, 0.1],
        [0.5, 0.1],
        [0.5, 0.5],
        [0.1, 0.5],
      ],
      bbox: { x: 0.1, y: 0.1, w: 0.4, h: 0.4 },
    },
  ];
  const mapped = new GarmentMappingEngine().mapFromVisionDocument(doc);
  assert.equal(mapped.garments.length, 2);
  assert.equal(mapped.garments[0].identity.typeId, 'pants');
  assert.equal(mapped.garments[1].identity.typeId, 'blazer');
  // Slot-stable ids differ
  assert.notEqual(mapped.garments[0].garmentId, mapped.garments[1].garmentId);
  console.log('ok multi_garment_ordering');
}

function testCatalogAmbiguity(): void {
  resetCatalogIndexCache();
  const eng = new CatalogResolutionEngine([
    { id: 'piece_a_blazer', category: 'tops', typeHint: 'blazer', colorId: 'beige_linen' },
    { id: 'piece_b_blazer', category: 'tops', typeHint: 'blazer', colorId: 'beige_linen' },
  ]);
  const r = eng.resolve({
    categoryId: 'tops',
    typeId: 'blazer',
    colors: ['beige_linen'],
  });
  assert.equal(r.catalogPieceId, undefined);
  assert.ok(r.limitationCodes.includes('catalog_ambiguous'));

  const doc = cloneDoc(loadGoldenVision());
  const mapped = new GarmentMappingEngine(
    undefined,
    undefined,
    eng,
  ).mapFromVisionDocument(doc);
  assert.equal(mapped.garments[0].identity.catalogPieceId, undefined);
  assert.ok(
    mapped.garments[0].limitations.some((l) => l.includes('catalog_ambiguous')),
  );
  assert.deepEqual(mapped.garments[0].attributes.season, []);
  console.log('ok catalog_ambiguity');
}

function testProviderLeakageBan(): void {
  assert.throws(() =>
    assertNoFashionProviderLeakage({ meta: { provider: 'vision_platform' } }),
  );
  assert.throws(() =>
    assertNoFashionProviderLeakage({ note: 'fashn+openai' }),
  );
  assert.doesNotThrow(() =>
    assertNoFashionProviderLeakage({ meta: { provider: 'mira' } }),
  );
  console.log('ok provider_leakage_ban');
}

function testAdapterFailureNoSilentEmpty(): void {
  // Unit-level: empty on proceed must throw (adapter surfaces as ProviderPortError)
  assert.throws(() => assertNonEmptyOnProceed([], 'proceed'));
  assert.doesNotThrow(() => assertNonEmptyOnProceed([], 'blocked'));

  const doc = cloneDoc(loadGoldenVision());
  // Force invalid measured material via post-map validation path
  const mapped = new GarmentMappingEngine().mapFromVisionDocument(doc);
  const bad: CanonicalGarment = {
    ...mapped.garments[0],
    attributes: {
      ...mapped.garments[0].attributes,
      material: { kind: 'measured', value: 'wool' },
    },
  };
  assert.throws(() => assertValidGarments([bad]));

  // Adapter class exposes failedRuntime helper for observability
  const rt = VisionFashionAdapter.failedRuntime(
    't1',
    'mapping failed',
    'فشل التعيين',
  );
  assert.equal(rt.status, 'FAILED');
  assert.ok(ProviderPortError);
  console.log('ok adapter_failure_no_silent_empty');
}

function testNoProviderLeakageOnSet(): void {
  const doc = loadGoldenVision();
  const mapped = new GarmentMappingEngine().mapFromVisionDocument(doc);
  const r = validateCanonicalGarmentSet(mapped.garments);
  assert.equal(r.valid, true, JSON.stringify(r.issues));
  assertNoFashionProviderLeakage(mapped.garments);
  console.log('ok no_provider_leakage_set');
}

function testCapabilityActivation(): void {
  assert.equal(getFashionCapability('analyze_garment')?.executionEnabled, true);
  assert.equal(
    getFashionCapability('analyze_garment')?.providerRequirements,
    'none',
  );
  const svc = new GarmentIntelligenceService(fakeConfig());
  const doc = loadGoldenVision();
  const out = svc.analyzeGarment(doc);
  assert.equal(out.success, true);
  assert.equal(out.capabilityId, 'analyze_garment');
  assert.ok(out.garments.length >= 1);
  console.log('ok capability_activation');
}

function testCapabilityFlagOff(): void {
  const svc = new GarmentIntelligenceService(
    fakeConfig({ FASHION_GARMENT_INTEL_ENABLED: 'false' }),
  );
  assert.throws(() => svc.analyzeGarment(loadGoldenVision()));
  console.log('ok capability_flag_off');
}

async function testWardrobeStoresRefsOnly(): Promise<void> {
  const repo = new InMemoryWardrobeRepository();
  const wardrobe = new WardrobeService(repo, fakeConfig());
  const svc = new GarmentIntelligenceService(fakeConfig());
  const out = svc.analyzeGarment(loadGoldenVision());
  const w = await wardrobe.createWardrobe('user-6c');
  const updated = await wardrobe.addItem(w.wardrobeId, {
    garmentId: out.garments[0].garmentId,
    entityClass: out.garments[0].identity.entityClass,
  });
  assert.equal(updated.items[0].garmentId, out.garments[0].garmentId);
  assert.equal(
    (updated.items[0] as { attributes?: unknown }).attributes,
    undefined,
  );
  // Remap → same wardrobe ref
  const out2 = svc.analyzeGarment(loadGoldenVision());
  assert.equal(out2.garments[0].garmentId, out.garments[0].garmentId);
  console.log('ok wardrobe_refs_only');
}

function testDuplicateIdsRejected(): void {
  const doc = loadGoldenVision();
  const mapped = new GarmentMappingEngine().mapFromVisionDocument(doc);
  const dup: CanonicalGarment[] = [...mapped.garments, { ...mapped.garments[0] }];
  const r = validateCanonicalGarmentSet(dup);
  assert.equal(r.valid, false);
  assert.ok(r.issues.some((i) => i.code === 'duplicate_garment_id'));
  console.log('ok duplicate_ids');
}

function testRuntimeEmission(): void {
  const mapped = new GarmentMappingEngine().mapFromVisionDocument(
    loadGoldenVision(),
  );
  assert.ok(mapped.runtime.status);
  assert.equal(typeof mapped.runtime.retryable, 'boolean');
  assert.ok(mapped.runtime.trustLevel);
  assert.equal(
    (mapped.runtime as { providerId?: string }).providerId,
    undefined,
  );
  console.log('ok runtime_emission');
}

function testVersions(): void {
  assert.equal(FASHION_GARMENT_SCHEMA_VERSION, 'garment-schema-v1');
  assert.equal(MAP_V, 'garment-mapping-v1');
  console.log('ok versions');
}

function testGoldenRegressionIdentityPin(): void {
  const mapped = new GarmentMappingEngine().mapFromVisionDocument(
    loadGoldenVision(),
  );
  const expected = deterministicGarmentId({
    slot: 'g0',
    categoryId: 'tops',
    typeId: 'blazer',
    colors: ['beige_linen'],
    material: 'wool',
    fit: 'tailored',
    segmentId: 'seg_upper_1',
  });
  assert.equal(mapped.garments[0].garmentId, expected);
  console.log('ok golden_regression_identity_pin');
}

async function main(): Promise<void> {
  testVersions();
  testNormalization();
  testClassification();
  testAttributesNoFabrication();
  testConfidence();
  testLimitations();
  testMappingGolden();
  testDeterministicIdentity();
  testGeometryMapping();
  testFieldConfidenceFusion();
  testMultiGarmentOrdering();
  testCatalogAmbiguity();
  testProviderLeakageBan();
  testAdapterFailureNoSilentEmpty();
  testNoProviderLeakageOnSet();
  testCapabilityActivation();
  testCapabilityFlagOff();
  testDuplicateIdsRejected();
  testRuntimeEmission();
  testGoldenRegressionIdentityPin();
  await testWardrobeStoresRefsOnly();
  console.log('phase6c garment intelligence OK (incl. 6C.1 remediation)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
