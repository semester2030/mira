/**
 * Advisor Runtime — platform-aligned conversation lifecycle.
 */
import { ADVISOR_RUNTIME_VERSION } from '../release';

export type AdvisorRuntimeStatus =
  | 'conversation'
  | 'clarification'
  | 'blocked'
  | 'waiting'
  | 'completed'
  | 'unsupported'
  | 'degraded';

export type AdvisorReasonCode =
  | 'advisor_ok'
  | 'missing_evidence'
  | 'expired_evidence'
  | 'conflicting_evidence'
  | 'low_confidence'
  | 'unsupported_request'
  | 'unknown_capability'
  | 'planner_failure'
  | 'clarification_required'
  | 'blocked_safety'
  | 'forbidden_claim'
  | 'law34_violation';

export interface AdvisorRuntime {
  version: typeof ADVISOR_RUNTIME_VERSION;
  status: AdvisorRuntimeStatus;
  reasonCode: AdvisorReasonCode;
  stage: 'ingress' | 'route' | 'envelope' | 'plan' | 'respond' | 'terminal';
  traceId: string;
  capabilityId?: string;
  envelopeId?: string;
  sessionId?: string;
  /** Whether the client should retry after refresh / clarification. */
  retryable: boolean;
}

export function advisorRuntime(
  partial: Omit<AdvisorRuntime, 'version' | 'retryable'> & {
    retryable?: boolean;
  },
): AdvisorRuntime {
  const retryable =
    partial.retryable ??
    (partial.reasonCode === 'missing_evidence' ||
      partial.reasonCode === 'expired_evidence' ||
      partial.reasonCode === 'clarification_required' ||
      partial.reasonCode === 'low_confidence');
  return {
    version: ADVISOR_RUNTIME_VERSION,
    ...partial,
    retryable,
  };
}
