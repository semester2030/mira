/**
 * Planner contracts — envelope-only inputs.
 */
import { ADVISOR_PLANNER_VERSION } from '../release';
import type { AdvisorIntent, AdvisorActionRoute } from './conversation-state';
import type { AdvisorReasonCode } from './advisor-runtime';

export type PlannerStepKind =
  | 'need_evidence'
  | 'select_evidence'
  | 'clarify'
  | 'narrate'
  | 'route_action'
  | 'refuse';

export interface PlannerStep {
  kind: PlannerStepKind;
  claimKeys?: string[];
  clarificationAr?: string;
  action?: AdvisorActionRoute;
  reasonCode?: AdvisorReasonCode;
}

export interface ConversationPlan {
  version: typeof ADVISOR_PLANNER_VERSION;
  intent: AdvisorIntent;
  steps: PlannerStep[];
  selectedClaimKeys: string[];
  followUpsAr: string[];
  primaryReasonCode: AdvisorReasonCode;
  answerStrategy: 'grounded' | 'clarify' | 'refuse' | 'unsupported';
}
