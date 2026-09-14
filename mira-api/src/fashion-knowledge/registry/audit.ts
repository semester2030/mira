/**
 * FK-4 — Append-only audit history (in-memory foundation).
 */
import {
  RegistryAuditEventType,
  type FashionKnowledgeAuditEvent,
} from './contracts';
import { FASHION_KNOWLEDGE_AUDIT_VERSION } from '../versioning/release';
import { sha256Hex } from './hash';

export class FashionKnowledgeAuditLog {
  private readonly events: FashionKnowledgeAuditEvent[] = [];

  append(
    partial: Omit<FashionKnowledgeAuditEvent, 'eventId' | 'schemaVersion'> & {
      eventId?: string;
    },
  ): FashionKnowledgeAuditEvent {
    const eventId =
      partial.eventId ??
      `aud_${sha256Hex([
        partial.type,
        partial.timestamp,
        partial.ruleId ?? '',
        partial.reason,
        String(this.events.length),
      ]).slice(0, 16)}`;
    const event: FashionKnowledgeAuditEvent = Object.freeze({
      eventId,
      schemaVersion: FASHION_KNOWLEDGE_AUDIT_VERSION,
      type: partial.type,
      ruleId: partial.ruleId,
      oldVersion: partial.oldVersion,
      newVersion: partial.newVersion,
      actorRef: partial.actorRef,
      timestamp: partial.timestamp,
      reason: partial.reason,
      releaseId: partial.releaseId,
      traceId: partial.traceId,
    });
    this.events.push(event);
    return event;
  }

  list(): readonly FashionKnowledgeAuditEvent[] {
    return Object.freeze([...this.events]);
  }

  clearForTests(): void {
    this.events.length = 0;
  }
}
