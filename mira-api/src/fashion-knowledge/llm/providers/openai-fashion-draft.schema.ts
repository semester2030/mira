/**
 * Phase 3C Final — strict provider boundary for FashionAdviceCandidateDraft.
 * Enum arrays are imported from the canonical domain contract to prevent drift.
 */
import { ALL_FASHION_ADVICE_TYPES } from '../../contracts/advice-types';
import {
  FASHION_ADVICE_CHANGE_ACTIONS,
  FASHION_ADVICE_PREFERENCE_ALIGNMENTS,
} from '../../contracts/alternatives';
import { ALL_KNOWLEDGE_CONFIDENCE } from '../../contracts/confidence';
import { ALL_CONFLICT_STATES } from '../../contracts/conflicts';
import { ALL_KNOWLEDGE_TYPES } from '../../contracts/knowledge-types';
import { ALL_SUBJECTIVITY_LEVELS } from '../../contracts/subjectivity';
import { FASHION_ADVICE_CANDIDATE_VERSION } from '../../versioning/release';

const stringArray = (maxItems = 32) => ({
  type: 'array',
  items: { type: 'string' },
  maxItems,
});

const nullableEnum = (values: readonly string[]) => ({
  type: ['string', 'null'],
  enum: [...values, null],
});

const changeSchema = {
  type: 'object',
  properties: {
    changeId: { type: 'string' },
    targetRef: { type: 'string' },
    action: { type: 'string', enum: [...FASHION_ADVICE_CHANGE_ACTIONS] },
    toDirection: { type: ['string', 'null'] },
    notes: { type: ['string', 'null'] },
  },
  required: ['changeId', 'targetRef', 'action', 'toDirection', 'notes'],
  additionalProperties: false,
};

const alternativeSchema = {
  type: 'object',
  properties: {
    alternativeId: { type: 'string' },
    direction: { type: 'string' },
    changes: {
      type: 'array',
      items: changeSchema,
      maxItems: 32,
    },
    expectedStyleEffect: { type: 'string' },
    evidenceRefs: stringArray(),
    ruleRefs: stringArray(),
    confidence: {
      type: 'string',
      enum: [...ALL_KNOWLEDGE_CONFIDENCE],
    },
    subjectivity: {
      type: 'string',
      enum: [...ALL_SUBJECTIVITY_LEVELS],
    },
    qualification: { type: 'string' },
    preferenceAlignment: {
      type: 'string',
      enum: [...FASHION_ADVICE_PREFERENCE_ALIGNMENTS],
    },
  },
  required: [
    'alternativeId',
    'direction',
    'changes',
    'expectedStyleEffect',
    'evidenceRefs',
    'ruleRefs',
    'confidence',
    'subjectivity',
    'qualification',
    'preferenceAlignment',
  ],
  additionalProperties: false,
};

export const OPENAI_FASHION_DRAFT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    draftId: { type: 'string' },
    schemaVersion: {
      type: 'string',
      enum: [FASHION_ADVICE_CANDIDATE_VERSION],
    },
    adviceType: { type: 'string', enum: [...ALL_FASHION_ADVICE_TYPES] },
    targetRefs: stringArray(),
    currentObservation: { type: 'string' },
    suggestion: {
      type: 'object',
      properties: {
        structuredText: { type: 'string' },
        adviceType: {
          type: 'string',
          enum: [...ALL_FASHION_ADVICE_TYPES],
        },
        absoluteClaim: { type: 'boolean', enum: [false] },
        knownRuleWording: { type: 'boolean', enum: [false] },
      },
      required: [
        'structuredText',
        'adviceType',
        'absoluteClaim',
        'knownRuleWording',
      ],
      additionalProperties: false,
    },
    rationale: { type: 'string' },
    evidenceRefs: stringArray(),
    subjectivity: {
      type: 'string',
      enum: [...ALL_SUBJECTIVITY_LEVELS],
    },
    occasionContext: stringArray(),
    alternatives: {
      type: 'array',
      items: alternativeSchema,
      maxItems: 8,
    },
    limitations: stringArray(),
    createdAt: { type: 'string' },
    traceId: { type: ['string', 'null'] },
    knowledgeType: nullableEnum(ALL_KNOWLEDGE_TYPES),
    confidenceEstimate: nullableEnum(ALL_KNOWLEDGE_CONFIDENCE),
    preferenceConflict: nullableEnum(ALL_CONFLICT_STATES),
    culturalConflict: nullableEnum(ALL_CONFLICT_STATES),
    occasionDependency: { type: ['boolean', 'null'] },
    assumptions: stringArray(),
    clarificationNeeds: stringArray(),
    forbiddenClaimDetected: { type: 'boolean', enum: [false] },
  },
  required: [
    'draftId',
    'schemaVersion',
    'adviceType',
    'targetRefs',
    'currentObservation',
    'suggestion',
    'rationale',
    'evidenceRefs',
    'subjectivity',
    'occasionContext',
    'alternatives',
    'limitations',
    'createdAt',
    'traceId',
    'knowledgeType',
    'confidenceEstimate',
    'preferenceConflict',
    'culturalConflict',
    'occasionDependency',
    'assumptions',
    'clarificationNeeds',
    'forbiddenClaimDetected',
  ],
  additionalProperties: false,
};

export const OPENAI_FASHION_DRAFT_RESPONSE_FORMAT = Object.freeze({
  type: 'json_schema' as const,
  json_schema: {
    name: 'mira_fashion_advice_candidate_v1',
    strict: true,
    schema: OPENAI_FASHION_DRAFT_JSON_SCHEMA,
  },
});
