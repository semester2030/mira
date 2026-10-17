import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MceAssistantPayloadV1 } from '../contracts/mce-context-snapshot.v1';
import { LlmContentPart } from './consultation-dialogue';

export type MceLlmMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | LlmContentPart[];
};

export const MCE_LLM_TIMEOUT_DEFAULT_MS = 30_000;

/** Applied completion cap in complete() and stream(). Cost estimates must not treat this as the average. */
export const MCE_LLM_MAX_COMPLETION_TOKENS = 800;

/** Invalid or missing values keep a real deadline. They do not turn the timeout off. */
export function readLlmTimeoutMs(value: unknown): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 1) return MCE_LLM_TIMEOUT_DEFAULT_MS;
  return Math.floor(parsed);
}

export interface MceLlmCallOptions {
  signal?: AbortSignal;
}

@Injectable()
export class MceLlmService {
  private readonly logger = new Logger(MceLlmService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('LLM_API_KEY')?.trim());
  }

  configuredModel(): string {
    return this.config.get<string>('MCE_LLM_MODEL') ?? this.config.get<string>('LLM_MODEL', 'gpt-4o-mini');
  }

  async complete(
    messages: MceLlmMessage[],
    options?: MceLlmCallOptions,
  ): Promise<{ payload: MceAssistantPayloadV1; modelId: string; tokenCountOut?: number }> {
    const apiKey = this.config.get<string>('LLM_API_KEY')?.trim();
    const baseUrl = this.config.get<string>('LLM_BASE_URL', 'https://api.openai.com/v1');
    const model = this.config.get<string>('MCE_LLM_MODEL') ?? this.config.get<string>('LLM_MODEL', 'gpt-4o-mini');

    if (!apiKey) {
      throw new ServiceUnavailableException({
        code: 'MCE_LLM_NOT_CONFIGURED',
        message: 'LLM_API_KEY غير مضبوط على السيرفر',
      });
    }

    const deadline = this.deadline(options?.signal);
    const response = await this.fetchWithDeadline(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.25,
        max_tokens: MCE_LLM_MAX_COMPLETION_TOKENS,
        response_format: { type: 'json_object' },
        messages,
      }),
    }, deadline, options?.signal);

    if (!response.ok) {
      this.logger.error(`MCE LLM HTTP ${response.status}`);
      throw new BadGatewayException({
        code: 'MCE_LLM_FAILED',
        message: 'فشل نموذج الاستشارة',
      });
    }

    let body: {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { completion_tokens?: number };
    };
    try {
      body = (await response.json()) as typeof body;
    } catch (error) {
      throw this.mapTransportError(error, options?.signal, deadline.timeoutSignal);
    }
    const content = body.choices?.[0]?.message?.content;
    if (!content) {
      throw new BadGatewayException({ code: 'MCE_LLM_EMPTY', message: 'رد فارغ من النموذج' });
    }

    let parsed: MceAssistantPayloadV1;
    try {
      parsed = JSON.parse(content) as MceAssistantPayloadV1;
    } catch {
      parsed = {
        answerAr: content,
        confidence: 'medium',
        intent: 'parse_fallback',
        citedFactIds: [],
        suggestedQuestionsAr: [],
        blocked: false,
        disclaimerAr: '',
      };
    }

    return {
      payload: parsed,
      modelId: model,
      tokenCountOut: body.usage?.completion_tokens,
    };
  }

  /** Stream raw completion chunks (JSON object assembled by caller). */
  async *stream(
    messages: MceLlmMessage[],
    options?: MceLlmCallOptions,
  ): AsyncGenerator<string> {
    const apiKey = this.config.get<string>('LLM_API_KEY')?.trim();
    const baseUrl = this.config.get<string>('LLM_BASE_URL', 'https://api.openai.com/v1');
    const model = this.config.get<string>('MCE_LLM_MODEL') ?? this.config.get<string>('LLM_MODEL', 'gpt-4o-mini');

    if (!apiKey) {
      throw new ServiceUnavailableException({
        code: 'MCE_LLM_NOT_CONFIGURED',
        message: 'LLM_API_KEY غير مضبوط على السيرفر',
      });
    }

    const deadline = this.deadline(options?.signal);
    const response = await this.fetchWithDeadline(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.25,
        max_tokens: MCE_LLM_MAX_COMPLETION_TOKENS,
        stream: true,
        response_format: { type: 'json_object' },
        messages,
      }),
    }, deadline, options?.signal);

    if (!response.ok || !response.body) {
      this.logger.error(`MCE LLM stream HTTP ${response.status}`);
      throw new BadGatewayException({
        code: 'MCE_LLM_STREAM_FAILED',
        message: 'فشل بث نموذج الاستشارة',
      });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) yield delta;
          } catch {
            // ignore malformed SSE chunk
          }
        }
      }
    } catch (error) {
      throw this.mapTransportError(error, options?.signal, deadline.timeoutSignal);
    } finally {
      reader.releaseLock();
    }
  }

  private timeoutMs(): number {
    return readLlmTimeoutMs(this.config.get('MCE_LLM_TIMEOUT_MS', MCE_LLM_TIMEOUT_DEFAULT_MS));
  }

  private deadline(external?: AbortSignal): { signal: AbortSignal; timeoutSignal: AbortSignal } {
    const timeoutSignal = AbortSignal.timeout(this.timeoutMs());
    const signal = external ? AbortSignal.any([timeoutSignal, external]) : timeoutSignal;
    return { signal, timeoutSignal };
  }

  private async fetchWithDeadline(
    url: string,
    init: RequestInit,
    deadline: { signal: AbortSignal; timeoutSignal: AbortSignal },
    external?: AbortSignal,
  ): Promise<Response> {
    try {
      return await fetch(url, { ...init, signal: deadline.signal });
    } catch (error) {
      throw this.mapTransportError(error, external, deadline.timeoutSignal);
    }
  }

  private mapTransportError(error: unknown, external?: AbortSignal, timeoutSignal?: AbortSignal): Error {
    const name = error instanceof Error ? error.name : '';
    const timedOut = Boolean(timeoutSignal?.aborted)
      || name === 'TimeoutError'
      || (name === 'AbortError' && !external?.aborted);
    if (timedOut && !external?.aborted) {
      return new ServiceUnavailableException({
        code: 'MCE_LLM_TIMEOUT',
        message: 'استغرقت الاستشارة وقتًا أطول من المهلة. حاولي مرة أخرى.',
      });
    }
    if (external?.aborted) {
      return new ServiceUnavailableException({
        code: 'MCE_CLIENT_CLOSED',
        message: 'أُلغي إرسال الاستشارة',
      });
    }
    return error instanceof Error ? error : new Error('LLM transport failed');
  }
}
