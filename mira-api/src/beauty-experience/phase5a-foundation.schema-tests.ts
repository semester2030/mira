/**
 * Phase 5A Foundation — schema & engineering-law tests.
 * Run: npm run test:phase5a
 */
import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { FoundationBeautyExperienceAdapter } from './adapters/foundation-beauty-experience.adapter';
import { defaultCapabilityRegistry } from './capability/capability-registry';
import { CapabilityEngine } from './capability/capability-engine';
import { CapabilityPolicyEngine } from './policy/capability-policy-engine';
import { BeautyPolicyContext } from './policy/policy-context';
import {
  createFoundationProviderManager,
  ProviderManager,
} from './provider-manager/provider-manager';
import { PROVIDER_CAPABILITY_MATRIX } from './provider-manager/provider-matrix';
import { BeautySessionStore } from './session/beauty-session-store';
import { createComparison } from './comparison/comparison-model';
import { buildHistoryEntry } from './history/history-model';
import {
  assertCanonicalDtoNoProviderFields,
} from './dto/canonical.dto';
import { assertNoVendorLeakage } from './runtime/beauty-runtime-state';
import {
  BEAUTY_EXPERIENCE_PORT,
} from './port/beauty-experience.port';
import { BEAUTY_TRYON_PORT } from '../ports/beauty-tryon/beauty-tryon.port';
import {
  BEAUTY_EXPERIENCE_RELEASE,
  BEAUTY_EXPERIENCE_ARCHITECTURE,
} from './release';

function fakeConfig(overrides: Record<string, string> = {}): ConfigService {
  return {
    get: (key: string, def?: string) =>
      overrides[key] ?? process.env[key] ?? def,
  } as ConfigService;
}

function basePolicy(
  patch: Partial<BeautyPolicyContext> = {},
): BeautyPolicyContext {
  return {
    capabilityId: 'lip',
    beautyExperienceEnabled: true,
    realTryOnEnabled: false,
    platform: 'ios',
    estimatedCostUnits: 2,
    remainingQuota: 10,
    consentTryOn: true,
    qualityGatePassed: true,
    hasLicensedProviderCandidate: false,
    licenseOk: false,
    ...patch,
  };
}

function testCapabilityRegistry(): void {
  const reg = defaultCapabilityRegistry;
  assert.ok(reg.get('lip'));
  assert.ok(reg.get('hair_color'));
  assert.ok(reg.get('glasses'));
  assert.equal(reg.get('lip')!.requiredAssets.includes('lip_mask'), true);
  assert.equal(
    reg.get('hair_color')!.requiredAssets.includes('hair_mask'),
    true,
  );
  assert.equal(
    reg.get('foundation')!.requiredAssets.includes('face_mask'),
    true,
  );
  assert.equal(
    reg.get('glasses')!.requiredAssets.includes('face_mesh'),
    true,
  );
  assert.equal(reg.get('lip')!.executionEnabled, false);
  console.log('ok capability_registry');
}

function testCapabilityEngine(): void {
  const engine = new CapabilityEngine(defaultCapabilityRegistry);
  const lip = engine.resolve('lip');
  assert.equal(lip.registered, true);
  assert.equal(lip.executionAllowed, false);
  assert.equal(lip.runtime.status, 'UNAVAILABLE');
  assert.equal(lip.runtime.stage, 'registry');
  assert.equal(lip.metadata.costClass, 'MEDIUM');
  assert.equal(defaultCapabilityRegistry.get('blush')!.costClass, 'LOW');
  assert.equal(
    defaultCapabilityRegistry.get('hair_style')!.costClass,
    'VERY_HIGH',
  );
  assert.equal(
    defaultCapabilityRegistry.get('glasses')!.displayNameEn,
    'Eyewear',
  );
  const pub = engine.listPublic();
  assert.ok(pub.length >= 8);
  assertCanonicalDtoNoProviderFields(pub);
  console.log('ok capability_engine');
}

function testPolicyEngineBlocksBeforeProvider(): void {
  const policy = new CapabilityPolicyEngine();
  const blocked = policy.evaluate(basePolicy());
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.blockingRule, 'real_tryon_flag');

  const quota = policy.evaluate(
    basePolicy({ realTryOnEnabled: true, remainingQuota: 0, licenseOk: true, hasLicensedProviderCandidate: true }),
  );
  assert.equal(quota.allowed, false);
  assert.equal(quota.blockingRule, 'quota');

  const consent = policy.evaluate(
    basePolicy({
      realTryOnEnabled: true,
      licenseOk: true,
      hasLicensedProviderCandidate: true,
      consentTryOn: false,
    }),
  );
  assert.equal(consent.allowed, false);
  assert.equal(consent.blockingRule, 'consent');

  const quality = policy.evaluate(
    basePolicy({
      realTryOnEnabled: true,
      licenseOk: true,
      hasLicensedProviderCandidate: true,
      qualityGatePassed: false,
    }),
  );
  assert.equal(quality.allowed, false);
  assert.equal(quality.blockingRule, 'quality');
  console.log('ok policy_engine');
}

function testProviderSelectionPriority(): void {
  const mgr = createFoundationProviderManager();
  // Foundation stubs are unlicensed → no selection
  const sel = mgr.selectForCapability('lip');
  assert.equal(sel.selected, undefined);
  assert.ok(sel.candidates.length >= 2);

  // Simulate licensed Perfect + Banuba for priority test
  const live = new ProviderManager();
  live.register({
    id: 'perfect_beauty',
    version: 't',
    label: 'P',
    licensed: true,
    sdkInstalled: true,
    health: 'healthy',
  });
  live.register({
    id: 'banuba_beauty',
    version: 't',
    label: 'B',
    licensed: true,
    sdkInstalled: true,
    health: 'healthy',
  });
  const lip = live.selectForCapability('lip');
  assert.equal(lip.selected, 'perfect_beauty'); // priority 100 > 80

  const hair = live.selectForCapability('hair_color');
  assert.equal(hair.selected, 'banuba_beauty'); // Banuba 100 > Perfect 90
  console.log('ok provider_selection_priority');
}

function testProviderMatrixExtended(): void {
  const lip = PROVIDER_CAPABILITY_MATRIX.filter((e) => e.capabilityId === 'lip');
  assert.ok(lip.some((e) => e.providerId === 'perfect_beauty' && e.priority === 100));
  assert.ok(lip.some((e) => e.providerId === 'banuba_beauty' && e.priority === 80));
  assert.ok(
    PROVIDER_CAPABILITY_MATRIX.some(
      (e) => e.capabilityId === 'glasses' && e.requiredAssets.includes('face_mesh'),
    ),
  );
  console.log('ok provider_matrix');
}

function testSessionAnalysisSources(): void {
  const store = new BeautySessionStore();
  const s = store.create('user-1');
  store.attachAnalysisSources(s.sessionId, {
    skinReportId: 'skin-1',
    faceReportId: 'face-1',
    fashionReportId: 'fashion-1',
    extra: { futureIntelId: 'x-1' },
  });
  const got = store.get(s.sessionId)!;
  assert.equal(got.state, 'enriched');
  assert.equal(got.analysisSources.skinReportId, 'skin-1');
  assert.equal(got.analysisSources.faceReportId, 'face-1');
  assert.equal(got.analysisSources.fashionReportId, 'fashion-1');
  assert.equal(got.analysisSources.extra?.futureIntelId, 'x-1');
  console.log('ok session_analysis_sources');
}

function testHistoryHierarchy(): void {
  const store = new BeautySessionStore();
  const s = store.create('user-h');
  const look = store.addLook(s.sessionId, 'Look A', 'إطلالة أ');
  store.addAttempt({
    sessionId: s.sessionId,
    lookId: look.lookId,
    capabilityId: 'lip',
    runtime: {
      status: 'BLOCKED_BY_POLICY',
      stage: 'policy',
      reasonCode: 'test',
      reasonEn: 't',
      reasonAr: 'ت',
    },
  });
  const entry = buildHistoryEntry(
    store.get(s.sessionId)!,
    store.listAttempts(s.sessionId),
    store.listLooks(s.sessionId),
  );
  assert.ok(entry.attempts.length === 1);
  assert.ok(entry.looks.length === 1);
  assert.equal(entry.looks[0].attemptIds.length, 1);
  // Hierarchy: session contains attempts AND looks (not looks-only)
  assert.ok('attempts' in entry && 'looks' in entry);
  assertCanonicalDtoNoProviderFields(entry);
  console.log('ok history_hierarchy');
}

function testComparisonModel(): void {
  const store = new BeautySessionStore();
  const s = store.create();
  const look1 = store.addLook(s.sessionId);
  const look2 = store.addLook(s.sessionId);
  const a1 = store.addAttempt({
    sessionId: s.sessionId,
    lookId: look1.lookId,
    capabilityId: 'lip',
    runtime: {
      status: 'UNAVAILABLE',
      stage: 'registry',
      reasonEn: 'a',
      reasonAr: 'أ',
    },
    providerId: 'perfect_beauty',
  });
  const a2 = store.addAttempt({
    sessionId: s.sessionId,
    lookId: look2.lookId,
    capabilityId: 'lip',
    runtime: {
      status: 'UNAVAILABLE',
      stage: 'registry',
      reasonEn: 'b',
      reasonAr: 'ب',
    },
    providerId: 'banuba_beauty',
  });
  const cmp = createComparison(s.sessionId, [
    {
      lookId: look1.lookId,
      capabilityId: 'lip',
      attemptId: a1.attemptId,
      timestamp: a1.createdAt,
      providerId: a1.providerId,
      metadata: { sessionId: s.sessionId },
      metrics: { score: 0 },
      runtime: a1.runtime,
    },
    {
      lookId: look2.lookId,
      capabilityId: 'lip',
      attemptId: a2.attemptId,
      timestamp: a2.createdAt,
      providerId: a2.providerId,
      metadata: { sessionId: s.sessionId },
      runtime: a2.runtime,
    },
  ]);
  assert.equal(cmp.candidates.length, 2);
  assert.ok(cmp.candidates[0].lookId);
  assert.ok(cmp.candidates[0].capabilityId);
  assert.ok(cmp.candidates[0].attemptId);
  assert.ok(cmp.candidates[0].timestamp);
  assert.ok(cmp.candidates[0].metadata);
  assert.ok(cmp.candidates[0].runtime);
  console.log('ok comparison_model');
}

async function testPortExecutePolicyFirst(): Promise<void> {
  const adapter = new FoundationBeautyExperienceAdapter(fakeConfig());
  assert.ok(BEAUTY_EXPERIENCE_PORT);
  assert.ok(BEAUTY_TRYON_PORT);
  assert.notEqual(BEAUTY_EXPERIENCE_PORT, BEAUTY_TRYON_PORT);

  const session = await adapter.createSession('u1');
  const result = await adapter.executeCapability({
    capabilityId: 'lip',
    sessionId: session.sessionId,
    policy: basePolicy(),
  });
  assert.equal(result.success, false);
  assert.ok(
    result.runtime.status === 'BLOCKED_BY_POLICY' ||
      result.runtime.status.startsWith('BLOCKED_BY_'),
  );
  assert.ok(result.runtime.stage);
  assert.equal(result.tryOn?.resultAssetUrl, null);
  assertCanonicalDtoNoProviderFields(result.tryOn);
  assertCanonicalDtoNoProviderFields(result.session);

  const caps = await adapter.listCapabilities();
  assertCanonicalDtoNoProviderFields(caps);

  const desc = await adapter.describe();
  assert.equal(desc.release, BEAUTY_EXPERIENCE_RELEASE);
  assert.equal(desc.architectureVersion, BEAUTY_EXPERIENCE_ARCHITECTURE);
  assertCanonicalDtoNoProviderFields(desc);
  console.log('ok beauty_experience_port');
}

async function testCompareAndHistoryPublic(): Promise<void> {
  const adapter = new FoundationBeautyExperienceAdapter(fakeConfig());
  const session = await adapter.createSession('u2');
  await adapter.attachAnalysisSources(session.sessionId, {
    skinReportId: 's1',
    faceReportId: 'f1',
  });
  const r1 = await adapter.executeCapability({
    capabilityId: 'lip',
    sessionId: session.sessionId,
    policy: basePolicy(),
  });
  const r2 = await adapter.executeCapability({
    capabilityId: 'foundation',
    sessionId: session.sessionId,
    policy: basePolicy({ capabilityId: 'foundation' }),
  });
  const cmp = await adapter.compare(session.sessionId, [
    r1.tryOn!.attemptId,
    r2.tryOn!.attemptId,
  ]);
  assert.equal(cmp.candidates.length, 2);
  assertCanonicalDtoNoProviderFields(cmp);
  const hist = await adapter.history('u2');
  assert.ok(hist.sessions.length >= 1);
  assert.ok(hist.sessions[0].attempts.length >= 1);
  assert.ok(hist.sessions[0].looks.length >= 1);
  assertCanonicalDtoNoProviderFields(hist);
  console.log('ok compare_history_public');
}

async function testFeatureFlagBlocks(): Promise<void> {
  const adapter = new FoundationBeautyExperienceAdapter(
    fakeConfig({ BEAUTY_EXPERIENCE_ENABLED: 'false' }),
  );
  const session = await adapter.createSession();
  const result = await adapter.executeCapability({
    capabilityId: 'lip',
    sessionId: session.sessionId,
    policy: basePolicy({ beautyExperienceEnabled: true }), // overridden by config in adapter
  });
  assert.equal(result.runtime.status, 'BLOCKED_BY_POLICY');
  assert.equal(result.runtime.reasonCode, 'beauty_experience_disabled');
  assert.equal(result.runtime.policyRuleId, 'feature_flag');
  console.log('ok feature_flags');
}

function testProviderIndependence(): void {
  // Changing priority table does not change capability ids Flutter would request
  const ids = defaultCapabilityRegistry.list().map((c) => c.id);
  assert.ok(ids.includes('lip'));
  assert.ok(!ids.includes('perfect_beauty' as never));
  assert.ok(!ids.includes('banuba_beauty' as never));
  console.log('ok provider_independence');
}

function testEngineeringLawsStatic(): void {
  // Law: Provider ≠ Capability — matrix maps both, registry only capabilities
  for (const e of PROVIDER_CAPABILITY_MATRIX) {
    assert.ok(defaultCapabilityRegistry.has(e.capabilityId));
  }
  // Law: vendor leakage ban list
  assert.throws(() => assertNoVendorLeakage('banuba_sdk'));
  assert.throws(() => assertNoVendorLeakage('rawYouCam'));
  assert.doesNotThrow(() => assertNoVendorLeakage('{"capabilityId":"lip"}'));
  console.log('ok engineering_laws');
}

async function main(): Promise<void> {
  testCapabilityRegistry();
  testCapabilityEngine();
  testPolicyEngineBlocksBeforeProvider();
  testProviderSelectionPriority();
  testProviderMatrixExtended();
  testSessionAnalysisSources();
  testHistoryHierarchy();
  testComparisonModel();
  await testPortExecutePolicyFirst();
  await testCompareAndHistoryPublic();
  await testFeatureFlagBlocks();
  testProviderIndependence();
  testEngineeringLawsStatic();
  console.log('phase5a foundation OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
