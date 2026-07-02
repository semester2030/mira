import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MceAssistantPayloadV1 } from '../contracts/mce-context-snapshot.v1';

@Injectable()
export class MceLlmService {
  private readonly logger = new Logger(MceLlmService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('LLM_API_KEY')?.trim());
  }

  async complete(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
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

    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.25,
        max_tokens: 800,
        response_format: { type: 'json_object' },
        messages,
      }),
    });

    if (!response.ok) {
      this.logger.error(`MCE LLM HTTP ${response.status}`);
      throw new BadGatewayException({
        code: 'MCE_LLM_FAILED',
        message: 'فشل نموذج الاستشارة',
      });
    }

    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { completion_tokens?: number };
    };
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
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
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

    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.25,
        max_tokens: 800,
        stream: true,
        response_format: { type: 'json_object' },
        messages,
      }),
    });

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
  }
}
