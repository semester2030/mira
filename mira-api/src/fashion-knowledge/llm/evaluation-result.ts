/**
 * FK-3 — Internal evaluation result (never public HTTP / Advisor).
 */
import type { FashionAdviceCandidate } from '../advice/advice-candidate';
import type { FashionClaimLockResult } from '../contracts/claim-lock';
import type { FashionLlmRuntimeState } from './runtime';
import type { FashionAdviceCandidateDraft } from '../advice/advice-candidate';

export interface FashionKnowledgeLlmEvaluationResult {
  readonly candidate?: FashionAdviceCandidate;
  readonly draft?: FashionAdviceCandidateDraft;
  readonly claimLockResult?: FashionClaimLockResult;
  readonly runtime: FashionLlmRuntimeState;
  readonly audit: {
    readonly requestId: string;
    readonly traceId: string;
    readonly claimLockInvoked: boolean;
    readonly sourceForcedUncurated: boolean;
    readonly featureFlagEnabled: boolean;
    readonly providerId?: string;
    readonly injectionFlags: readonly string[];
    readonly validationIssueCodes: readonly string[];
    readonly curatedPrecedenceWinner?: string;
  };
}
