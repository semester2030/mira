/**
 * View counting stays off until the owner approves a policy.
 * PLC-0008 is a proposal, not that approval. This module must not invent one.
 */
export const VIEW_POLICY_STATUS = 'unapproved' as const;

export type ViewCountState = 'disabled' | 'available' | 'unavailable';

export interface ViewCountBody {
  state: ViewCountState;
  count: number | null;
  policyStatus: typeof VIEW_POLICY_STATUS;
}

export function viewCountingEnabled(): boolean {
  return false;
}

export function disabledViewCount(): ViewCountBody {
  return { state: 'disabled', count: null, policyStatus: VIEW_POLICY_STATUS };
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

export type ViewRefusal = 'client-total' | 'invalid' | 'unapproved';

export function refuseQualifiedView(input: QualifiedViewRequest): ViewRefusal {
  if (input.count !== undefined && input.count !== null) return 'client-total';
  if (!input.targetKind || !input.targetId || !input.eventId || input.eventType !== 'qualified_view') return 'invalid';
  return 'unapproved';
}
