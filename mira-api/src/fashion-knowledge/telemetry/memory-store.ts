/**
 * FK-9 — Deterministic in-memory telemetry adapter (TEST_ONLY / local).
 * Must not be used silently as production sink.
 */
import type { FashionKnowledgeTelemetryEvent } from './event-contract';
import type { FashionAdviceFeedback } from './feedback-contract';
import type { FashionKnowledgeEventStorePort } from './port';
import { aggregateFashionKnowledgeTelemetry } from './aggregation';
import { buildResearchCandidates } from './research-export';
import { FASHION_KNOWLEDGE_TEST_ONLY } from '../versioning/release';

export class InMemoryFashionKnowledgeTelemetryStore
  implements FashionKnowledgeEventStorePort
{
  readonly kind = FASHION_KNOWLEDGE_TEST_ONLY;
  private readonly events: FashionKnowledgeTelemetryEvent[] = [];
  private readonly feedback: FashionAdviceFeedback[] = [];
  private readonly eventIds = new Set<string>();
  private readonly eventIdempotency = new Set<string>();
  private readonly feedbackIds = new Set<string>();
  private readonly feedbackIdempotency = new Set<string>();

  async recordEvent(
    event: FashionKnowledgeTelemetryEvent,
  ): Promise<{ recorded: boolean; duplicate: boolean }> {
    const idem = event.idempotencyKey ?? event.eventId;
    if (this.eventIds.has(event.eventId) || this.eventIdempotency.has(idem)) {
      return { recorded: false, duplicate: true };
    }
    this.eventIds.add(event.eventId);
    this.eventIdempotency.add(idem);
    this.events.push(event);
    return { recorded: true, duplicate: false };
  }

  async recordEvents(
    events: readonly FashionKnowledgeTelemetryEvent[],
  ): Promise<{ recorded: number; duplicates: number }> {
    let recorded = 0;
    let duplicates = 0;
    for (const e of events) {
      const r = await this.recordEvent(e);
      if (r.recorded) recorded += 1;
      if (r.duplicate) duplicates += 1;
    }
    return { recorded, duplicates };
  }

  async recordFeedback(
    feedback: FashionAdviceFeedback,
  ): Promise<{ recorded: boolean; duplicate: boolean }> {
    const idem = feedback.idempotencyKey ?? feedback.feedbackId;
    if (
      this.feedbackIds.has(feedback.feedbackId) ||
      this.feedbackIdempotency.has(idem)
    ) {
      return { recorded: false, duplicate: true };
    }
    this.feedbackIds.add(feedback.feedbackId);
    this.feedbackIdempotency.add(idem);
    this.feedback.push(feedback);
    return { recorded: true, duplicate: false };
  }

  async queryAggregates(input: {
    readonly clockNowIso: string;
    readonly preferenceSegment?: string;
  }) {
    return aggregateFashionKnowledgeTelemetry({
      events: this.events,
      feedback: this.feedback,
      clockNowIso: input.clockNowIso,
      preferenceSegment: input.preferenceSegment,
    });
  }

  async loadFeedback(input?: { readonly adviceCandidateId?: string }) {
    const all = [...this.feedback];
    if (!input?.adviceCandidateId) return Object.freeze(all);
    return Object.freeze(
      all.filter((f) => f.adviceCandidateId === input.adviceCandidateId),
    );
  }

  async loadEvents() {
    return Object.freeze([...this.events]);
  }

  async buildResearchCandidates(input: { readonly clockNowIso: string }) {
    return buildResearchCandidates({
      events: this.events,
      feedback: this.feedback,
      clockNowIso: input.clockNowIso,
    });
  }

  clear(): void {
    this.events.length = 0;
    this.feedback.length = 0;
    this.eventIds.clear();
    this.eventIdempotency.clear();
    this.feedbackIds.clear();
    this.feedbackIdempotency.clear();
  }
}
