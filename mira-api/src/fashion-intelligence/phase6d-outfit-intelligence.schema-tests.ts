/**
 * Phase 6D + 6D.1 — Outfit Intelligence tests (remediation).
 * Run: npm run test:phase6d
 */
import assert from 'node:assert/strict';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { CanonicalGarment } from './garment/canonical-garment';
import { fashionRuntime, toPublicFashionRuntime } from './runtime/fashion-runtime-state';
import { OutfitEvaluationEngine } from './outfit/evaluation-engine';
import { OutfitIntelligenceService } from './outfit/outfit-intelligence.service';
import {
  assertValidOutfit,
  assertValidEvidenceGraph,
  validateCanonicalOutfit,
} from './outfit/outfit-validators';
import {
  deterministicOutfitId,
  OUTFIT_MAPPING_EPOCH_ISO,
} from './outfit/outfit-identity';
import {
  FASHION_OUTFIT_EVALUATION_VERSION,
  toPublicCanonicalOutfit,
} from './outfit/canonical-outfit';
import { getFashionCapability } from './capability/fashion-capability-catalog';
import { FASHION_INTELLIGENCE_RELEASE, FASHION_OUTFIT_SCHEMA_VERSION } from './release';
import { assertNoFashionProviderLeakage } from './runtime/fashion-runtime-state';
import { CompositionEngine } from './outfit/composition-engine';
import { OutfitEvidenceGraphBuilder } from './outfit/outfit-evidence-graph';
import { OUTFIT_CONFIDENCE_WEIGHTS_V1 } from './outfit/confidence-engine';

function fakeConfig(overrides: Record<string, string> = {}): NestConfigService {
  return {
    get: (key: string, def?: string) =>
      overrides[key] ?? process.env[key] ?? def,
  } as NestConfigService;
}

function sampleGarment(
  overrides: Partial<CanonicalGarment> & { garmentId: string },
): CanonicalGarment {
  const runtime = toPublicFashionRuntime(
    fashionRuntime({
      status: 'AVAILABLE',
      stage: 'mapping',
      reasonCode: 'fixture',
      capabilityId: 'analyze_garment',
      capabilityVersion: 'garment-schema-v1',
      traceId: 'fix',
    }),
  );
  const base: CanonicalGarment = {
    garmentId: overrides.garmentId,
    version: 'garment-schema-v1',
    identity: {
      categoryId: 'tops',
      typeId: 'blazer',
      entityClass: 'garment',
    },
    attributes: {
      colors: ['beige_linen'],
      material: { kind: 'estimated', value: 'wool', confidence: 0.7 },
      season: [],
      occasion: [],
      styleHints: ['quiet_luxury'],
    },
    confidence: 0.8,
    fieldConfidence: [{ field: 'color:beige_linen', confidence: 0.85 }],
    availability: 'detected',
    source: 'vision',
    limitations: [],
    explainability: [],
    runtime,
    mappingVersion: 'garment-mapping-v1',
    createdAt: OUTFIT_MAPPING_EPOCH_ISO,
    updatedAt: OUTFIT_MAPPING_EPOCH_ISO,
  };
  return {
    ...base,
    ...overrides,
    identity: { ...base.identity, ...overrides.identity },
    attributes: { ...base.attributes, ...overrides.attributes },
  };
}

function goldenLook(): CanonicalGarment[] {
  return [
    sampleGarment({
      garmentId: 'garm_blazer_01',
      identity: { categoryId: 'outerwear', typeId: 'blazer', entityClass: 'garment' },
      attributes: {
        colors: ['beige_linen'],
        material: { kind: 'estimated', value: 'wool' },
        season: ['autumn'],
        occasion: ['work'],
        styleHints: ['quiet_luxury'],
        fit: 'tailored',
      },
    }),
    sampleGarment({
      garmentId: 'garm_pants_01',
      identity: { categoryId: 'bottoms', typeId: 'pants', entityClass: 'garment' },
      attributes: {
        colors: ['black_pure'],
        material: { kind: 'estimated', value: 'wool' },
        season: ['autumn'],
        occasion: ['work'],
        styleHints: ['quiet_luxury'],
      },
    }),
  ];
}

function testVersions(): void {
  assert.equal(FASHION_OUTFIT_SCHEMA_VERSION, 'outfit-schema-v1');
  assert.equal(FASHION_OUTFIT_EVALUATION_VERSION, 'outfit-eval-v1');
  assert.equal(FASHION_INTELLIGENCE_RELEASE, '1.0.0-styling-intelligence');
  assert.equal(OUTFIT_CONFIDENCE_WEIGHTS_V1.version, 'outfit-confidence-weights-v1');
  console.log('ok versions');
}

function testComposition(): void {
  const graph = new OutfitEvidenceGraphBuilder('t_comp');
  const r = new CompositionEngine().compose(goldenLook(), graph);
  assert.equal(r.garmentIds.length, 2);
  assert.ok(r.slots.some((s) => s.slot === 'outer'));
  assert.ok(r.slots.some((s) => s.slot === 'lower'));
  // outer + lower without base/mid = incomplete (6D.1)
  assert.equal(r.complete, false);
  assert.ok(r.limitationCodes.includes('incomplete_outfit'));
  console.log('ok composition');
}

function testCompletenessHonest(): void {
  const eng = new CompositionEngine();
  const outerOnly = eng.compose(
    [
      sampleGarment({
        garmentId: 'garm_outer_only',
        identity: { categoryId: 'outerwear', typeId: 'coat', entityClass: 'garment' },
      }),
    ],
    new OutfitEvidenceGraphBuilder('t_outer'),
  );
  assert.equal(outerOnly.complete, false);

  const lowerOnly = eng.compose(
    [
      sampleGarment({
        garmentId: 'garm_lower_only',
        identity: { categoryId: 'bottoms', typeId: 'pants', entityClass: 'garment' },
      }),
    ],
    new OutfitEvidenceGraphBuilder('t_lower'),
  );
  assert.equal(lowerOnly.complete, false);

  const fullBody = eng.compose(
    [
      sampleGarment({
        garmentId: 'garm_dress',
        identity: { categoryId: 'dresses', typeId: 'dress', entityClass: 'garment' },
      }),
    ],
    new OutfitEvidenceGraphBuilder('t_dress'),
  );
  assert.equal(fullBody.complete, true);

  const baseLower = eng.compose(
    [
      sampleGarment({
        garmentId: 'garm_top',
        identity: { categoryId: 'tops', typeId: 'blouse', entityClass: 'garment' },
      }),
      sampleGarment({
        garmentId: 'garm_bottom',
        identity: { categoryId: 'bottoms', typeId: 'skirt', entityClass: 'garment' },
      }),
    ],
    new OutfitEvidenceGraphBuilder('t_base_lower'),
  );
  assert.equal(baseLower.complete, true);

  const midLower = eng.compose(
    [
      sampleGarment({
        garmentId: 'garm_sweater',
        identity: { categoryId: 'tops', typeId: 'sweater', entityClass: 'garment' },
      }),
      sampleGarment({
        garmentId: 'garm_jeans',
        identity: { categoryId: 'bottoms', typeId: 'jeans', entityClass: 'garment' },
      }),
    ],
    new OutfitEvidenceGraphBuilder('t_mid'),
  );
  assert.equal(midLower.slots.some((s) => s.slot === 'mid'), true);
  assert.equal(midLower.complete, true);
  console.log('ok completeness_honest');
}

function testDeterminism(): void {
  const eng = new OutfitEvaluationEngine();
  const ctx = { occasionId: 'work', season: 'autumn' };
  const a = eng.evaluate(goldenLook(), ctx);
  const b = eng.evaluate(goldenLook(), ctx);
  assert.equal(a.outfit.outfitId, b.outfit.outfitId);
  assert.equal(a.outfit.confidence, b.outfit.confidence);
  assert.equal(a.outfit.createdAt, OUTFIT_MAPPING_EPOCH_ISO);
  const id = deterministicOutfitId({
    garmentIds: ['garm_pants_01', 'garm_blazer_01'],
    occasionId: 'work',
    season: 'autumn',
  });
  assert.equal(a.outfit.outfitId, id);
  console.log('ok determinism');
}

function testReorderDeterminism(): void {
  const eng = new OutfitEvaluationEngine();
  const look = goldenLook();
  const rev = [...look].reverse();
  const a = eng.evaluate(look, { occasionId: 'work' });
  const b = eng.evaluate(rev, { occasionId: 'work' });
  assert.equal(a.outfit.outfitId, b.outfit.outfitId);
  assert.equal(a.outfit.confidence, b.outfit.confidence);
  assert.deepEqual(
    a.evidenceGraph.records.map((r) => r.evidenceId).sort(),
    b.evidenceGraph.records.map((r) => r.evidenceId).sort(),
  );
  assert.deepEqual(
    a.evidenceGraph.edges.map((e) => `${e.from}|${e.to}|${e.relation}`).sort(),
    b.evidenceGraph.edges.map((e) => `${e.from}|${e.to}|${e.relation}`).sort(),
  );
  console.log('ok reorder_determinism');
}

function testEvidenceLaw31(): void {
  const { outfit, evidenceGraph } = new OutfitEvaluationEngine().evaluate(
    goldenLook(),
    { occasionId: 'work' },
  );
  assert.ok(evidenceGraph.records.length >= 3);
  assert.ok(evidenceGraph.edges.length > 0, 'edges required');
  for (const m of outfit.metrics) {
    assert.ok(m.evidenceIds.length > 0, m.name);
  }
  for (const f of outfit.fieldConfidence) {
    assert.ok(f.evidenceIds.length > 0, f.field);
  }
  for (const x of outfit.explainability) {
    assert.ok(x.evidenceRefs.length > 0);
    assert.ok(x.reasonAr.length > 0);
  }
  const cited = new Set<string>();
  for (const m of outfit.metrics) for (const e of m.evidenceIds) cited.add(e);
  for (const f of outfit.fieldConfidence) for (const e of f.evidenceIds) cited.add(e);
  for (const x of outfit.explainability) for (const e of x.evidenceRefs) cited.add(e);
  for (const r of evidenceGraph.records) {
    assert.ok(cited.has(r.evidenceId), `uncited ${r.evidenceId}`);
  }
  const ids = new Set(evidenceGraph.records.map((r) => r.evidenceId));
  for (const e of evidenceGraph.edges) {
    assert.ok(ids.has(e.from) && ids.has(e.to));
  }
  console.log('ok evidence_law31');
}

function testValidation(): void {
  const { outfit, evidenceGraph } = new OutfitEvaluationEngine().evaluate(
    goldenLook(),
  );
  const v = validateCanonicalOutfit(outfit, evidenceGraph);
  assert.equal(v.valid, true, JSON.stringify(v.issues));
  assertValidOutfit(outfit, evidenceGraph);
  assertNoFashionProviderLeakage(toPublicCanonicalOutfit(outfit));
  console.log('ok validation');
}

function testNegativeValidationUncited(): void {
  const { outfit, evidenceGraph } = new OutfitEvaluationEngine().evaluate(
    goldenLook(),
  );
  const rogue = {
    ...evidenceGraph,
    records: [
      ...evidenceGraph.records,
      {
        evidenceId: 'ev_rogue_uncited',
        kind: 'composition' as const,
        claim: 'rogue',
        polarity: 'neutral' as const,
        strength: 0.1,
        subjectRefs: [],
        sourceRefs: [],
        engineId: 'test',
      },
    ],
  };
  const v = validateCanonicalOutfit(outfit, rogue);
  assert.equal(v.valid, false);
  assert.ok(v.issues.some((i) => i.code === 'uncited_evidence'));
  console.log('ok negative_uncited');
}

function testCompatibilityHardConflict(): void {
  const dresses = [
    sampleGarment({
      garmentId: 'garm_dress_a',
      identity: { categoryId: 'dresses', typeId: 'dress', entityClass: 'garment' },
    }),
    sampleGarment({
      garmentId: 'garm_dress_b',
      identity: { categoryId: 'dresses', typeId: 'dress', entityClass: 'garment' },
    }),
  ];
  const { outfit } = new OutfitEvaluationEngine().evaluate(dresses);
  assert.ok(
    outfit.limitations.some(
      (l) => l.includes('invalid_compatibility') || l.includes('hard'),
    ),
  );
  assert.equal(outfit.runtime.status, 'DEGRADED');
  assert.equal(outfit.runtime.reasonCode, 'outfit_evaluation_degraded');
  console.log('ok compatibility_hard');
}

function testLayering(): void {
  const { outfit, evidenceGraph } = new OutfitEvaluationEngine().evaluate(
    goldenLook(),
  );
  assert.ok(evidenceGraph.records.some((r) => r.kind === 'layering'));
  assert.ok(outfit.metrics.some((m) => m.name === 'layering'));
  console.log('ok layering');
}

function testContext(): void {
  const { outfit, evidenceGraph } = new OutfitEvaluationEngine().evaluate(
    [
      sampleGarment({
        garmentId: 'garm_blouse',
        identity: { categoryId: 'tops', typeId: 'blouse', entityClass: 'garment' },
        attributes: {
          colors: ['white'],
          material: { kind: 'estimated', value: 'cotton' },
          season: ['summer'],
          occasion: ['casual'],
          styleHints: ['soft'],
        },
      }),
      sampleGarment({
        garmentId: 'garm_skirt',
        identity: { categoryId: 'bottoms', typeId: 'skirt', entityClass: 'garment' },
        attributes: {
          colors: ['navy'],
          material: { kind: 'estimated', value: 'cotton' },
          season: ['summer'],
          occasion: ['casual'],
          styleHints: ['soft'],
        },
      }),
    ],
    { occasionId: 'casual', season: 'summer', modestyPolicy: 'standard' },
  );
  assert.equal(outfit.context.occasionId, 'casual');
  assert.ok(evidenceGraph.records.some((r) => r.kind === 'context.occasion'));
  assert.ok(evidenceGraph.records.some((r) => r.kind === 'context.weather'));
  assert.ok(evidenceGraph.records.some((r) => r.kind === 'context.modesty'));
  assert.ok(
    !evidenceGraph.records.some((r) => r.claim === 'modesty_policy_standard_pass'),
  );
  console.log('ok context');
}

function testClimateUnevidenced(): void {
  const { outfit, evidenceGraph } = new OutfitEvaluationEngine().evaluate(
    [
      sampleGarment({
        garmentId: 'garm_bag',
        identity: { categoryId: 'bags', typeId: 'bag', entityClass: 'bag' },
        attributes: {
          colors: ['black'],
          material: { kind: 'unknown' },
          season: [],
          occasion: [],
          styleHints: [],
        },
      }),
    ],
    { climate: 'hot_arid' },
  );
  assert.ok(
    evidenceGraph.records.some((r) => r.claim.includes('climate_noted_unevidenced')),
  );
  assert.ok(outfit.limitations.some((l) => l.includes('missing_evidence:climate')));
  console.log('ok climate_unevidenced');
}

function testModestyStandardUnevidenced(): void {
  const { evidenceGraph, outfit } = new OutfitEvaluationEngine().evaluate(
    [
      sampleGarment({
        garmentId: 'garm_heels',
        identity: { categoryId: 'heels', typeId: 'heels', entityClass: 'garment' },
        attributes: {
          colors: ['black'],
          material: { kind: 'unknown' },
          season: [],
          occasion: [],
          styleHints: [],
        },
      }),
    ],
    { modestyPolicy: 'standard' },
  );
  assert.ok(
    evidenceGraph.records.some((r) =>
      r.claim.includes('modesty_policy_standard_unevidenced'),
    ),
  );
  assert.ok(
    outfit.limitations.some((l) => l.includes('missing_evidence:modesty_standard')),
  );
  console.log('ok modesty_standard_unevidenced');
}

function testRuntime(): void {
  const { outfit } = new OutfitEvaluationEngine().evaluate(goldenLook());
  assert.ok(outfit.runtime.status);
  assert.equal(typeof outfit.runtime.retryable, 'boolean');
  assert.equal(
    (outfit.runtime as { providerId?: string }).providerId,
    undefined,
  );
  if (outfit.runtime.status === 'AVAILABLE') {
    assert.equal(outfit.runtime.reasonCode, 'outfit_evaluation_complete');
    assert.equal(outfit.runtime.stage, 'mapping');
  }
  console.log('ok runtime');
}

function testRuntimeEmptyFailed(): void {
  const { outfit } = new OutfitEvaluationEngine().evaluate([]);
  assert.equal(outfit.runtime.status, 'FAILED');
  assert.equal(outfit.runtime.reasonCode, 'outfit_evaluation_failed_empty');
  assert.equal(outfit.runtime.stage, 'terminal');
  console.log('ok runtime_failed');
}

function testCapabilities(): void {
  assert.equal(getFashionCapability('analyze_outfit')?.executionEnabled, true);
  assert.equal(getFashionCapability('compatibility')?.executionEnabled, true);
  assert.equal(getFashionCapability('color_harmony')?.executionEnabled, true);
  assert.equal(getFashionCapability('occasion_matching')?.executionEnabled, true);
  assert.equal(getFashionCapability('season_matching')?.executionEnabled, true);
  assert.equal(getFashionCapability('compare_looks')?.executionEnabled, true);
  assert.equal(getFashionCapability('recommendations')?.executionEnabled, false);
  console.log('ok capabilities');
}

function testService(): void {
  const svc = new OutfitIntelligenceService(fakeConfig());
  const out = svc.analyzeOutfit(goldenLook(), { occasionId: 'work' });
  assert.equal(out.success, true);
  assert.equal(out.capabilityId, 'analyze_outfit');
  assert.ok(out.outfit.outfitId.startsWith('outf_'));
  assert.equal(
    (out.outfit as { evidenceGraphRef?: string }).evidenceGraphRef,
    undefined,
  );
  assert.ok(out.evidenceGraph.edges.length > 0);

  const compat = svc.evaluateCompatibility(goldenLook());
  assert.ok(compat.evidenceGraph.edges.length > 0);
  assertValidEvidenceGraph(compat.evidenceGraph);

  const harmony = svc.evaluateColorHarmony(goldenLook());
  assertValidEvidenceGraph(harmony.evidenceGraph);

  const occasion = svc.evaluateOccasion(goldenLook(), 'work');
  assertValidEvidenceGraph(occasion.evidenceGraph);

  const season = svc.evaluateSeason(goldenLook(), 'autumn');
  assertValidEvidenceGraph(season.evidenceGraph);

  const off = new OutfitIntelligenceService(
    fakeConfig({ FASHION_OUTFIT_INTEL_ENABLED: 'false' }),
  );
  assert.throws(() => off.analyzeOutfit(goldenLook()));
  console.log('ok service');
}

function testCompareLooks(): void {
  const svc = new OutfitIntelligenceService(fakeConfig());
  const lookB = [
    sampleGarment({
      garmentId: 'garm_only_acc',
      identity: { categoryId: 'bags', typeId: 'bag', entityClass: 'bag' },
      attributes: {
        colors: ['black_pure'],
        material: { kind: 'unknown' },
        season: [],
        occasion: [],
        styleHints: [],
      },
    }),
  ];
  const cmp = svc.compareLooks(goldenLook(), lookB, { occasionId: 'work' });
  assert.ok(cmp.a.outfitId);
  assert.ok(cmp.b.outfitId);
  assert.ok(['a', 'b', 'tie'].includes(cmp.winner));
  console.log('ok compare_looks');
}

function testPublicNoEvidenceGraph(): void {
  const { outfit } = new OutfitEvaluationEngine().evaluate(goldenLook());
  const pub = toPublicCanonicalOutfit(outfit);
  assert.equal(
    'evidenceGraphRef' in pub
      ? (pub as { evidenceGraphRef?: string }).evidenceGraphRef
      : undefined,
    undefined,
  );
  console.log('ok public_strip');
}

function testDuplicateGarmentsLimitation(): void {
  const g = goldenLook()[0];
  const { outfit } = new OutfitEvaluationEngine().evaluate([g, { ...g }]);
  assert.ok(outfit.limitations.some((l) => l.includes('duplicate')));
  console.log('ok duplicate_limitation');
}

function testGoldenRegression(): void {
  const { outfit, evidenceGraph } = new OutfitEvaluationEngine().evaluate(
    [
      sampleGarment({
        garmentId: 'garm_shirt',
        identity: { categoryId: 'tops', typeId: 'shirt', entityClass: 'garment' },
        attributes: {
          colors: ['white_optic'],
          material: { kind: 'estimated', value: 'cotton' },
          season: ['spring'],
          occasion: ['casual'],
          styleHints: ['minimal'],
        },
      }),
      sampleGarment({
        garmentId: 'garm_jeans',
        identity: { categoryId: 'bottoms', typeId: 'jeans', entityClass: 'garment' },
        attributes: {
          colors: ['indigo'],
          material: { kind: 'estimated', value: 'denim' },
          season: ['spring'],
          occasion: ['casual'],
          styleHints: ['minimal'],
        },
      }),
    ],
    { occasionId: 'casual', season: 'spring', modestyPolicy: 'standard' },
  );
  assert.ok(outfit.outfitId.startsWith('outf_'));
  assert.equal(outfit.runtime.status, 'AVAILABLE');
  assert.ok(evidenceGraph.edges.length >= 1);
  assertValidOutfit(outfit, evidenceGraph);
  console.log('ok golden_regression');
}

async function main(): Promise<void> {
  testVersions();
  testComposition();
  testCompletenessHonest();
  testDeterminism();
  testReorderDeterminism();
  testEvidenceLaw31();
  testValidation();
  testNegativeValidationUncited();
  testCompatibilityHardConflict();
  testLayering();
  testContext();
  testClimateUnevidenced();
  testModestyStandardUnevidenced();
  testRuntime();
  testRuntimeEmptyFailed();
  testCapabilities();
  testService();
  testCompareLooks();
  testPublicNoEvidenceGraph();
  testDuplicateGarmentsLimitation();
  testGoldenRegression();
  console.log('phase6d / 6D.1 outfit intelligence OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
