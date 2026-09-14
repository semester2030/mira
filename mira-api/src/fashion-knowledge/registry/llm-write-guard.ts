/**
 * FK-4 — Prove LLM adapter has zero write path into the registry.
 */
import type { FashionKnowledgeRegistryStorePort } from './storage';

/** Structural guard: LLM evaluation result type must not include registry write. */
export const LLM_REGISTRY_WRITE_FORBIDDEN = true as const;

/**
 * Any attempt to expose saveDraftRegistry through an LLM-facing facade must fail.
 */
export function assertNoLlmRegistryWriteApi(facade: unknown): void {
  if (
    facade &&
    typeof facade === 'object' &&
    ('saveDraftRegistry' in facade ||
      'writeRule' in facade ||
      'upsertRule' in facade ||
      'deleteRule' in facade)
  ) {
    throw new Error('LLM_REGISTRY_WRITE_FORBIDDEN');
  }
}

/** Read-only view for future orchestration — no write methods. */
export interface FashionKnowledgeRegistryReadPort {
  readonly loadRegistry: FashionKnowledgeRegistryStorePort['loadRegistry'];
  readonly getRule: FashionKnowledgeRegistryStorePort['getRule'];
  readonly listRules: FashionKnowledgeRegistryStorePort['listRules'];
  readonly findApplicableRules: FashionKnowledgeRegistryStorePort['findApplicableRules'];
  readonly loadSnapshot: FashionKnowledgeRegistryStorePort['loadSnapshot'];
  readonly validateRegistry: FashionKnowledgeRegistryStorePort['validateRegistry'];
  readonly getRegisteredSourceIds: FashionKnowledgeRegistryStorePort['getRegisteredSourceIds'];
}

export function asReadOnlyRegistryPort(
  store: FashionKnowledgeRegistryStorePort,
): FashionKnowledgeRegistryReadPort {
  return {
    loadRegistry: () => store.loadRegistry(),
    getRule: (id) => store.getRule(id),
    listRules: () => store.listRules(),
    findApplicableRules: (q) => store.findApplicableRules(q),
    loadSnapshot: (t) => store.loadSnapshot(t),
    validateRegistry: () => store.validateRegistry(),
    getRegisteredSourceIds: () => store.getRegisteredSourceIds(),
  };
}
