/**
 * Feature flags for Beauty Experience integration (env-driven).
 * Never enables live provider calls in 5B.1.
 */
export interface BeautyFeatureFlags {
  /** Subsystem on */
  beautyExperienceEnabled: boolean;
  /** Integration surface ready (session/history/compare) */
  beautyIntegrationReady: boolean;
  /** Real try-on — MUST stay false until Phase 5B license */
  beautyRealTryOnEnabled: boolean;
  /** Operator-marked lip license */
  beautyLipLicenseVerified: boolean;
  /** Emit telemetry events */
  beautyTelemetryEnabled: boolean;
}

export function resolveBeautyFeatureFlags(
  get: (key: string, def?: string) => string | undefined,
): BeautyFeatureFlags {
  return {
    beautyExperienceEnabled: (get('BEAUTY_EXPERIENCE_ENABLED', 'true') ?? 'true') !== 'false',
    beautyIntegrationReady:
      (get('BEAUTY_INTEGRATION_READY', 'true') ?? 'true') !== 'false',
    beautyRealTryOnEnabled:
      (get('BEAUTY_REAL_TRYON_ENABLED', 'false') ?? 'false') === 'true',
    beautyLipLicenseVerified:
      (get('BEAUTY_LIP_LICENSE_VERIFIED', 'false') ?? 'false') === 'true',
    beautyTelemetryEnabled:
      (get('BEAUTY_TELEMETRY_ENABLED', 'true') ?? 'true') !== 'false',
  };
}

/** Live provider execution allowed only when all gates pass */
export function isProviderExecutionAllowed(flags: BeautyFeatureFlags): boolean {
  return (
    flags.beautyExperienceEnabled &&
    flags.beautyIntegrationReady &&
    flags.beautyRealTryOnEnabled &&
    flags.beautyLipLicenseVerified
  );
}
