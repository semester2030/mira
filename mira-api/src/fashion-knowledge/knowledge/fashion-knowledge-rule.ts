/**
 * FK-2 — Fashion Knowledge Rule contract + lifecycle.
 * Do not populate production rules in FK-2.
 */
import type {
  RuleApplicability,
  RuleException,
  TrendValidity,
} from '../contracts/applicability';
import type { FashionRuleCondition } from '../contracts/conditions';
import type { KnowledgeConfidence } from '../contracts/confidence';
import type { KnowledgeType } from '../contracts/knowledge-types';
import type { FashionProvenance } from '../contracts/provenance';
import type { FashionRuleDomain } from '../contracts/rule-domains';
import type { SubjectivityLevel } from '../contracts/subjectivity';
import { FASHION_KNOWLEDGE_RULE_SCHEMA_VERSION } from '../versioning/release';

export const RuleLifecycleStatus = {
  DRAFT: 'DRAFT',
  REVIEWED: 'REVIEWED',
  APPROVED: 'APPROVED',
  ACTIVE: 'ACTIVE',
  DEPRECATED: 'DEPRECATED',
  REJECTED: 'REJECTED',
} as const;

export type RuleLifecycleStatus =
  (typeof RuleLifecycleStatus)[keyof typeof RuleLifecycleStatus];

export interface FashionRecommendationPattern {
  readonly patternId: string;
  readonly adviceTypeHint: string;
  readonly structuredSuggestion: string;
  readonly allowsMultipleAlternatives: boolean;
}

export interface FashionKnowledgeRule {
  readonly ruleId: string;
  readonly schemaVersion: typeof FASHION_KNOWLEDGE_RULE_SCHEMA_VERSION | string;
  readonly ruleVersion: string;
  readonly knowledgeType: KnowledgeType;
  readonly domain: FashionRuleDomain;
  readonly conditions: readonly FashionRuleCondition[];
  readonly recommendationPattern: FashionRecommendationPattern;
  readonly rationale: string;
  readonly applicability: readonly RuleApplicability[];
  readonly exceptions: readonly RuleException[];
  readonly subjectivity: SubjectivityLevel;
  readonly confidence: KnowledgeConfidence;
  readonly provenance: FashionProvenance;
  readonly occasionContext: readonly string[];
  readonly culturalContext: readonly string[];
  readonly trendValidity?: TrendValidity;
  readonly conflictRefs: readonly string[];
  readonly status: RuleLifecycleStatus;
  readonly lifecycle: RuleLifecycleStatus;
  /** TEST_ONLY marker — production matching must ignore these. */
  readonly testOnly?: boolean;
}

/** Only ACTIVE rules may be used for future production matching. */
export function isProductionEligibleRule(rule: FashionKnowledgeRule): boolean {
  return (
    rule.status === RuleLifecycleStatus.ACTIVE &&
    rule.lifecycle === RuleLifecycleStatus.ACTIVE &&
    rule.testOnly !== true
  );
}
