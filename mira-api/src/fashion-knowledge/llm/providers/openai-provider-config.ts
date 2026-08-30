/**
 * AT-2 — Production OpenAI transport config for Fashion Knowledge Mode B.
 * Reuses shared LLM_* secrets; optional FASHION_KNOWLEDGE_LLM_* overrides.
 * Does not enable Mode B (flag remains separate).
 */

export interface FashionLlmConfigReader {
  get<T = string>(key: string, defaultValue?: T): T | undefined;
}

export interface ProductionFashionLlmConfig {
  readonly configured: boolean;
  readonly apiKey?: string;
  readonly baseUrl: string;
  readonly model: string;
  readonly temperature: number;
  readonly timeoutMs: number;
  readonly maxOutputTokens: number;
  readonly providerId: string;
}

function readTrimmed(
  config: FashionLlmConfigReader,
  key: string,
  fallback?: string,
): string | undefined {
  const raw = config.get<string>(key, fallback as string | undefined);
  if (raw == null) return undefined;
  const trimmed = String(raw).trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readNumber(
  config: FashionLlmConfigReader,
  key: string,
  fallback: number,
): number {
  const raw = config.get<string | number>(key, fallback as unknown as string);
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Resolve production transport settings.
 * Priority: FASHION_KNOWLEDGE_LLM_* override → shared LLM_* → safe default.
 */
export function resolveProductionFashionLlmConfig(
  config: FashionLlmConfigReader,
): ProductionFashionLlmConfig {
  const apiKey = readTrimmed(config, 'LLM_API_KEY');
  const baseUrl =
    readTrimmed(config, 'FASHION_KNOWLEDGE_LLM_BASE_URL') ??
    readTrimmed(config, 'LLM_BASE_URL') ??
    'https://api.openai.com/v1';
  const model =
    readTrimmed(config, 'FASHION_KNOWLEDGE_LLM_MODEL') ??
    readTrimmed(config, 'LLM_MODEL') ??
    'gpt-4o-mini';
  const temperature = Math.min(
    0.3,
    Math.max(
      0,
      readNumber(
        config,
        'FASHION_KNOWLEDGE_LLM_TEMPERATURE',
        readNumber(config, 'LLM_TEMPERATURE', 0.2),
      ),
    ),
  );
  const timeoutMs = Math.max(
    1000,
    readNumber(
      config,
      'FASHION_KNOWLEDGE_LLM_TIMEOUT_MS',
      readNumber(config, 'LLM_TIMEOUT_MS', 15000),
    ),
  );
  const maxOutputTokens = Math.max(
    256,
    Math.min(
      4096,
      readNumber(config, 'FASHION_KNOWLEDGE_LLM_MAX_OUTPUT_TOKENS', 1200),
    ),
  );
  const providerId =
    readTrimmed(config, 'FASHION_KNOWLEDGE_LLM_PROVIDER') ??
    'openai-fashion-knowledge-llm';

  return {
    configured: Boolean(apiKey),
    apiKey,
    baseUrl,
    model,
    temperature,
    timeoutMs,
    maxOutputTokens,
    providerId,
  };
}

export function normalizeLlmBaseUrl(baseUrl: string): string | null {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (!/^https:\/\//i.test(trimmed)) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'https:') return null;
    return trimmed;
  } catch {
    return null;
  }
}
