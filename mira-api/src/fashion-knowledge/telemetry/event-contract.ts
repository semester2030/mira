/**
 * FK-9 — Versioned telemetry event contract.
 * No Canonical bodies, no images, no Decision Ledger, no Evidence Graph.
 */
import { FASHION_TELEMETRY_SCHEMA_VERSION } from '../versioning/release';
import type { AdviceSourceMode, FashionKnowledgeEventType } from './event-taxonomy';

export interface FashionKnowledgeTelemetryEvent {
  readonly eventId: string;
  readonly eventType: FashionKnowledgeEventType;
  readonly schemaVersion: typeof FASHION_TELEMETRY_SCHEMA_VERSION | string;
  readonly occurredAt: string;
  readonly sessionRef?: string;
  /** Pseudonymous / hashed user ref only — never raw PII. */
  readonly userRefHash?: string;
  readonly adviceCandidateId?: string;
  readonly claimLockDecision?: string;
  readonly adviceType?: string;
  readonly sourceMode: AdviceSourceMode | string;
  readonly ruleIds: readonly string[];
  readonly knowledgeType?: string;
  readonly subjectivity?: string;
  readonly confidenceBand?: string;
  readonly occasionClass?: string;
  readonly dressCodeClass?: string;
  /** Broad boolean only — prefer not detailed cultural identity. */
  readonly culturalContextPresent?: boolean;
  readonly preferenceConflict?: string;
  readonly domains: readonly string[];
  readonly alternativeId?: string;
  readonly feedbackValue?: string;
  readonly reasonCodes: readonly string[];
  readonly releaseVersion: string;
  readonly registryVersion?: string;
  readonly llmPolicyVersion?: string;
  readonly traceId?: string;
  readonly idempotencyKey?: string;
  /** Bounded safe metadata only. */
  readonly metadata: Readonly<Record<string, string | number | boolean | null>>;
}

export interface FashionKnowledgeTelemetryEventInput
  extends Omit<
    FashionKnowledgeTelemetryEvent,
    'schemaVersion' | 'ruleIds' | 'domains' | 'reasonCodes' | 'metadata'
  > {
  readonly ruleIds?: readonly string[];
  readonly domains?: readonly string[];
  readonly reasonCodes?: readonly string[];
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
  readonly schemaVersion?: string;
}
