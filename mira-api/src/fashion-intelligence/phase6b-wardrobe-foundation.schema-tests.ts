/**
 * Phase 6B — Wardrobe Foundation schema & contract tests.
 * Run: npm run test:phase6b
 */
import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import {
  InMemoryFashionSessionRepository,
  InMemoryWardrobeRepository,
} from './repository/in-memory.repository';
import { WardrobeService } from './service/wardrobe.service';
import { FashionSessionService } from './service/fashion-session.service';
import {
  assertNoFashionProviderLeakage,
  fashionRuntime,
  FASHION_RUNTIME_STATUS_CATALOG,
  isValidFashionRuntimeTransition,
  toPublicFashionRuntime,
} from './runtime/fashion-runtime-state';
import {
  validateWardrobe,
  validateSession,
  validateRuntimeTransition,
} from './validation/fashion-validators';
import {
  FASHION_CAPABILITY_CATALOG,
  getFashionCapability,
} from './capability/fashion-capability-catalog';
import {
  FASHION_INTELLIGENCE_RELEASE,
  FASHION_SESSION_VERSION,
  FASHION_WARDROBE_SCHEMA_VERSION,
} from './release';
import { resolveFashionFeatureFlags } from './feature-flags';
import { fashionAuditLog } from './telemetry/fashion-telemetry';
import { CanonicalWardrobe } from './models/canonical-wardrobe';

function fakeConfig(overrides: Record<string, string> = {}): ConfigService {
  return {
    get: (key: string, def?: string) =>
      overrides[key] ?? process.env[key] ?? def,
  } as ConfigService;
}

function services(overrides: Record<string, string> = {}) {
  const wardrobeRepo = new InMemoryWardrobeRepository();
  const sessionRepo = new InMemoryFashionSessionRepository();
  const config = fakeConfig(overrides);
  const wardrobe = new WardrobeService(wardrobeRepo, config);
  const session = new FashionSessionService(sessionRepo, wardrobeRepo, config);
  return { wardrobe, session, wardrobeRepo, sessionRepo };
}

async function testRepositoryRoundTrip(): Promise<void> {
  const { wardrobe, wardrobeRepo } = services();
  const w = await wardrobe.createWardrobe('user-1');
  const found = await wardrobeRepo.findByUserId('user-1');
  assert.ok(found);
  assert.equal(found!.wardrobeId, w.wardrobeId);
  assert.equal(found!.version, FASHION_WARDROBE_SCHEMA_VERSION);
  console.log('ok repository_round_trip');
}

async function testWardrobeLifecycle(): Promise<void> {
  const { wardrobe } = services();
  const w = await wardrobe.createWardrobe('user-2');
  const withItem = await wardrobe.addItem(w.wardrobeId, {
    garmentId: 'g-shirt-1',
    entityClass: 'garment',
  });
  assert.equal(withItem.items.length, 1);
  assert.equal(withItem.items[0].entityClass, 'garment');

  const { collection } = await wardrobe.createCollection(
    w.wardrobeId,
    'Work',
    'عمل',
    ['g-shirt-1'],
  );
  assert.ok(collection.collectionId);

  const { look } = await wardrobe.createLook(w.wardrobeId, {
    titleEn: 'Office',
    garmentIds: ['g-shirt-1'],
    outfitId: 'outfit-ref-1',
  });
  assert.ok(look.lookId);

  const { favorite } = await wardrobe.addFavorite(
    w.wardrobeId,
    'garment',
    'g-shirt-1',
  );
  assert.ok(favorite.favoriteId);

  await wardrobe.recordUsage(w.wardrobeId, 'g-shirt-1', 'garment');
  const again = await wardrobe.getWardrobe(w.wardrobeId);
  assert.equal(again.usage[0].wearCount, 1);
  assert.ok(again.statistics.itemCount >= 1);

  const insights = await wardrobe.insights(w.wardrobeId);
  assert.equal(insights.capabilityId, 'wardrobe_insights');
  assertNoFashionProviderLeakage(insights);

  await wardrobe.setLifecycle(w.wardrobeId, 'archived');
  await assert.rejects(() =>
    wardrobe.addItem(w.wardrobeId, { garmentId: 'g-2' }),
  );
  console.log('ok wardrobe_lifecycle');
}

async function testDuplicateGarmentRejected(): Promise<void> {
  const { wardrobe } = services();
  const w = await wardrobe.createWardrobe('user-dup');
  await wardrobe.addItem(w.wardrobeId, { garmentId: 'g-dup' });
  await assert.rejects(() =>
    wardrobe.addItem(w.wardrobeId, { garmentId: 'g-dup' }),
  );
  console.log('ok duplicate_garment_rejected');
}

async function testSessionIntegrity(): Promise<void> {
  const { wardrobe, session } = services();
  const w = await wardrobe.createWardrobe('user-sess');
  await wardrobe.addItem(w.wardrobeId, { garmentId: 'g-a' });
  const { look } = await wardrobe.createLook(w.wardrobeId, {
    garmentIds: ['g-a'],
  });
  const s = await session.createSession({
    userId: 'user-sess',
    source: 'wardrobe',
  });
  assert.equal(s.version, FASHION_SESSION_VERSION);
  const bound = await session.bindWardrobe(s.sessionId, w.wardrobeId);
  assert.equal(bound.wardrobeId, w.wardrobeId);
  assert.ok(bound.garmentIds.includes('g-a'));
  assert.ok(bound.lookIds.includes(look.lookId));

  const { attempt } = await session.recordAttempt(s.sessionId, {
    capabilityId: 'wardrobe',
  });
  assert.equal(attempt.runtime.status, 'AVAILABLE');
  assert.equal(attempt.providerId, undefined);

  const blocked = await session.recordAttempt(s.sessionId, {
    capabilityId: 'recommendations',
    providerId: 'should_strip',
  });
  assert.equal(blocked.attempt.runtime.status, 'BLOCKED');
  assert.equal(blocked.attempt.providerId, undefined);
  assertNoFashionProviderLeakage(blocked.attempt);
  assertNoFashionProviderLeakage(blocked.session);

  const outfitAttempt = await session.recordAttempt(s.sessionId, {
    capabilityId: 'analyze_outfit',
  });
  assert.equal(outfitAttempt.attempt.runtime.status, 'AVAILABLE');
  assert.equal(outfitAttempt.attempt.providerId, undefined);

  const progressed = await session.updateProgress(s.sessionId, {});
  assert.equal(
    progressed.progress.goals.find((g) => g.goalId === 'fill_wardrobe')?.done,
    true,
  );

  const hist = await session.history('user-sess');
  assert.ok(hist.sessions.length >= 1);
  console.log('ok session_integrity');
}

function testRuntimeCatalog(): void {
  const required = [
    'NOT_REQUESTED',
    'AVAILABLE',
    'PARTIAL',
    'DEGRADED',
    'BLOCKED',
    'FAILED',
    'UNAVAILABLE',
  ] as const;
  for (const s of required) {
    assert.ok(FASHION_RUNTIME_STATUS_CATALOG[s]);
    assert.ok(typeof FASHION_RUNTIME_STATUS_CATALOG[s].retryable === 'boolean');
  }
  assert.equal(isValidFashionRuntimeTransition('FAILED', 'AVAILABLE'), true);
  assert.equal(isValidFashionRuntimeTransition('FAILED', 'PARTIAL'), false);
  const rt = fashionRuntime({
    status: 'BLOCKED',
    stage: 'policy',
    reasonCode: 'x',
    reasonEn: 'e',
    reasonAr: 'a',
  });
  assert.equal(rt.retryable, true);
  assert.equal(rt.trustLevel, 'blocked');
  const pub = toPublicFashionRuntime({
    ...rt,
    providerId: 'fashn',
  });
  assert.equal((pub as { providerId?: string }).providerId, undefined);
  console.log('ok runtime_catalog');
}

function testValidationContract(): void {
  const bad: CanonicalWardrobe = {
    wardrobeId: 'w1',
    userId: 'u1',
    version: FASHION_WARDROBE_SCHEMA_VERSION,
    items: [
      {
        itemId: 'i1',
        garmentId: 'g1',
        status: 'active',
      },
      {
        itemId: 'i2',
        garmentId: 'g1',
        status: 'active',
      },
    ],
    collections: [
      {
        collectionId: 'c1',
        titleEn: 't',
        titleAr: 'ت',
        garmentIds: ['missing'],
        outfitIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    favorites: [],
    looks: [],
    usage: [],
    statistics: {
      categoryCounts: {},
      gapHints: [],
      itemCount: 0,
      lookCount: 0,
      collectionCount: 0,
      favoriteCount: 0,
    },
    lifecycle: 'active',
    runtime: fashionRuntime({
      status: 'AVAILABLE',
      stage: 'idle',
      reasonEn: 'e',
      reasonAr: 'a',
    }),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const r = validateWardrobe(bad);
  assert.equal(r.valid, false);
  assert.ok(r.issues.some((i) => i.code === 'duplicate_garment_id'));
  assert.ok(r.issues.some((i) => i.code === 'orphan_collection_garment'));
  console.log('ok validation_contract');
}

function testCapabilityRegistration(): void {
  assert.ok(FASHION_CAPABILITY_CATALOG.length >= 8);
  assert.equal(getFashionCapability('wardrobe')?.executionEnabled, true);
  assert.equal(getFashionCapability('analyze_garment')?.executionEnabled, true);
  assert.equal(getFashionCapability('analyze_outfit')?.executionEnabled, true);
  assert.equal(getFashionCapability('analyze_style')?.executionEnabled, true);
  assert.equal(getFashionCapability('recommendations')?.executionEnabled, false);
  assert.equal(getFashionCapability('compatibility')?.executionEnabled, true);
  assert.equal(getFashionCapability('recolor_garment')?.executionEnabled, false);
  const { session } = services();
  const caps = session.listCapabilities();
  assert.ok(caps.every((c) => c.providerExecution === false));
  assert.ok(caps.every((c) => c.providerRequirements !== undefined));
  console.log('ok capability_registration');
}

function testFeatureFlags(): void {
  const flags = resolveFashionFeatureFlags(() => 'false');
  assert.equal(flags.fashionWardrobeEnabled, false);
  assert.equal(flags.fashionProviderExecutionEnabled, false);
  console.log('ok feature_flags');
}

async function testFeatureFlagBlocksService(): Promise<void> {
  const { wardrobe } = services({ FASHION_WARDROBE_ENABLED: 'false' });
  await assert.rejects(() => wardrobe.createWardrobe('u'));
  console.log('ok feature_flag_blocks');
}

function testRuntimeTransitionValidation(): void {
  const from = fashionRuntime({
    status: 'FAILED',
    stage: 'terminal',
    reasonEn: 'e',
    reasonAr: 'a',
  });
  const to = fashionRuntime({
    status: 'PARTIAL',
    stage: 'execution',
    reasonEn: 'e',
    reasonAr: 'a',
  });
  const r = validateRuntimeTransition(from, to);
  assert.equal(r.valid, false);
  console.log('ok runtime_transition_validation');
}

async function testMigrationAliasGarmentEntity(): Promise<void> {
  const { wardrobe } = services();
  const w = await wardrobe.createWardrobe('user-alias');
  const updated = await wardrobe.addItem(w.wardrobeId, {
    garmentId: 'entity-as-garment',
    // entityClass defaults to garment — Addendum alias rule
  });
  assert.equal(updated.items[0].entityClass ?? 'garment', 'garment');
  assert.equal(updated.items[0].garmentId, 'entity-as-garment');
  console.log('ok migration_entity_alias');
}

async function testRegressionNoProviderLeakage(): Promise<void> {
  const { wardrobe, session } = services();
  const w = await wardrobe.createWardrobe('user-reg');
  const s = await session.createSession({ userId: 'user-reg' });
  await session.bindWardrobe(s.sessionId, w.wardrobeId);
  const full = await session.getSession(s.sessionId);
  assertNoFashionProviderLeakage(full);
  assertNoFashionProviderLeakage(w);
  assert.ok(!JSON.stringify(full).includes('fashn'));
  assert.ok(!JSON.stringify(full).includes('openai'));
  console.log('ok regression_no_provider_leakage');
}

async function testAuditTrail(): Promise<void> {
  fashionAuditLog.clear();
  const { wardrobe } = services();
  await wardrobe.createWardrobe('user-audit');
  const entries = fashionAuditLog.list();
  assert.ok(entries.some((e) => e.action === 'wardrobe_created'));
  console.log('ok audit_trail');
}

function testReleaseIdentity(): void {
  // SoT: mira-api/src/fashion-intelligence/release.ts (platform release label).
  // Schema pins stay frozen; platform release advances with phases (6D.2 policy).
  assert.equal(FASHION_INTELLIGENCE_RELEASE, '1.0.0-styling-intelligence');
  assert.equal(FASHION_SESSION_VERSION, 'fashion-session-v1');
  console.log('ok release_identity');
}

function testSessionValidation(): void {
  const r = validateSession({
    sessionId: '',
    version: '',
    state: 'created',
    source: 'system',
    trust: { level: 'unknown', reasons: [] },
    analysisSources: {},
    garmentIds: ['a', 'a'],
    outfitIds: [],
    lookIds: [],
    favoriteIds: [],
    collectionIds: [],
    styleIds: [],
    recommendationIds: [],
    attemptIds: ['x', 'x'],
    history: [],
    progress: { goals: [], milestones: [] },
    runtime: fashionRuntime({
      status: 'NOT_REQUESTED',
      stage: 'idle',
      reasonEn: 'e',
      reasonAr: 'a',
    }),
    createdAt: '',
    updatedAt: '',
  });
  assert.equal(r.valid, false);
  assert.ok(r.issues.some((i) => i.code === 'duplicate_garment_id'));
  console.log('ok session_validation');
}

async function main(): Promise<void> {
  testReleaseIdentity();
  testRuntimeCatalog();
  testRuntimeTransitionValidation();
  testValidationContract();
  testSessionValidation();
  testCapabilityRegistration();
  testFeatureFlags();
  await testRepositoryRoundTrip();
  await testWardrobeLifecycle();
  await testDuplicateGarmentRejected();
  await testSessionIntegrity();
  await testFeatureFlagBlocksService();
  await testMigrationAliasGarmentEntity();
  await testRegressionNoProviderLeakage();
  await testAuditTrail();
  console.log('phase6b wardrobe foundation OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
