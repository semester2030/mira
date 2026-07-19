import { OutfitMetric } from './canonical-outfit';
import { OutfitEvidenceGraph } from './outfit-evidence-graph';

/**
 * Metrics Engine — metrics ONLY from evidence (Law #31).
 */
export class MetricsEngine {
  fromEvidence(input: {
    graph: OutfitEvidenceGraph;
    compatibilityEvidenceIds: string[];
    harmonyEvidenceIds: string[];
    layeringEvidenceIds: string[];
    occasionEvidenceIds: string[];
    weatherEvidenceIds: string[];
    modestyEvidenceIds: string[];
    compositionEvidenceIds: string[];
  }): OutfitMetric[] {
    const metrics: OutfitMetric[] = [];

    const push = (name: string, ids: string[]) => {
      if (!ids.length) return;
      const value = avgStrength(input.graph, ids);
      metrics.push({ name, value, evidenceIds: [...ids] });
    };

    push('completeness', input.compositionEvidenceIds);
    push('compatibility', input.compatibilityEvidenceIds);
    const colorIds = filterKind(input.graph, input.harmonyEvidenceIds, 'color');
    const styleIds = filterKind(input.graph, input.harmonyEvidenceIds, 'style');
    push('colorHarmony', colorIds);
    push('styleCoherence', styleIds);
    // If neither filter matched, cite harmony once under colorHarmony only (no dual silent assign)
    if (
      !colorIds.length &&
      !styleIds.length &&
      input.harmonyEvidenceIds.length
    ) {
      push('colorHarmony', input.harmonyEvidenceIds);
    }
    push('layering', input.layeringEvidenceIds);
    push('occasionFit', input.occasionEvidenceIds);
    push('climateFit', input.weatherEvidenceIds);
    push('modestyFit', input.modestyEvidenceIds);

    return metrics;
  }
}

function avgStrength(graph: OutfitEvidenceGraph, ids: string[]): number {
  const set = new Set(ids);
  const recs = graph.records.filter((r) => set.has(r.evidenceId));
  if (!recs.length) return 0;
  // conflicts pull down
  const vals = recs.map((r) =>
    r.polarity === 'conflicts' ? 1 - r.strength : r.strength,
  );
  return clamp01(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function filterKind(
  graph: OutfitEvidenceGraph,
  ids: string[],
  needle: string,
): string[] {
  const set = new Set(ids);
  return graph.records
    .filter((r) => set.has(r.evidenceId) && r.claim.includes(needle))
    .map((r) => r.evidenceId);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
