import { BeautyProviderDescriptor, BeautyProviderId } from './provider-ids';
import { BEAUTY_PROVIDER_MANAGER_VERSION } from '../release';
import {
  matrixForCapability,
  ProviderCapabilityMatrixEntry,
} from './provider-matrix';
import { BeautyCapabilityId } from '../capability/capability-ids';

export interface ProviderSelectionResult {
  selected?: BeautyProviderId;
  candidates: Array<{
    providerId: BeautyProviderId;
    priority: number;
    health: BeautyProviderDescriptor['health'];
    licensed: boolean;
  }>;
  reason?: string;
}

/**
 * Provider Manager — selection by capability priority.
 * Never called from Flutter. No vendor business logic beyond registry.
 */
export class ProviderManager {
  readonly version = BEAUTY_PROVIDER_MANAGER_VERSION;
  private readonly providers = new Map<BeautyProviderId, BeautyProviderDescriptor>();

  register(descriptor: BeautyProviderDescriptor): void {
    this.providers.set(descriptor.id, descriptor);
  }

  list(): BeautyProviderDescriptor[] {
    return [...this.providers.values()];
  }

  get(id: BeautyProviderId): BeautyProviderDescriptor | undefined {
    return this.providers.get(id);
  }

  health(id: BeautyProviderId): BeautyProviderDescriptor['health'] {
    return this.providers.get(id)?.health ?? 'unconfigured';
  }

  /**
   * Select highest-priority healthy licensed provider for capability.
   * Foundation stubs are unlicensed → selection returns empty (policy blocks).
   */
  selectForCapability(capabilityId: BeautyCapabilityId): ProviderSelectionResult {
    const entries = matrixForCapability(capabilityId);
    // Candidates = full matrix row visibility (even unconfigured stubs).
    // Selection = licensed + SDK + healthy/degraded only.
    const candidates = entries
      .map((e) => {
        const p = this.providers.get(e.providerId);
        return {
          providerId: e.providerId,
          priority: e.priority,
          health: p?.health ?? ('unconfigured' as const),
          licensed: p?.licensed ?? false,
          sdkInstalled: p?.sdkInstalled ?? false,
        };
      })
      .sort((a, b) => b.priority - a.priority);

    const publicCandidates = candidates.map((c) => ({
      providerId: c.providerId,
      priority: c.priority,
      health: c.health,
      licensed: c.licensed,
    }));

    const executable = candidates.filter(
      (c) =>
        c.licensed &&
        c.sdkInstalled &&
        (c.health === 'healthy' || c.health === 'degraded'),
    );
    if (executable.length === 0) {
      return {
        candidates: publicCandidates,
        reason:
          'No licensed provider with SDK for this capability (Phase 5A foundation stubs).',
      };
    }

    return {
      selected: executable[0].providerId,
      candidates: publicCandidates,
    };
  }

  matrixEntries(capabilityId: BeautyCapabilityId): ProviderCapabilityMatrixEntry[] {
    return matrixForCapability(capabilityId);
  }

  hasAnyCandidate(capabilityId: BeautyCapabilityId): boolean {
    return matrixForCapability(capabilityId).length > 0;
  }
}

/** Default foundation registry: stubs only, unlicensed, no SDK. */
export function createFoundationProviderManager(): ProviderManager {
  const mgr = new ProviderManager();
  mgr.register({
    id: 'disabled',
    version: 'disabled-v1',
    label: 'Disabled Beauty Adapter',
    licensed: false,
    sdkInstalled: false,
    health: 'healthy',
  });
  mgr.register({
    id: 'perfect_beauty',
    version: 'perfect-beauty-stub-v1',
    label: 'Perfect Beauty (stub — no SDK)',
    licensed: false,
    sdkInstalled: false,
    health: 'unconfigured',
  });
  mgr.register({
    id: 'banuba_beauty',
    version: 'banuba-beauty-stub-v1',
    label: 'Banuba Beauty (stub — no SDK)',
    licensed: false,
    sdkInstalled: false,
    health: 'unconfigured',
  });
  mgr.register({
    id: 'future',
    version: 'future-v0',
    label: 'Future Provider Slot',
    licensed: false,
    sdkInstalled: false,
    health: 'unconfigured',
  });
  return mgr;
}
