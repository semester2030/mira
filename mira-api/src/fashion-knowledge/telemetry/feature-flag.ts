/**
 * FK-9 — Feature flag (default false).
 */
export function isFashionKnowledgeTelemetryEnabled(
  getEnv: (key: string, def?: string) => string | undefined = (k, d) =>
    process.env[k] ?? d,
): boolean {
  const v = (getEnv('FASHION_KNOWLEDGE_TELEMETRY_ENABLED', 'false') ?? 'false')
    .trim()
    .toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}
