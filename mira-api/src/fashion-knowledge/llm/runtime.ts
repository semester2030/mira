/**
 * FK-3 — LLM adapter runtime (does not redefine frozen Fashion Runtime).
 */
import { FASHION_LLM_RUNTIME_VERSION } from '../versioning/release';

export const FashionLlmRuntimeStage = {
  CONTEXT_PROJECTION: 'context_projection',
  PROMPT_BUILD: 'prompt_build',
  PROVIDER_CALL: 'provider_call',
  STRUCTURED_PARSE: 'structured_parse',
  DRAFT_VALIDATION: 'draft_validation',
  CANDIDATE_MAPPING: 'candidate_mapping',
  CLAIM_LOCK: 'claim_lock',
  TERMINAL: 'terminal',
} as const;

export type FashionLlmRuntimeStage =
  (typeof FashionLlmRuntimeStage)[keyof typeof FashionLlmRuntimeStage];

export const FashionLlmRuntimeStatus = {
  AVAILABLE: 'AVAILABLE',
  DEGRADED: 'DEGRADED',
  FAILED: 'FAILED',
  BLOCKED: 'BLOCKED',
  NEED_CLARIFICATION: 'NEED_CLARIFICATION',
  DISABLED: 'DISABLED',
  QUALIFIED: 'QUALIFIED',
  PASSED: 'PASSED',
} as const;

export type FashionLlmRuntimeStatus =
  (typeof FashionLlmRuntimeStatus)[keyof typeof FashionLlmRuntimeStatus];

export interface FashionLlmRuntimeState {
  readonly version: typeof FASHION_LLM_RUNTIME_VERSION | string;
  readonly stage: FashionLlmRuntimeStage;
  readonly status: FashionLlmRuntimeStatus;
  readonly reasonCode: string;
  readonly retryable: boolean;
  readonly traceId: string;
  readonly candidateId?: string;
  /** Server-audit only */
  readonly providerAuditId?: string;
  readonly attempts: number;
}

export function makeRuntime(partial: {
  stage: FashionLlmRuntimeStage;
  status: FashionLlmRuntimeStatus;
  reasonCode: string;
  retryable: boolean;
  traceId: string;
  candidateId?: string;
  providerAuditId?: string;
  attempts?: number;
}): FashionLlmRuntimeState {
  return {
    version: FASHION_LLM_RUNTIME_VERSION,
    stage: partial.stage,
    status: partial.status,
    reasonCode: partial.reasonCode,
    retryable: partial.retryable,
    traceId: partial.traceId,
    candidateId: partial.candidateId,
    providerAuditId: partial.providerAuditId,
    attempts: partial.attempts ?? 0,
  };
}
