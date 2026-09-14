/**
 * FK-12 — Telemetry consent hard gate.
 * Flag alone is never consent. Unknown/denied → no fashion telemetry.
 */
export const FashionTelemetryConsentState = {
  GRANTED: 'GRANTED',
  DENIED: 'DENIED',
  UNKNOWN: 'UNKNOWN',
  CONSENT_UNAVAILABLE: 'CONSENT_UNAVAILABLE',
} as const;

export type FashionTelemetryConsentState =
  (typeof FashionTelemetryConsentState)[keyof typeof FashionTelemetryConsentState];

export function resolveFashionTelemetryConsent(input?: {
  readonly consentState?: FashionTelemetryConsentState | string;
  /** Explicit product analytics permission — never inferred from feature flag. */
  readonly analyticsAllowed?: boolean;
}): FashionTelemetryConsentState {
  if (input?.analyticsAllowed === true) {
    return FashionTelemetryConsentState.GRANTED;
  }
  if (input?.analyticsAllowed === false) {
    return FashionTelemetryConsentState.DENIED;
  }
  const s = input?.consentState;
  if (
    s === FashionTelemetryConsentState.GRANTED ||
    s === FashionTelemetryConsentState.DENIED ||
    s === FashionTelemetryConsentState.UNKNOWN ||
    s === FashionTelemetryConsentState.CONSENT_UNAVAILABLE
  ) {
    return s;
  }
  // Platform consent service not wired — fail closed.
  return FashionTelemetryConsentState.CONSENT_UNAVAILABLE;
}

export function isFashionTelemetryConsentAllowed(
  state: FashionTelemetryConsentState,
): boolean {
  return state === FashionTelemetryConsentState.GRANTED;
}
