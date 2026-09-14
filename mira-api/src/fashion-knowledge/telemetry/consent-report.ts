/**
 * FK-9 — Consent integration report (no invented legal behavior).
 */
export const FK9_CONSENT_INTEGRATION_REPORT = Object.freeze({
  status: 'DOCUMENTED_GAP' as const,
  fashionKnowledgeSpecificConsent: 'NOT_FOUND',
  relatedExisting: Object.freeze([
    'beauty_experience_try_on_consent',
    'analysis_telemetry_safe_props_guard',
  ]),
  blocker:
    'Product-level analytics/consent for Fashion Knowledge telemetry is not yet wired; do not enable FASHION_KNOWLEDGE_TELEMETRY_ENABLED in production until consent integration is approved.',
  policy:
    'Do not bypass existing consent choices. Do not invent legal consent behavior in FK-9.',
});
