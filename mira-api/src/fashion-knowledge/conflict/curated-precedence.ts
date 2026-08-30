/**
 * FK-2 — Curated rule precedence over LLM general knowledge.
 */
import { KnowledgeType } from '../contracts/knowledge-types';
import { RuleRelationType, type FashionRuleRelation } from '../contracts/conflicts';
import type { FashionKnowledgeRule } from '../knowledge/fashion-knowledge-rule';
import { isProductionEligibleRule } from '../knowledge/fashion-knowledge-rule';
import { FASHION_CONFLICT_POLICY_VERSION } from '../versioning/release';

export interface PrecedenceDecision {
  readonly version: typeof FASHION_CONFLICT_POLICY_VERSION;
  readonly winner: 'curated_rule' | 'llm' | 'none' | 'record_conflict';
  readonly winningRuleId?: string;
  readonly notes: string;
  readonly relationsRecorded: readonly FashionRuleRelation[];
}

/**
 * Applicable ACTIVE APPROVED Mira Rule > LLM_GENERAL_KNOWLEDGE.
 * User preference may still influence alternative selection later —
 * precedence here is for domain knowledge ownership only.
 */
export function resolveCuratedOverLlm(input: {
  readonly curatedRules: readonly FashionKnowledgeRule[];
  readonly llmCandidateRuleIds: readonly string[];
  readonly domain: string;
}): PrecedenceDecision {
  const applicable = input.curatedRules.filter(
    (r) =>
      (isProductionEligibleRule(r) || r.testOnly === true) &&
      r.domain === input.domain &&
      r.knowledgeType !== KnowledgeType.LLM_GENERAL_KNOWLEDGE,
  );

  if (applicable.length === 0) {
    return {
      version: FASHION_CONFLICT_POLICY_VERSION,
      winner: input.llmCandidateRuleIds.length > 0 ? 'llm' : 'none',
      notes: 'No curated applicable rule; LLM may proceed under Claim Lock',
      relationsRecorded: [],
    };
  }

  const winner = applicable[0]!;
  const relations: FashionRuleRelation[] = input.llmCandidateRuleIds.map(
    (llmId, i) => ({
      relationId: `rel_curated_over_llm_${i}`,
      fromRuleId: winner.ruleId,
      toRuleId: llmId,
      type: RuleRelationType.CONFLICTS,
      notes: 'Curated domain knowledge outranks LLM general knowledge',
    }),
  );

  return {
    version: FASHION_CONFLICT_POLICY_VERSION,
    winner: 'curated_rule',
    winningRuleId: winner.ruleId,
    notes:
      'Curated rule wins domain knowledge; LLM must not silently overwrite',
    relationsRecorded: relations,
  };
}
