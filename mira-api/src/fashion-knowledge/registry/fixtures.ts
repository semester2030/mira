/**
 * FK-4 — TEST_ONLY synthetic registry fixtures. Never load in production.
 */
import { FashionAdviceType } from '../contracts/advice-types';
import { ConditionField, ConditionOperator } from '../contracts/conditions';
import { KnowledgeConfidence } from '../contracts/confidence';
import { RuleRelationType } from '../contracts/conflicts';
import { KnowledgeType } from '../contracts/knowledge-types';
import {
  ProvenanceApprovalStatus,
  ProvenanceSourceType,
} from '../contracts/provenance';
import { FashionRuleDomain } from '../contracts/rule-domains';
import { SubjectivityLevel } from '../contracts/subjectivity';
import {
  RuleLifecycleStatus,
  type FashionKnowledgeRule,
} from '../knowledge/fashion-knowledge-rule';
import { FASHION_KNOWLEDGE_RULE_SCHEMA_VERSION, FASHION_KNOWLEDGE_TEST_ONLY } from '../versioning/release';
import { buildFashionKnowledgeRegistry } from './snapshot';
import type { FashionKnowledgeRegistry } from './contracts';

const SRC = {
  sourceId: 'test_src_editorial_fk4',
  sourceType: ProvenanceSourceType.MIRA_EDITORIAL,
  title: 'TEST_ONLY Editorial',
  reviewer: 'test_reviewer',
  reviewedAt: '2026-08-01T00:00:00.000Z',
  approvalStatus: ProvenanceApprovalStatus.APPROVED,
  sourceConfidence: 0.8,
  notes: FASHION_KNOWLEDGE_TEST_ONLY,
} as const;

function baseRule(
  partial: Partial<FashionKnowledgeRule> & Pick<FashionKnowledgeRule, 'ruleId' | 'domain' | 'knowledgeType' | 'conditions'>,
): FashionKnowledgeRule {
  return {
    schemaVersion: FASHION_KNOWLEDGE_RULE_SCHEMA_VERSION,
    ruleVersion: '0.0.1-test',
    recommendationPattern: {
      patternId: `pat_${partial.ruleId}`,
      adviceTypeHint: FashionAdviceType.BALANCE_COLOR,
      structuredSuggestion: 'TEST_ONLY synthetic suggestion',
      allowsMultipleAlternatives: true,
    },
    rationale: 'TEST_ONLY synthetic rule for registry foundation',
    applicability: [],
    exceptions: [],
    subjectivity: SubjectivityLevel.MEDIUM_SUBJECTIVITY,
    confidence: KnowledgeConfidence.MEDIUM,
    provenance: { ...SRC },
    occasionContext: [],
    culturalContext: [],
    conflictRefs: [],
    status: RuleLifecycleStatus.ACTIVE,
    lifecycle: RuleLifecycleStatus.ACTIVE,
    testOnly: true,
    ...partial,
  };
}

export const FK4_TEST_RULE_COLOR = baseRule({
  ruleId: 'TEST_FK4_COLOR_CONTRAST',
  domain: FashionRuleDomain.COLOR,
  knowledgeType: KnowledgeType.CONVENTION,
  conditions: [
    {
      field: ConditionField.COLOR,
      operator: ConditionOperator.ANY_OF,
      value: ['red', 'yellow'],
    },
  ],
});

export const FK4_TEST_RULE_OCCASION = baseRule({
  ruleId: 'TEST_FK4_WEDDING_OCCASION',
  domain: FashionRuleDomain.OCCASION,
  knowledgeType: KnowledgeType.DRESS_CODE_RULE,
  conditions: [
    {
      field: ConditionField.OCCASION,
      operator: ConditionOperator.EQUALS,
      value: 'wedding',
    },
  ],
  occasionContext: ['wedding'],
  applicability: [
    {
      applicabilityId: 'app_wedding',
      requiredOccasions: ['wedding'],
    },
  ],
  recommendationPattern: {
    patternId: 'pat_wedding',
    adviceTypeHint: FashionAdviceType.OCCASION_ADJUSTMENT,
    structuredSuggestion: 'TEST_ONLY wedding context option',
    allowsMultipleAlternatives: true,
  },
});

export const FK4_TEST_RULE_TREND = baseRule({
  ruleId: 'TEST_FK4_TREND_EXPIRED',
  domain: FashionRuleDomain.COLOR,
  knowledgeType: KnowledgeType.TREND,
  conditions: [
    {
      field: ConditionField.COLOR,
      operator: ConditionOperator.EXISTS,
    },
  ],
  trendValidity: {
    validFrom: '2020-01-01T00:00:00.000Z',
    validTo: '2020-12-31T23:59:59.000Z',
    notes: 'ss20 TEST_ONLY',
  },
  subjectivity: SubjectivityLevel.TREND_DEPENDENT,
});

export const FK4_TEST_RULE_EXCEPTION = baseRule({
  ruleId: 'TEST_FK4_EXCEPTION',
  domain: FashionRuleDomain.COLOR,
  knowledgeType: KnowledgeType.CONVENTION,
  conditions: [
    {
      field: ConditionField.COLOR,
      operator: ConditionOperator.IN,
      value: ['red', 'yellow'],
    },
  ],
  exceptions: [
    {
      exceptionId: 'ex_bold',
      description: 'Bold preference exception',
      whenValues: ['bold'],
      blocksAdvice: true,
    },
  ],
});

export const FK4_TEST_RULE_OLD = baseRule({
  ruleId: 'TEST_FK4_SUPERSEDED_OLD',
  domain: FashionRuleDomain.COLOR,
  knowledgeType: KnowledgeType.CONVENTION,
  conditions: [
    { field: ConditionField.COLOR, operator: ConditionOperator.EXISTS },
  ],
  status: RuleLifecycleStatus.ACTIVE,
  lifecycle: RuleLifecycleStatus.ACTIVE,
});

export const FK4_TEST_RULE_NEW = baseRule({
  ruleId: 'TEST_FK4_SUPERSEDES_NEW',
  domain: FashionRuleDomain.COLOR,
  knowledgeType: KnowledgeType.CONVENTION,
  conditions: [
    { field: ConditionField.COLOR, operator: ConditionOperator.EXISTS },
  ],
});

export const FK4_TEST_RULE_DRAFT = baseRule({
  ruleId: 'TEST_FK4_DRAFT',
  domain: FashionRuleDomain.GENERAL_STYLING,
  knowledgeType: KnowledgeType.PROFESSIONAL_OPINION,
  conditions: [],
  status: RuleLifecycleStatus.DRAFT,
  lifecycle: RuleLifecycleStatus.DRAFT,
  provenance: {
    ...SRC,
    approvalStatus: ProvenanceApprovalStatus.DRAFT,
  },
});

export function buildFk4TestRegistry(
  clockIso = '2026-08-10T12:00:00.000Z',
): FashionKnowledgeRegistry {
  return buildFashionKnowledgeRegistry({
    registryId: 'mira_fk4_test_only',
    registryVersion: '0.0.1-test',
    releaseId: 'fk4-test',
    createdAt: clockIso,
    updatedAt: clockIso,
    rules: [
      FK4_TEST_RULE_COLOR,
      FK4_TEST_RULE_OCCASION,
      FK4_TEST_RULE_TREND,
      FK4_TEST_RULE_EXCEPTION,
      FK4_TEST_RULE_OLD,
      FK4_TEST_RULE_NEW,
      FK4_TEST_RULE_DRAFT,
    ],
    relations: [
      {
        relationId: 'rel_super_1',
        fromRuleId: FK4_TEST_RULE_NEW.ruleId,
        toRuleId: FK4_TEST_RULE_OLD.ruleId,
        type: RuleRelationType.SUPERSEDES,
        notes: 'TEST_ONLY supersession',
      },
      {
        relationId: 'rel_conflict_1',
        fromRuleId: FK4_TEST_RULE_COLOR.ruleId,
        toRuleId: FK4_TEST_RULE_EXCEPTION.ruleId,
        type: RuleRelationType.CONFLICTS,
      },
      {
        relationId: 'rel_special_1',
        fromRuleId: FK4_TEST_RULE_OCCASION.ruleId,
        toRuleId: FK4_TEST_RULE_COLOR.ruleId,
        type: RuleRelationType.SPECIALIZES,
      },
      {
        relationId: 'rel_exception_to_1',
        fromRuleId: FK4_TEST_RULE_EXCEPTION.ruleId,
        toRuleId: FK4_TEST_RULE_COLOR.ruleId,
        type: RuleRelationType.EXCEPTION_TO,
      },
      {
        relationId: 'rel_supports_1',
        fromRuleId: FK4_TEST_RULE_NEW.ruleId,
        toRuleId: FK4_TEST_RULE_COLOR.ruleId,
        type: RuleRelationType.SUPPORTS,
      },
    ],
    provenanceCatalog: [{ ...SRC }],
    metadata: {
      allowTestOnly: true,
      note: FASHION_KNOWLEDGE_TEST_ONLY,
    },
  });
}

export function buildCircularSupersessionRegistry(
  clockIso = '2026-08-10T12:00:00.000Z',
): FashionKnowledgeRegistry {
  const a = baseRule({
    ruleId: 'TEST_CYCLE_A',
    domain: FashionRuleDomain.COLOR,
    knowledgeType: KnowledgeType.CONVENTION,
    conditions: [],
  });
  const b = baseRule({
    ruleId: 'TEST_CYCLE_B',
    domain: FashionRuleDomain.COLOR,
    knowledgeType: KnowledgeType.CONVENTION,
    conditions: [],
  });
  return buildFashionKnowledgeRegistry({
    registryId: 'mira_fk4_cycle',
    registryVersion: '0.0.1-cycle',
    releaseId: 'fk4-cycle',
    createdAt: clockIso,
    updatedAt: clockIso,
    rules: [a, b],
    relations: [
      {
        relationId: 'c1',
        fromRuleId: a.ruleId,
        toRuleId: b.ruleId,
        type: RuleRelationType.SUPERSEDES,
      },
      {
        relationId: 'c2',
        fromRuleId: b.ruleId,
        toRuleId: a.ruleId,
        type: RuleRelationType.SUPERSEDES,
      },
    ],
    provenanceCatalog: [{ ...SRC }],
    metadata: { allowTestOnly: true },
  });
}
