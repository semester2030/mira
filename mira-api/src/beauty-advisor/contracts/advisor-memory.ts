/**
 * Advisor Memory — references only. Never duplicate frozen payloads.
 */
import { ADVISOR_MEMORY_VERSION } from '../release';

export interface AdvisorMemoryRefs {
  version: typeof ADVISOR_MEMORY_VERSION;
  conversationSummaryRef?: string;
  preferenceRefs: string[];
  goalRefs: string[];
  historyRefs: string[];
  longTermRefs: string[];
  lastEnvelopeId?: string;
}

export interface ConversationMemoryTurn {
  turnIndex: number;
  role: 'user' | 'assistant';
  textAr: string;
  intent?: string;
  citedClaimKeys?: string[];
  envelopeId?: string;
  at: string;
}

export interface ConversationMemory {
  version: typeof ADVISOR_MEMORY_VERSION;
  sessionId: string;
  turns: ConversationMemoryTurn[];
  rollingSummaryAr?: string;
}

export interface SessionMemory {
  version: typeof ADVISOR_MEMORY_VERSION;
  sessionId: string;
  boundEvidenceRefs: string[];
  boundSubsystemLabels: string[];
  occasionId?: string;
  locale: string;
  beautySessionRef?: string;
}

export function emptyAdvisorMemoryRefs(): AdvisorMemoryRefs {
  return {
    version: ADVISOR_MEMORY_VERSION,
    preferenceRefs: [],
    goalRefs: [],
    historyRefs: [],
    longTermRefs: [],
  };
}

export function emptyConversationMemory(sessionId: string): ConversationMemory {
  return {
    version: ADVISOR_MEMORY_VERSION,
    sessionId,
    turns: [],
  };
}

export function emptySessionMemory(
  sessionId: string,
  locale = 'ar',
): SessionMemory {
  return {
    version: ADVISOR_MEMORY_VERSION,
    sessionId,
    boundEvidenceRefs: [],
    boundSubsystemLabels: [],
    locale,
  };
}
