/**
 * FK-3 — Domain LLM provider port (provider-independent).
 */
import type { FashionAdviceCandidateDraft } from '../advice/advice-candidate';
import type { FashionLlmPromptBundle } from './prompt-builder';
import type { FashionLlmKnowledgeRequest } from './request-contract';

export type FashionLlmProviderCallStatus =
  | 'ok'
  | 'malformed'
  | 'timeout'
  | 'failed'
  | 'blocked';

export interface FashionLlmProviderResult {
  readonly status: FashionLlmProviderCallStatus;
  readonly draft?: FashionAdviceCandidateDraft;
  readonly rawText?: string;
  readonly errorCode?: string;
  readonly errorMessage?: string;
  /** Server-audit only — never copy into public candidate. */
  readonly providerAuditId?: string;
  readonly latencyMs?: number;
  readonly tokenUsage?: {
    readonly promptTokens?: number;
    readonly completionTokens?: number;
  };
}

export interface FashionKnowledgeLlmPort {
  readonly providerId: string;
  readonly generateStructuredDraft: (input: {
    readonly request: FashionLlmKnowledgeRequest;
    readonly prompt: FashionLlmPromptBundle;
  }) => Promise<FashionLlmProviderResult>;
}
