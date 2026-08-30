/**
 * FK-7 — Feature flag (default false).
 */
export function isFashionKnowledgeFormSilhouetteEnabled(
  getEnv: (key: string, def?: string) => string | undefined = (k, d) =>
    process.env[k] ?? d,
): boolean {
  const v = (getEnv('FASHION_KNOWLEDGE_FORM_SILHOUETTE_ENABLED', 'false') ??
    'false')
    .trim()
    .toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}
