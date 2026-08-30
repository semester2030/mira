/**
 * FK-4 — Validated registry cache (version + content hash key).
 */
import type { FashionKnowledgeRegistry } from './contracts';

export class FashionKnowledgeRegistryCache {
  private entry?: {
    key: string;
    registry: FashionKnowledgeRegistry;
  };

  static cacheKey(registry: FashionKnowledgeRegistry): string {
    return `${registry.registryVersion}|${registry.snapshotHash}`;
  }

  get(key: string): FashionKnowledgeRegistry | undefined {
    if (this.entry?.key === key) return this.entry.registry;
    return undefined;
  }

  set(registry: FashionKnowledgeRegistry): void {
    this.entry = {
      key: FashionKnowledgeRegistryCache.cacheKey(registry),
      registry,
    };
  }

  clear(): void {
    this.entry = undefined;
  }
}
