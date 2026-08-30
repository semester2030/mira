/**
 * FK-9 — Provider-independent telemetry port.
 * No public user HTTP API. No registry writes.
 */
import type { FashionKnowledgeTelemetryEvent } from './event-contract';
import type { FashionAdviceFeedback } from './feedback-contract';
import type { FashionKnowledgeAggregationReport } from './aggregation';
import type { FashionKnowledgeResearchCandidate } from './research-export';

export interface FashionKnowledgeEventStorePort {
  recordEvent(
    event: FashionKnowledgeTelemetryEvent,
  ): Promise<{ recorded: boolean; duplicate: boolean }>;
  recordEvents(
    events: readonly FashionKnowledgeTelemetryEvent[],
  ): Promise<{ recorded: number; duplicates: number }>;
  recordFeedback(
    feedback: FashionAdviceFeedback,
  ): Promise<{ recorded: boolean; duplicate: boolean }>;
  queryAggregates(input: {
    readonly clockNowIso: string;
    readonly preferenceSegment?: string;
  }): Promise<FashionKnowledgeAggregationReport>;
  loadFeedback(input?: {
    readonly adviceCandidateId?: string;
  }): Promise<readonly FashionAdviceFeedback[]>;
  loadEvents(): Promise<readonly FashionKnowledgeTelemetryEvent[]>;
  buildResearchCandidates(input: {
    readonly clockNowIso: string;
  }): Promise<readonly FashionKnowledgeResearchCandidate[]>;
}

/** @deprecated alias — prefer FashionKnowledgeEventStorePort to avoid FK-2 port name clash */
export type FashionKnowledgeTelemetryStorePort = FashionKnowledgeEventStorePort;

/** Hard surface: telemetry port must never expose registry mutation. */
export type ForbiddenTelemetryRegistryMethods =
  | 'activateRule'
  | 'approveRule'
  | 'publishRegistry'
  | 'writeRegistry';
