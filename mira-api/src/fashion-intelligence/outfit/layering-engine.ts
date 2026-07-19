import { OutfitSlotAssignment } from './canonical-outfit';
import { OutfitEvidenceGraphBuilder } from './outfit-evidence-graph';

export interface LayeringResult {
  evidenceIds: string[];
  limitationCodes: string[];
  legal: boolean;
  supportStrength: number;
}

const ORDER: Record<string, number> = {
  base: 1,
  mid: 2,
  outer: 3,
  full_body: 2,
  lower: 1,
  feet: 4,
  accessory: 5,
  unknown: 0,
};

/**
 * Layering Engine — legality, ordering, silhouette/coverage checks.
 */
export class LayeringEngine {
  evaluate(
    slots: OutfitSlotAssignment[],
    graph: OutfitEvidenceGraphBuilder,
  ): LayeringResult {
    const evidenceIds: string[] = [];
    const limitationCodes: string[] = [];
    let legal = true;
    let supportStrength = 0.8;

    const outers = slots.filter((s) => s.slot === 'outer');
    if (outers.length > 2) {
      legal = false;
      limitationCodes.push('invalid_layering');
      evidenceIds.push(
        graph.add({
          kind: 'layering',
          claim: 'too_many_outer_layers',
          polarity: 'conflicts',
          strength: 0.9,
          subjectRefs: outers.map((s) => s.garmentId),
          sourceRefs: ['layering.outer_limit'],
          engineId: 'layering',
        }),
      );
      supportStrength = 0.2;
    }

    const full = slots.filter((s) => s.slot === 'full_body');
    if (full.length === 1 && outers.length > 1) {
      limitationCodes.push('layering_coverage_warn');
      evidenceIds.push(
        graph.add({
          kind: 'layering',
          claim: 'full_body_multi_outer',
          polarity: 'neutral',
          strength: 0.5,
          subjectRefs: [...full, ...outers].map((s) => s.garmentId),
          sourceRefs: ['layering.silhouette'],
          engineId: 'layering',
        }),
      );
      supportStrength = Math.min(supportStrength, 0.55);
    }

    const ordered = [...slots].sort(
      (a, b) => (ORDER[a.slot] ?? 0) - (ORDER[b.slot] ?? 0),
    );
    evidenceIds.push(
      graph.add({
        kind: 'layering',
        claim: `order:${ordered.map((s) => s.slot).join('>')}`,
        polarity: legal ? 'supports' : 'conflicts',
        strength: supportStrength,
        subjectRefs: ordered.map((s) => s.garmentId),
        sourceRefs: ['layering.order'],
        engineId: 'layering',
      }),
    );

    const bodySlots = slots.filter((s) =>
      ['base', 'mid', 'outer', 'full_body', 'lower'].includes(s.slot),
    );
    if (bodySlots.length === 0 && slots.length > 0) {
      legal = false;
      limitationCodes.push('invalid_layering');
      evidenceIds.push(
        graph.add({
          kind: 'layering',
          claim: 'no_body_layer',
          polarity: 'conflicts',
          strength: 0.95,
          subjectRefs: slots.map((s) => s.garmentId),
          sourceRefs: ['layering.coverage'],
          engineId: 'layering',
        }),
      );
      supportStrength = 0.15;
    } else if (bodySlots.length > 0) {
      evidenceIds.push(
        graph.add({
          kind: 'layering',
          claim: 'coverage_present',
          polarity: 'supports',
          strength: 0.85,
          subjectRefs: bodySlots.map((s) => s.garmentId),
          sourceRefs: ['layering.coverage'],
          engineId: 'layering',
        }),
      );
    }

    return { evidenceIds, limitationCodes, legal, supportStrength };
  }
}
