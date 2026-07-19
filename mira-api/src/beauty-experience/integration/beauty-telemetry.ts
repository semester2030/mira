import { assertSafeTelemetryProps } from '../../ports/telemetry/analysis-telemetry.port';

/**
 * Beauty analytics / telemetry events — no images, no secrets, no vendor payloads.
 */
export type BeautyAnalyticsEventName =
  | 'beauty_session_created'
  | 'beauty_session_enriched'
  | 'beauty_look_created'
  | 'beauty_attempt_recorded'
  | 'beauty_capability_requested'
  | 'beauty_capability_blocked'
  | 'beauty_compare_created'
  | 'beauty_favorite_added'
  | 'beauty_collection_created'
  | 'beauty_share_created'
  | 'beauty_history_listed'
  | 'beauty_provider_activation_hook'
  | 'beauty_integration_ready';

export interface BeautyAnalyticsEvent {
  name: BeautyAnalyticsEventName;
  traceId: string;
  sessionId?: string;
  capabilityId?: string;
  runtimeStatus?: string;
  /** Safe props only */
  props?: Record<string, string | number | boolean | null>;
}

export type BeautyAnalyticsSink = (event: BeautyAnalyticsEvent) => void;

const defaultSink: BeautyAnalyticsSink = (event) => {
  // Structured log-safe sink — no secrets
  if (process.env.BEAUTY_TELEMETRY_LOG === 'true') {
    // eslint-disable-next-line no-console
    console.log(
      `[beauty-telemetry] ${event.name} trace=${event.traceId} status=${event.runtimeStatus ?? '-'}`,
    );
  }
};

export class BeautyTelemetry {
  private sink: BeautyAnalyticsSink = defaultSink;

  setSink(sink: BeautyAnalyticsSink): void {
    this.sink = sink;
  }

  track(event: BeautyAnalyticsEvent): void {
    assertSafeTelemetryProps(event.props);
    this.sink(event);
  }
}

export const beautyTelemetry = new BeautyTelemetry();
