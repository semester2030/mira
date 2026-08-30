/**
 * FK-6 — Feature flag (default false).
 */
export const FASHION_KNOWLEDGE_ACCESSORIES_FLAG =
  'FASHION_KNOWLEDGE_ACCESSORIES_ENABLED';

export function isFashionKnowledgeAccessoriesEnabled(
  getEnv: (key: string, def?: string) => string | undefined = (k, d) =>
    process.env[k] ?? d,
): boolean {
  const v = (getEnv(FASHION_KNOWLEDGE_ACCESSORIES_FLAG, 'false') ?? 'false')
    .trim()
    .toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}
