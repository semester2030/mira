/**
 * FK-9 — Fashion Knowledge event taxonomy.
 */
export const FashionKnowledgeEventType = {
  ADVICE_GENERATED: 'ADVICE_GENERATED',
  ADVICE_CLAIM_LOCKED: 'ADVICE_CLAIM_LOCKED',
  ADVICE_PRESENTED: 'ADVICE_PRESENTED',
  ADVICE_OPENED: 'ADVICE_OPENED',
  ADVICE_DISMISSED: 'ADVICE_DISMISSED',
  ADVICE_ACCEPTED: 'ADVICE_ACCEPTED',
  ADVICE_REJECTED: 'ADVICE_REJECTED',
  ADVICE_SAVED: 'ADVICE_SAVED',
  ALTERNATIVE_SELECTED: 'ALTERNATIVE_SELECTED',
  CLARIFICATION_REQUESTED: 'CLARIFICATION_REQUESTED',
  ADVISOR_FOLLOWUP_REQUESTED: 'ADVISOR_FOLLOWUP_REQUESTED',
  PREFERENCE_OVERRIDE: 'PREFERENCE_OVERRIDE',
  MODE_A_RULE_USED: 'MODE_A_RULE_USED',
  MODE_B_LLM_USED: 'MODE_B_LLM_USED',
  CANDIDATE_BLOCKED: 'CANDIDATE_BLOCKED',
  CANDIDATE_QUALIFIED: 'CANDIDATE_QUALIFIED',
  CANDIDATE_FAILED: 'CANDIDATE_FAILED',
  RULE_RESEARCH_FLAGGED: 'RULE_RESEARCH_FLAGGED',
  FEEDBACK_SUBMITTED: 'FEEDBACK_SUBMITTED',
} as const;

export type FashionKnowledgeEventType =
  (typeof FashionKnowledgeEventType)[keyof typeof FashionKnowledgeEventType];

export const ALL_FASHION_KNOWLEDGE_EVENT_TYPES: readonly FashionKnowledgeEventType[] =
  Object.freeze(Object.values(FashionKnowledgeEventType));

export function isFashionKnowledgeEventType(
  value: unknown,
): value is FashionKnowledgeEventType {
  return (
    typeof value === 'string' &&
    (ALL_FASHION_KNOWLEDGE_EVENT_TYPES as readonly string[]).includes(value)
  );
}

export const AdviceSourceMode = {
  MODE_A_CURATED: 'MODE_A_CURATED',
  MODE_B_LLM: 'MODE_B_LLM',
  MIXED: 'MIXED',
  NO_KNOWLEDGE: 'NO_KNOWLEDGE',
  UNKNOWN: 'UNKNOWN',
} as const;

export type AdviceSourceMode =
  (typeof AdviceSourceMode)[keyof typeof AdviceSourceMode];

/** Year-1 expected default when Mode B is used. */
export const YEAR1_DEFAULT_SOURCE_MODE = AdviceSourceMode.MODE_B_LLM;
