/**
 * FK-10 — Master Advisor integration flag (default false).
 * Does not enable Mode B / domain / telemetry by itself.
 */
export function isFashionKnowledgeAdvisorIntegrationEnabled(
  getEnv: (key: string, def?: string) => string | undefined = (k, d) =>
    process.env[k] ?? d,
): boolean {
  const v = (getEnv('FASHION_KNOWLEDGE_ADVISOR_INTEGRATION_ENABLED', 'false') ??
    'false')
    .trim()
    .toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

/** QA activation recipe only — never enable silently in production. */
export const FK10_QA_ACTIVATION_RECIPE = Object.freeze({
  master: 'FASHION_KNOWLEDGE_ADVISOR_INTEGRATION_ENABLED=true',
  modeB: 'FASHION_KNOWLEDGE_LLM_ENABLED=true',
  registry: 'FASHION_KNOWLEDGE_REGISTRY_ENABLED=true',
  accessories: 'FASHION_KNOWLEDGE_ACCESSORIES_ENABLED=true',
  formSilhouette: 'FASHION_KNOWLEDGE_FORM_SILHOUETTE_ENABLED=true',
  cultural: 'FASHION_KNOWLEDGE_CULTURAL_CONTEXT_ENABLED=true',
  telemetry:
    'FASHION_KNOWLEDGE_TELEMETRY_ENABLED=true (only after consent/policy)',
  note: 'Defaults remain false. Telemetry requires consent readiness (FK-9 gap).',
});
