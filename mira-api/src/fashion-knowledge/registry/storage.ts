/**
 * FK-4 — Storage port + in-memory / JSON foundation.
 */
import type { FashionKnowledgeRule } from '../knowledge/fashion-knowledge-rule';
import type {
  FashionKnowledgeLookupQuery,
  FashionKnowledgeLookupResult,
  FashionKnowledgeRegistry,
  FashionKnowledgeRegistrySnapshot,
} from './contracts';
import { lookupFashionKnowledgeRules, getRuleById } from './lookup';
import { validateFashionKnowledgeRegistry } from './validation';
import { createRegistrySnapshot } from './snapshot';
import { buildFashionKnowledgeRegistry } from './snapshot';

export interface FashionKnowledgeRegistryStorePort {
  readonly loadRegistry: () => Promise<FashionKnowledgeRegistry>;
  readonly getRule: (ruleId: string) => Promise<FashionKnowledgeRule | undefined>;
  readonly listRules: () => Promise<readonly FashionKnowledgeRule[]>;
  readonly findApplicableRules: (
    query: FashionKnowledgeLookupQuery,
  ) => Promise<FashionKnowledgeLookupResult>;
  /** Internal/admin foundation only — never public CRUD. */
  readonly saveDraftRegistry?: (
    registry: FashionKnowledgeRegistry,
  ) => Promise<void>;
  readonly loadSnapshot: (
    generatedAt: string,
  ) => Promise<FashionKnowledgeRegistrySnapshot>;
  readonly validateRegistry: () => Promise<{
    ok: boolean;
    issues: readonly { code: string; message: string }[];
  }>;
  readonly getRegisteredSourceIds: () => Promise<ReadonlySet<string>>;
}

/** In-memory store — primary FK-4 foundation for tests and empty prod. */
export class InMemoryFashionKnowledgeRegistryStore
  implements FashionKnowledgeRegistryStorePort
{
  private registry: FashionKnowledgeRegistry;

  constructor(registry: FashionKnowledgeRegistry) {
    this.registry = registry;
  }

  async loadRegistry(): Promise<FashionKnowledgeRegistry> {
    return this.registry;
  }

  async getRule(ruleId: string): Promise<FashionKnowledgeRule | undefined> {
    return getRuleById(this.registry, ruleId);
  }

  async listRules(): Promise<readonly FashionKnowledgeRule[]> {
    return this.registry.rules;
  }

  async findApplicableRules(
    query: FashionKnowledgeLookupQuery,
  ): Promise<FashionKnowledgeLookupResult> {
    return lookupFashionKnowledgeRules(this.registry, query);
  }

  async saveDraftRegistry(registry: FashionKnowledgeRegistry): Promise<void> {
    const v = validateFashionKnowledgeRegistry(registry, {
      allowTestOnly: registry.metadata.allowTestOnly === true,
      productionMode: false,
    });
    if (!v.ok) {
      throw new Error(
        `invalid_draft_registry:${v.issues.map((i) => i.code).join(',')}`,
      );
    }
    this.registry = registry;
  }

  async loadSnapshot(
    generatedAt: string,
  ): Promise<FashionKnowledgeRegistrySnapshot> {
    return createRegistrySnapshot({
      registry: this.registry,
      generatedAt,
    });
  }

  async validateRegistry() {
    return validateFashionKnowledgeRegistry(this.registry, {
      allowTestOnly: this.registry.metadata.allowTestOnly === true,
      productionMode: this.registry.metadata.allowTestOnly !== true,
    });
  }

  async getRegisteredSourceIds(): Promise<ReadonlySet<string>> {
    return new Set(this.registry.provenanceCatalog.map((p) => p.sourceId));
  }
}

export function emptyProductionRegistry(clockIso: string): FashionKnowledgeRegistry {
  return buildFashionKnowledgeRegistry({
    registryId: 'mira_fashion_knowledge_prod',
    registryVersion: '0.0.0-empty',
    releaseId: 'fk4-empty',
    createdAt: clockIso,
    updatedAt: clockIso,
    rules: [],
    relations: [],
    provenanceCatalog: [],
    metadata: { note: 'Empty production registry — FK-4 foundation' },
  });
}
