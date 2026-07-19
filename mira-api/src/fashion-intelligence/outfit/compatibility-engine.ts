import { CanonicalGarment } from '../garment/canonical-garment';
import { OutfitEvidenceGraphBuilder } from './outfit-evidence-graph';
import { OutfitSlotAssignment } from './canonical-outfit';

export interface CompatibilityResult {
  hardConflicts: string[];
  softConflicts: string[];
  evidenceIds: string[];
  limitationCodes: string[];
  /** Metric value derived later only via evidence ids */
  supportStrengthAvg: number;
}

/**
 * Compatibility Engine — pair/set fit. No recommendations.
 */
export class CompatibilityEngine {
  evaluate(
    garments: CanonicalGarment[],
    slots: OutfitSlotAssignment[],
    graph: OutfitEvidenceGraphBuilder,
  ): CompatibilityResult {
    const byId = new Map(garments.map((g) => [g.garmentId, g]));
    const hardConflicts: string[] = [];
    const softConflicts: string[] = [];
    const evidenceIds: string[] = [];
    const limitationCodes: string[] = [];
    const strengths: number[] = [];

    const fullBody = slots.filter((s) => s.slot === 'full_body');
    if (fullBody.length > 1) {
      const claim = 'hard:multiple_full_body';
      hardConflicts.push(claim);
      evidenceIds.push(
        graph.add({
          kind: 'compatibility',
          claim,
          polarity: 'conflicts',
          strength: 1,
          subjectRefs: fullBody.map((s) => s.garmentId),
          sourceRefs: ['compatibility.slot_rules'],
          engineId: 'compatibility',
        }),
      );
      strengths.push(0);
    }

    const hasFull = fullBody.length === 1;
    const hasLower = slots.some((s) => s.slot === 'lower');
    const hasBase = slots.some((s) => s.slot === 'base' || s.slot === 'mid');
    if (hasFull && (hasLower || hasBase)) {
      const claim = 'hard:full_body_with_separates';
      hardConflicts.push(claim);
      evidenceIds.push(
        graph.add({
          kind: 'compatibility',
          claim,
          polarity: 'conflicts',
          strength: 0.95,
          subjectRefs: slots.map((s) => s.garmentId),
          sourceRefs: ['compatibility.slot_rules'],
          engineId: 'compatibility',
        }),
      );
      strengths.push(0.05);
    }

    // Pairwise soft color stem conflicts
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const a = byId.get(slots[i].garmentId);
        const b = byId.get(slots[j].garmentId);
        if (!a || !b) continue;
        const stemA = colorStem(a.attributes.colors[0]);
        const stemB = colorStem(b.attributes.colors[0]);
        if (stemA && stemB && isClashPair(stemA, stemB)) {
          const claim = `soft:color_clash:${stemA}_${stemB}`;
          softConflicts.push(claim);
          evidenceIds.push(
            graph.add({
              kind: 'compatibility',
              claim,
              polarity: 'conflicts',
              strength: 0.55,
              subjectRefs: [a.garmentId, b.garmentId],
              sourceRefs: [
                `garment.${a.garmentId}.colors`,
                `garment.${b.garmentId}.colors`,
              ],
              engineId: 'compatibility',
            }),
          );
          strengths.push(0.45);
        } else if (stemA && stemB) {
          evidenceIds.push(
            graph.add({
              kind: 'compatibility',
              claim: `pair_ok:${a.garmentId},${b.garmentId}`,
              polarity: 'supports',
              strength: 0.75,
              subjectRefs: [a.garmentId, b.garmentId],
              sourceRefs: [
                `garment.${a.garmentId}.colors`,
                `garment.${b.garmentId}.colors`,
              ],
              engineId: 'compatibility',
            }),
          );
          strengths.push(0.75);
        }
      }
    }

    if (slots.length === 1) {
      evidenceIds.push(
        graph.add({
          kind: 'compatibility',
          claim: 'single_piece_set',
          polarity: 'neutral',
          strength: 0.7,
          subjectRefs: [slots[0].garmentId],
          sourceRefs: ['compatibility.set'],
          engineId: 'compatibility',
        }),
      );
      strengths.push(0.7);
    }

    if (hardConflicts.length) {
      limitationCodes.push('invalid_compatibility');
    } else if (softConflicts.length) {
      limitationCodes.push('soft_compatibility_conflicts');
    }

    if (!evidenceIds.length) {
      limitationCodes.push('missing_evidence:compatibility');
      evidenceIds.push(
        graph.add({
          kind: 'compatibility',
          claim: 'no_pairs_evaluated',
          polarity: 'neutral',
          strength: 0.3,
          subjectRefs: slots.map((s) => s.garmentId),
          sourceRefs: ['compatibility.empty'],
          engineId: 'compatibility',
        }),
      );
      strengths.push(0.3);
    }

    const supportStrengthAvg =
      strengths.length === 0
        ? 0
        : strengths.reduce((a, b) => a + b, 0) / strengths.length;

    return {
      hardConflicts,
      softConflicts,
      evidenceIds,
      limitationCodes,
      supportStrengthAvg,
    };
  }
}

function colorStem(color?: string): string {
  if (!color) return '';
  return color.toLowerCase().split('_')[0] ?? '';
}

function isClashPair(a: string, b: string): boolean {
  if (a === b) return false;
  const clashes: Array<[string, string]> = [
    ['red', 'pink'],
    ['orange', 'red'],
    ['green', 'red'],
  ];
  return clashes.some(
    ([x, y]) => (a === x && b === y) || (a === y && b === x),
  );
}
