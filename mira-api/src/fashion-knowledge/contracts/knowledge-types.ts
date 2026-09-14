/**
 * FK-2 — Knowledge type contract.
 * No type may silently default to ESTABLISHED_PRINCIPLE.
 */
export const KnowledgeType = {
  ESTABLISHED_PRINCIPLE: 'ESTABLISHED_PRINCIPLE',
  CONVENTION: 'CONVENTION',
  DRESS_CODE_RULE: 'DRESS_CODE_RULE',
  CULTURAL_CONVENTION: 'CULTURAL_CONVENTION',
  TREND: 'TREND',
  PROFESSIONAL_OPINION: 'PROFESSIONAL_OPINION',
  USER_PREFERENCE: 'USER_PREFERENCE',
  LLM_GENERAL_KNOWLEDGE: 'LLM_GENERAL_KNOWLEDGE',
} as const;

export type KnowledgeType =
  (typeof KnowledgeType)[keyof typeof KnowledgeType];

export const ALL_KNOWLEDGE_TYPES: readonly KnowledgeType[] = Object.freeze(
  Object.values(KnowledgeType),
);

/** Public claim strength ceiling implied by knowledge type (policy, not narration). */
export type KnowledgeTypeClaimCeiling =
  | 'FACTUAL_RELATIONSHIP'
  | 'ESTABLISHED_GUIDANCE'
  | 'CONVENTIONAL_GUIDANCE'
  | 'QUALIFIED_SUGGESTION'
  | 'PREFERENCE_DEPENDENT_OPTION';

export interface KnowledgeTypePolicy {
  readonly type: KnowledgeType;
  /** USER_PREFERENCE is context, not fashion truth. */
  readonly isFashionTruth: boolean;
  /** LLM_GENERAL_KNOWLEDGE is always uncurated. */
  readonly alwaysUncurated: boolean;
  readonly requiresTrendValidity: boolean;
  readonly requiresCulturalApplicability: boolean;
  /** DRESS_CODE_RULE is not universal fashion taste. */
  readonly isUniversalTaste: boolean;
  readonly claimCeiling: KnowledgeTypeClaimCeiling;
}

export const KNOWLEDGE_TYPE_POLICIES: Readonly<
  Record<KnowledgeType, KnowledgeTypePolicy>
> = Object.freeze({
  ESTABLISHED_PRINCIPLE: {
    type: KnowledgeType.ESTABLISHED_PRINCIPLE,
    isFashionTruth: true,
    alwaysUncurated: false,
    requiresTrendValidity: false,
    requiresCulturalApplicability: false,
    isUniversalTaste: false,
    claimCeiling: 'ESTABLISHED_GUIDANCE',
  },
  CONVENTION: {
    type: KnowledgeType.CONVENTION,
    isFashionTruth: false,
    alwaysUncurated: false,
    requiresTrendValidity: false,
    requiresCulturalApplicability: false,
    isUniversalTaste: false,
    claimCeiling: 'CONVENTIONAL_GUIDANCE',
  },
  DRESS_CODE_RULE: {
    type: KnowledgeType.DRESS_CODE_RULE,
    isFashionTruth: false,
    alwaysUncurated: false,
    requiresTrendValidity: false,
    requiresCulturalApplicability: false,
    isUniversalTaste: false,
    claimCeiling: 'CONVENTIONAL_GUIDANCE',
  },
  CULTURAL_CONVENTION: {
    type: KnowledgeType.CULTURAL_CONVENTION,
    isFashionTruth: false,
    alwaysUncurated: false,
    requiresTrendValidity: false,
    requiresCulturalApplicability: true,
    isUniversalTaste: false,
    claimCeiling: 'CONVENTIONAL_GUIDANCE',
  },
  TREND: {
    type: KnowledgeType.TREND,
    isFashionTruth: false,
    alwaysUncurated: false,
    requiresTrendValidity: true,
    requiresCulturalApplicability: false,
    isUniversalTaste: false,
    claimCeiling: 'QUALIFIED_SUGGESTION',
  },
  PROFESSIONAL_OPINION: {
    type: KnowledgeType.PROFESSIONAL_OPINION,
    isFashionTruth: false,
    alwaysUncurated: false,
    requiresTrendValidity: false,
    requiresCulturalApplicability: false,
    isUniversalTaste: false,
    claimCeiling: 'QUALIFIED_SUGGESTION',
  },
  USER_PREFERENCE: {
    type: KnowledgeType.USER_PREFERENCE,
    isFashionTruth: false,
    alwaysUncurated: false,
    requiresTrendValidity: false,
    requiresCulturalApplicability: false,
    isUniversalTaste: false,
    claimCeiling: 'PREFERENCE_DEPENDENT_OPTION',
  },
  LLM_GENERAL_KNOWLEDGE: {
    type: KnowledgeType.LLM_GENERAL_KNOWLEDGE,
    isFashionTruth: false,
    alwaysUncurated: true,
    requiresTrendValidity: false,
    requiresCulturalApplicability: false,
    isUniversalTaste: false,
    claimCeiling: 'QUALIFIED_SUGGESTION',
  },
});

export function knowledgeTypePolicy(type: KnowledgeType): KnowledgeTypePolicy {
  return KNOWLEDGE_TYPE_POLICIES[type];
}

export function isKnowledgeType(value: unknown): value is KnowledgeType {
  return (
    typeof value === 'string' &&
    (ALL_KNOWLEDGE_TYPES as readonly string[]).includes(value)
  );
}
