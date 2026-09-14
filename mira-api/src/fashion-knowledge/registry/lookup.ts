/**
 * FK-4 — Deterministic rule lookup (returns rules, not advice).
 */
import {
  confidenceRank,
  type KnowledgeConfidence,
} from '../contracts/confidence';
import { RuleLifecycleStatus } from '../knowledge/fashion-knowledge-rule';
import type { FashionKnowledgeRule } from '../knowledge/fashion-knowledge-rule';
import type { FashionKnowledgeRegistry } from './contracts';
import {
  LookupReasonCode,
  type FashionKnowledgeExcludedRule,
  type FashionKnowledgeLookupQuery,
  type FashionKnowledgeLookupResult,
  type FashionKnowledgeMatchedRule,
  type CuratedRuleAvailability,
} from './contracts';
import { evaluateAllConditions, type FactBag } from './condition-evaluator';
import { matchingExceptions } from '../contracts/applicability';
import { analyzeSupersession, isSuperseded } from './supersession';
import { contentHash } from './hash';
import { createRegistrySnapshot } from './snapshot';
import { FASHION_KNOWLEDGE_LOOKUP_VERSION } from '../versioning/release';
import { RuleRelationType } from '../contracts/conflicts';

function normalizeQuery(query: FashionKnowledgeLookupQuery): unknown {
  return {
    domain: query.domain ?? null,
    domains: [...(query.domains ?? [])].sort(),
    garmentFacts: query.garmentFacts ?? {},
    colorFacts: [...(query.colorFacts ?? [])].map((c) => c.toLowerCase()).sort(),
    occasion: query.occasion?.toLowerCase() ?? null,
    dressCode: query.dressCode?.toLowerCase() ?? null,
    culturalContext: query.culturalContext?.toLowerCase() ?? null,
    styleGoal: query.styleGoal ?? null,
    preferenceTokens: [...(query.preferenceTokens ?? [])]
      .map((t) => t.toLowerCase())
      .sort(),
    clockNowIso: query.clockNowIso,
    minimumConfidence: query.minimumConfidence ?? null,
    knowledgeTypes: [...(query.knowledgeTypes ?? [])].sort(),
    subjectivityLevels: [...(query.subjectivityLevels ?? [])].sort(),
    activeOnly: query.activeOnly !== false,
    allowTestOnly: query.allowTestOnly === true,
  };
}

export function hashLookupQuery(query: FashionKnowledgeLookupQuery): string {
  return contentHash(normalizeQuery(query));
}

function buildFacts(query: FashionKnowledgeLookupQuery): FactBag {
  const facts: Record<string, string | number | boolean | readonly string[]> = {
    ...(query.garmentFacts ?? {}),
  };
  if (query.colorFacts?.length) {
    facts.color = query.colorFacts.map((c) => c.toLowerCase());
  }
  if (query.occasion) facts.occasion = query.occasion.toLowerCase();
  if (query.dressCode) facts.formality = query.dressCode.toLowerCase();
  if (query.culturalContext) {
    facts.cultural_context = query.culturalContext.toLowerCase();
  }
  if (query.styleGoal) facts.style_goal = query.styleGoal;
  if (query.preferenceTokens?.length) {
    facts.preference = query.preferenceTokens.map((t) => t.toLowerCase());
  }
  return facts;
}

function meetsConfidence(
  ruleConf: KnowledgeConfidence,
  min?: KnowledgeConfidence,
): boolean {
  if (!min) return true;
  return confidenceRank(ruleConf) >= confidenceRank(min);
}

export function lookupFashionKnowledgeRules(
  registry: FashionKnowledgeRegistry,
  query: FashionKnowledgeLookupQuery,
): FashionKnowledgeLookupResult {
  const started = Date.now();
  const appliedFilters: string[] = [];
  const matched: FashionKnowledgeMatchedRule[] = [];
  const excluded: FashionKnowledgeExcludedRule[] = [];
  const reasonCodes = new Set<typeof LookupReasonCode[keyof typeof LookupReasonCode]>();

  const activeOnly = query.activeOnly !== false;
  if (activeOnly) appliedFilters.push('active_only');
  const allowTestOnly = query.allowTestOnly === true;
  const facts = buildFacts(query);
  const superAnalysis = analyzeSupersession(registry.relations);
  const queryHash = hashLookupQuery(query);
  const snapshot = createRegistrySnapshot({
    registry,
    generatedAt: query.clockNowIso,
  });

  const domainFilter = new Set<string>();
  if (query.domain) domainFilter.add(query.domain);
  for (const d of query.domains ?? []) domainFilter.add(d);
  if (domainFilter.size) appliedFilters.push('domain');

  const ktFilter = new Set(query.knowledgeTypes ?? []);
  if (ktFilter.size) appliedFilters.push('knowledge_type');
  const subFilter = new Set(query.subjectivityLevels ?? []);
  if (subFilter.size) appliedFilters.push('subjectivity');
  if (query.occasion) appliedFilters.push('occasion');
  if (query.culturalContext) appliedFilters.push('cultural_context');
  if (query.minimumConfidence) appliedFilters.push('minimum_confidence');

  const conflictRefs = registry.relations
    .filter((r) => r.type === RuleRelationType.CONFLICTS)
    .map((r) => r.relationId)
    .sort();

  if (registry.rules.length === 0) {
    reasonCodes.add(LookupReasonCode.NO_APPLICABLE_CURATED_RULE);
    return Object.freeze({
      schemaVersion: FASHION_KNOWLEDGE_LOOKUP_VERSION,
      matchedRules: [],
      excludedRules: [],
      conflictRefs,
      appliedFilters: Object.freeze(appliedFilters.sort()),
      registryVersion: registry.registryVersion,
      snapshotId: snapshot.snapshotId,
      queryHash,
      reasonCodes: Object.freeze([...reasonCodes].sort()),
      runtime: {
        status: 'empty' as const,
        elapsedMs: Math.max(0, Date.now() - started),
      },
    });
  }

  const rules = [...registry.rules].sort((a, b) =>
    a.ruleId.localeCompare(b.ruleId),
  );

  for (const rule of rules) {
    if (!allowTestOnly && rule.testOnly === true) {
      excluded.push({
        ruleId: rule.ruleId,
        reasonCode: LookupReasonCode.TEST_ONLY_EXCLUDED,
      });
      continue;
    }
    if (activeOnly) {
      if (rule.status === RuleLifecycleStatus.DEPRECATED) {
        excluded.push({
          ruleId: rule.ruleId,
          reasonCode: LookupReasonCode.DEPRECATED,
        });
        continue;
      }
      if (
        rule.status !== RuleLifecycleStatus.ACTIVE ||
        rule.lifecycle !== RuleLifecycleStatus.ACTIVE
      ) {
        excluded.push({
          ruleId: rule.ruleId,
          reasonCode: LookupReasonCode.INACTIVE,
        });
        continue;
      }
    }
    if (isSuperseded(rule.ruleId, superAnalysis)) {
      excluded.push({
        ruleId: rule.ruleId,
        reasonCode: LookupReasonCode.SUPERSEDED,
        detail: 'superseded by newer relation',
      });
      continue;
    }
    if (domainFilter.size && !domainFilter.has(rule.domain)) {
      excluded.push({
        ruleId: rule.ruleId,
        reasonCode: LookupReasonCode.FILTERED_BY_DOMAIN,
      });
      continue;
    }
    if (ktFilter.size && !ktFilter.has(rule.knowledgeType)) {
      excluded.push({
        ruleId: rule.ruleId,
        reasonCode: LookupReasonCode.FILTERED_BY_KNOWLEDGE_TYPE,
      });
      continue;
    }
    if (subFilter.size && !subFilter.has(rule.subjectivity)) {
      excluded.push({
        ruleId: rule.ruleId,
        reasonCode: LookupReasonCode.FILTERED_BY_SUBJECTIVITY,
      });
      continue;
    }
    if (!meetsConfidence(rule.confidence, query.minimumConfidence)) {
      excluded.push({
        ruleId: rule.ruleId,
        reasonCode: LookupReasonCode.CONFIDENCE_BELOW_THRESHOLD,
      });
      continue;
    }

    // Provenance gate for active curated
    if (
      activeOnly &&
      (rule.provenance.approvalStatus === 'UNCURATED' ||
        rule.provenance.sourceType === 'llm_general_knowledge' ||
        rule.provenance.sourceType === 'unknown')
    ) {
      excluded.push({
        ruleId: rule.ruleId,
        reasonCode: LookupReasonCode.INVALID_PROVENANCE,
      });
      continue;
    }

    // Occasion
    if (rule.occasionContext.length > 0) {
      if (!query.occasion) {
        excluded.push({
          ruleId: rule.ruleId,
          reasonCode: LookupReasonCode.OCCASION_MISMATCH,
          detail: 'rule requires occasion',
        });
        continue;
      }
      if (
        !rule.occasionContext
          .map((o) => o.toLowerCase())
          .includes(query.occasion.toLowerCase())
      ) {
        excluded.push({
          ruleId: rule.ruleId,
          reasonCode: LookupReasonCode.OCCASION_MISMATCH,
        });
        continue;
      }
    }
    let skipRule = false;
    for (const app of rule.applicability) {
      if (app.requiredOccasions?.length) {
        if (
          !query.occasion ||
          !app.requiredOccasions
            .map((o) => o.toLowerCase())
            .includes(query.occasion.toLowerCase())
        ) {
          excluded.push({
            ruleId: rule.ruleId,
            reasonCode: LookupReasonCode.OCCASION_MISMATCH,
          });
          skipRule = true;
          break;
        }
      }
      if (app.culturalRestrictions?.length) {
        if (
          !query.culturalContext ||
          !app.culturalRestrictions
            .map((c) => c.toLowerCase())
            .includes(query.culturalContext.toLowerCase())
        ) {
          excluded.push({
            ruleId: rule.ruleId,
            reasonCode: LookupReasonCode.CULTURAL_CONTEXT_MISMATCH,
          });
          skipRule = true;
          break;
        }
      }
    }
    if (skipRule) continue;

    if (rule.culturalContext.length > 0) {
      if (
        !query.culturalContext ||
        !rule.culturalContext
          .map((c) => c.toLowerCase())
          .includes(query.culturalContext.toLowerCase())
      ) {
        excluded.push({
          ruleId: rule.ruleId,
          reasonCode: LookupReasonCode.CULTURAL_CONTEXT_MISMATCH,
        });
        continue;
      }
    }

    // Trend validity — explicit clock
    if (rule.trendValidity) {
      const { validFrom, validTo } = rule.trendValidity;
      if (
        query.clockNowIso < validFrom ||
        query.clockNowIso > validTo
      ) {
        excluded.push({
          ruleId: rule.ruleId,
          reasonCode: LookupReasonCode.TREND_EXPIRED,
          detail: `${validFrom}..${validTo}`,
        });
        continue;
      }
    }

    const cond = evaluateAllConditions(rule.conditions, facts);
    if (!cond.ok) {
      excluded.push({
        ruleId: rule.ruleId,
        reasonCode: LookupReasonCode.NO_MATCH,
        detail: cond.reason,
      });
      continue;
    }
    if (!cond.matched) {
      excluded.push({
        ruleId: rule.ruleId,
        reasonCode: LookupReasonCode.NO_MATCH,
      });
      continue;
    }

    // Exceptions
    const tokens = new Set<string>();
    for (const [k, v] of Object.entries(facts)) {
      tokens.add(String(k).toLowerCase());
      if (Array.isArray(v)) v.forEach((x) => tokens.add(String(x).toLowerCase()));
      else if (v != null) tokens.add(String(v).toLowerCase());
    }
    const exMatches = matchingExceptions(rule.exceptions, tokens).filter(
      (e) => e.blocksAdvice,
    );
    if (exMatches.length > 0) {
      excluded.push({
        ruleId: rule.ruleId,
        reasonCode: LookupReasonCode.EXCEPTION_MATCHED,
        detail: exMatches.map((e) => e.exceptionId).join(','),
      });
      continue;
    }

    matched.push({
      ruleId: rule.ruleId,
      ruleVersion: rule.ruleVersion,
      domain: rule.domain,
      knowledgeType: rule.knowledgeType,
      confidence: rule.confidence,
      subjectivity: rule.subjectivity,
      adviceTypeHint: rule.recommendationPattern.adviceTypeHint,
      reasonCode: LookupReasonCode.MATCHED,
    });
  }

  if (matched.length === 0) {
    reasonCodes.add(LookupReasonCode.NO_APPLICABLE_CURATED_RULE);
  } else {
    reasonCodes.add(LookupReasonCode.MATCHED);
  }

  return Object.freeze({
    schemaVersion: FASHION_KNOWLEDGE_LOOKUP_VERSION,
    matchedRules: Object.freeze(matched),
    excludedRules: Object.freeze(excluded),
    conflictRefs: Object.freeze(conflictRefs),
    appliedFilters: Object.freeze(appliedFilters.sort()),
    registryVersion: registry.registryVersion,
    snapshotId: snapshot.snapshotId,
    queryHash,
    reasonCodes: Object.freeze([...reasonCodes].sort()),
    runtime: {
      status: (matched.length ? 'ok' : 'empty') as 'ok' | 'empty',
      elapsedMs: Math.max(0, Date.now() - started),
    },
  });
}

/** FK-3 integration boundary: read-only curated availability. Does NOT invoke LLM. */
export function askApplicableCuratedRules(
  registry: FashionKnowledgeRegistry,
  query: FashionKnowledgeLookupQuery,
): CuratedRuleAvailability {
  const lookup = lookupFashionKnowledgeRules(registry, query);
  const available = lookup.matchedRules.length > 0;
  return {
    available,
    code: available
      ? LookupReasonCode.MATCHED
      : LookupReasonCode.NO_APPLICABLE_CURATED_RULE,
    matchedRuleIds: lookup.matchedRules.map((m) => m.ruleId),
    lookup,
  };
}

export function getRuleById(
  registry: FashionKnowledgeRegistry,
  ruleId: string,
): FashionKnowledgeRule | undefined {
  return registry.rules.find((r) => r.ruleId === ruleId);
}
