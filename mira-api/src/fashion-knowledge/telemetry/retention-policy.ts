/**
 * FK-9 — Retention policy classes (document gaps; no arbitrary permanence).
 */
export const FK9_DATA_RETENTION_POLICY = Object.freeze({
  classes: Object.freeze({
    OPERATIONAL_TELEMETRY: {
      purpose: 'debug Claim Lock / LLM quality / system behavior',
      defaultRetention: 'FOLLOW_PLATFORM_POLICY',
    },
    AGGREGATED_ANALYTICS: {
      purpose: 'denominated rates and dashboards',
      defaultRetention: 'FOLLOW_PLATFORM_POLICY',
    },
    USER_FEEDBACK: {
      purpose: 'preference and context-correction signals',
      defaultRetention: 'FOLLOW_PLATFORM_POLICY',
      note: 'Minimize free text; prefer categorical feedback types',
    },
    RESEARCH_EXPORT: {
      purpose: 'human research queue — not ACTIVE rules',
      defaultRetention: 'FOLLOW_PLATFORM_POLICY',
    },
  }),
  gaps: Object.freeze([
    'No Fashion-Knowledge-specific retention TTL configured in FK-9',
    'Must align with repository/platform privacy conventions before production enablement',
  ]),
});
