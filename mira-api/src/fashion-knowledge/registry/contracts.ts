/**
 * FK-4 — Registry contracts (internal only).
 */
import type { FashionKnowledgeRule } from '../knowledge/fashion-knowledge-rule';
import type { FashionRuleRelation } from '../contracts/conflicts';
import type { FashionProvenance } from '../contracts/provenance';
import type { FashionRuleDomain } from '../contracts/rule-domains';
import type { KnowledgeType } from '../contracts/knowledge-types';
import type { KnowledgeConfidence } from '../contracts/confidence';
import type { SubjectivityLevel } from '../contracts/subjectivity';
import {
  FASHION_KNOWLEDGE_AUDIT_VERSION,
  FASHION_KNOWLEDGE_LOOKUP_VERSION,
  FASHION_KNOWLEDGE_REGISTRY_SCHEMA_VERSION,
  FASHION_KNOWLEDGE_RELEASE_MODEL_VERSION,
  FASHION_KNOWLEDGE_SNAPSHOT_VERSION,
} from '../versioning/release';

export const RegistryStatus = {
  EMPTY: 'EMPTY',
  DRAFT: 'DRAFT',
  VALIDATED: 'VALIDATED',
  RELEASED: 'RELEASED',
  INVALID: 'INVALID',
  UNAVAILABLE: 'UNAVAILABLE',
} as const;

export type RegistryStatus =
  (typeof RegistryStatus)[keyof typeof RegistryStatus];

export interface FashionKnowledgeRegistryIndexes {
  readonly byRuleId: Readonly<Record<string, string>>; // ruleId -> ruleVersion key
  readonly byDomain: Readonly<Record<string, readonly string[]>>;
  readonly byKnowledgeType: Readonly<Record<string, readonly string[]>>;
  readonly byStatus: Readonly<Record<string, readonly string[]>>;
  readonly byOccasion: Readonly<Record<string, readonly string[]>>;
  readonly byCulturalContext: Readonly<Record<string, readonly string[]>>;
  readonly bySourceType: Readonly<Record<string, readonly string[]>>;
  readonly bySubjectivity: Readonly<Record<string, readonly string[]>>;
  readonly byConfidence: Readonly<Record<string, readonly string[]>>;
  readonly byTrendState: Readonly<Record<string, readonly string[]>>;
}

export interface FashionKnowledgeRegistryMetadata {
  readonly note?: string;
  readonly allowTestOnly?: boolean;
  readonly domainsCovered?: readonly FashionRuleDomain[];
}

export interface FashionKnowledgeRegistry {
  readonly registryId: string;
  readonly schemaVersion: typeof FASHION_KNOWLEDGE_REGISTRY_SCHEMA_VERSION | string;
  readonly registryVersion: string;
  readonly releaseId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly rules: readonly FashionKnowledgeRule[];
  readonly relations: readonly FashionRuleRelation[];
  readonly provenanceCatalog: readonly FashionProvenance[];
  readonly indexes: FashionKnowledgeRegistryIndexes;
  readonly snapshotHash: string;
  readonly status: RegistryStatus;
  readonly metadata: FashionKnowledgeRegistryMetadata;
}

export interface FashionKnowledgeRegistrySnapshot {
  readonly snapshotId: string;
  readonly schemaVersion: typeof FASHION_KNOWLEDGE_SNAPSHOT_VERSION | string;
  readonly registryVersion: string;
  readonly contentHash: string;
  readonly activeRuleIds: readonly string[];
  readonly provenanceIds: readonly string[];
  readonly generatedAt: string;
  readonly schemaVersions: readonly string[];
  readonly releaseId: string;
}

export const RegistryAuditEventType = {
  RULE_ADDED: 'RULE_ADDED',
  RULE_UPDATED: 'RULE_UPDATED',
  RULE_APPROVED: 'RULE_APPROVED',
  RULE_ACTIVATED: 'RULE_ACTIVATED',
  RULE_DEACTIVATED: 'RULE_DEACTIVATED',
  RULE_DEPRECATED: 'RULE_DEPRECATED',
  RULE_REJECTED: 'RULE_REJECTED',
  RULE_SUPERSEDED: 'RULE_SUPERSEDED',
  PROVENANCE_UPDATED: 'PROVENANCE_UPDATED',
  REGISTRY_RELEASED: 'REGISTRY_RELEASED',
  REGISTRY_ROLLBACK: 'REGISTRY_ROLLBACK',
} as const;

export type RegistryAuditEventType =
  (typeof RegistryAuditEventType)[keyof typeof RegistryAuditEventType];

export interface FashionKnowledgeAuditEvent {
  readonly eventId: string;
  readonly schemaVersion: typeof FASHION_KNOWLEDGE_AUDIT_VERSION | string;
  readonly type: RegistryAuditEventType;
  readonly ruleId?: string;
  readonly oldVersion?: string;
  readonly newVersion?: string;
  readonly actorRef?: string;
  readonly timestamp: string;
  readonly reason: string;
  readonly releaseId?: string;
  readonly traceId?: string;
}

export interface FashionKnowledgeRegistryRelease {
  readonly releaseId: string;
  readonly schemaVersion: typeof FASHION_KNOWLEDGE_RELEASE_MODEL_VERSION | string;
  readonly registryVersion: string;
  readonly snapshotId: string;
  readonly activeRuleCount: number;
  readonly domainsCovered: readonly FashionRuleDomain[];
  readonly releasedAt: string;
  readonly releaseNotes: string;
  readonly approvedBy?: string;
  readonly rollbackTarget?: string;
}

export const LookupReasonCode = {
  MATCHED: 'MATCHED',
  NO_MATCH: 'NO_MATCH',
  NO_APPLICABLE_CURATED_RULE: 'NO_APPLICABLE_CURATED_RULE',
  INACTIVE: 'INACTIVE',
  DEPRECATED: 'DEPRECATED',
  SUPERSEDED: 'SUPERSEDED',
  EXCEPTION_MATCHED: 'EXCEPTION_MATCHED',
  TREND_EXPIRED: 'TREND_EXPIRED',
  CULTURAL_CONTEXT_MISMATCH: 'CULTURAL_CONTEXT_MISMATCH',
  OCCASION_MISMATCH: 'OCCASION_MISMATCH',
  CONFIDENCE_BELOW_THRESHOLD: 'CONFIDENCE_BELOW_THRESHOLD',
  INVALID_PROVENANCE: 'INVALID_PROVENANCE',
  TEST_ONLY_EXCLUDED: 'TEST_ONLY_EXCLUDED',
  FILTERED_BY_DOMAIN: 'FILTERED_BY_DOMAIN',
  FILTERED_BY_KNOWLEDGE_TYPE: 'FILTERED_BY_KNOWLEDGE_TYPE',
  FILTERED_BY_SUBJECTIVITY: 'FILTERED_BY_SUBJECTIVITY',
} as const;

export type LookupReasonCode =
  (typeof LookupReasonCode)[keyof typeof LookupReasonCode];

export interface FashionKnowledgeLookupQuery {
  readonly domain?: FashionRuleDomain;
  readonly domains?: readonly FashionRuleDomain[];
  readonly garmentFacts?: Readonly<Record<string, string | number | boolean | readonly string[]>>;
  readonly colorFacts?: readonly string[];
  readonly occasion?: string;
  readonly dressCode?: string;
  readonly culturalContext?: string;
  readonly styleGoal?: string;
  readonly preferenceTokens?: readonly string[];
  /** Explicit clock ISO — required for trend checks. */
  readonly clockNowIso: string;
  readonly minimumConfidence?: KnowledgeConfidence;
  readonly knowledgeTypes?: readonly KnowledgeType[];
  readonly subjectivityLevels?: readonly SubjectivityLevel[];
  readonly activeOnly?: boolean;
  readonly allowTestOnly?: boolean;
  readonly traceId?: string;
}

export interface FashionKnowledgeExcludedRule {
  readonly ruleId: string;
  readonly reasonCode: LookupReasonCode;
  readonly detail?: string;
}

export interface FashionKnowledgeMatchedRule {
  readonly ruleId: string;
  readonly ruleVersion: string;
  readonly domain: FashionRuleDomain;
  readonly knowledgeType: KnowledgeType;
  readonly confidence: KnowledgeConfidence;
  readonly subjectivity: SubjectivityLevel;
  readonly adviceTypeHint?: string;
  readonly reasonCode: typeof LookupReasonCode.MATCHED;
}

export interface FashionKnowledgeLookupResult {
  readonly schemaVersion: typeof FASHION_KNOWLEDGE_LOOKUP_VERSION | string;
  readonly matchedRules: readonly FashionKnowledgeMatchedRule[];
  readonly excludedRules: readonly FashionKnowledgeExcludedRule[];
  readonly conflictRefs: readonly string[];
  readonly appliedFilters: readonly string[];
  readonly registryVersion: string;
  readonly snapshotId: string;
  readonly queryHash: string;
  readonly reasonCodes: readonly LookupReasonCode[];
  readonly runtime: {
    readonly status: 'ok' | 'empty' | 'unavailable' | 'invalid';
    readonly elapsedMs: number;
  };
}

/** Read-only ask: are there applicable curated rules? */
export interface CuratedRuleAvailability {
  readonly available: boolean;
  readonly code:
    | typeof LookupReasonCode.MATCHED
    | typeof LookupReasonCode.NO_APPLICABLE_CURATED_RULE;
  readonly matchedRuleIds: readonly string[];
  readonly lookup: FashionKnowledgeLookupResult;
}
