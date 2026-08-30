/**
 * FK-2/FK-3/FK-4 — Extension ports.
 */
import type { FashionAdviceCandidateDraft } from '../advice/advice-candidate';
import type { FashionAdviceCandidate } from '../advice/advice-candidate';
import type { FashionKnowledgeRule } from '../knowledge/fashion-knowledge-rule';
import type { FashionClaimLockResult } from '../contracts/claim-lock';
import type { FashionClaimLockContext } from '../runtime/evaluation-context';
import type { FashionKnowledgeLlmPort } from '../llm/provider-port';
import type { FashionKnowledgeRegistryStorePort } from '../registry/storage';

/** @deprecated Prefer FashionKnowledgeLlmPort from llm/provider-port */
export interface FashionLlmCandidateProviderPort {
  readonly produceDraft: (input: {
    readonly contextJson: string;
    readonly clockNowIso: string;
  }) => Promise<FashionAdviceCandidateDraft>;
}

export type { FashionKnowledgeLlmPort };

/** FK-4 — knowledge registry store port (implemented under registry/). */
export type FashionKnowledgeRegistryPort = FashionKnowledgeRegistryStorePort;

/** FK-5+ — curated rule matcher (unimplemented beyond registry lookup). */
export interface FashionCuratedRuleMatcherPort {
  readonly match: (input: {
    readonly factTokens: ReadonlySet<string>;
    readonly occasionTokens: ReadonlySet<string>;
  }) => Promise<FashionKnowledgeRule[]>;
}

/** FK-9 — telemetry sink (unimplemented). */
export interface FashionKnowledgeTelemetryPort {
  readonly recordClaimLock: (result: FashionClaimLockResult) => void;
}

/** FK-10 — Advisor Envelope projection (unimplemented). */
export interface FashionAdvisorEnvelopeProjectionPort {
  readonly projectLockedCandidate: (input: {
    readonly candidate: FashionAdviceCandidate;
    readonly lock: FashionClaimLockResult;
    readonly context: FashionClaimLockContext;
  }) => Promise<{ envelopeFragmentId: string }>;
}

export const FASHION_KNOWLEDGE_PORTS = Object.freeze({
  llmCandidateProvider: 'FashionKnowledgeLlmPort',
  knowledgeRegistry: 'FashionKnowledgeRegistryPort',
  curatedRuleMatcher: 'FashionCuratedRuleMatcherPort',
  telemetry: 'FashionKnowledgeTelemetryPort',
  advisorEnvelopeProjection: 'FashionAdvisorEnvelopeProjectionPort',
});
