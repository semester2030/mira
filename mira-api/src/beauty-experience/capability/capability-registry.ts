import {
  BeautyCapabilityId,
  BeautyCapabilityMetadata,
  FROZEN_CAPABILITY_IDS,
} from './capability-ids';
import { BEAUTY_CAPABILITY_REGISTRY_VERSION } from '../release';
import { BEAUTY_CAPABILITY_CATALOG_VERSION } from './catalog-release';
import catalogJson from './BEAUTY_CAPABILITY_CATALOG.json';

interface CatalogFile {
  catalogVersion: string;
  status: string;
  capabilities: BeautyCapabilityMetadata[];
}

const catalog = catalogJson as CatalogFile;

function assertCatalogIntegrity(caps: BeautyCapabilityMetadata[]): void {
  const ids = caps.map((c) => c.id);
  const unique = new Set(ids);
  if (unique.size !== ids.length) {
    throw new Error('Duplicate capability ids in catalog');
  }
  for (const frozen of FROZEN_CAPABILITY_IDS) {
    if (!unique.has(frozen)) {
      throw new Error(`Frozen capability missing from catalog: ${frozen}`);
    }
  }
  for (const c of caps) {
    const blob = JSON.stringify(c);
    if (
      blob.includes('"providerId"') ||
      blob.includes('perfect_beauty') ||
      blob.includes('banuba_beauty')
    ) {
      throw new Error(`Provider leakage in capability metadata: ${c.id}`);
    }
  }
}

assertCatalogIntegrity(catalog.capabilities);

/**
 * Capability Registry — loads frozen catalog (Engineering Law #14 SSOT).
 */
export class CapabilityRegistry {
  readonly version = BEAUTY_CAPABILITY_REGISTRY_VERSION;
  readonly catalogVersion = BEAUTY_CAPABILITY_CATALOG_VERSION;

  list(): BeautyCapabilityMetadata[] {
    return catalog.capabilities.map((c) => ({
      ...c,
      modes: [...c.modes],
      platforms: [...c.platforms],
      qualityRequirements: [...c.qualityRequirements],
      requiredAssets: [...c.requiredAssets],
      dependencies: [...c.dependencies],
    }));
  }

  get(id: BeautyCapabilityId): BeautyCapabilityMetadata | undefined {
    const found = catalog.capabilities.find((c) => c.id === id);
    return found
      ? {
          ...found,
          modes: [...found.modes],
          platforms: [...found.platforms],
          qualityRequirements: [...found.qualityRequirements],
          requiredAssets: [...found.requiredAssets],
          dependencies: [...found.dependencies],
        }
      : undefined;
  }

  has(id: string): id is BeautyCapabilityId {
    return catalog.capabilities.some((c) => c.id === id);
  }

  assertKnown(id: string): BeautyCapabilityId {
    if (!this.has(id)) {
      throw new Error(`Unknown beauty capability: ${id}`);
    }
    return id;
  }

  /** Law #13 — permanent ids */
  frozenIds(): readonly BeautyCapabilityId[] {
    return FROZEN_CAPABILITY_IDS;
  }
}

export const defaultCapabilityRegistry = new CapabilityRegistry();
