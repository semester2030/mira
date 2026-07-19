import { BeautySession } from '../session/beauty-session';
import { BeautyAttempt } from '../session/beauty-session';
import { BeautyLook } from '../session/beauty-session';

/**
 * History hierarchy: Session → Attempts → Looks
 * Never History → Looks only.
 */
export interface BeautyHistoryAttemptEntry {
  attemptId: string;
  capabilityId: string;
  lookId: string;
  createdAt: string;
  runtimeStatus: string;
}

export interface BeautyHistoryLookEntry {
  lookId: string;
  labelEn?: string;
  labelAr?: string;
  attemptIds: string[];
  createdAt: string;
}

export interface BeautyHistorySessionEntry {
  sessionId: string;
  state: string;
  createdAt: string;
  updatedAt: string;
  analysisSources: BeautySession['analysisSources'];
  attempts: BeautyHistoryAttemptEntry[];
  looks: BeautyHistoryLookEntry[];
}

export interface BeautyHistory {
  userId?: string;
  sessions: BeautyHistorySessionEntry[];
}

export function buildHistoryEntry(
  session: BeautySession,
  attempts: BeautyAttempt[],
  looks: BeautyLook[],
): BeautyHistorySessionEntry {
  return {
    sessionId: session.sessionId,
    state: session.state,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    analysisSources: { ...session.analysisSources },
    attempts: attempts.map((a) => ({
      attemptId: a.attemptId,
      capabilityId: a.capabilityId,
      lookId: a.lookId,
      createdAt: a.createdAt,
      runtimeStatus: a.runtime.status,
      // providerId intentionally omitted from history public shape
    })),
    looks: looks.map((l) => ({
      lookId: l.lookId,
      labelEn: l.labelEn,
      labelAr: l.labelAr,
      attemptIds: [...l.attemptIds],
      createdAt: l.createdAt,
    })),
  };
}
