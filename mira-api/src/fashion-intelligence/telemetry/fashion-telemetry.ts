import { assertSafeTelemetryProps } from '../../ports/telemetry/analysis-telemetry.port';

export type FashionAnalyticsEventName =
  | 'fashion_wardrobe_created'
  | 'fashion_wardrobe_item_added'
  | 'fashion_wardrobe_collection_created'
  | 'fashion_wardrobe_favorite_added'
  | 'fashion_wardrobe_look_created'
  | 'fashion_session_created'
  | 'fashion_session_bound_wardrobe'
  | 'fashion_session_history_appended'
  | 'fashion_attempt_recorded'
  | 'fashion_capability_requested'
  | 'fashion_capability_blocked'
  | 'fashion_validation_failed'
  | 'fashion_audit';

export interface FashionAnalyticsEvent {
  name: FashionAnalyticsEventName;
  traceId: string;
  sessionId?: string;
  wardrobeId?: string;
  capabilityId?: string;
  runtimeStatus?: string;
  props?: Record<string, string | number | boolean | null>;
}

export type FashionAnalyticsSink = (event: FashionAnalyticsEvent) => void;

const defaultSink: FashionAnalyticsSink = (event) => {
  if (process.env.FASHION_TELEMETRY_LOG === 'true') {
    // eslint-disable-next-line no-console
    console.log(
      `[fashion-telemetry] ${event.name} trace=${event.traceId} status=${event.runtimeStatus ?? '-'}`,
    );
  }
};

export class FashionTelemetry {
  private sink: FashionAnalyticsSink = defaultSink;

  setSink(sink: FashionAnalyticsSink): void {
    this.sink = sink;
  }

  track(event: FashionAnalyticsEvent): void {
    assertSafeTelemetryProps(event.props);
    this.sink(event);
  }
}

export const fashionTelemetry = new FashionTelemetry();

/** Append-only audit trail (in-process foundation). */
export interface FashionAuditEntry {
  auditId: string;
  at: string;
  action: string;
  actor?: string;
  wardrobeId?: string;
  sessionId?: string;
  detail?: Record<string, string | number | boolean | null>;
}

export class FashionAuditLog {
  private readonly entries: FashionAuditEntry[] = [];

  append(entry: Omit<FashionAuditEntry, 'auditId' | 'at'> & { auditId?: string }): FashionAuditEntry {
    const full: FashionAuditEntry = {
      auditId: entry.auditId ?? `faudit_${Date.now()}_${this.entries.length}`,
      at: new Date().toISOString(),
      action: entry.action,
      actor: entry.actor,
      wardrobeId: entry.wardrobeId,
      sessionId: entry.sessionId,
      detail: entry.detail,
    };
    this.entries.push(full);
    fashionTelemetry.track({
      name: 'fashion_audit',
      traceId: full.auditId,
      wardrobeId: full.wardrobeId,
      sessionId: full.sessionId,
      props: { action: full.action },
    });
    return full;
  }

  list(limit = 100): FashionAuditEntry[] {
    return this.entries.slice(-limit);
  }

  clear(): void {
    this.entries.length = 0;
  }
}

export const fashionAuditLog = new FashionAuditLog();
