import { Injectable } from '@nestjs/common';
import {
  runAdvisorTurn,
  type AdvisorTurnInput,
  type AdvisorTurnResult,
} from './conversation/conversation-engine';
import type { AdvisorEvidenceUnit } from './contracts/advisor-evidence-envelope';
import type { ConversationState } from './contracts/conversation-state';
import type {
  AdvisorMemoryRefs,
  ConversationMemory,
  SessionMemory,
} from './contracts/advisor-memory';
import { BEAUTY_ADVISOR_RELEASE } from './release';

export interface BeautyAdvisorChatRequest {
  sessionId: string;
  message: string;
  evidenceUnits?: AdvisorEvidenceUnit[];
  limitations?: string[];
  forceBlocked?: boolean;
  /** Optional multi-turn continuity (caller-owned). */
  prior?: Pick<
    AdvisorTurnInput,
    | 'conversationState'
    | 'conversationMemory'
    | 'sessionMemory'
    | 'memoryRefs'
  >;
  /** When true, load/store session continuity in the service map. */
  persistSession?: boolean;
}

interface SessionBundle {
  conversationState: ConversationState;
  conversationMemory: ConversationMemory;
  sessionMemory: SessionMemory;
  memoryRefs: AdvisorMemoryRefs;
}

/**
 * Beauty Advisor Service — orchestration façade for Phase 7B / 7B.1.
 * Never evaluates Skin/Face/Garment/Outfit/Styling.
 * In-memory session map enables HTTP multi-turn continuity.
 */
@Injectable()
export class BeautyAdvisorService {
  readonly release = BEAUTY_ADVISOR_RELEASE;
  private readonly sessions = new Map<string, SessionBundle>();

  turn(request: BeautyAdvisorChatRequest): AdvisorTurnResult {
    const persist = request.persistSession !== false;
    const prior =
      request.prior ??
      (persist ? this.sessions.get(request.sessionId) : undefined);

    const result = runAdvisorTurn({
      sessionId: request.sessionId,
      message: request.message,
      evidenceUnits: request.evidenceUnits,
      limitations: request.limitations,
      forceBlocked: request.forceBlocked,
      conversationState: prior?.conversationState,
      conversationMemory: prior?.conversationMemory,
      sessionMemory: prior?.sessionMemory,
      memoryRefs: prior?.memoryRefs,
    });

    if (persist) {
      this.sessions.set(request.sessionId, {
        conversationState: result.conversationState,
        conversationMemory: result.conversationMemory,
        sessionMemory: result.sessionMemory,
        memoryRefs: result.memoryRefs,
      });
    }

    return result;
  }

  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  getSessionTurnCount(sessionId: string): number {
    return this.sessions.get(sessionId)?.conversationState.turnIndex ?? 0;
  }
}
