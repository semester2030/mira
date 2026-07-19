import { CanonicalGarment } from '../garment/canonical-garment';
import { OutfitSlot, OutfitSlotAssignment } from './canonical-outfit';
import { OutfitEvidenceGraphBuilder } from './outfit-evidence-graph';

export interface CompositionResult {
  slots: OutfitSlotAssignment[];
  garmentIds: string[];
  complete: boolean;
  duplicateGarmentIds: string[];
  evidenceIds: string[];
  limitationCodes: string[];
  completenessEvidenceId?: string;
}

/**
 * Composition Engine — deterministic slot assignment from CanonicalGarment[].
 * Completeness is evidence-driven: full_body OR (upper ∧ lower). Outer/lower alone ≠ complete.
 */
export class CompositionEngine {
  compose(
    garments: CanonicalGarment[],
    graph: OutfitEvidenceGraphBuilder,
  ): CompositionResult {
    const limitationCodes: string[] = [];
    const evidenceIds: string[] = [];
    const ids = garments.map((g) => g.garmentId);
    const seen = new Set<string>();
    const duplicateGarmentIds: string[] = [];
    for (const id of ids) {
      if (seen.has(id)) duplicateGarmentIds.push(id);
      seen.add(id);
    }
    if (duplicateGarmentIds.length) {
      limitationCodes.push('duplicate_garments');
      evidenceIds.push(
        graph.add({
          kind: 'composition',
          claim: `duplicate_garment_ids:${[...new Set(duplicateGarmentIds)].sort().join(',')}`,
          polarity: 'conflicts',
          strength: 1,
          subjectRefs: [...new Set(duplicateGarmentIds)],
          sourceRefs: ['composition.duplicate_check'],
          engineId: 'composition',
        }),
      );
    }

    // Deterministic order — sort by garmentId
    const uniqueGarments = garments
      .filter((g, i) => ids.indexOf(g.garmentId) === i)
      .sort((a, b) => a.garmentId.localeCompare(b.garmentId));

    const slots: OutfitSlotAssignment[] = uniqueGarments.map((g) => ({
      garmentId: g.garmentId,
      slot: assignSlot(g),
    }));

    const slotEvidenceIds: string[] = [];
    for (const s of slots) {
      const eid = graph.add({
        kind: 'composition',
        claim: `slot_assigned:${s.slot}`,
        polarity: 'supports',
        strength: s.slot === 'unknown' ? 0.4 : 0.9,
        subjectRefs: [s.garmentId],
        sourceRefs: [
          `garment.${s.garmentId}.category`,
          `garment.${s.garmentId}.type`,
        ],
        engineId: 'composition',
      });
      evidenceIds.push(eid);
      slotEvidenceIds.push(eid);
    }

    const slotSet = new Set(slots.map((s) => s.slot));
    const hasFullBody = slotSet.has('full_body');
    const hasUpper = slotSet.has('base') || slotSet.has('mid');
    const hasLower = slotSet.has('lower');
    // Outer-only / lower-only / outer+lower without upper = incomplete
    const complete =
      uniqueGarments.length > 0 && (hasFullBody || (hasUpper && hasLower));

    let completenessEvidenceId: string | undefined;
    if (!uniqueGarments.length) {
      limitationCodes.push('incomplete_outfit');
      completenessEvidenceId = graph.add({
        kind: 'composition',
        claim: 'empty_garment_set',
        polarity: 'conflicts',
        strength: 1,
        subjectRefs: [],
        sourceRefs: ['composition.input'],
        engineId: 'composition',
        relatedEvidenceIds: slotEvidenceIds,
      });
      evidenceIds.push(completenessEvidenceId);
    } else if (!complete) {
      limitationCodes.push('incomplete_outfit');
      const reason = completenessGapReason(slotSet);
      completenessEvidenceId = graph.add({
        kind: 'composition',
        claim: `incomplete_look:${reason}`,
        polarity: 'conflicts',
        strength: 0.85,
        subjectRefs: uniqueGarments.map((g) => g.garmentId),
        sourceRefs: ['composition.completeness', ...slotEvidenceIds.map((id) => `evidence.${id}`)],
        engineId: 'composition',
        relatedEvidenceIds: slotEvidenceIds,
      });
      evidenceIds.push(completenessEvidenceId);
      for (const sid of slotEvidenceIds) {
        graph.link(completenessEvidenceId, sid, 'derived_from');
      }
    } else {
      completenessEvidenceId = graph.add({
        kind: 'composition',
        claim: 'look_complete',
        polarity: 'supports',
        strength: 0.85,
        subjectRefs: uniqueGarments.map((g) => g.garmentId),
        sourceRefs: [
          'composition.completeness',
          hasFullBody ? 'slot.full_body' : 'slot.upper+lower',
        ],
        engineId: 'composition',
        relatedEvidenceIds: slotEvidenceIds,
      });
      evidenceIds.push(completenessEvidenceId);
      for (const sid of slotEvidenceIds) {
        graph.link(completenessEvidenceId, sid, 'derived_from');
      }
    }

    return {
      slots,
      garmentIds: uniqueGarments.map((g) => g.garmentId),
      complete,
      duplicateGarmentIds: [...new Set(duplicateGarmentIds)].sort(),
      evidenceIds,
      limitationCodes,
      completenessEvidenceId,
    };
  }
}

function completenessGapReason(slotSet: Set<OutfitSlot>): string {
  if (slotSet.has('outer') && !slotSet.has('base') && !slotSet.has('mid') && !slotSet.has('lower') && !slotSet.has('full_body')) {
    return 'outer_only';
  }
  if (slotSet.has('lower') && !slotSet.has('base') && !slotSet.has('mid') && !slotSet.has('full_body')) {
    return slotSet.has('outer') ? 'outer_lower_without_upper' : 'lower_only';
  }
  if ((slotSet.has('base') || slotSet.has('mid')) && !slotSet.has('lower') && !slotSet.has('full_body')) {
    return 'upper_without_lower';
  }
  return 'missing_body_coverage_slot';
}

export function assignSlot(g: CanonicalGarment): OutfitSlot {
  const cat = g.identity.categoryId;
  const type = g.identity.typeId;
  if (cat === 'dresses' || type === 'dress' || type === 'abaya') return 'full_body';
  if (cat === 'outerwear' || type === 'blazer' || type === 'jacket' || type === 'coat') {
    return 'outer';
  }
  // Mid layer — sweaters / cardigans / vests (was dead slot)
  if (
    type === 'sweater' ||
    type === 'cardigan' ||
    type === 'vest' ||
    type === 'knit'
  ) {
    return 'mid';
  }
  if (cat === 'tops' || type === 'shirt' || type === 'blouse' || type === 'top') {
    return 'base';
  }
  if (cat === 'bottoms' || type === 'pants' || type === 'jeans' || type === 'skirt') {
    return 'lower';
  }
  if (cat === 'heels' || type === 'heels') return 'feet';
  if (
    cat === 'bags' ||
    cat === 'jewelry' ||
    cat === 'scarves' ||
    type === 'bag' ||
    type === 'jewelry' ||
    type === 'scarf'
  ) {
    return 'accessory';
  }
  return 'unknown';
}
