import { BeautyCapabilityId } from '../capability/capability-ids';
import {
  buildActivationChecklist,
  tryActivateCapability,
} from './activation-checklist';
import { PROVIDER_CONFIGURATION_WIZARD } from './configuration-wizard';
import { buildProviderReadinessReport } from './readiness-report';
import {
  PROVIDER_READINESS_STATUS,
  PROVIDER_READINESS_VERSION,
} from './release';
import {
  ProviderReadinessStore,
  seedProviderReadinessStore,
} from './seed-registry';
import { defaultVerificationWorkflow } from './verification-workflow';
import { ReadinessProviderId } from './types';

/**
 * Facade for Provider Readiness Platform v1.0.0.
 * No SDK. No live provider calls. Config-not-code.
 */
export class ProviderReadinessPlatform {
  readonly version = PROVIDER_READINESS_VERSION;
  readonly status = PROVIDER_READINESS_STATUS;
  readonly store: ProviderReadinessStore;
  readonly wizard = PROVIDER_CONFIGURATION_WIZARD;

  constructor(store?: ProviderReadinessStore) {
    this.store = store ?? seedProviderReadinessStore();
  }

  listProviders() {
    return this.store.listProviders();
  }

  getLicense(providerId: ReadinessProviderId) {
    return this.store.licenses.get(providerId);
  }

  getConfiguration(providerId: ReadinessProviderId) {
    return this.store.configurations.get(providerId);
  }

  getHealth(providerId: ReadinessProviderId) {
    return this.store.health.get(providerId);
  }

  getCost(providerId: ReadinessProviderId) {
    return this.store.costs.get(providerId);
  }

  getSandbox(providerId: ReadinessProviderId) {
    return this.store.sandboxes.get(providerId);
  }

  getDocs(providerId: ReadinessProviderId) {
    return this.store.docs.get(providerId);
  }

  verify(providerId: ReadinessProviderId, capabilityId?: BeautyCapabilityId) {
    return defaultVerificationWorkflow.run(this.store, providerId, capabilityId);
  }

  checklist(providerId: ReadinessProviderId, capabilityId: BeautyCapabilityId) {
    return buildActivationChecklist(this.store, providerId, capabilityId);
  }

  tryActivate(providerId: ReadinessProviderId, capabilityId: BeautyCapabilityId) {
    return tryActivateCapability(this.store, providerId, capabilityId);
  }

  readinessReport() {
    return buildProviderReadinessReport(this.store);
  }

  /**
   * Operator marks license verified — still does not call providers.
   * Activation still requires full checklist.
   */
  markLicenseVerified(
    providerId: ReadinessProviderId,
    evidenceRef: string,
  ): void {
    this.store.setLicense({
      providerId,
      status: 'verified',
      verifiedAt: new Date().toISOString(),
      evidenceRef,
      notes: 'Operator-marked verified — smoke test still required',
    });
  }
}

export function createProviderReadinessPlatform(): ProviderReadinessPlatform {
  return new ProviderReadinessPlatform();
}
