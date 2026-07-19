import type {
  AdvisorMemoryRefs,
  ConversationMemory,
  ConversationMemoryTurn,
  SessionMemory,
} from '../contracts/advisor-memory';
import {
  emptyAdvisorMemoryRefs,
  emptyConversationMemory,
  emptySessionMemory,
} from '../contracts/advisor-memory';

/** Append a turn — caller owns persistence. */
export function appendConversationTurn(
  memory: ConversationMemory,
  turn: Omit<ConversationMemoryTurn, 'turnIndex'> & { turnIndex?: number },
): ConversationMemory {
  const turnIndex = turn.turnIndex ?? memory.turns.length;
  const next: ConversationMemory = {
    ...memory,
    turns: [
      ...memory.turns,
      {
        turnIndex,
        role: turn.role,
        textAr: turn.textAr,
        intent: turn.intent,
        citedClaimKeys: turn.citedClaimKeys,
        envelopeId: turn.envelopeId,
        at: turn.at,
      },
    ],
  };
  return next;
}

export function bindSessionEvidenceRef(
  session: SessionMemory,
  ref: string,
  subsystemLabel?: string,
): SessionMemory {
  const boundEvidenceRefs = [...new Set([...session.boundEvidenceRefs, ref])];
  const boundSubsystemLabels = subsystemLabel
    ? [...new Set([...session.boundSubsystemLabels, subsystemLabel])]
    : session.boundSubsystemLabels;
  return { ...session, boundEvidenceRefs, boundSubsystemLabels };
}

export function evolveMemoryRefs(
  refs: AdvisorMemoryRefs,
  patch: Partial<AdvisorMemoryRefs>,
): AdvisorMemoryRefs {
  return {
    version: refs.version,
    conversationSummaryRef:
      patch.conversationSummaryRef ?? refs.conversationSummaryRef,
    preferenceRefs: [
      ...new Set([
        ...refs.preferenceRefs,
        ...(patch.preferenceRefs ?? []),
      ]),
    ],
    goalRefs: [...new Set([...refs.goalRefs, ...(patch.goalRefs ?? [])])],
    historyRefs: [
      ...new Set([...refs.historyRefs, ...(patch.historyRefs ?? [])]),
    ],
    longTermRefs: [
      ...new Set([...refs.longTermRefs, ...(patch.longTermRefs ?? [])]),
    ],
    lastEnvelopeId: patch.lastEnvelopeId ?? refs.lastEnvelopeId,
  };
}

export function createAdvisorMemoryBundle(sessionId: string, locale = 'ar') {
  return {
    conversation: emptyConversationMemory(sessionId),
    session: emptySessionMemory(sessionId, locale),
    refs: emptyAdvisorMemoryRefs(),
  };
}
