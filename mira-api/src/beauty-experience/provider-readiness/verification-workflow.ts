import { BeautyCapabilityId } from '../capability/capability-ids';
import { PROVIDER_VERIFICATION_VERSION } from './release';
import { ProviderReadinessStore } from './seed-registry';
import {
  CheckResult,
  ProviderVerificationReport,
  ReadinessProviderId,
  VerificationCheck,
  VerificationStatus,
} from './types';

/**
 * Verification workflow — NEVER calls external APIs (Law #21).
 * Reachability / auth results are Unknown unless operator marks verified.
 */
export class ProviderVerificationWorkflow {
  readonly version = PROVIDER_VERIFICATION_VERSION;

  run(
    store: ProviderReadinessStore,
    providerId: ReadinessProviderId,
    capabilityId?: BeautyCapabilityId,
  ): ProviderVerificationReport {
    const checks: VerificationCheck[] = [];
    const license = store.licenses.get(providerId);
    const config = store.configurations.get(providerId);
    const health = store.health.get(providerId);
    const sandbox = store.sandboxes.get(providerId);
    const provider = store.providers.get(providerId);

    checks.push(
      check(
        'license',
        'License',
        license?.status === 'verified'
          ? 'pass'
          : license?.status === 'rejected' || license?.status === 'expired'
            ? 'fail'
            : 'unknown',
        `status=${license?.status ?? 'missing'}`,
      ),
    );

    const caps = provider?.supportedCapabilities ?? [];
    const capOk =
      !capabilityId || caps.includes(capabilityId) ? 'pass' : 'fail';
    checks.push(
      check(
        'capabilities',
        'Capabilities',
        capabilityId ? capOk : caps.length > 0 ? 'pass' : 'unknown',
        capabilityId
          ? `capability=${capabilityId}`
          : `count=${caps.length}`,
      ),
    );

    const quota = store.costs.get(providerId)?.quotaRemaining;
    checks.push(
      check(
        'quota',
        'Quota',
        quota === 'unknown' || quota === undefined
          ? 'unknown'
          : typeof quota === 'number' && quota <= 0
            ? 'fail'
            : 'pass',
        `quotaRemaining=${String(quota)}`,
      ),
    );

    checks.push(
      check(
        'sandbox',
        'Sandbox',
        sandbox?.sandboxVerified
          ? 'pass'
          : sandbox?.sandboxAvailable
            ? 'unknown'
            : 'fail',
        `status=${sandbox?.status ?? 'missing'}`,
      ),
    );

    checks.push(
      check(
        'health',
        'Health',
        health?.status === 'available'
          ? 'pass'
          : health?.status === 'unknown'
            ? 'unknown'
            : 'fail',
        health?.reason ?? health?.status,
      ),
    );

    // Authentication — never probe; Unknown unless license verified + config complete
    const auth: CheckResult =
      license?.status === 'verified' && config?.status === 'complete'
        ? 'unknown'
        : license?.status === 'verified'
          ? 'unknown'
          : 'fail';
    checks.push(
      check(
        'authentication',
        'Authentication',
        auth === 'unknown' && license?.status !== 'verified' ? 'fail' : auth,
        'No live auth probe in Provider Readiness Platform',
      ),
    );

    // API reachability — NEVER live call
    checks.push(
      check(
        'api_reachability',
        'API reachability',
        'unknown',
        'Live probe forbidden in 5B.0 — mark after operator smoke test',
      ),
    );

    checks.push(
      check(
        'version_compatibility',
        'Version compatibility',
        config?.restVersion || config?.sdkVersion ? 'pass' : 'unknown',
        `rest=${config?.restVersion ?? 'n/a'} sdk=${config?.sdkVersion ?? 'n/a'}`,
      ),
    );

    checks.push(
      check(
        'required_assets',
        'Required assets',
        capabilityId ? 'pass' : 'unknown',
        'Catalog assets declared; not fetched from vendor',
      ),
    );

    checks.push(
      check(
        'configuration',
        'Configuration',
        config?.status === 'complete'
          ? 'pass'
          : config?.status === 'partial'
            ? 'unknown'
            : 'fail',
        config?.status,
      ),
    );

    const overall = summarize(checks);
    const report: ProviderVerificationReport = {
      providerId,
      capabilityId,
      checks,
      overall,
      completedAt: new Date().toISOString(),
    };

    const p = store.providers.get(providerId);
    if (p) {
      p.verificationStatus = overall;
      store.upsertProvider(p);
    }
    return report;
  }
}

function check(
  id: string,
  label: string,
  result: CheckResult,
  detail?: string,
): VerificationCheck {
  return { id, label, result, detail };
}

function summarize(checks: VerificationCheck[]): VerificationStatus {
  if (checks.some((c) => c.result === 'fail')) return 'failed';
  if (checks.every((c) => c.result === 'pass')) return 'passed';
  if (checks.every((c) => c.result === 'unknown')) return 'unknown';
  return 'in_progress';
}

export const defaultVerificationWorkflow = new ProviderVerificationWorkflow();
