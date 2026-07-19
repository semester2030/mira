import { CanonicalGarment } from '../garment/canonical-garment';
import { OutfitEvidenceGraphBuilder } from './outfit-evidence-graph';

export interface HarmonyResult {
  evidenceIds: string[];
  limitationCodes: string[];
  colorSupport: number;
  styleSupport: number;
}

/**
 * Harmony Engine — color + style coherence from evidenced attributes only.
 */
export class HarmonyEngine {
  evaluate(
    garments: CanonicalGarment[],
    graph: OutfitEvidenceGraphBuilder,
  ): HarmonyResult {
    const evidenceIds: string[] = [];
    const limitationCodes: string[] = [];
    const colors = garments.flatMap((g) => g.attributes.colors);
    const hints = garments.flatMap((g) => g.attributes.styleHints);

    if (colors.length === 0) {
      limitationCodes.push('missing_evidence:harmony_color');
      evidenceIds.push(
        graph.add({
          kind: 'harmony',
          claim: 'no_evidenced_colors',
          polarity: 'conflicts',
          strength: 0.2,
          subjectRefs: garments.map((g) => g.garmentId),
          sourceRefs: ['harmony.colors'],
          engineId: 'harmony',
        }),
      );
    } else {
      const stems = colors.map((c) => c.split('_')[0] ?? c);
      const unique = new Set(stems);
      const shared = stems.length - unique.size;
      const colorSupport = clamp01(0.55 + shared * 0.1 + (unique.size <= 3 ? 0.15 : 0));
      evidenceIds.push(
        graph.add({
          kind: 'harmony',
          claim: `color_palette_size:${unique.size}`,
          polarity: unique.size <= 4 ? 'supports' : 'neutral',
          strength: colorSupport,
          subjectRefs: garments.map((g) => g.garmentId),
          sourceRefs: garments.map((g) => `garment.${g.garmentId}.colors`),
          engineId: 'harmony',
        }),
      );
    }

    if (hints.length === 0) {
      limitationCodes.push('missing_evidence:harmony_style');
      evidenceIds.push(
        graph.add({
          kind: 'harmony',
          claim: 'no_evidenced_style_hints',
          polarity: 'neutral',
          strength: 0.35,
          subjectRefs: garments.map((g) => g.garmentId),
          sourceRefs: ['harmony.styleHints'],
          engineId: 'harmony',
        }),
      );
    } else {
      const counts = new Map<string, number>();
      for (const h of hints) counts.set(h, (counts.get(h) ?? 0) + 1);
      const overlap = [...counts.values()].filter((n) => n > 1).length;
      const styleSupport = clamp01(0.5 + overlap * 0.2);
      evidenceIds.push(
        graph.add({
          kind: 'harmony',
          claim: `style_hint_overlap:${overlap}`,
          polarity: overlap > 0 ? 'supports' : 'neutral',
          strength: styleSupport,
          subjectRefs: garments.map((g) => g.garmentId),
          sourceRefs: garments.map((g) => `garment.${g.garmentId}.styleHints`),
          engineId: 'harmony',
        }),
      );
    }

    const colorEv = evidenceIds[0];
    const styleEv = evidenceIds[1] ?? evidenceIds[0];
    const colorSupport = graph.getRecords().find((r) => r.evidenceId === colorEv)?.strength ?? 0;
    const styleSupport = graph.getRecords().find((r) => r.evidenceId === styleEv)?.strength ?? 0;

    return {
      evidenceIds,
      limitationCodes,
      colorSupport,
      styleSupport,
    };
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
