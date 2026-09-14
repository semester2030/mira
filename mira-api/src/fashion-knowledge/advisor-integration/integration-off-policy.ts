/**
 * FK-12 — Integration-OFF / global prescriptive quarantine policy (Option A).
 * Prescriptive fashion advice is never unrestricted MCE default.
 */
export const FK12_INTEGRATION_OFF_POLICY = Object.freeze({
  option: 'A' as const,
  name: 'GLOBAL_PRESCRIPTIVE_QUARANTINE',
  summary:
    'Prescriptive fashion advice is quarantined on MCE regardless of FKL integration flag. When FKL integration is OFF, Advisor returns unavailable/descriptive-only — never unrestricted fashion LLM.',
  mcePrescriptive: 'ALWAYS_QUARANTINE',
  advisorWhenIntegrationOff: 'UNAVAILABLE_OR_DESCRIPTIVE_ONLY',
  legacyDevEscapeHatch:
    'FASHION_KNOWLEDGE_LEGACY_MCE_FASHION_ALLOWED=true (default false, non-production)',
});

export function isLegacyMceFashionAllowed(
  getEnv: (key: string, def?: string) => string | undefined = (k, d) =>
    process.env[k] ?? d,
): boolean {
  const v = (
    getEnv('FASHION_KNOWLEDGE_LEGACY_MCE_FASHION_ALLOWED', 'false') ?? 'false'
  )
    .trim()
    .toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}
