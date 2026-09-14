/**
 * FK-4 — Snapshot + registry builder (deterministic).
 */
import type { FashionKnowledgeRule } from '../knowledge/fashion-knowledge-rule';
import type { FashionRuleRelation } from '../contracts/conflicts';
import type { FashionProvenance } from '../contracts/provenance';
import {
  RegistryStatus,
  type FashionKnowledgeRegistry,
  type FashionKnowledgeRegistryMetadata,
  type FashionKnowledgeRegistrySnapshot,
} from './contracts';
import { buildRegistryIndexes, activeRuleIds } from './indexes';
import { contentHash, sha256Hex } from './hash';
import {
  FASHION_KNOWLEDGE_REGISTRY_SCHEMA_VERSION,
  FASHION_KNOWLEDGE_SNAPSHOT_VERSION,
  FASHION_KNOWLEDGE_RULE_SCHEMA_VERSION,
  FASHION_KNOWLEDGE_TYPES_VERSION,
  FASHION_PROVENANCE_VERSION,
} from '../versioning/release';

export function computeRegistryContentHash(input: {
  readonly registryVersion: string;
  readonly rules: readonly FashionKnowledgeRule[];
  readonly relations: readonly FashionRuleRelation[];
  readonly provenanceCatalog: readonly FashionProvenance[];
}): string {
  const indexes = buildRegistryIndexes(input.rules);
  return contentHash({
    registryVersion: input.registryVersion,
    rules: input.rules.map((r) => ({
      id: r.ruleId,
      v: r.ruleVersion,
      s: r.status,
      d: r.domain,
    })),
    relations: input.relations,
    provenance: input.provenanceCatalog.map((p) => p.sourceId).sort(),
    indexes,
  });
}

export function buildFashionKnowledgeRegistry(input: {
  readonly registryId: string;
  readonly registryVersion: string;
  readonly releaseId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly rules?: readonly FashionKnowledgeRule[];
  readonly relations?: readonly FashionRuleRelation[];
  readonly provenanceCatalog?: readonly FashionProvenance[];
  readonly metadata?: FashionKnowledgeRegistryMetadata;
  readonly status?: RegistryStatus;
}): FashionKnowledgeRegistry {
  const rules = input.rules ?? [];
  const relations = input.relations ?? [];
  const provenanceCatalog = input.provenanceCatalog ?? [];
  const indexes = buildRegistryIndexes(rules);
  const snapshotHash = computeRegistryContentHash({
    registryVersion: input.registryVersion,
    rules,
    relations,
    provenanceCatalog,
  });
  const status =
    input.status ??
    (rules.length === 0 ? RegistryStatus.EMPTY : RegistryStatus.VALIDATED);

  return Object.freeze({
    registryId: input.registryId,
    schemaVersion: FASHION_KNOWLEDGE_REGISTRY_SCHEMA_VERSION,
    registryVersion: input.registryVersion,
    releaseId: input.releaseId,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    rules: Object.freeze([...rules]),
    relations: Object.freeze([...relations]),
    provenanceCatalog: Object.freeze([...provenanceCatalog]),
    indexes,
    snapshotHash,
    status,
    metadata: Object.freeze(input.metadata ?? {}),
  });
}

export function createRegistrySnapshot(input: {
  readonly registry: FashionKnowledgeRegistry;
  readonly generatedAt: string;
}): FashionKnowledgeRegistrySnapshot {
  const { registry, generatedAt } = input;
  const activeIds = activeRuleIds(registry.rules);
  const provenanceIds = Object.freeze(
    [...new Set(registry.provenanceCatalog.map((p) => p.sourceId))].sort(),
  );
  const snapshotId = sha256Hex([
    registry.registryVersion,
    registry.snapshotHash,
    generatedAt,
    ...activeIds,
  ]).slice(0, 32);

  return Object.freeze({
    snapshotId: `snap_${snapshotId}`,
    schemaVersion: FASHION_KNOWLEDGE_SNAPSHOT_VERSION,
    registryVersion: registry.registryVersion,
    contentHash: registry.snapshotHash,
    activeRuleIds: activeIds,
    provenanceIds,
    generatedAt,
    schemaVersions: Object.freeze([
      FASHION_KNOWLEDGE_REGISTRY_SCHEMA_VERSION,
      FASHION_KNOWLEDGE_RULE_SCHEMA_VERSION,
      FASHION_KNOWLEDGE_TYPES_VERSION,
      FASHION_PROVENANCE_VERSION,
      FASHION_KNOWLEDGE_SNAPSHOT_VERSION,
    ]),
    releaseId: registry.releaseId,
  });
}
