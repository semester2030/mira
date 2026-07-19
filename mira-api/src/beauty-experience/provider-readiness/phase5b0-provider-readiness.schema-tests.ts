/**
 * Phase 5B.0 — Provider Readiness Platform schema tests.
 * Run: npm run test:phase5b0
 * NO live provider calls. NO SDK.
 */
import assert from 'node:assert/strict';
import {
  createProviderReadinessPlatform,
  PROVIDER_READINESS_VERSION,
  PROVIDER_CONFIGURATION_WIZARD,
  tryActivateCapability,
} from './index';
import { assertCanonicalDtoNoProviderFields } from '../dto/canonical.dto';

function testRegistry(): void {
  const platform = createProviderReadinessPlatform();
  const ids = platform.listProviders().map((p) => p.providerId);
  assert.ok(ids.includes('perfect_beauty'));
  assert.ok(ids.includes('banuba_beauty'));
  assert.ok(ids.includes('disabled'));
  assert.ok(ids.includes('future'));
  assert.ok(ids.includes('unknown'));
  assert.equal(new Set(ids).size, ids.length);
  console.log('ok registry');
}

function testLicenseStates(): void {
  const platform = createProviderReadinessPlatform();
  const perfect = platform.getLicense('perfect_beauty');
  assert.equal(perfect?.status, 'unknown');
  platform.markLicenseVerified(
    'perfect_beauty',
    'docs/governance/PHASE_5B_PROVIDER_VERIFICATION.md',
  );
  assert.equal(platform.getLicense('perfect_beauty')?.status, 'verified');
  // Never infer — banuba stays unknown
  assert.equal(platform.getLicense('banuba_beauty')?.status, 'unknown');
  console.log('ok license_states');
}

function testActivationRemainsDisabled(): void {
  const platform = createProviderReadinessPlatform();
  const result = platform.tryActivate('perfect_beauty', 'lip');
  assert.equal(result.activated, false);
  assert.equal(result.checklist.allPassed, false);
  const act = platform.store.getCapabilityActivation('perfect_beauty', 'lip');
  assert.equal(act?.status, 'disabled');
  console.log('ok activation_disabled');
}

function testHealthModel(): void {
  const platform = createProviderReadinessPlatform();
  assert.equal(platform.getHealth('perfect_beauty')?.status, 'license_missing');
  assert.equal(platform.getHealth('disabled')?.status, 'unavailable');
  console.log('ok health_model');
}

function testVerificationWorkflow(): void {
  const platform = createProviderReadinessPlatform();
  const report = platform.verify('perfect_beauty', 'lip');
  assert.ok(report.checks.length >= 8);
  assert.ok(report.checks.some((c) => c.id === 'api_reachability'));
  const reach = report.checks.find((c) => c.id === 'api_reachability')!;
  assert.equal(reach.result, 'unknown'); // never live probe
  assert.ok(
    report.overall === 'failed' ||
      report.overall === 'in_progress' ||
      report.overall === 'unknown',
  );
  console.log('ok verification_workflow');
}

function testConfigurationNoSecrets(): void {
  const platform = createProviderReadinessPlatform();
  const cfg = platform.getConfiguration('perfect_beauty')!;
  assert.equal(cfg.apiKeyEnvVar, 'PERFECT_API_KEY');
  assert.equal(cfg.healthCheck.allowLiveProbe, false);
  const json = JSON.stringify(cfg);
  // Must not look like a raw API key blob
  assert.ok(!/sk_live|Bearer [A-Za-z0-9]{20,}/.test(json));
  assert.ok(!json.includes('"apiKey":'));
  console.log('ok configuration_no_secrets');
}

function testCostModel(): void {
  const platform = createProviderReadinessPlatform();
  const cost = platform.getCost('perfect_beauty')!;
  assert.equal(cost.costClass, 'MEDIUM');
  assert.equal(cost.quotaRemaining, 'unknown');
  assertCanonicalDtoNoProviderFields({
    costClass: cost.costClass,
    billingUnit: cost.billingUnit,
  });
  console.log('ok cost_model');
}

function testSandboxAndDocs(): void {
  const platform = createProviderReadinessPlatform();
  assert.equal(platform.getSandbox('perfect_beauty')?.sandboxVerified, false);
  assert.equal(platform.getDocs('perfect_beauty')?.status, 'partial');
  assert.equal(platform.getSandbox('banuba_beauty')?.status, 'unavailable');
  console.log('ok sandbox_docs');
}

function testWizardArchitecture(): void {
  const steps = PROVIDER_CONFIGURATION_WIZARD.map((s) => s.id);
  assert.deepEqual(steps, [
    'choose_provider',
    'verify_license',
    'verify_capabilities',
    'configure_keys',
    'health_check',
    'activate',
    'smoke_test',
    'ready',
  ]);
  console.log('ok wizard');
}

function testReadinessReport(): void {
  const platform = createProviderReadinessPlatform();
  const report = platform.readinessReport();
  assert.equal(report.version, PROVIDER_READINESS_VERSION);
  const perfect = report.entries.find((e) => e.providerId === 'perfect_beauty');
  assert.equal(perfect?.level, 'blocked');
  assert.ok(perfect?.reasons.some((r) => /license/i.test(r)));
  const banuba = report.entries.find((e) => e.providerId === 'banuba_beauty');
  assert.ok(
    banuba?.level === 'blocked' || banuba?.level === 'unknown',
  );
  console.log('ok readiness_report');
}

function testProviderIndependence(): void {
  const platform = createProviderReadinessPlatform();
  // Marking Perfect license does not change Banuba
  platform.markLicenseVerified('perfect_beauty', 'test-evidence');
  assert.equal(platform.getLicense('banuba_beauty')?.status, 'unknown');
  // Still cannot activate without full checklist
  const { activated } = tryActivateCapability(
    platform.store,
    'perfect_beauty',
    'lip',
  );
  assert.equal(activated, false);
  console.log('ok provider_independence');
}

function testNoProviderLeakageInPublicReport(): void {
  const platform = createProviderReadinessPlatform();
  const report = platform.readinessReport();
  // Public-ish summary: levels and reasons only — strip provider ids for Flutter law
  // Ops report may include providerId; ensure no secret payloads
  const json = JSON.stringify(report);
  assert.ok(!json.includes('sk_'));
  assert.ok(!json.includes('rawYouCam'));
  assert.ok(!json.includes('banuba_sdk'));
  console.log('ok no_secret_leakage');
}

function main(): void {
  assert.equal(PROVIDER_READINESS_VERSION, '1.0.0');
  testRegistry();
  testLicenseStates();
  testActivationRemainsDisabled();
  testHealthModel();
  testVerificationWorkflow();
  testConfigurationNoSecrets();
  testCostModel();
  testSandboxAndDocs();
  testWizardArchitecture();
  testReadinessReport();
  testProviderIndependence();
  testNoProviderLeakageInPublicReport();
  console.log('phase5b0 provider readiness OK');
}

main();
