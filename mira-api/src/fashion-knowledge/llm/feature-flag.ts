/**
 * FK-3 — Feature flag. Default false — adapter must not execute when off.
 */
export const FASHION_KNOWLEDGE_LLM_FLAG = 'FASHION_KNOWLEDGE_LLM_ENABLED';

export function isFashionKnowledgeLlmEnabled(
  getEnv: (key: string, def?: string) => string | undefined = (k, d) =>
    process.env[k] ?? d,
): boolean {
  return (getEnv(FASHION_KNOWLEDGE_LLM_FLAG, 'false') ?? 'false') === 'true';
}
