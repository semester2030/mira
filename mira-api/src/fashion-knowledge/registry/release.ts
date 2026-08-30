/**
 * FK-4 — Registry release + rollback foundation.
 */
import type { FashionRuleDomain } from '../contracts/rule-domains';
import type {
  FashionKnowledgeRegistry,
  FashionKnowledgeRegistryRelease,
  FashionKnowledgeRegistrySnapshot,
} from './contracts';
import { createRegistrySnapshot } from './snapshot';
import { activeRuleIds } from './indexes';
import { FASHION_KNOWLEDGE_RELEASE_MODEL_VERSION } from '../versioning/release';
import {
  FashionKnowledgeAuditLog,
} from './audit';
import { RegistryAuditEventType } from './contracts';

export interface RegistryReleaseState {
  readonly current?: FashionKnowledgeRegistryRelease;
  readonly history: readonly FashionKnowledgeRegistryRelease[];
  readonly snapshots: ReadonlyMap<string, FashionKnowledgeRegistrySnapshot>;
  readonly registries: ReadonlyMap<string, FashionKnowledgeRegistry>;
}

export class FashionKnowledgeReleaseManager {
  private current?: FashionKnowledgeRegistryRelease;
  private readonly history: FashionKnowledgeRegistryRelease[] = [];
  private readonly snapshots = new Map<string, FashionKnowledgeRegistrySnapshot>();
  private readonly registries = new Map<string, FashionKnowledgeRegistry>();

  constructor(private readonly audit = new FashionKnowledgeAuditLog()) {}

  release(input: {
    readonly registry: FashionKnowledgeRegistry;
    readonly releasedAt: string;
    readonly releaseNotes: string;
    readonly approvedBy?: string;
  }): FashionKnowledgeRegistryRelease {
    const snapshot = createRegistrySnapshot({
      registry: input.registry,
      generatedAt: input.releasedAt,
    });
    const domains = Object.freeze(
      [...new Set(input.registry.rules.map((r) => r.domain))].sort() as FashionRuleDomain[],
    );
    const rel: FashionKnowledgeRegistryRelease = Object.freeze({
      releaseId: input.registry.releaseId,
      schemaVersion: FASHION_KNOWLEDGE_RELEASE_MODEL_VERSION,
      registryVersion: input.registry.registryVersion,
      snapshotId: snapshot.snapshotId,
      activeRuleCount: activeRuleIds(input.registry.rules).length,
      domainsCovered: domains,
      releasedAt: input.releasedAt,
      releaseNotes: input.releaseNotes,
      approvedBy: input.approvedBy,
      rollbackTarget: this.current?.releaseId,
    });
    this.snapshots.set(snapshot.snapshotId, snapshot);
    this.registries.set(input.registry.registryVersion, input.registry);
    if (this.current) this.history.push(this.current);
    this.current = rel;
    this.audit.append({
      type: RegistryAuditEventType.REGISTRY_RELEASED,
      timestamp: input.releasedAt,
      reason: input.releaseNotes,
      releaseId: rel.releaseId,
      newVersion: rel.registryVersion,
      actorRef: input.approvedBy,
    });
    return rel;
  }

  rollback(input: {
    readonly toReleaseId: string;
    readonly timestamp: string;
    readonly actorRef?: string;
  }): FashionKnowledgeRegistryRelease {
    const target =
      this.history.find((h) => h.releaseId === input.toReleaseId) ??
      (this.current?.releaseId === input.toReleaseId ? this.current : undefined);
    if (!target) {
      throw new Error(`rollback_target_missing:${input.toReleaseId}`);
    }
    const rolled: FashionKnowledgeRegistryRelease = Object.freeze({
      ...target,
      releaseId: `${target.releaseId}_rollback_${input.timestamp}`,
      releasedAt: input.timestamp,
      releaseNotes: `Rollback to ${target.releaseId}`,
      approvedBy: input.actorRef,
      rollbackTarget: target.releaseId,
    });
    if (this.current) this.history.push(this.current);
    this.current = rolled;
    this.audit.append({
      type: RegistryAuditEventType.REGISTRY_ROLLBACK,
      timestamp: input.timestamp,
      reason: `rollback_to:${target.releaseId}`,
      releaseId: rolled.releaseId,
      oldVersion: target.registryVersion,
      newVersion: target.registryVersion,
      actorRef: input.actorRef,
    });
    return rolled;
  }

  getCurrent(): FashionKnowledgeRegistryRelease | undefined {
    return this.current;
  }

  getSnapshot(snapshotId: string): FashionKnowledgeRegistrySnapshot | undefined {
    return this.snapshots.get(snapshotId);
  }

  getRegistryByVersion(
    registryVersion: string,
  ): FashionKnowledgeRegistry | undefined {
    return this.registries.get(registryVersion);
  }

  getAudit() {
    return this.audit;
  }

  getHistory(): readonly FashionKnowledgeRegistryRelease[] {
    return Object.freeze([...this.history]);
  }
}
