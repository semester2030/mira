/**
 * Multi-service visit plan metadata for appointment *requests*
 * (status stays `requested` until the partner confirms).
 */

export type VisitPlanMode = 'consecutive' | 'separate' | 'solo';

export type VisitPlanInput = {
  mode: VisitPlanMode;
  groupId: string;
  sequence: number;
  peerServiceIds: string[];
  branchId?: string | null;
  expectedStartsAt?: string | null;
  expectedEndsAt?: string | null;
};

export const VISIT_PLAN_NOTE_PREFIX = '[[mira_visit_plan:';

export function parseVisitPlan(raw: unknown): VisitPlanInput | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const mode = o.mode;
  if (mode !== 'consecutive' && mode !== 'separate' && mode !== 'solo') return null;
  const groupId = typeof o.groupId === 'string' ? o.groupId.trim() : '';
  const sequence = typeof o.sequence === 'number' ? o.sequence : Number(o.sequence);
  if (!groupId || !Number.isFinite(sequence) || sequence < 1) return null;
  const peerServiceIds = Array.isArray(o.peerServiceIds)
    ? o.peerServiceIds.filter((x): x is string => typeof x === 'string' && !!x.trim())
    : [];
  return {
    mode,
    groupId,
    sequence: Math.trunc(sequence),
    peerServiceIds,
    branchId: typeof o.branchId === 'string' ? o.branchId : null,
    expectedStartsAt: typeof o.expectedStartsAt === 'string' ? o.expectedStartsAt : null,
    expectedEndsAt: typeof o.expectedEndsAt === 'string' ? o.expectedEndsAt : null,
  };
}

export function encodeVisitPlanNote(plan: VisitPlanInput, humanNotes?: string | null): string {
  const payload = JSON.stringify({
    mode: plan.mode,
    groupId: plan.groupId,
    sequence: plan.sequence,
    peerServiceIds: plan.peerServiceIds,
    branchId: plan.branchId ?? null,
    expectedStartsAt: plan.expectedStartsAt ?? null,
    expectedEndsAt: plan.expectedEndsAt ?? null,
  });
  const machine = `${VISIT_PLAN_NOTE_PREFIX}${payload}]]`;
  const human = (humanNotes ?? '').trim();
  return human ? `${human}\n${machine}` : machine;
}

export function extractVisitPlanFromNotes(notes: string | null | undefined): VisitPlanInput | null {
  if (!notes) return null;
  const start = notes.indexOf(VISIT_PLAN_NOTE_PREFIX);
  if (start < 0) return null;
  const jsonStart = start + VISIT_PLAN_NOTE_PREFIX.length;
  const end = notes.indexOf(']]', jsonStart);
  if (end < 0) return null;
  try {
    return parseVisitPlan(JSON.parse(notes.slice(jsonStart, end)));
  } catch {
    return null;
  }
}

/** Consecutive peer must start when the previous service ends (±60s). */
export function consecutiveStartsAlign(previousEndsAt: Date, nextStartsAt: Date, skewMs = 60_000): boolean {
  return Math.abs(previousEndsAt.getTime() - nextStartsAt.getTime()) <= skewMs;
}
