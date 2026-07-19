import { OutfitExplainability } from './canonical-outfit';
import { OutfitEvidenceGraph } from './outfit-evidence-graph';
import { OutfitLimitationEngine } from './limitation-engine';

/**
 * Explainability Engine — consumes ONLY Outfit Evidence Graph.
 */
export class OutfitExplainabilityEngine {
  private readonly limitations = new OutfitLimitationEngine();

  build(input: {
    graph: OutfitEvidenceGraph;
    limitationCodes: string[];
    /** Evidence that must always be cited (e.g. version root) */
    alwaysCite?: string[];
  }): OutfitExplainability[] {
    const out: OutfitExplainability[] = [];
    const always = (input.alwaysCite ?? []).filter((id) =>
      input.graph.records.some((r) => r.evidenceId === id),
    );

    if (always.length) {
      out.push({
        code: 'version_root',
        reasonEn: 'Evaluation versioning evidence.',
        reasonAr: 'أدلة إصدار التقييم.',
        evidenceRefs: always,
      });
    }

    const supporting = input.graph.records
      .filter((r) => r.polarity === 'supports')
      .sort((a, b) => b.strength - a.strength || a.evidenceId.localeCompare(b.evidenceId))
      .slice(0, 3);
    for (const r of supporting) {
      out.push({
        code: `evidence_${r.kind}`,
        reasonEn: `Supported by ${r.kind}: ${r.claim}.`,
        reasonAr: `مدعوم بـ ${r.kind}: ${r.claim}.`,
        evidenceRefs: [r.evidenceId],
      });
    }

    const conflicting = input.graph.records
      .filter((r) => r.polarity === 'conflicts')
      .sort((a, b) => b.strength - a.strength || a.evidenceId.localeCompare(b.evidenceId))
      .slice(0, 3);
    for (const r of conflicting) {
      out.push({
        code: `conflict_${r.kind}`,
        reasonEn: `Conflict in ${r.kind}: ${r.claim}.`,
        reasonAr: `تعارض في ${r.kind}: ${r.claim}.`,
        evidenceRefs: [r.evidenceId],
      });
    }

    for (const t of this.limitations.textsForExplain(input.limitationCodes)) {
      const related = input.graph.records
        .filter(
          (r) =>
            r.claim.includes(t.code.split(':')[0] ?? '') ||
            t.code.includes(r.kind) ||
            r.claim.includes(t.code),
        )
        .map((r) => r.evidenceId)
        .slice(0, 4);
      const refs =
        related.length > 0
          ? related
          : always.length
            ? always
            : input.graph.records.slice(0, 1).map((r) => r.evidenceId);
      out.push({
        code: t.code,
        reasonEn: t.en,
        reasonAr: t.ar,
        evidenceRefs: refs,
      });
    }

    if (!out.length && input.graph.records.length) {
      const r = [...input.graph.records].sort((a, b) =>
        a.evidenceId.localeCompare(b.evidenceId),
      )[0];
      out.push({
        code: 'evaluated',
        reasonEn: 'Outfit evaluated with structured evidence.',
        reasonAr: 'تم تقييم الإطلالة بأدلة منظمة.',
        evidenceRefs: [r.evidenceId],
      });
    }

    return out;
  }
}
