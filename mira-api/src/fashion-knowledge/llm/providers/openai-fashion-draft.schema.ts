/**
 * AT-2 — OpenAI response_format helper for FashionAdviceCandidateDraft.
 * Uses json_object (repository-compatible) + post-parse strict validation.
 * Enum legality is enforced by FK-3 draft-validator after parse.
 */

export const OPENAI_FASHION_DRAFT_RESPONSE_FORMAT = Object.freeze({
  type: 'json_object' as const,
});

/** Compact schema reminder appended to user message (not chain-of-thought). */
export const OPENAI_FASHION_DRAFT_SHAPE_HINT = Object.freeze({
  draftId: 'string',
  schemaVersion: 'fashion-advice-candidate-v1',
  adviceType: 'FashionAdviceType enum string',
  targetRefs: ['string'],
  currentObservation: 'string',
  suggestion: {
    structuredText: 'string',
    adviceType: 'FashionAdviceType enum string',
    absoluteClaim: false,
    knownRuleWording: false,
  },
  rationale: 'string',
  evidenceRefs: ['string — must be subset of request evidenceRefs'],
  subjectivity: 'SubjectivityLevel enum string',
  knowledgeType: 'LLM_GENERAL_KNOWLEDGE preferred',
  confidenceEstimate: 'LOW|MEDIUM|UNVERIFIED preferred (never trust HIGH)',
  preferenceConflict: 'ConflictState',
  culturalConflict: 'ConflictState',
  occasionDependency: 'boolean',
  occasionContext: ['string'],
  assumptions: ['string'],
  clarificationNeeds: ['string'],
  alternatives: [
    {
      alternativeId: 'string',
      direction: 'string',
      changes: [
        {
          changeId: 'string',
          targetRef: 'string',
          action: 'keep|soften_color|neutralize_color|replace_direction|other',
          toDirection: 'string optional',
        },
      ],
      expectedStyleEffect: 'string',
      evidenceRefs: ['string'],
      ruleRefs: [],
      confidence: 'KnowledgeConfidence',
      subjectivity: 'SubjectivityLevel',
      qualification: 'string',
      preferenceAlignment: 'aligned|partial|opposed|unknown',
    },
  ],
  limitations: ['string'],
  createdAt: 'ISO-8601 from request clock',
  traceId: 'from request',
  forbiddenClaimDetected: false,
});
