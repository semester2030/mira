/**
 * FK-4 — Supersession / circular relation detection.
 */
import {
  RuleRelationType,
  type FashionRuleRelation,
} from '../contracts/conflicts';

export interface SupersessionAnalysis {
  readonly supersededRuleIds: ReadonlySet<string>;
  readonly cycles: readonly string[];
  readonly valid: boolean;
}

export function analyzeSupersession(
  relations: readonly FashionRuleRelation[],
): SupersessionAnalysis {
  const supersedes = relations.filter(
    (r) => r.type === RuleRelationType.SUPERSEDES,
  );
  const superseded = new Set<string>();
  const graph = new Map<string, string[]>();
  for (const r of supersedes) {
    superseded.add(r.toRuleId);
    const list = graph.get(r.fromRuleId) ?? [];
    list.push(r.toRuleId);
    graph.set(r.fromRuleId, list);
  }

  const cycles: string[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(node: string, path: string[]): void {
    if (visiting.has(node)) {
      const i = path.indexOf(node);
      cycles.push([...path.slice(i), node].join('->'));
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    for (const next of graph.get(node) ?? []) {
      dfs(next, [...path, node]);
    }
    visiting.delete(node);
    visited.add(node);
  }

  for (const node of graph.keys()) dfs(node, []);

  return {
    supersededRuleIds: superseded,
    cycles: Object.freeze([...new Set(cycles)].sort()),
    valid: cycles.length === 0,
  };
}

export function isSuperseded(
  ruleId: string,
  analysis: SupersessionAnalysis,
): boolean {
  return analysis.supersededRuleIds.has(ruleId);
}
