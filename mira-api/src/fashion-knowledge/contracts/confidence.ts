/**
 * FK-2 — Knowledge confidence (separate from GI/OI/SI/LLM model confidence).
 */
export const KnowledgeConfidence = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  UNVERIFIED: 'UNVERIFIED',
} as const;

export type KnowledgeConfidence =
  (typeof KnowledgeConfidence)[keyof typeof KnowledgeConfidence];

export const ALL_KNOWLEDGE_CONFIDENCE: readonly KnowledgeConfidence[] =
  Object.freeze(Object.values(KnowledgeConfidence));

export function isKnowledgeConfidence(
  value: unknown,
): value is KnowledgeConfidence {
  return (
    typeof value === 'string' &&
    (ALL_KNOWLEDGE_CONFIDENCE as readonly string[]).includes(value)
  );
}

/** LLM_GENERAL_KNOWLEDGE must not receive HIGH curated knowledge confidence. */
export function capConfidenceForLlm(
  confidence: KnowledgeConfidence,
): KnowledgeConfidence {
  if (confidence === KnowledgeConfidence.HIGH) {
    return KnowledgeConfidence.MEDIUM;
  }
  return confidence;
}

export function confidenceRank(c: KnowledgeConfidence): number {
  switch (c) {
    case KnowledgeConfidence.HIGH:
      return 3;
    case KnowledgeConfidence.MEDIUM:
      return 2;
    case KnowledgeConfidence.LOW:
      return 1;
    case KnowledgeConfidence.UNVERIFIED:
      return 0;
    default:
      return 0;
  }
}
