import { CanonicalOutfit } from './canonical-outfit';
import {
  collectCitedEvidenceIds,
  OutfitEvidenceGraph,
} from './outfit-evidence-graph';
import { assertNoFashionProviderLeakage } from '../runtime/fashion-runtime-state';

export interface OutfitValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface OutfitValidationResult {
  valid: boolean;
  issues: OutfitValidationIssue[];
}

const VALID_STATUSES = new Set(['AVAILABLE', 'PARTIAL', 'DEGRADED', 'FAILED', 'UNAVAILABLE']);

export function validateCanonicalOutfit(
  outfit: CanonicalOutfit,
  graph?: OutfitEvidenceGraph,
): OutfitValidationResult {
  const issues: OutfitValidationIssue[] = [];

  if (!outfit.outfitId) {
    issues.push({ code: 'missing_id', path: 'outfitId', message: 'outfitId required' });
  }
  if (outfit.version !== 'outfit-schema-v1') {
    issues.push({
      code: 'invalid_version',
      path: 'version',
      message: 'Expected outfit-schema-v1',
    });
  }

  const seen = new Set<string>();
  for (const [i, id] of outfit.garmentIds.entries()) {
    if (seen.has(id)) {
      issues.push({
        code: 'duplicate_garments',
        path: `garmentIds[${i}]`,
        message: `Duplicate ${id}`,
      });
    }
    seen.add(id);
  }

  for (const slot of outfit.slots) {
    if (!outfit.garmentIds.includes(slot.garmentId)) {
      issues.push({
        code: 'broken_references',
        path: 'slots',
        message: `Slot garment ${slot.garmentId} not in garmentIds`,
      });
    }
  }

  // Honest completeness: look_complete metric must not appear if incomplete slots
  const slotSet = new Set(outfit.slots.map((s) => s.slot));
  const hasFullBody = slotSet.has('full_body');
  const hasUpper = slotSet.has('base') || slotSet.has('mid');
  const hasLower = slotSet.has('lower');
  const structurallyComplete =
    outfit.garmentIds.length > 0 && (hasFullBody || (hasUpper && hasLower));
  const completenessMetric = outfit.metrics.find((m) => m.name === 'completeness');
  if (completenessMetric && graph) {
    const claims = graph.records
      .filter((r) => completenessMetric.evidenceIds.includes(r.evidenceId))
      .map((r) => r.claim);
    if (claims.some((c) => c === 'look_complete') && !structurallyComplete) {
      issues.push({
        code: 'dishonest_completeness',
        path: 'metrics.completeness',
        message: 'look_complete claimed without upper+lower or full_body',
      });
    }
  }

  for (const [i, m] of outfit.metrics.entries()) {
    if (!m.evidenceIds.length) {
      issues.push({
        code: 'metrics_without_evidence',
        path: `metrics[${i}]`,
        message: `Metric ${m.name} has no evidence`,
      });
    }
  }
  for (const [i, f] of outfit.fieldConfidence.entries()) {
    if (!f.evidenceIds.length) {
      issues.push({
        code: 'confidence_without_evidence',
        path: `fieldConfidence[${i}]`,
        message: `Field ${f.field} confidence without evidence`,
      });
    }
  }

  if (typeof outfit.runtime?.retryable !== 'boolean') {
    issues.push({
      code: 'invalid_runtime',
      path: 'runtime.retryable',
      message: 'retryable required',
    });
  }
  if (outfit.runtime?.status && !VALID_STATUSES.has(outfit.runtime.status)) {
    issues.push({
      code: 'invalid_runtime_status',
      path: 'runtime.status',
      message: `Unexpected status ${outfit.runtime.status}`,
    });
  }
  if (
    outfit.runtime?.status === 'FAILED' &&
    outfit.runtime.reasonCode === 'outfit_evaluation_complete'
  ) {
    issues.push({
      code: 'invalid_runtime_reason',
      path: 'runtime.reasonCode',
      message: 'FAILED must not use outfit_evaluation_complete',
    });
  }

  if (graph) {
    const ids = new Set(graph.records.map((r) => r.evidenceId));
    const cited = collectCitedEvidenceIds({
      metrics: outfit.metrics,
      fieldConfidence: outfit.fieldConfidence,
      explainability: outfit.explainability,
    });

    for (const m of outfit.metrics) {
      for (const e of m.evidenceIds) {
        if (!ids.has(e)) {
          issues.push({
            code: 'broken_evidence_references',
            path: 'metrics',
            message: `Missing evidence ${e}`,
          });
        }
      }
    }
    for (const x of outfit.explainability) {
      for (const e of x.evidenceRefs) {
        if (!ids.has(e)) {
          issues.push({
            code: 'broken_evidence_references',
            path: 'explainability',
            message: `Missing evidence ${e}`,
          });
        }
      }
    }

    // Uncited evidence (CanonicalOutfit path — metrics/explain must cite)
    for (const r of graph.records) {
      if (!cited.has(r.evidenceId)) {
        issues.push({
          code: 'uncited_evidence',
          path: 'evidenceGraph',
          message: `Uncited evidence ${r.evidenceId} (${r.kind})`,
        });
      }
    }

    for (const r of graph.records) {
      for (const sub of r.subjectRefs) {
        if (
          sub.startsWith('garm_') &&
          outfit.garmentIds.length &&
          !outfit.garmentIds.includes(sub) &&
          sub !== outfit.outfitId
        ) {
          issues.push({
            code: 'orphan_evidence',
            path: 'evidenceGraph',
            message: `Orphan subject ${sub}`,
          });
        }
      }
    }

    issues.push(...validateEvidenceGraphIntegrity(graph).issues);
  }

  try {
    assertNoFashionProviderLeakage(outfit);
  } catch (e) {
    issues.push({
      code: 'provider_leakage',
      path: '$',
      message: e instanceof Error ? e.message : String(e),
    });
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Law #31 graph integrity — applies to CanonicalOutfit graphs AND capability-only paths.
 * Does not require metrics/explain citation (those apply only to full outfit evaluation).
 */
export function validateEvidenceGraphIntegrity(
  graph: OutfitEvidenceGraph,
): OutfitValidationResult {
  const issues: OutfitValidationIssue[] = [];
  const ids = new Set<string>();

  if (graph.records.length === 0) {
    issues.push({
      code: 'missing_evidence',
      path: 'evidenceGraph',
      message: 'Evidence graph empty',
    });
  }

  for (const r of graph.records) {
    if (ids.has(r.evidenceId)) {
      issues.push({
        code: 'duplicate_evidence',
        path: 'evidenceGraph',
        message: `Duplicate evidenceId ${r.evidenceId}`,
      });
    }
    ids.add(r.evidenceId);
  }

  if (graph.records.length > 1 && graph.edges.length === 0) {
    issues.push({
      code: 'missing_evidence_edges',
      path: 'evidenceGraph.edges',
      message: 'Multi-record graph has no edges (Law #31)',
    });
  }

  for (const edge of graph.edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) {
      issues.push({
        code: 'broken_graph_edges',
        path: 'evidenceGraph.edges',
        message: `Edge ${edge.from}→${edge.to} references missing record`,
      });
    }
  }

  if (graph.records.length > 1) {
    const connected = new Set<string>();
    for (const e of graph.edges) {
      connected.add(e.from);
      connected.add(e.to);
    }
    for (const r of graph.records) {
      if (!connected.has(r.evidenceId)) {
        issues.push({
          code: 'unconnected_evidence',
          path: 'evidenceGraph',
          message: `Record ${r.evidenceId} not connected by edges`,
        });
      }
    }
  }

  return { valid: issues.length === 0, issues };
}

export function assertValidEvidenceGraph(graph: OutfitEvidenceGraph): void {
  const r = validateEvidenceGraphIntegrity(graph);
  if (!r.valid) {
    throw new Error(
      `Evidence graph validation failed: ${r.issues.map((i) => i.code).join(',')}`,
    );
  }
}

export function assertValidOutfit(
  outfit: CanonicalOutfit,
  graph?: OutfitEvidenceGraph,
): void {
  const r = validateCanonicalOutfit(outfit, graph);
  if (!r.valid) {
    throw new Error(
      `Outfit validation failed: ${r.issues.map((i) => i.code).join(',')}`,
    );
  }
}
