/**
 * Feature flags — Fashion Intelligence (env-driven).
 * Provider execution remains false — GI/OI map/evaluate only.
 */
export interface FashionFeatureFlags {
  fashionWardrobeEnabled: boolean;
  fashionSessionEnabled: boolean;
  fashionTelemetryEnabled: boolean;
  /** Garment Intelligence mapping (no direct provider calls) */
  fashionGarmentIntelEnabled: boolean;
  /** Outfit Intelligence evaluation (no direct provider calls) */
  fashionOutfitIntelEnabled: boolean;
  /** Styling Intelligence reasoning (no analysis / no recommendations) */
  fashionStylingIntelEnabled: boolean;
  /** Always false — live provider execution not owned by Fashion Intelligence module */
  fashionProviderExecutionEnabled: boolean;
}

export function resolveFashionFeatureFlags(
  get: (key: string, def?: string) => string | undefined,
): FashionFeatureFlags {
  return {
    fashionWardrobeEnabled:
      (get('FASHION_WARDROBE_ENABLED', 'true') ?? 'true') !== 'false',
    fashionSessionEnabled:
      (get('FASHION_SESSION_ENABLED', 'true') ?? 'true') !== 'false',
    fashionTelemetryEnabled:
      (get('FASHION_TELEMETRY_ENABLED', 'true') ?? 'true') !== 'false',
    fashionGarmentIntelEnabled:
      (get('FASHION_GARMENT_INTEL_ENABLED', 'true') ?? 'true') !== 'false',
    fashionOutfitIntelEnabled:
      (get('FASHION_OUTFIT_INTEL_ENABLED', 'true') ?? 'true') !== 'false',
    fashionStylingIntelEnabled:
      (get('FASHION_STYLING_INTEL_ENABLED', 'true') ?? 'true') !== 'false',
    fashionProviderExecutionEnabled: false,
  };
}
