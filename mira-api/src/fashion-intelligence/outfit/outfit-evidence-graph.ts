/**
 * Outfit Evidence Graph — internal only (Law #31).
 * Real graph: records + edges. Not a public DTO.
 */

export type EvidenceKind =
  | 'composition'
  | 'compatibility'
  | 'harmony'
  | 'layering'
  | 'context.occasion'
  | 'context.weather'
  | 'context.modesty'
  | 'version';

export type EvidencePolarity = 'supports' | 'conflicts' | 'neutral';

export interface OutfitEvidenceRecord {
  evidenceId: string;
  kind: EvidenceKind;
  claim: string;
  polarity: EvidencePolarity;
  /** Evidence strength 0..1 — not public confidence */
  strength: number;
  subjectRefs: string[];
  sourceRefs: string[];
  engineId: string;
  relatedEvidenceIds?: string[];
}

export interface OutfitEvidenceEdge {
  from: string;
  to: string;
  relation: 'supports' | 'conflicts' | 'derived_from';
}

export interface OutfitEvidenceGraph {
  graphId: string;
  records: OutfitEvidenceRecord[];
  edges: OutfitEvidenceEdge[];
}

import { createHash } from 'crypto';

function stableEvidenceId(input: {
  kind: string;
  claim: string;
  subjectRefs: string[];
  engineId: string;
}): string {
  const payload = [
    input.kind,
    input.claim,
    [...input.subjectRefs].sort().join(','),
    input.engineId,
  ].join('|');
  const hash = createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, 16);
  return `ev_${hash}`;
}

export class OutfitEvidenceGraphBuilder {
  private readonly records: OutfitEvidenceRecord[] = [];
  private readonly edges: OutfitEvidenceEdge[] = [];
  private readonly edgeKeys = new Set<string>();

  constructor(private readonly graphId: string) {}

  add(input: Omit<OutfitEvidenceRecord, 'evidenceId'> & { evidenceId?: string }): string {
    const subjectRefs = [...input.subjectRefs].sort();
    const sourceRefs = [...input.sourceRefs].sort();
    const evidenceId =
      input.evidenceId ??
      stableEvidenceId({
        kind: input.kind,
        claim: input.claim,
        subjectRefs,
        engineId: input.engineId,
      });
    const existing = this.records.find((r) => r.evidenceId === evidenceId);
    if (existing) {
      return existing.evidenceId;
    }
    this.records.push({
      evidenceId,
      kind: input.kind,
      claim: input.claim,
      polarity: input.polarity,
      strength: clamp01(input.strength),
      subjectRefs,
      sourceRefs,
      engineId: input.engineId,
      relatedEvidenceIds: input.relatedEvidenceIds
        ? [...input.relatedEvidenceIds].sort()
        : undefined,
    });
    return evidenceId;
  }

  link(
    from: string,
    to: string,
    relation: OutfitEvidenceEdge['relation'],
  ): void {
    if (!from || !to || from === to) return;
    const key = `${from}|${to}|${relation}`;
    if (this.edgeKeys.has(key)) return;
    this.edgeKeys.add(key);
    this.edges.push({ from, to, relation });
  }

  /**
   * Law #31 finalize — connect version root to all records; connect relatedEvidenceIds;
   * ensure every record participates in at least one edge when |records| > 1.
   */
  finalizeLaw31(opts?: { rootEvidenceId?: string }): void {
    const root =
      opts?.rootEvidenceId ??
      this.records.find((r) => r.kind === 'version')?.evidenceId;

    for (const r of this.records) {
      if (r.relatedEvidenceIds?.length) {
        for (const rel of r.relatedEvidenceIds) {
          if (this.records.some((x) => x.evidenceId === rel)) {
            this.link(r.evidenceId, rel, 'derived_from');
          }
        }
      }
    }

    if (root) {
      for (const r of this.records) {
        if (r.evidenceId === root) continue;
        this.link(r.evidenceId, root, 'derived_from');
      }
    }

    // Single-record graphs need no edges; multi-record must be connected.
    if (this.records.length > 1 && this.edges.length === 0 && root) {
      for (const r of this.records) {
        if (r.evidenceId !== root) this.link(r.evidenceId, root, 'derived_from');
      }
    }
  }

  build(): OutfitEvidenceGraph {
    return {
      graphId: this.graphId,
      records: [...this.records].sort((a, b) =>
        a.evidenceId.localeCompare(b.evidenceId),
      ),
      edges: [...this.edges].sort((a, b) =>
        `${a.from}|${a.to}|${a.relation}`.localeCompare(
          `${b.from}|${b.to}|${b.relation}`,
        ),
      ),
    };
  }

  getRecords(): OutfitEvidenceRecord[] {
    return [...this.records];
  }
}

export function findEvidence(
  graph: OutfitEvidenceGraph,
  ids: string[],
): OutfitEvidenceRecord[] {
  const set = new Set(ids);
  return graph.records.filter((r) => set.has(r.evidenceId));
}

export function evidenceIdsOfKind(
  graph: OutfitEvidenceGraph,
  kind: EvidenceKind,
): string[] {
  return graph.records.filter((r) => r.kind === kind).map((r) => r.evidenceId);
}

/** Collect all evidence ids cited by public outfit projections. */
export function collectCitedEvidenceIds(input: {
  metrics: Array<{ evidenceIds: string[] }>;
  fieldConfidence: Array<{ evidenceIds: string[] }>;
  explainability: Array<{ evidenceRefs: string[] }>;
}): Set<string> {
  const cited = new Set<string>();
  for (const m of input.metrics) {
    for (const e of m.evidenceIds) cited.add(e);
  }
  for (const f of input.fieldConfidence) {
    for (const e of f.evidenceIds) cited.add(e);
  }
  for (const x of input.explainability) {
    for (const e of x.evidenceRefs) cited.add(e);
  }
  return cited;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
