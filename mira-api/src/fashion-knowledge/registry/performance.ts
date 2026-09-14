/**
 * FK-4 — Lightweight performance probe for synthetic rule counts.
 */
import { FashionAdviceType } from '../contracts/advice-types';
import { ConditionField, ConditionOperator } from '../contracts/conditions';
import { KnowledgeConfidence } from '../contracts/confidence';
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
import { FASHION_KNOWLEDGE_RULE_SCHEMA_VERSION } from '../versioning/release';
import { buildFashionKnowledgeRegistry } from './snapshot';
import { buildRegistryIndexes } from './indexes';
import { lookupFashionKnowledgeRules } from './lookup';

function synthRule(i: number): FashionKnowledgeRule {
  return {
    ruleId: `SYNTH_${String(i).padStart(5, '0')}`,
    schemaVersion: FASHION_KNOWLEDGE_RULE_SCHEMA_VERSION,
    ruleVersion: '0.0.1-synth',
    knowledgeType: KnowledgeType.CONVENTION,
    domain: FashionRuleDomain.COLOR,
    conditions: [
      {
        field: ConditionField.COLOR,
        operator: ConditionOperator.EQUALS,
        value: i % 2 === 0 ? 'red' : 'blue',
      },
    ],
    recommendationPattern: {
      patternId: `pat_${i}`,
      adviceTypeHint: FashionAdviceType.BALANCE_COLOR,
      structuredSuggestion: 'synth',
      allowsMultipleAlternatives: true,
    },
    rationale: 'synthetic performance fixture',
    applicability: [],
    exceptions: [],
    subjectivity: SubjectivityLevel.MEDIUM_SUBJECTIVITY,
    confidence: KnowledgeConfidence.MEDIUM,
    provenance: {
      sourceId: 'synth_src',
      sourceType: ProvenanceSourceType.MIRA_EDITORIAL,
      approvalStatus: ProvenanceApprovalStatus.APPROVED,
      sourceConfidence: 0.5,
      reviewer: 'synth',
      reviewedAt: '2026-01-01T00:00:00.000Z',
    },
    occasionContext: [],
    culturalContext: [],
    conflictRefs: [],
    status: RuleLifecycleStatus.ACTIVE,
    lifecycle: RuleLifecycleStatus.ACTIVE,
    testOnly: true,
  };
}

export interface RegistryPerfProbeResult {
  readonly ruleCount: number;
  readonly indexBuildMs: number;
  readonly lookupMs: number;
  readonly matched: number;
}

export function probeRegistryPerformance(
  ruleCount: number,
  clockNowIso = '2026-08-10T12:00:00.000Z',
): RegistryPerfProbeResult {
  const rules = Array.from({ length: ruleCount }, (_, i) => synthRule(i));
  const t0 = Date.now();
  buildRegistryIndexes(rules);
  const indexBuildMs = Date.now() - t0;

  const registry = buildFashionKnowledgeRegistry({
    registryId: 'perf',
    registryVersion: `perf-${ruleCount}`,
    releaseId: 'perf',
    createdAt: clockNowIso,
    updatedAt: clockNowIso,
    rules,
    metadata: { allowTestOnly: true },
  });

  const t1 = Date.now();
  const result = lookupFashionKnowledgeRules(registry, {
    clockNowIso,
    colorFacts: ['red'],
    garmentFacts: { color: 'red' },
    activeOnly: true,
    allowTestOnly: true,
    domain: FashionRuleDomain.COLOR,
  });
  const lookupMs = Date.now() - t1;

  return {
    ruleCount,
    indexBuildMs,
    lookupMs,
    matched: result.matchedRules.length,
  };
}
