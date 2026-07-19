import type { AdvisorEvidenceUnit } from '../contracts/advisor-evidence-envelope';
import type { ConversationState } from '../contracts/conversation-state';
import { emptyConversationState } from '../contracts/conversation-state';
import type {
  AdvisorMemoryRefs,
  ConversationMemory,
  SessionMemory,
} from '../contracts/advisor-memory';
import {
  emptyAdvisorMemoryRefs,
  emptyConversationMemory,
  emptySessionMemory,
} from '../contracts/advisor-memory';
import type { AdvisorRuntime } from '../contracts/advisor-runtime';
import { advisorRuntime } from '../contracts/advisor-runtime';
import type { ConversationPlan } from '../contracts/planner-contracts';
import type { AdvisorEvidenceEnvelope } from '../contracts/advisor-evidence-envelope';
import type { GroundedAdvisorResponse } from '../response/grounded-response-engine';
import { detectAdvisorIntent } from './intent-detection';
import { routeCapability } from '../routing/capability-router';
import { sealAdvisorEvidenceEnvelope } from '../envelope/envelope-builder';
import { planConversation } from '../planner/conversation-planner';
import { generateGroundedResponse } from '../response/grounded-response-engine';
import {
  appendConversationTurn,
  bindSessionEvidenceRef,
  evolveMemoryRefs,
} from '../memory/advisor-memory-store';
import {
  assertFreshForGrounded,
  assertLaw34,
  assertPlannerConsistency,
  assertValidEnvelope,
  validateEnvelopeCompleteness,
  validateExpiredEvidence,
  validateLaw34Response,
  validatePlannerConsistency,
} from '../validation/advisor-validators';

export interface AdvisorTurnInput {
  sessionId: string;
  message: string;
  /** Pre-projected public evidence units — never frozen internals. */
  evidenceUnits?: AdvisorEvidenceUnit[];
  limitations?: string[];
  conversationState?: ConversationState;
  conversationMemory?: ConversationMemory;
  sessionMemory?: SessionMemory;
  memoryRefs?: AdvisorMemoryRefs;
  now?: string;
  /** Force blocked safety path (façade guard). */
  forceBlocked?: boolean;
}

export interface AdvisorTurnResult {
  response: GroundedAdvisorResponse;
  envelope: AdvisorEvidenceEnvelope;
  plan: ConversationPlan;
  runtime: AdvisorRuntime;
  conversationState: ConversationState;
  conversationMemory: ConversationMemory;
  sessionMemory: SessionMemory;
  memoryRefs: AdvisorMemoryRefs;
  intent: ReturnType<typeof detectAdvisorIntent>;
  validation: {
    envelopeOk: boolean;
    plannerOk: boolean;
    law34Ok: boolean;
    expiryOk: boolean;
  };
}

/**
 * Conversation Engine — multi-turn orchestration over sealed envelopes only.
 */
export function runAdvisorTurn(input: AdvisorTurnInput): AdvisorTurnResult {
  const now = input.now ?? new Date().toISOString();
  let state =
    input.conversationState ?? emptyConversationState(input.sessionId);
  let conversationMemory =
    input.conversationMemory ?? emptyConversationMemory(input.sessionId);
  let sessionMemory =
    input.sessionMemory ?? emptySessionMemory(input.sessionId);
  let memoryRefs = input.memoryRefs ?? emptyAdvisorMemoryRefs();

  const intent = input.forceBlocked
    ? 'blocked'
    : detectAdvisorIntent(input.message);
  const route = routeCapability(intent);

  conversationMemory = appendConversationTurn(conversationMemory, {
    role: 'user',
    textAr: input.message,
    intent,
    at: now,
  });

  const sealAndPlan = (units: AdvisorEvidenceUnit[], limitations?: string[]) => {
    const envelope = sealAdvisorEvidenceEnvelope({
      sessionId: input.sessionId,
      units,
      limitations,
      now,
    });
    assertValidEnvelope(envelope);
    const expiryCheck = validateExpiredEvidence(envelope);
    const plan = planConversation({ intent, envelope, route });
    assertPlannerConsistency(envelope, plan);
    assertFreshForGrounded(envelope, plan);
    const response = generateGroundedResponse({ plan, envelope });
    assertLaw34(envelope, response);
    return { envelope, plan, response, expiryCheck };
  };

  if (intent === 'blocked') {
    const { envelope, plan, response, expiryCheck } = sealAndPlan([], [
      'blocked_safety',
    ]);
    const runtime = advisorRuntime({
      status: 'blocked',
      reasonCode: 'blocked_safety',
      stage: 'terminal',
      traceId: envelope.traceability.traceId,
      envelopeId: envelope.envelopeId,
      sessionId: input.sessionId,
      retryable: false,
    });
    state = {
      ...state,
      turnIndex: state.turnIndex + 1,
      lastIntent: intent,
      lastEnvelopeId: envelope.envelopeId,
      pendingClarifications: [],
      openActions: [],
    };
    conversationMemory = appendConversationTurn(conversationMemory, {
      role: 'assistant',
      textAr: response.answerAr,
      intent,
      citedClaimKeys: response.citedClaimKeys,
      envelopeId: envelope.envelopeId,
      at: now,
    });
    memoryRefs = evolveMemoryRefs(memoryRefs, {
      lastEnvelopeId: envelope.envelopeId,
      historyRefs: [envelope.envelopeId],
    });
    return {
      response,
      envelope,
      plan,
      runtime,
      conversationState: state,
      conversationMemory,
      sessionMemory,
      memoryRefs,
      intent,
      validation: {
        envelopeOk: true,
        plannerOk: true,
        law34Ok: true,
        expiryOk: expiryCheck.ok,
      },
    };
  }

  const { envelope, plan, response, expiryCheck } = sealAndPlan(
    input.evidenceUnits ?? [],
    input.limitations,
  );
  const envCheck = validateEnvelopeCompleteness(envelope);
  const planCheck = validatePlannerConsistency(envelope, plan);
  const law34Check = validateLaw34Response(envelope, response);

  let status: AdvisorRuntime['status'] = 'conversation';
  if (plan.answerStrategy === 'clarify') {
    status =
      plan.primaryReasonCode === 'expired_evidence' ? 'waiting' : 'clarification';
  } else if (plan.answerStrategy === 'unsupported') status = 'unsupported';
  else if (plan.answerStrategy === 'refuse') status = 'blocked';
  else if (plan.primaryReasonCode === 'advisor_ok') status = 'completed';
  else if (plan.primaryReasonCode === 'low_confidence') status = 'degraded';
  else status = 'waiting';

  const runtime = advisorRuntime({
    status,
    reasonCode: plan.primaryReasonCode,
    stage: 'terminal',
    traceId: envelope.traceability.traceId,
    envelopeId: envelope.envelopeId,
    sessionId: input.sessionId,
    capabilityId: route.capabilityHints[0],
  });

  const pendingClarifications = plan.steps
    .filter((s) => s.kind === 'clarify' && s.clarificationAr)
    .map((s) => s.clarificationAr!);
  const openActions = plan.steps
    .filter((s) => s.kind === 'route_action' && s.action)
    .map((s) => s.action!);

  state = {
    ...state,
    turnIndex: state.turnIndex + 1,
    lastIntent: intent,
    lastEnvelopeId: envelope.envelopeId,
    pendingClarifications,
    openActions,
  };

  conversationMemory = appendConversationTurn(conversationMemory, {
    role: 'assistant',
    textAr: response.answerAr,
    intent,
    citedClaimKeys: response.citedClaimKeys,
    envelopeId: envelope.envelopeId,
    at: now,
  });

  for (const ref of envelope.traceability.sourceRefs) {
    sessionMemory = bindSessionEvidenceRef(
      sessionMemory,
      ref,
      envelope.subsystemIds[0],
    );
  }
  for (const eid of envelope.evidenceIds) {
    sessionMemory = bindSessionEvidenceRef(sessionMemory, eid);
  }

  memoryRefs = evolveMemoryRefs(memoryRefs, {
    lastEnvelopeId: envelope.envelopeId,
    historyRefs: [envelope.envelopeId],
  });

  return {
    response,
    envelope,
    plan,
    runtime,
    conversationState: state,
    conversationMemory,
    sessionMemory,
    memoryRefs,
    intent,
    validation: {
      envelopeOk: envCheck.ok,
      plannerOk: planCheck.ok,
      law34Ok: law34Check.ok,
      expiryOk: expiryCheck.ok,
    },
  };
}
