import {
  CanonicalProviderRecord,
  CapabilityActivationRecord,
  ProviderConfiguration,
  ProviderCostMetadata,
  ProviderDocumentationRecord,
  ProviderHealthRecord,
  ProviderLicenseRecord,
  ProviderSandboxRecord,
  ReadinessProviderId,
} from './types';
import { BeautyCapabilityId } from '../capability/capability-ids';
import { PROVIDER_COST_MODEL_VERSION } from './release';

/**
 * In-memory canonical registries for Provider Readiness Platform.
 * Operator updates via methods — never infer license from network.
 */
export class ProviderReadinessStore {
  readonly providers = new Map<ReadinessProviderId, CanonicalProviderRecord>();
  readonly licenses = new Map<ReadinessProviderId, ProviderLicenseRecord>();
  readonly configurations = new Map<ReadinessProviderId, ProviderConfiguration>();
  readonly health = new Map<ReadinessProviderId, ProviderHealthRecord>();
  readonly costs = new Map<ReadinessProviderId, ProviderCostMetadata>();
  readonly sandboxes = new Map<ReadinessProviderId, ProviderSandboxRecord>();
  readonly docs = new Map<ReadinessProviderId, ProviderDocumentationRecord>();
  readonly capabilityActivations = new Map<string, CapabilityActivationRecord>();

  upsertProvider(record: CanonicalProviderRecord): void {
    this.providers.set(record.providerId, { ...record });
  }

  setLicense(record: ProviderLicenseRecord): void {
    this.licenses.set(record.providerId, { ...record });
    const p = this.providers.get(record.providerId);
    if (p) {
      p.licenseStatus = record.status;
      this.providers.set(p.providerId, p);
    }
  }

  setConfiguration(config: ProviderConfiguration): void {
    this.configurations.set(config.providerId, {
      ...config,
      featureFlags: { ...config.featureFlags },
      endpoints: { ...config.endpoints },
      healthCheck: { ...config.healthCheck, allowLiveProbe: false },
    });
    const p = this.providers.get(config.providerId);
    if (p) {
      p.configurationStatus = config.status;
      this.providers.set(p.providerId, p);
    }
  }

  setHealth(record: ProviderHealthRecord): void {
    this.health.set(record.providerId, { ...record });
    const p = this.providers.get(record.providerId);
    if (p) {
      p.health = record.status;
      this.providers.set(p.providerId, p);
    }
  }

  setCost(record: ProviderCostMetadata): void {
    this.costs.set(record.providerId, { ...record });
  }

  setSandbox(record: ProviderSandboxRecord): void {
    this.sandboxes.set(record.providerId, {
      ...record,
      limitations: [...record.limitations],
    });
    const p = this.providers.get(record.providerId);
    if (p) {
      p.sandboxStatus = record.status;
      this.providers.set(p.providerId, p);
    }
  }

  setDocs(record: ProviderDocumentationRecord): void {
    this.docs.set(record.providerId, { ...record });
    const p = this.providers.get(record.providerId);
    if (p) {
      p.documentationStatus = record.status;
      this.providers.set(p.providerId, p);
    }
  }

  setCapabilityActivation(record: CapabilityActivationRecord): void {
    const key = `${record.providerId}:${record.capabilityId}`;
    this.capabilityActivations.set(key, { ...record });
  }

  getCapabilityActivation(
    providerId: ReadinessProviderId,
    capabilityId: BeautyCapabilityId,
  ): CapabilityActivationRecord | undefined {
    return this.capabilityActivations.get(`${providerId}:${capabilityId}`);
  }

  listProviders(): CanonicalProviderRecord[] {
    return [...this.providers.values()].map((p) => ({
      ...p,
      supportedCapabilities: [...p.supportedCapabilities],
    }));
  }
}

export function seedProviderReadinessStore(): ProviderReadinessStore {
  const store = new ProviderReadinessStore();
  const now = new Date().toISOString();

  // Disabled
  store.upsertProvider({
    providerId: 'disabled',
    displayName: 'Disabled Beauty Provider',
    version: 'disabled-v1',
    health: 'unavailable',
    status: 'inactive',
    licenseStatus: 'unknown',
    activationStatus: 'inactive',
    supportedCapabilities: [],
    configurationStatus: 'complete',
    verificationStatus: 'passed',
    documentationStatus: 'complete',
    sandboxStatus: 'unavailable',
  });
  store.setLicense({ providerId: 'disabled', status: 'unknown', notes: 'Safety null provider' });
  store.setConfiguration({
    providerId: 'disabled',
    environment: 'unknown',
    endpoints: {},
    featureFlags: { BEAUTY_REAL_TRYON_ENABLED: 'false' },
    healthCheck: { enabled: false, allowLiveProbe: false },
    status: 'complete',
  });
  store.setHealth({
    providerId: 'disabled',
    status: 'unavailable',
    updatedAt: now,
    reason: 'Intentionally disabled',
  });
  store.setCost({
    providerId: 'disabled',
    costClass: 'LOW',
    costVersion: PROVIDER_COST_MODEL_VERSION,
    billingUnit: 'none',
    currency: 'USD',
    estimatedCostPerUnit: 0,
  });
  store.setSandbox({
    providerId: 'disabled',
    sandboxAvailable: false,
    sandboxVerified: false,
    limitations: ['No execution'],
    productionReady: false,
    status: 'unavailable',
  });
  store.setDocs({
    providerId: 'disabled',
    status: 'complete',
    integrationGuideUrl: 'docs/architecture/beauty_experience_foundation.md',
  });

  // Perfect Beauty — documented product, license UNKNOWN (5B stop)
  store.upsertProvider({
    providerId: 'perfect_beauty',
    displayName: 'Perfect Corp Beauty (YouCam Makeup VTO)',
    version: 'perfect-beauty-readiness-v1',
    health: 'license_missing',
    status: 'blocked',
    licenseStatus: 'unknown',
    activationStatus: 'blocked',
    supportedCapabilities: [
      'lip',
      'foundation',
      'blush',
      'eyeshadow',
      'contour',
      'look',
      'makeup_vto',
      'hair_color',
      'hair_style',
      'glasses',
    ],
    configurationStatus: 'partial',
    verificationStatus: 'failed',
    documentationStatus: 'partial',
    sandboxStatus: 'unknown',
  });
  store.setLicense({
    providerId: 'perfect_beauty',
    status: 'unknown',
    notes:
      'Phase 5B stop: Makeup VTO entitlement not verified. Skin PERFECT_API_KEY ≠ verified lip license.',
    evidenceRef: 'docs/governance/PHASE_5B_PROVIDER_VERIFICATION.md',
  });
  store.setConfiguration({
    providerId: 'perfect_beauty',
    apiKeyEnvVar: 'PERFECT_API_KEY',
    environment: 'unknown',
    endpoints: {
      restBaseUrlEnvVar: 'PERFECT_BASE_URL',
      restBaseUrlDefault: 'https://yce-api-01.makeupar.com/s2s/v2.0',
      healthPath: undefined,
    },
    sdkVersion: undefined,
    restVersion: 's2s/v2.0',
    featureFlags: {
      BEAUTY_TRYON_ENABLED: 'false',
      BEAUTY_REAL_TRYON_ENABLED: 'false',
      BEAUTY_LIP_LICENSE_VERIFIED: 'false',
    },
    timeoutMs: 90000,
    region: 'unknown',
    healthCheck: { enabled: true, allowLiveProbe: false },
    status: 'partial',
  });
  store.setHealth({
    providerId: 'perfect_beauty',
    status: 'license_missing',
    updatedAt: now,
    reason: 'License not verified — no live probe in 5B.0',
  });
  store.setCost({
    providerId: 'perfect_beauty',
    costClass: 'MEDIUM',
    estimatedCostPerUnit: undefined,
    billingUnit: 'credit',
    currency: 'USD',
    quotaRemaining: 'unknown',
    costVersion: PROVIDER_COST_MODEL_VERSION,
  });
  store.setSandbox({
    providerId: 'perfect_beauty',
    sandboxAvailable: true,
    sandboxVerified: false,
    sandboxCredentialsEnvVar: 'PERFECT_API_KEY',
    limitations: [
      'Playground trials may exist',
      'Sandbox not verified by Mira',
      'No live API calls in Provider Readiness Platform',
    ],
    productionReady: false,
    status: 'unknown',
  });
  store.setDocs({
    providerId: 'perfect_beauty',
    officialDocsUrl: 'https://docs.perfectcorp.com/reference/makeup_vto',
    restGuideUrl: 'https://docs.perfectcorp.com/reference/makeup_vto',
    pricingGuideUrl: 'https://yce.makeupar.com/api-console/en/api-keys/',
    licenseGuideUrl: 'https://yce.makeupar.com/api-console/en/api-keys/',
    retentionPolicyUrl: undefined,
    privacyPolicyUrl: undefined,
    status: 'partial',
  });
  for (const cap of ['lip', 'foundation', 'blush'] as BeautyCapabilityId[]) {
    store.setCapabilityActivation({
      capabilityId: cap,
      providerId: 'perfect_beauty',
      status: 'disabled',
      updatedAt: now,
      reason: 'Awaiting verified license + configuration',
    });
  }

  // Banuba — docs-only planning, no SDK
  store.upsertProvider({
    providerId: 'banuba_beauty',
    displayName: 'Banuba Beauty (planned)',
    version: 'banuba-beauty-readiness-v1',
    health: 'license_missing',
    status: 'blocked',
    licenseStatus: 'unknown',
    activationStatus: 'blocked',
    supportedCapabilities: ['lip', 'hair_color', 'glasses', 'blush', 'foundation'],
    configurationStatus: 'missing',
    verificationStatus: 'not_started',
    documentationStatus: 'partial',
    sandboxStatus: 'unavailable',
  });
  store.setLicense({
    providerId: 'banuba_beauty',
    status: 'unknown',
    notes: 'No Banuba license configured. Phase2 docs only.',
  });
  store.setConfiguration({
    providerId: 'banuba_beauty',
    environment: 'unknown',
    endpoints: {},
    featureFlags: {},
    healthCheck: { enabled: false, allowLiveProbe: false },
    status: 'missing',
  });
  store.setHealth({
    providerId: 'banuba_beauty',
    status: 'license_missing',
    updatedAt: now,
    reason: 'No Banuba SDK / license',
  });
  store.setCost({
    providerId: 'banuba_beauty',
    costClass: 'unknown',
    costVersion: PROVIDER_COST_MODEL_VERSION,
    quotaRemaining: 'unknown',
  });
  store.setSandbox({
    providerId: 'banuba_beauty',
    sandboxAvailable: false,
    sandboxVerified: false,
    limitations: ['SDK not installed', 'No credentials'],
    productionReady: false,
    status: 'unavailable',
  });
  store.setDocs({
    providerId: 'banuba_beauty',
    integrationGuideUrl: 'docs/mira-phase2-platform.html',
    status: 'partial',
  });
  store.setCapabilityActivation({
    capabilityId: 'lip',
    providerId: 'banuba_beauty',
    status: 'disabled',
    updatedAt: now,
    reason: 'Provider not configured',
  });

  // Future slot
  store.upsertProvider({
    providerId: 'future',
    displayName: 'Future Beauty Provider Slot',
    version: 'future-v0',
    health: 'unknown',
    status: 'inactive',
    licenseStatus: 'unknown',
    activationStatus: 'inactive',
    supportedCapabilities: [],
    configurationStatus: 'missing',
    verificationStatus: 'not_started',
    documentationStatus: 'missing',
    sandboxStatus: 'unknown',
  });
  store.setLicense({ providerId: 'future', status: 'unknown' });
  store.setConfiguration({
    providerId: 'future',
    environment: 'unknown',
    endpoints: {},
    featureFlags: {},
    healthCheck: { enabled: false, allowLiveProbe: false },
    status: 'missing',
  });
  store.setHealth({
    providerId: 'future',
    status: 'unknown',
    updatedAt: now,
  });
  store.setCost({
    providerId: 'future',
    costClass: 'unknown',
    costVersion: PROVIDER_COST_MODEL_VERSION,
  });
  store.setSandbox({
    providerId: 'future',
    sandboxAvailable: false,
    sandboxVerified: false,
    limitations: ['Placeholder'],
    productionReady: false,
    status: 'unknown',
  });
  store.setDocs({ providerId: 'future', status: 'missing' });

  // Unknown
  store.upsertProvider({
    providerId: 'unknown',
    displayName: 'Unknown Provider',
    version: 'unknown-v0',
    health: 'unknown',
    status: 'blocked',
    licenseStatus: 'unknown',
    activationStatus: 'blocked',
    supportedCapabilities: [],
    configurationStatus: 'missing',
    verificationStatus: 'unknown',
    documentationStatus: 'missing',
    sandboxStatus: 'unknown',
  });
  store.setLicense({ providerId: 'unknown', status: 'unknown' });
  store.setConfiguration({
    providerId: 'unknown',
    environment: 'unknown',
    endpoints: {},
    featureFlags: {},
    healthCheck: { enabled: false, allowLiveProbe: false },
    status: 'missing',
  });
  store.setHealth({
    providerId: 'unknown',
    status: 'unknown',
    updatedAt: now,
  });
  store.setCost({
    providerId: 'unknown',
    costClass: 'unknown',
    costVersion: PROVIDER_COST_MODEL_VERSION,
  });
  store.setSandbox({
    providerId: 'unknown',
    sandboxAvailable: false,
    sandboxVerified: false,
    limitations: [],
    productionReady: false,
    status: 'unknown',
  });
  store.setDocs({ providerId: 'unknown', status: 'missing' });

  return store;
}
