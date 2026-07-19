/**
 * Canonical Styling Profile — Phase 6E.1 · style-schema-v1
 * Reasoning only. Consumes frozen Skin/Face/Garment/Outfit/Wardrobe refs.
 */
import { CanonicalFashionRuntime } from '../runtime/fashion-runtime-state';
import { FASHION_STYLE_SCHEMA_VERSION } from '../release';

export const FASHION_STYLING_EVALUATION_VERSION = 'styling-eval-v1';
export const FASHION_STYLING_MAPPING_VERSION = 'styling-mapping-v1';
export const FASHION_STYLING_CONTRACT_VERSION = 'styling-contract-v1';
export const FASHION_STYLING_REASONING_POLICY_VERSION = 'styling-reasoning-policy-v1';
export const FASHION_STYLING_DECISION_VERSION = 'styling-decision-v1';

export function styleSchemaVersion(): string {
  return FASHION_STYLE_SCHEMA_VERSION;
}

export interface StyleFieldConfidence {
  field: string;
  confidence: number;
  evidenceIds: string[];
}

export interface StylePreferenceSet {
  preferredColors: string[];
  avoidedColors: string[];
  preferredSilhouettes: string[];
  avoidedStyles: string[];
  formality?: 'casual' | 'smart_casual' | 'formal' | 'unevaluated';
}

export type StyleGoalStatus =
  | 'draft'
  | 'active'
  | 'completed'
  | 'blocked'
  | 'cancelled';

export interface StyleGoal {
  goalId: string;
  titleEn: string;
  titleAr: string;
  target: string;
  status: StyleGoalStatus;
  horizon?: string;
  evidenceRefs: string[];
  dependsOnGoalIds: string[];
  conflictCodes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StyleMilestone {
  milestoneId: string;
  goalId?: string;
  labelEn: string;
  labelAr: string;
  achieved: boolean;
  evidenceRefs: string[];
  at: string;
}

export interface StyleProgress {
  progressId: string;
  milestones: StyleMilestone[];
  /** 0..1 aggregate toward active goals */
  completionRatio: number;
  deltas: Array<{ code: string; value: number; evidenceRefs: string[] }>;
  evidenceRefs: string[];
}

export interface StyleHistoryEvent {
  eventId: string;
  type: string;
  at: string;
  refs: string[];
  decisionId?: string;
}

export type StyleDecisionOutcome =
  | 'affirm'
  | 'caution'
  | 'revise'
  | 'block'
  | 'observe';

/** Public style decision — Law #32: evidenceRefs required */
export interface StyleDecision {
  decisionId: string;
  decisionVersion: string;
  reasoningPolicyVersion: string;
  claim: string;
  outcome: StyleDecisionOutcome;
  confidence: number;
  evidenceRefs: string[];
  limitations: string[];
  subjectRefs: string[];
  createdAt: string;
}

export interface CanonicalStylingProfile {
  styleProfileId: string;
  version: string;
  subjectId: string;
  preferences: StylePreferenceSet;
  goals: StyleGoal[];
  progress: StyleProgress;
  history: StyleHistoryEvent[];
  /** Frozen evidence citation ids only */
  evidenceIds: string[];
  decisions: StyleDecision[];
  limitations: string[];
  confidence: number;
  fieldConfidence: StyleFieldConfidence[];
  runtime: CanonicalFashionRuntime;
  evaluationVersion: string;
  mappingVersion: string;
  reasoningPolicyVersion: string;
  createdAt: string;
  updatedAt: string;
  /** Internal ledger ref — stripped from public */
  decisionLedgerRef?: string;
}

export function toPublicCanonicalStylingProfile(
  profile: CanonicalStylingProfile,
): Omit<CanonicalStylingProfile, 'decisionLedgerRef'> {
  const { decisionLedgerRef: _drop, ...rest } = profile;
  return rest;
}
