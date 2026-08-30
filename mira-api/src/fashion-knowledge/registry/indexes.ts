/**
 * FK-4 — Deterministic registry indexes.
 */
import type { FashionKnowledgeRule } from '../knowledge/fashion-knowledge-rule';
import { RuleLifecycleStatus } from '../knowledge/fashion-knowledge-rule';
import type { FashionKnowledgeRegistryIndexes } from './contracts';

function push(
  map: Record<string, string[]>,
  key: string,
  ruleId: string,
): void {
  const k = key || '_unset';
  if (!map[k]) map[k] = [];
  map[k]!.push(ruleId);
}

function freezeMap(
  map: Record<string, string[]>,
): Readonly<Record<string, readonly string[]>> {
  const out: Record<string, readonly string[]> = {};
  for (const k of Object.keys(map).sort()) {
    out[k] = Object.freeze([...new Set(map[k]!)].sort());
  }
  return Object.freeze(out);
}

function trendState(rule: FashionKnowledgeRule, nowIso?: string): string {
  if (!rule.trendValidity) return 'none';
  if (!nowIso) return 'unknown_clock';
  if (nowIso < rule.trendValidity.validFrom) return 'future';
  if (nowIso > rule.trendValidity.validTo) return 'expired';
  return 'current';
}

export function buildRegistryIndexes(
  rules: readonly FashionKnowledgeRule[],
  nowIso?: string,
): FashionKnowledgeRegistryIndexes {
  const byRuleId: Record<string, string> = {};
  const byDomain: Record<string, string[]> = {};
  const byKnowledgeType: Record<string, string[]> = {};
  const byStatus: Record<string, string[]> = {};
  const byOccasion: Record<string, string[]> = {};
  const byCulturalContext: Record<string, string[]> = {};
  const bySourceType: Record<string, string[]> = {};
  const bySubjectivity: Record<string, string[]> = {};
  const byConfidence: Record<string, string[]> = {};
  const byTrendState: Record<string, string[]> = {};

  const sorted = [...rules].sort((a, b) => a.ruleId.localeCompare(b.ruleId));
  for (const rule of sorted) {
    byRuleId[rule.ruleId] = rule.ruleVersion;
    push(byDomain, rule.domain, rule.ruleId);
    push(byKnowledgeType, rule.knowledgeType, rule.ruleId);
    push(byStatus, rule.status, rule.ruleId);
    push(bySourceType, rule.provenance.sourceType, rule.ruleId);
    push(bySubjectivity, rule.subjectivity, rule.ruleId);
    push(byConfidence, rule.confidence, rule.ruleId);
    push(byTrendState, trendState(rule, nowIso), rule.ruleId);
    for (const o of rule.occasionContext) push(byOccasion, o.toLowerCase(), rule.ruleId);
    for (const c of rule.culturalContext) {
      push(byCulturalContext, c.toLowerCase(), rule.ruleId);
    }
    if (rule.occasionContext.length === 0) push(byOccasion, '_none', rule.ruleId);
    if (rule.culturalContext.length === 0) {
      push(byCulturalContext, '_none', rule.ruleId);
    }
  }

  return Object.freeze({
    byRuleId: Object.freeze({ ...byRuleId }),
    byDomain: freezeMap(byDomain),
    byKnowledgeType: freezeMap(byKnowledgeType),
    byStatus: freezeMap(byStatus),
    byOccasion: freezeMap(byOccasion),
    byCulturalContext: freezeMap(byCulturalContext),
    bySourceType: freezeMap(bySourceType),
    bySubjectivity: freezeMap(bySubjectivity),
    byConfidence: freezeMap(byConfidence),
    byTrendState: freezeMap(byTrendState),
  });
}

export function activeRuleIds(
  rules: readonly FashionKnowledgeRule[],
): readonly string[] {
  return Object.freeze(
    rules
      .filter(
        (r) =>
          r.status === RuleLifecycleStatus.ACTIVE &&
          r.lifecycle === RuleLifecycleStatus.ACTIVE &&
          r.testOnly !== true,
      )
      .map((r) => r.ruleId)
      .sort(),
  );
}
