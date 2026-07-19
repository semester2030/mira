/**
 * Style Memory — references only. Stateless helpers (no process singleton).
 * Callers pass/persist snapshots per subject/session.
 */
import { StyleMemorySnapshot } from './styling-evidence';
import {
  StyleDecision,
  StyleGoal,
  StyleHistoryEvent,
  StyleProgress,
} from './canonical-styling-profile';

export function emptyStyleMemory(): StyleMemorySnapshot {
  return {
    preferredColors: [],
    avoidedColors: [],
    preferredSilhouettes: [],
    avoidedStyles: [],
    favoriteOutfitIds: [],
    dislikedStyleTags: [],
    priorDecisionIds: [],
    sessionIds: [],
  };
}

export function normalizeMemorySnapshot(
  prefs?: StyleMemorySnapshot,
): StyleMemorySnapshot {
  const p = prefs ?? emptyStyleMemory();
  return {
    preferredColors: [...p.preferredColors].sort(),
    avoidedColors: [...p.avoidedColors].sort(),
    preferredSilhouettes: [...p.preferredSilhouettes].sort(),
    avoidedStyles: [...p.avoidedStyles].sort(),
    favoriteOutfitIds: [...p.favoriteOutfitIds].sort(),
    dislikedStyleTags: [...p.dislikedStyleTags].sort(),
    priorDecisionIds: [...p.priorDecisionIds].sort(),
    sessionIds: [...p.sessionIds].sort(),
  };
}

/** Pure evolve — no shared mutable store. */
export function evolveMemorySnapshot(input: {
  prior?: StyleMemorySnapshot;
  decisions: StyleDecision[];
  sessionId?: string;
}): StyleMemorySnapshot {
  const base = normalizeMemorySnapshot(input.prior);
  const decisionIds = new Set(base.priorDecisionIds);
  for (const d of input.decisions) decisionIds.add(d.decisionId);
  const sessionIds = new Set(base.sessionIds);
  if (input.sessionId) sessionIds.add(input.sessionId);
  return {
    ...base,
    priorDecisionIds: [...decisionIds].sort(),
    sessionIds: [...sessionIds].sort(),
  };
}

/** Test/helper ephemeral store — never attach to Nest singleton services. */
export class StyleMemoryStore {
  private snapshot: StyleMemorySnapshot = emptyStyleMemory();
  private goals: StyleGoal[] = [];
  private progress: StyleProgress | null = null;
  private history: StyleHistoryEvent[] = [];
  private profileEvolution: Array<{ styleProfileId: string; at: string }> = [];

  load(prefs: StyleMemorySnapshot): void {
    this.snapshot = normalizeMemorySnapshot(prefs);
  }

  getSnapshot(): StyleMemorySnapshot {
    return normalizeMemorySnapshot(this.snapshot);
  }

  recordEvaluation(input: {
    styleProfileId: string;
    at: string;
    decisions: StyleDecision[];
    goals: StyleGoal[];
    progress: StyleProgress;
    history: StyleHistoryEvent[];
    sessionId?: string;
  }): StyleMemorySnapshot {
    this.snapshot = evolveMemorySnapshot({
      prior: this.snapshot,
      decisions: input.decisions,
      sessionId: input.sessionId,
    });
    this.goals = [...input.goals].sort((a, b) =>
      a.goalId.localeCompare(b.goalId),
    );
    this.progress = input.progress;
    const histMap = new Map(this.history.map((h) => [h.eventId, h]));
    for (const h of input.history) histMap.set(h.eventId, h);
    this.history = [...histMap.values()].sort((a, b) =>
      a.eventId.localeCompare(b.eventId),
    );
    this.profileEvolution.push({
      styleProfileId: input.styleProfileId,
      at: input.at,
    });
    this.profileEvolution.sort((a, b) =>
      a.styleProfileId.localeCompare(b.styleProfileId),
    );
    return this.getSnapshot();
  }

  getState() {
    return {
      preferences: this.getSnapshot(),
      goals: [...this.goals],
      progress: this.progress,
      history: [...this.history],
      decisionIds: [...this.snapshot.priorDecisionIds],
      profileEvolution: [...this.profileEvolution],
    };
  }
}
