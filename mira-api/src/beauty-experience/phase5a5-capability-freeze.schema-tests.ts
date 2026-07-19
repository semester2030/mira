/**
 * Phase 5A.5 — Beauty Capability Catalog Freeze validation.
 * Run: npm run test:phase5a5
 */
import assert from 'node:assert/strict';
import { defaultCapabilityRegistry } from './capability/capability-registry';
import {
  FROZEN_CAPABILITY_IDS,
} from './capability/capability-ids';
import {
  BEAUTY_CAPABILITY_CATALOG_VERSION,
  BEAUTY_CAPABILITY_VERSION_POLICY,
  BEAUTY_CAPABILITY_RUNTIME_MATRIX_VERSION,
} from './capability/catalog-release';
import { COST_CLASS_DEFINITIONS } from './capability/capability-cost';
import {
  BEAUTY_CAPABILITY_GROUPS,
  compatibilityBetween,
} from './capability/capability-compatibility';
import {
  buildCapabilityDependencyGraph,
  HAIR_COLOR_DEPENDENCY_CHAIN,
} from './capability/capability-dependencies';
import {
  RUNTIME_STATUS_CATALOG,
  BeautyRuntimeStatus,
} from './runtime/beauty-runtime-state';
import { PROVIDER_CAPABILITY_MATRIX } from './provider-manager/provider-matrix';
import { assertCanonicalDtoNoProviderFields } from './dto/canonical.dto';
import catalogJson from './capability/BEAUTY_CAPABILITY_CATALOG.json';

function testNoDuplicateIds(): void {
  const ids = defaultCapabilityRegistry.list().map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of FROZEN_CAPABILITY_IDS) {
    assert.ok(ids.includes(id), `missing frozen id ${id}`);
  }
  // Law #13 — eyewear is NOT an id; glasses is permanent
  assert.ok(!ids.includes('eyewear' as never));
  console.log('ok no_duplicate_ids');
}

function testNoDuplicateMetadata(): void {
  const formulas = defaultCapabilityRegistry.list().map((c) => c.formulaId);
  assert.equal(new Set(formulas).size, formulas.length);
  const versions = defaultCapabilityRegistry
    .list()
    .map((c) => `${c.id}@${c.version}`);
  assert.equal(new Set(versions).size, versions.length);
  console.log('ok no_duplicate_metadata');
}

function testNoProviderLeakageInCatalog(): void {
  assertCanonicalDtoNoProviderFields(catalogJson.capabilities);
  for (const c of defaultCapabilityRegistry.list()) {
    assertCanonicalDtoNoProviderFields(c);
  }
  console.log('ok no_provider_leakage');
}

function testRuntimeStatesUnique(): void {
  const keys = Object.keys(RUNTIME_STATUS_CATALOG) as BeautyRuntimeStatus[];
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(keys.includes('BLOCKED_BY_ASSETS'));
  assert.ok(keys.includes('BLOCKED_BY_LICENSE'));
  assert.ok(keys.includes('BLOCKED_BY_QUALITY'));
  for (const k of keys) {
    const row = RUNTIME_STATUS_CATALOG[k];
    assert.ok(row.meaning);
    assert.ok(Array.isArray(row.allowedNext));
  }
  console.log('ok runtime_states');
}

function testDependenciesExplicit(): void {
  const hair = defaultCapabilityRegistry.get('hair_color')!;
  for (const d of HAIR_COLOR_DEPENDENCY_CHAIN.slice(1)) {
    assert.ok(
      hair.dependencies.includes(d as never) ||
        hair.requiredAssets.includes(d as never) ||
        d === 'capability_policy',
      `hair_color missing dep ${d}`,
    );
  }
  const graph = buildCapabilityDependencyGraph('hair_color');
  assert.equal(graph.version, 'beauty-cap-deps-v1');
  assert.ok(graph.edges.every((e) => e.explicit === true));
  assert.ok(graph.edges.length > 0);
  console.log('ok dependencies_explicit');
}

function testCostClasses(): void {
  assert.equal(COST_CLASS_DEFINITIONS.length, 4);
  const ids = COST_CLASS_DEFINITIONS.map((c) => c.id);
  assert.deepEqual(ids, ['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']);
  for (const cap of defaultCapabilityRegistry.list()) {
    assert.ok(ids.includes(cap.costClass));
  }
  console.log('ok cost_classes');
}

function testGroupsAndCompat(): void {
  assert.ok(BEAUTY_CAPABILITY_GROUPS.includes('makeup'));
  assert.ok(BEAUTY_CAPABILITY_GROUPS.includes('session'));
  const excl = compatibilityBetween('makeup_vto', 'lip');
  assert.equal(excl.relation, 'mutually_exclusive');
  const parallel = compatibilityBetween('lip', 'blush');
  assert.equal(parallel.relation, 'parallel_ok');
  console.log('ok groups_compat');
}

function testProviderSupportSeparated(): void {
  for (const row of PROVIDER_CAPABILITY_MATRIX) {
    assert.ok(FROZEN_CAPABILITY_IDS.includes(row.capabilityId));
    assert.notEqual(row.capabilityId, row.providerId as never);
    assert.ok(!FROZEN_CAPABILITY_IDS.includes(row.providerId as never));
  }
  console.log('ok provider_support_separated');
}

function testVersionIdentifiers(): void {
  assert.equal(BEAUTY_CAPABILITY_CATALOG_VERSION, '1.0.0');
  assert.equal(BEAUTY_CAPABILITY_VERSION_POLICY, 'beauty-cap-semver-v1');
  assert.equal(
    BEAUTY_CAPABILITY_RUNTIME_MATRIX_VERSION,
    'beauty-cap-runtime-matrix-v1',
  );
  assert.equal(catalogJson.catalogVersion, '1.0.0');
  console.log('ok version_identifiers');
}

function testGlassesNotRenamed(): void {
  const g = defaultCapabilityRegistry.get('glasses')!;
  assert.equal(g.id, 'glasses');
  assert.equal(g.displayNameEn, 'Eyewear');
  assert.ok(g.deprecationPolicy.includes('never renamed'));
  console.log('ok glasses_id_frozen');
}

function main(): void {
  testNoDuplicateIds();
  testNoDuplicateMetadata();
  testNoProviderLeakageInCatalog();
  testRuntimeStatesUnique();
  testDependenciesExplicit();
  testCostClasses();
  testGroupsAndCompat();
  testProviderSupportSeparated();
  testVersionIdentifiers();
  testGlassesNotRenamed();
  console.log('phase5a5 capability freeze OK');
}

main();
