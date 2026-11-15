/**
 * Owner-directed view policy (2026-11-15 session):
 * - Eye icon is a **display counter**, not a separate action button.
 * - A qualified view = the active Discover clip played with real progress (≥1 progress tick).
 * - Prefetch / warm / park never records a view.
 * - Idempotent by eventId (same eventId → alreadyRecorded, no double count).
 * - Rebuild / re-attach without a new eventId must not inflate the count.
 * - Client must not send a total count; the server owns the number.
 *
 * Disable with env MIRA_VIEW_COUNTING_ENABLED=0.
 */
export const VIEW_POLICY_STATUS = 'approved_v1' as const;
export const VIEW_POLICY_VERSION = 'approved_v1';

export type ViewCountState = 'disabled' | 'available' | 'unavailable';

export interface ViewCountBody {
  state: ViewCountState;
  count: number | null;
  policyStatus: typeof VIEW_POLICY_STATUS | 'unapproved';
}

export function viewCountingEnabled(): boolean {
  return process.env.MIRA_VIEW_COUNTING_ENABLED !== '0';
}

export function disabledViewCount(): ViewCountBody {
  return { state: 'disabled', count: null, policyStatus: 'unapproved' };
}

export function availableViewCount(count: number): ViewCountBody {
  return { state: 'available', count, policyStatus: VIEW_POLICY_STATUS };
}

export interface QualifiedViewRequest {
  targetKind?: string;
  targetId?: string;
  eventId?: string;
  eventType?: string;
  policyVersion?: string;
  context?: string;
  count?: number;
}

export type ViewRefusal = 'client-total' | 'invalid' | 'unapproved' | null;

export function refuseQualifiedView(input: QualifiedViewRequest): ViewRefusal {
  if (input.count !== undefined && input.count !== null) return 'client-total';
  if (!input.targetKind || !input.targetId || !input.eventId || input.eventType !== 'qualified_view') {
    return 'invalid';
  }
  if (!viewCountingEnabled()) return 'unapproved';
  return null;
}
