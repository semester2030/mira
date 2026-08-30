/**
 * FK-3 — Provider-independent configuration (env-driven, no secrets in code).
 */
export interface FashionLlmAdapterConfig {
  readonly enabled: boolean;
  readonly providerId: string;
  readonly model: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly temperature: number;
  readonly maxOutputTokens: number;
  /** Server-audit only — never place in public contracts. */
  readonly baseUrl?: string;
}

export function resolveFashionLlmAdapterConfig(
  getEnv: (key: string, def?: string) => string | undefined = (k, d) =>
    process.env[k] ?? d,
): FashionLlmAdapterConfig {
  const enabled =
    (getEnv('FASHION_KNOWLEDGE_LLM_ENABLED', 'false') ?? 'false') === 'true';
  return {
    enabled,
    providerId: getEnv('FASHION_KNOWLEDGE_LLM_PROVIDER', 'none') ?? 'none',
    model: getEnv('FASHION_KNOWLEDGE_LLM_MODEL', 'unconfigured') ?? 'unconfigured',
    timeoutMs: Number(getEnv('FASHION_KNOWLEDGE_LLM_TIMEOUT_MS', '15000') ?? '15000'),
    maxRetries: Number(getEnv('FASHION_KNOWLEDGE_LLM_MAX_RETRIES', '1') ?? '1'),
    temperature: Number(getEnv('FASHION_KNOWLEDGE_LLM_TEMPERATURE', '0.2') ?? '0.2'),
    maxOutputTokens: Number(
      getEnv('FASHION_KNOWLEDGE_LLM_MAX_OUTPUT_TOKENS', '1200') ?? '1200',
    ),
    baseUrl: getEnv('FASHION_KNOWLEDGE_LLM_BASE_URL'),
  };
}
