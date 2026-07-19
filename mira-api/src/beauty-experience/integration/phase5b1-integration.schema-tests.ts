/**
 * Phase 5B.1 — Integration readiness tests.
 * No Perfect/Banuba. No fabricated images. Run: npm run test:phase5b1
 */
import assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { FoundationBeautyExperienceAdapter } from '../adapters/foundation-beauty-experience.adapter';
import { assertCanonicalDtoNoProviderFields } from '../dto/canonical.dto';
import { RUNTIME_STATUS_CATALOG } from '../runtime/beauty-runtime-state';
import {
  BEAUTY_INTEGRATION_RELEASE,
  BEAUTY_INTEGRATION_STATUS,
} from './release';
import {
  isProviderExecutionAllowed,
  resolveBeautyFeatureFlags,
} from './feature-flags';
import {
  clearProviderActivationHooks,
  listCapabilityPlaceholders,
  notifyProviderActivated,
  registerProviderActivationHook,
} from './activation-hooks';
import { FROZEN_CAPABILITY_IDS } from '../capability/capability-ids';
import { BeautyPolicyContext } from '../policy/policy-context';

function fakeConfig(overrides: Record<string, string> = {}): ConfigService {
  return {
    get: (key: string, def?: string) =>
      overrides[key] ?? process.env[key] ?? def,
  } as ConfigService;
}

function basePolicy(patch: Partial<BeautyPolicyContext> = {}): BeautyPolicyContext {
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

async function testFullSessionLifecycle(): Promise<void> {
  const adapter = new FoundationBeautyExperienceAdapter(fakeConfig());
  const session = await adapter.createSession('u-5b1');
  await adapter.attachAnalysisSources(session.sessionId, {
    skinReportId: 's1',
    faceReportId: 'f1',
  });
  const look = await adapter.createLook(session.sessionId, 'Look A', 'إطلالة');
  const exec = await adapter.executeCapability({
    capabilityId: 'lip',
    sessionId: session.sessionId,
    lookId: look.lookId,
    policy: basePolicy(),
  });
  assert.equal(exec.success, false);
  assert.equal(exec.tryOn?.resultAssetUrl, null);
  assert.ok(exec.runtime.status.startsWith('BLOCKED_BY_'));
  assert.ok(typeof exec.runtime.retryable === 'boolean');
  assertCanonicalDtoNoProviderFields(exec.tryOn);

  const fav = await adapter.addFavorite(session.sessionId, look.lookId);
  assert.ok(fav.favoriteId);
  const col = await adapter.createCollection(
    session.sessionId,
    'Col',
    'مجموعة',
    [look.lookId],
  );
  assert.ok(col.collectionId);
  const share = await adapter.share(session.sessionId, look.lookId);
  assert.equal(share.revoked, false);

  const exec2 = await adapter.executeCapability({
    capabilityId: 'foundation',
    sessionId: session.sessionId,
    policy: basePolicy({ capabilityId: 'foundation' }),
  });
  const cmp = await adapter.compare(session.sessionId, [
    exec.tryOn!.attemptId,
    exec2.tryOn!.attemptId,
  ]);
  assert.equal(cmp.candidates.length, 2);
  assertCanonicalDtoNoProviderFields(cmp);

  const hist = await adapter.history('u-5b1');
  assert.ok(hist.sessions[0].attempts.length >= 1);
  assert.ok(hist.sessions[0].looks.length >= 1);
  assertCanonicalDtoNoProviderFields(hist);

  const looks = await adapter.listLooks(session.sessionId);
  assert.ok(looks.length >= 1);
  console.log('ok session_lifecycle');
}

function testNoProviderDependency(): void {
  const flags = resolveBeautyFeatureFlags(() => 'false');
  assert.equal(isProviderExecutionAllowed(flags), false);
  const placeholders = listCapabilityPlaceholders([...FROZEN_CAPABILITY_IDS]);
  assert.ok(placeholders.every((p) => p.providerExecutionEnabled === false));
  assert.ok(placeholders.every((p) => p.integrationReady === true));
  console.log('ok no_provider_dependency');
}

function testRuntimeStatesHaveRetry(): void {
  const required = [
    'NOT_REQUESTED',
    'AVAILABLE',
    'UNAVAILABLE',
    'FAILED',
    'BLOCKED_BY_POLICY',
    'BLOCKED_BY_LICENSE',
    'BLOCKED_BY_PROVIDER',
    'BLOCKED_BY_CONFIGURATION',
    'BLOCKED_BY_COST',
    'BLOCKED_BY_QUALITY',
  ] as const;
  for (const s of required) {
    assert.ok(RUNTIME_STATUS_CATALOG[s]);
    assert.ok(typeof RUNTIME_STATUS_CATALOG[s].retryable === 'boolean');
    assert.ok(RUNTIME_STATUS_CATALOG[s].meaning);
  }
  console.log('ok runtime_retry_policy');
}

async function testNoFabricatedImages(): Promise<void> {
  const adapter = new FoundationBeautyExperienceAdapter(fakeConfig());
  const session = await adapter.createSession();
  const r = await adapter.executeCapability({
    capabilityId: 'lip',
    sessionId: session.sessionId,
    policy: basePolicy(),
    // Even with image bytes — must not invent result
    imageBytes: Buffer.from([1, 2, 3]),
  });
  assert.equal(r.tryOn?.resultAssetUrl, null);
  assert.equal(r.success, false);
  console.log('ok no_fabricated_images');
}

async function testActivationHooksNoLiveCall(): Promise<void> {
  clearProviderActivationHooks();
  let called = false;
  registerProviderActivationHook(async () => {
    called = true;
  });
  await notifyProviderActivated({
    providerId: 'perfect_beauty',
    capabilityId: 'lip',
    evidenceRef: 'test',
  });
  assert.equal(called, true);
  clearProviderActivationHooks();
  console.log('ok activation_hooks');
}

async function testDescribeIntegration(): Promise<void> {
  const adapter = new FoundationBeautyExperienceAdapter(fakeConfig());
  const d = await adapter.describe();
  assert.equal(d.integrationRelease, BEAUTY_INTEGRATION_RELEASE);
  assert.equal(d.integrationStatus, BEAUTY_INTEGRATION_STATUS);
  assert.equal(d.providerExecutionEnabled, false);
  assertCanonicalDtoNoProviderFields(d);
  console.log('ok describe_integration');
}

function testNoProviderPackageLeakage(): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pkg = require('../../../package.json') as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const all = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  };
  const banned = Object.keys(all).filter(
    (k) =>
      /banuba/i.test(k) ||
      /perfect.?corp/i.test(k) ||
      /youcam.?makeup/i.test(k),
  );
  assert.equal(banned.length, 0, `provider package leakage: ${banned.join(',')}`);
  console.log('ok no_provider_package_leakage');
}

async function main(): Promise<void> {
  await testFullSessionLifecycle();
  testNoProviderDependency();
  testRuntimeStatesHaveRetry();
  await testNoFabricatedImages();
  await testActivationHooksNoLiveCall();
  await testDescribeIntegration();
  testNoProviderPackageLeakage();
  console.log('phase5b1 integration readiness OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
