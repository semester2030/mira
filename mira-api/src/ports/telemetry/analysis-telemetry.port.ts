export const ANALYSIS_TELEMETRY_PORT = Symbol('ANALYSIS_TELEMETRY_PORT');

export type AnalysisTelemetryEventName =
  | 'analysis_started'
  | 'provider_called'
  | 'provider_succeeded'
  | 'provider_failed'
  | 'analysis_completed'
  | 'analysis_blocked'
  | 'result_unavailable'
  | 'unsafe_mock_blocked';

export interface AnalysisTelemetryEvent {
  name: AnalysisTelemetryEventName;
  feature: 'skin' | 'fashion' | 'tryon' | 'image_quality' | 'system';
  provider?: string;
  traceId: string;
  latencyMs?: number;
  errorCode?: string;
  environment?: string;
  /** Must never contain images, tokens, or full YouCam payloads */
  safeProps?: Record<string, string | number | boolean | null>;
}

export interface AnalysisTelemetryPort {
  track(event: AnalysisTelemetryEvent): void | Promise<void>;
}

/** Reject payloads that look like secrets or raw biometric dumps. */
export function assertSafeTelemetryProps(
  props?: AnalysisTelemetryEvent['safeProps'],
): void {
  if (!props) return;
  const banned = [
    'image',
    'imagebytes',
    'imagebase64',
    'rawyoucam',
    'token',
    'apikey',
    'authorization',
    'password',
    'secret',
  ];
  for (const key of Object.keys(props)) {
    const lower = key.toLowerCase().replace(/[_-]/g, '');
    if (banned.some((b) => lower.includes(b))) {
      throw new Error(`Telemetry prop banned: ${key}`);
    }
    const val = props[key];
    if (typeof val === 'string' && val.length > 500) {
      throw new Error(`Telemetry string too long for key: ${key}`);
    }
  }
}
