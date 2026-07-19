import { OutfitFieldConfidence, OutfitMetric } from './canonical-outfit';
import { OutfitEvidenceGraph } from './outfit-evidence-graph';

/** Versioned confidence aggregation policy — not hidden magic numbers. */
export const OUTFIT_CONFIDENCE_WEIGHTS_V1 = {
  version: 'outfit-confidence-weights-v1',
  metricAvg: 0.75,
  coverage: 0.15,
  nonConflict: 0.1,
} as const;

/**
 * Confidence Engine — Evidence → Metrics → Confidence only.
 */
export class OutfitConfidenceEngine {
  aggregate(input: {
    graph: OutfitEvidenceGraph;
    metrics: OutfitMetric[];
  }): { overall: number; fields: OutfitFieldConfidence[]; weightsVersion: string } {
    const fields: OutfitFieldConfidence[] = input.metrics.map((m) => ({
      field: m.name,
      confidence: m.value,
      evidenceIds: [...m.evidenceIds],
    }));

    if (fields.some((f) => f.evidenceIds.length === 0)) {
      throw new Error('confidence_without_evidence');
    }
    if (input.metrics.some((m) => m.evidenceIds.length === 0)) {
      throw new Error('metrics_without_evidence');
    }

    const w = OUTFIT_CONFIDENCE_WEIGHTS_V1;
    const coverage = input.graph.records.length > 0 ? 1 : 0;
    const conflictRatio =
      input.graph.records.filter((r) => r.polarity === 'conflicts').length /
      Math.max(1, input.graph.records.length);
    const metricAvg =
      fields.length === 0
        ? 0
        : fields.reduce((s, f) => s + f.confidence, 0) / fields.length;

    const overall = clamp01(
      metricAvg * w.metricAvg + coverage * w.coverage + (1 - conflictRatio) * w.nonConflict,
    );
    return { overall, fields, weightsVersion: w.version };
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
