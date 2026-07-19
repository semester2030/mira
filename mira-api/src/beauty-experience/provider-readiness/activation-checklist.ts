import { BeautyCapabilityId } from '../capability/capability-ids';
import { ProviderReadinessStore } from './seed-registry';
import { defaultVerificationWorkflow } from './verification-workflow';
import {
  ActivationChecklist,
  ActivationChecklistItem,
  CheckResult,
  ReadinessProviderId,
} from './types';

/**
 * Formal activation checklist — ALL required checks must Pass.
 * Never activates on Unknown.
 */
export function buildActivationChecklist(
  store: ProviderReadinessStore,
  providerId: ReadinessProviderId,
  capabilityId: BeautyCapabilityId,
): ActivationChecklist {
  const verification = defaultVerificationWorkflow.run(
    store,
    providerId,
    capabilityId,
  );
  const byId = Object.fromEntries(
    verification.checks.map((c) => [c.id, c.result]),
  );
  const license = store.licenses.get(providerId);
  const config = store.configurations.get(providerId);
  const health = store.health.get(providerId);
  const flags = config?.featureFlags ?? {};
  const activation = store.getCapabilityActivation(providerId, capabilityId);

  const items: ActivationChecklistItem[] = [
    item(
      'license_verified',
      'License verified',
      license?.status === 'verified' ? 'pass' : 'fail',
      `license=${license?.status}`,
    ),
    item(
      'capability_verified',
      'Capability verified',
      byId.capabilities === 'pass' ? 'pass' : 'fail',
      `capability=${capabilityId}`,
    ),
    item(
      'api_reachable',
      'API reachable',
      byId.api_reachability === 'pass' ? 'pass' : 'fail',
      'Operator must complete smoke test — default fail until pass',
    ),
    item(
      'authentication_valid',
      'Authentication valid',
      byId.authentication === 'pass' ? 'pass' : 'fail',
      byId.authentication,
    ),
    item(
      'health_ok',
      'Health OK',
      health?.status === 'available' ? 'pass' : 'fail',
      health?.status,
    ),
    item(
      'configuration_complete',
      'Configuration complete',
      config?.status === 'complete' ? 'pass' : 'fail',
      config?.status,
    ),
    item(
      'feature_flags_enabled',
      'Feature flags enabled',
      flags.BEAUTY_REAL_TRYON_ENABLED === 'true' &&
        flags.BEAUTY_LIP_LICENSE_VERIFIED === 'true'
        ? 'pass'
        : 'fail',
      JSON.stringify({
        BEAUTY_REAL_TRYON_ENABLED: flags.BEAUTY_REAL_TRYON_ENABLED,
        BEAUTY_LIP_LICENSE_VERIFIED: flags.BEAUTY_LIP_LICENSE_VERIFIED,
      }),
    ),
    item(
      'quota_available',
      'Quota available',
      byId.quota === 'pass' ? 'pass' : byId.quota === 'unknown' ? 'fail' : 'fail',
      byId.quota,
    ),
    item(
      'runtime_validated',
      'Runtime validated',
      activation?.status === 'ready' || activation?.status === 'activated'
        ? 'pass'
        : 'fail',
      activation?.status ?? 'missing',
    ),
  ];

  return {
    providerId,
    capabilityId,
    items,
    allPassed: items.every((i) => i.result === 'pass'),
  };
}

/**
 * Attempt activation — remains Disabled unless ALL checklist items Pass.
 */
export function tryActivateCapability(
  store: ProviderReadinessStore,
  providerId: ReadinessProviderId,
  capabilityId: BeautyCapabilityId,
): { activated: boolean; checklist: ActivationChecklist } {
  const checklist = buildActivationChecklist(store, providerId, capabilityId);
  if (!checklist.allPassed) {
    store.setCapabilityActivation({
      capabilityId,
      providerId,
      status: 'disabled',
      updatedAt: new Date().toISOString(),
      reason: 'Activation checklist incomplete',
    });
    return { activated: false, checklist };
  }
  store.setCapabilityActivation({
    capabilityId,
    providerId,
    status: 'activated',
    updatedAt: new Date().toISOString(),
    reason: 'All activation checks passed',
  });
  const p = store.providers.get(providerId);
  if (p) {
    p.activationStatus = 'activated';
    p.status = 'activated';
    store.upsertProvider(p);
  }
  return { activated: true, checklist };
}

function item(
  id: string,
  label: string,
  result: CheckResult,
  detail?: string,
): ActivationChecklistItem {
  return { id, label, required: true, result, detail };
}
