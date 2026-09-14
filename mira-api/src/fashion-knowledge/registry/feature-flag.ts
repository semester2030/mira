/**
 * FK-4 — Feature flag for production registry consumption.
 * Default false. Pure load/test infrastructure may exist without enabling.
 */
export const FASHION_KNOWLEDGE_REGISTRY_FLAG =
  'FASHION_KNOWLEDGE_REGISTRY_ENABLED';

export function isFashionKnowledgeRegistryEnabled(
  getEnv: (key: string, def?: string) => string | undefined = (k, d) =>
    process.env[k] ?? d,
): boolean {
  return (
    (getEnv(FASHION_KNOWLEDGE_REGISTRY_FLAG, 'false') ?? 'false') === 'true'
  );
}
