/**
 * FK-5 — Shared helpers for review-candidate rule shells.
 * Provenance is honest SOURCING_GAP / UNKNOWN — never fake books.
 */
import {
  type FashionRuleCondition,
} from '../contracts/conditions';
import { KnowledgeConfidence } from '../contracts/confidence';
import { KnowledgeType } from '../contracts/knowledge-types';
import {
  ProvenanceApprovalStatus,
  ProvenanceSourceType,
  type FashionProvenance,
} from '../contracts/provenance';
import { FashionRuleDomain } from '../contracts/rule-domains';
import { SubjectivityLevel } from '../contracts/subjectivity';
import type { RuleApplicability, RuleException } from '../contracts/applicability';
import {
  RuleLifecycleStatus,
  type FashionKnowledgeRule,
  type FashionRecommendationPattern,
} from '../knowledge/fashion-knowledge-rule';
import {
  FASHION_KNOWLEDGE_RULE_SCHEMA_VERSION,
  FASHION_KNOWLEDGE_SOURCING_GAP,
} from '../versioning/release';

export function sourcingGapProvenance(sourceId: string): FashionProvenance {
  return {
    sourceId,
    sourceType: ProvenanceSourceType.UNKNOWN,
    approvalStatus: ProvenanceApprovalStatus.DRAFT,
    sourceConfidence: 0.15,
    notes: `${FASHION_KNOWLEDGE_SOURCING_GAP}: awaiting Tier A/B citation + human approval. No fabricated bibliography.`,
  };
}

export function draftRule(input: {
  readonly ruleId: string;
  readonly knowledgeType: KnowledgeType;
  readonly domain: FashionRuleDomain;
  readonly conditions: readonly FashionRuleCondition[];
  readonly pattern: FashionRecommendationPattern;
  readonly rationale: string;
  readonly applicability: readonly RuleApplicability[];
  readonly exceptions?: readonly RuleException[];
  readonly subjectivity: SubjectivityLevel;
  readonly confidence?: KnowledgeConfidence;
  readonly occasionContext?: readonly string[];
  readonly culturalContext?: readonly string[];
  readonly provenanceSourceId: string;
}): FashionKnowledgeRule {
  return {
    ruleId: input.ruleId,
    schemaVersion: FASHION_KNOWLEDGE_RULE_SCHEMA_VERSION,
    ruleVersion: '0.4.0-review-candidate',
    knowledgeType: input.knowledgeType,
    domain: input.domain,
    conditions: input.conditions,
    recommendationPattern: input.pattern,
    rationale: input.rationale,
    applicability: input.applicability,
    exceptions: input.exceptions ?? [],
    subjectivity: input.subjectivity,
    confidence: input.confidence ?? KnowledgeConfidence.UNVERIFIED,
    provenance: sourcingGapProvenance(input.provenanceSourceId),
    occasionContext: input.occasionContext ?? [],
    culturalContext: input.culturalContext ?? [],
    conflictRefs: [],
    status: RuleLifecycleStatus.DRAFT,
    lifecycle: RuleLifecycleStatus.DRAFT,
  };
}
