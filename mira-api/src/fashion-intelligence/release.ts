/**
 * Fashion Intelligence — Wardrobe + Garment + Outfit Intelligence.
 * Architecture baseline: 6A · 6A.5 · Addendum · 6B · 6C frozen · 6D Outfit Freeze · 6E.3 Styling Freeze.
 *
 * RELEASE PIN POLICY (source of truth):
 * - `FASHION_INTELLIGENCE_RELEASE` in this file is the sole platform release label.
 * - Schema pins below (`*-schema-v1`, session/runtime versions) are frozen contracts —
 *   they do NOT change when the platform release label advances.
 * - Regression suites must assert the current value of `FASHION_INTELLIGENCE_RELEASE`,
 *   not a historically frozen phase string (e.g. 6B must not pin 0.3.0 after 6D.2).
 * See: docs/governance/PHASE_6D2_RELEASE_PIN_POLICY.md
 * Outfit Freeze: docs/governance/PHASE_6D3_OUTFIT_INTELLIGENCE_FREEZE_CERTIFICATE.md
 * Styling Freeze: docs/governance/PHASE_6E3_STYLING_INTELLIGENCE_FREEZE_CERTIFICATE.md
 */
export const FASHION_INTELLIGENCE_RELEASE = '1.0.0-styling-intelligence';
export const FASHION_INTELLIGENCE_STATUS =
  'Styling Intelligence (Frozen) · Outfit Intelligence (Frozen) · Garment Intelligence · Wardrobe Foundation' as const;
export const FASHION_INTELLIGENCE_ARCHITECTURE = 'fashion-intelligence-arch-v1';
export const FASHION_COMPAT = 'fashion-compat-v1';

/** Version pins — Canonical Fashion Data Platform (6A.5) */
export const FASHION_MANIFEST_VERSION = 'fashion-manifest-v1';
export const FASHION_GARMENT_SCHEMA_VERSION = 'garment-schema-v1';
export const FASHION_OUTFIT_SCHEMA_VERSION = 'outfit-schema-v1';
export const FASHION_WARDROBE_SCHEMA_VERSION = 'wardrobe-schema-v1';
export const FASHION_STYLE_SCHEMA_VERSION = 'style-schema-v1';
export const FASHION_RECO_SCHEMA_VERSION = 'reco-schema-v1';
export const FASHION_SESSION_VERSION = 'fashion-session-v1';
export const FASHION_RUNTIME_VERSION = 'fashion-runtime-v1';
export const FASHION_REPORT_DTO_VERSION = 'fashion-report-v1';
export const FASHION_CAPABILITY_CATALOG_VERSION = 'fashion-cap-catalog-v1';
export const FASHION_CONTRACT_SET_VERSION = 'fashion-contracts-v1';
