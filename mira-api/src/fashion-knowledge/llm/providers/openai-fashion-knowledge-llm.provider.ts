/**
 * AT-2 — Production Fashion Knowledge LLM provider (OpenAI Chat Completions).
 * Implements FashionKnowledgeLlmPort. Does NOT call MceLlmService.
 * Structured draft only — fail-closed. No mock fallback.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FashionLlmPromptBundle } from '../prompt-builder';
import type { FashionLlmKnowledgeRequest } from '../request-contract';
import type {
  FashionKnowledgeLlmPort,
  FashionLlmProviderResult,
} from '../provider-port';
import { parseOpenAiFashionDraftJson } from './openai-fashion-draft.parser';
import {
  OPENAI_FASHION_DRAFT_RESPONSE_FORMAT,
} from './openai-fashion-draft.schema';
import {
  normalizeLlmBaseUrl,
  resolveProductionFashionLlmConfig,
  type FashionLlmConfigReader,
  type ProductionFashionLlmConfig,
} from './openai-provider-config';

export type FashionLlmHttpFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export interface OpenAiFashionKnowledgeLlmProviderDeps {
  readonly config: FashionLlmConfigReader;
  readonly fetchImpl?: FashionLlmHttpFetch;
  readonly logger?: Pick<Logger, 'warn' | 'error' | 'log'>;
}

@Injectable()
export class OpenAiFashionKnowledgeLlmProvider
  implements FashionKnowledgeLlmPort
{
  readonly providerId: string;
  private readonly logger: Pick<Logger, 'warn' | 'error' | 'log'>;
  private readonly fetchImpl: FashionLlmHttpFetch;
  private readonly configReader: FashionLlmConfigReader;

  constructor(
    configOrDeps: ConfigService | OpenAiFashionKnowledgeLlmProviderDeps,
    fetchImpl?: FashionLlmHttpFetch,
  ) {
    if (
      configOrDeps &&
      typeof configOrDeps === 'object' &&
      'config' in configOrDeps
    ) {
      this.configReader = configOrDeps.config;
      this.fetchImpl = configOrDeps.fetchImpl ?? fetch;
      this.logger =
        configOrDeps.logger ??
        new Logger(OpenAiFashionKnowledgeLlmProvider.name);
    } else {
      this.configReader = configOrDeps as FashionLlmConfigReader;
      this.fetchImpl = fetchImpl ?? fetch;
      this.logger = new Logger(OpenAiFashionKnowledgeLlmProvider.name);
    }
    this.providerId =
      resolveProductionFashionLlmConfig(this.configReader).providerId;
  }

  /** True when LLM_API_KEY is present — distinct from Mode B feature flag. */
  isConfigured(): boolean {
    return resolveProductionFashionLlmConfig(this.configReader).configured;
  }

  async generateStructuredDraft(input: {
    readonly request: FashionLlmKnowledgeRequest;
    readonly prompt: FashionLlmPromptBundle;
  }): Promise<FashionLlmProviderResult> {
    const started = Date.now();
    const cfg = resolveProductionFashionLlmConfig(this.configReader);

    if (!cfg.apiKey) {
      this.logger.warn(
        `Fashion Knowledge LLM not configured (trace=${input.request.traceId})`,
      );
      return {
        status: 'failed',
        errorCode: 'PROVIDER_CONFIG_MISSING',
        errorMessage: 'LLM_API_KEY missing',
        providerAuditId: `fk_llm_cfg_${input.request.requestId}`,
        latencyMs: Date.now() - started,
      };
    }

    const baseUrl = normalizeLlmBaseUrl(cfg.baseUrl);
    if (!baseUrl) {
      return {
        status: 'failed',
        errorCode: 'PROVIDER_CONFIG_INVALID',
        errorMessage: 'LLM_BASE_URL must be https',
        providerAuditId: `fk_llm_url_${input.request.requestId}`,
        latencyMs: Date.now() - started,
      };
    }

    const url = `${baseUrl}/chat/completions`;
    const body = this.buildRequestBody(cfg, input.prompt, input.request);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        return this.mapHttpFailure(
          response.status,
          input.request,
          Date.now() - started,
        );
      }

      const payload = (await response.json()) as {
        id?: string;
        choices?: Array<{ message?: { content?: string } }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
        };
      };

      const content = payload.choices?.[0]?.message?.content;
      if (!content?.trim()) {
        return {
          status: 'malformed',
          errorCode: 'malformed_json',
          errorMessage: 'Empty provider content',
          providerAuditId: payload.id ?? `fk_llm_empty_${input.request.requestId}`,
          latencyMs: Date.now() - started,
        };
      }

      const parsed = parseOpenAiFashionDraftJson(content);
      if (!parsed.ok) {
        return {
          status: 'malformed',
          errorCode: parsed.errorCode,
          errorMessage: parsed.errorMessage,
          // rawText omitted from logs; keep briefly for orchestrator retry only
          rawText: content.slice(0, 500),
          providerAuditId: payload.id ?? `fk_llm_bad_${input.request.requestId}`,
          latencyMs: Date.now() - started,
          tokenUsage: {
            promptTokens: payload.usage?.prompt_tokens,
            completionTokens: payload.usage?.completion_tokens,
          },
        };
      }

      this.logger.log(
        `Fashion Knowledge LLM ok model=${cfg.model} latencyMs=${Date.now() - started} trace=${input.request.traceId}`,
      );

      return {
        status: 'ok',
        draft: parsed.draft,
        providerAuditId: payload.id ?? `fk_llm_ok_${input.request.requestId}`,
        latencyMs: Date.now() - started,
        tokenUsage: {
          promptTokens: payload.usage?.prompt_tokens,
          completionTokens: payload.usage?.completion_tokens,
        },
      };
    } catch (err) {
      const name = err instanceof Error ? err.name : 'Error';
      const aborted =
        name === 'AbortError' ||
        (err instanceof Error && /aborted|timeout/i.test(err.message));
      if (aborted) {
        this.logger.warn(
          `Fashion Knowledge LLM timeout (${cfg.timeoutMs}ms) trace=${input.request.traceId}`,
        );
        return {
          status: 'timeout',
          errorCode: 'timeout',
          errorMessage: 'Provider timeout',
          providerAuditId: `fk_llm_timeout_${input.request.requestId}`,
          latencyMs: Date.now() - started,
        };
      }
      this.logger.error(
        `Fashion Knowledge LLM network failure class=${name} trace=${input.request.traceId}`,
      );
      return {
        status: 'failed',
        errorCode: 'transient_provider_error',
        errorMessage: 'Provider network failure',
        providerAuditId: `fk_llm_net_${input.request.requestId}`,
        latencyMs: Date.now() - started,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildRequestBody(
    cfg: ProductionFashionLlmConfig,
    prompt: FashionLlmPromptBundle,
    request: FashionLlmKnowledgeRequest,
  ): Record<string, unknown> {
    const userContent = [
      prompt.userPayloadJson,
      '',
      'Return ONE JSON object matching FashionAdviceCandidateDraft.',
      'No markdown. No prose outside JSON. No chain-of-thought.',
      `schemaVersion must be "${request.schemaVersion.includes('fashion') ? 'fashion-advice-candidate-v1' : 'fashion-advice-candidate-v1'}".`,
      `createdAt must equal "${request.clockNowIso}".`,
      `traceId must equal "${request.traceId}".`,
      `evidenceRefs must be a subset of the request evidenceRefs.`,
      'Field structure, enum values and casing are enforced by the strict response JSON Schema.',
    ].join('\n');

    return {
      model: cfg.model,
      temperature: cfg.temperature,
      max_tokens: cfg.maxOutputTokens,
      response_format: OPENAI_FASHION_DRAFT_RESPONSE_FORMAT,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: userContent },
      ],
    };
  }

  private mapHttpFailure(
    status: number,
    request: FashionLlmKnowledgeRequest,
    latencyMs: number,
  ): FashionLlmProviderResult {
    if (status === 401 || status === 403) {
      this.logger.error(
        `Fashion Knowledge LLM auth failure HTTP ${status} trace=${request.traceId}`,
      );
      return {
        status: 'failed',
        errorCode: 'PROVIDER_AUTH_FAILURE',
        errorMessage: `HTTP ${status}`,
        providerAuditId: `fk_llm_http_${status}_${request.requestId}`,
        latencyMs,
      };
    }
    if (status === 429) {
      this.logger.warn(
        `Fashion Knowledge LLM rate limited HTTP 429 trace=${request.traceId}`,
      );
      return {
        status: 'failed',
        errorCode: 'transient_provider_error',
        errorMessage: 'HTTP 429',
        providerAuditId: `fk_llm_http_429_${request.requestId}`,
        latencyMs,
      };
    }
    if (status >= 500) {
      this.logger.warn(
        `Fashion Knowledge LLM upstream HTTP ${status} trace=${request.traceId}`,
      );
      return {
        status: 'failed',
        errorCode: 'transient_provider_error',
        errorMessage: `HTTP ${status}`,
        providerAuditId: `fk_llm_http_${status}_${request.requestId}`,
        latencyMs,
      };
    }
    this.logger.error(
      `Fashion Knowledge LLM HTTP ${status} trace=${request.traceId}`,
    );
    return {
      status: 'failed',
      errorCode: 'provider_failed',
      errorMessage: `HTTP ${status}`,
      providerAuditId: `fk_llm_http_${status}_${request.requestId}`,
      latencyMs,
    };
  }
}
