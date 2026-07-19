import { CanonicalGarment } from '../garment/canonical-garment';
import { CanonicalOutfit } from '../outfit/canonical-outfit';
import {
  FrozenReportRef,
  InterpretedStylingEvidence,
  StyleGoalDraft,
  StyleMemorySnapshot,
  WardrobeRefInput,
} from './styling-evidence';
import { stableEvidenceCitationId } from './styling-identity';

export interface EvidenceInterpretationInput {
  subjectId: string;
  skin?: FrozenReportRef;
  face?: FrozenReportRef;
  garments?: CanonicalGarment[];
  outfits?: CanonicalOutfit[];
  wardrobe?: WardrobeRefInput;
  memory?: StyleMemorySnapshot;
  goalDrafts?: StyleGoalDraft[];
}

/**
 * Evidence Interpretation Engine — consume frozen artifacts → reasoning inputs.
 * Never modifies evidence sources.
 */
export class EvidenceInterpretationEngine {
  interpret(input: EvidenceInterpretationInput): {
    evidence: InterpretedStylingEvidence[];
    limitationCodes: string[];
  } {
    const evidence: InterpretedStylingEvidence[] = [];
    const limitationCodes: string[] = [];
    const subjectId = input.subjectId;

    if (input.skin?.reportId) {
      const id = stableEvidenceCitationId('skin', input.skin.reportId);
      const conf = input.skin.confidence ?? 0.5;
      evidence.push({
        evidenceId: id,
        sourceKind: 'skin',
        sourceRef: input.skin.reportId,
        claim: `skin_report_available:${input.skin.reportId}`,
        polarity: conf >= 0.5 ? 'supports' : 'neutral',
        strength: clamp01(conf),
        subjectRefs: [subjectId],
      });
      for (const code of input.skin.limitationCodes ?? []) {
        limitationCodes.push(`skin:${code}`);
      }
    } else {
      limitationCodes.push('missing_evidence:skin');
    }

    if (input.face?.reportId) {
      const id = stableEvidenceCitationId('face', input.face.reportId);
      const conf = input.face.confidence ?? 0.5;
      evidence.push({
        evidenceId: id,
        sourceKind: 'face',
        sourceRef: input.face.reportId,
        claim: `face_report_available:${input.face.reportId}`,
        polarity: conf >= 0.5 ? 'supports' : 'neutral',
        strength: clamp01(conf),
        subjectRefs: [subjectId],
      });
      for (const code of input.face.limitationCodes ?? []) {
        limitationCodes.push(`face:${code}`);
      }
    } else {
      limitationCodes.push('missing_evidence:face');
    }

    const garments = [...(input.garments ?? [])].sort((a, b) =>
      a.garmentId.localeCompare(b.garmentId),
    );
    for (const g of garments) {
      const id = stableEvidenceCitationId('garment', g.garmentId);
      const hints = [...g.attributes.styleHints].sort();
      evidence.push({
        evidenceId: id,
        sourceKind: 'garment',
        sourceRef: g.garmentId,
        claim: `garment_attrs:${g.identity.typeId}:colors=${[...g.attributes.colors].sort().join(',')}:hints=${hints.join(',')}`,
        polarity: g.confidence >= 0.5 ? 'supports' : 'neutral',
        strength: clamp01(g.confidence),
        subjectRefs: [subjectId, g.garmentId],
      });
      for (const e of g.explainability) {
        for (const ref of e.evidenceRefs) {
          evidence.push({
            evidenceId: stableEvidenceCitationId('garment_explain', `${g.garmentId}:${ref}`),
            sourceKind: 'garment',
            sourceRef: g.garmentId,
            claim: `garment_explain:${e.code}`,
            polarity: 'supports',
            strength: 0.6,
            subjectRefs: [g.garmentId],
          });
        }
      }
    }
    if (!garments.length) {
      limitationCodes.push('missing_evidence:garment');
    }

    const outfits = [...(input.outfits ?? [])].sort((a, b) =>
      a.outfitId.localeCompare(b.outfitId),
    );
    for (const o of outfits) {
      const id = stableEvidenceCitationId('outfit', o.outfitId);
      const completeMetric = o.metrics.find((m) => m.name === 'completeness');
      const conflictish = o.limitations.some(
        (l) => l.includes('invalid') || l.includes('hard') || l.includes('incomplete'),
      );
      evidence.push({
        evidenceId: id,
        sourceKind: 'outfit',
        sourceRef: o.outfitId,
        claim: `outfit_eval:${o.outfitId}:conf=${o.confidence.toFixed(3)}:complete=${completeMetric?.value ?? 0}`,
        polarity: conflictish ? 'conflicts' : o.confidence >= 0.5 ? 'supports' : 'neutral',
        strength: clamp01(o.confidence),
        subjectRefs: [subjectId, o.outfitId, ...o.garmentIds],
      });
      for (const m of o.metrics) {
        for (const eid of m.evidenceIds) {
          evidence.push({
            evidenceId: stableEvidenceCitationId('outfit_metric', `${o.outfitId}:${m.name}:${eid}`),
            sourceKind: 'outfit',
            sourceRef: o.outfitId,
            claim: `outfit_metric:${m.name}:${eid}`,
            polarity: m.value >= 0.5 ? 'supports' : 'neutral',
            strength: clamp01(m.value),
            subjectRefs: [o.outfitId],
          });
        }
      }
      for (const lim of o.limitations) {
        if (lim.includes('incomplete') || lim.includes('invalid')) {
          evidence.push({
            evidenceId: stableEvidenceCitationId('outfit_lim', `${o.outfitId}:${lim}`),
            sourceKind: 'outfit',
            sourceRef: o.outfitId,
            claim: `outfit_limitation:${lim}`,
            polarity: 'conflicts',
            strength: 0.8,
            subjectRefs: [o.outfitId],
          });
        }
      }
    }
    if (!outfits.length) {
      limitationCodes.push('missing_evidence:outfit');
    }

    const wardrobe = input.wardrobe;
    if (wardrobe) {
      const refs = [
        ...wardrobe.garmentIds,
        ...(wardrobe.lookIds ?? []),
        ...(wardrobe.favoriteOutfitIds ?? []),
      ].sort();
      if (refs.length) {
        evidence.push({
          evidenceId: stableEvidenceCitationId('wardrobe', refs.join(',')),
          sourceKind: 'wardrobe',
          sourceRef: refs[0]!,
          claim: `wardrobe_refs:count=${refs.length}`,
          polarity: 'supports',
          strength: 0.7,
          subjectRefs: [subjectId, ...refs.slice(0, 8)],
        });
      } else {
        limitationCodes.push('missing_evidence:wardrobe');
      }
    } else {
      limitationCodes.push('missing_evidence:wardrobe');
    }

    const memory = input.memory;
    if (memory) {
      if (memory.preferredColors.length || memory.avoidedStyles.length) {
        evidence.push({
          evidenceId: stableEvidenceCitationId(
            'preference',
            [...memory.preferredColors, ...memory.avoidedStyles].sort().join(','),
          ),
          sourceKind: 'preference',
          sourceRef: 'memory.preferences',
          claim: `preferences:colors=${[...memory.preferredColors].sort().join(',')}:avoid=${[...memory.avoidedStyles].sort().join(',')}`,
          polarity: 'supports',
          strength: 0.65,
          subjectRefs: [subjectId],
        });
      }
      for (const oid of [...memory.favoriteOutfitIds].sort()) {
        evidence.push({
          evidenceId: stableEvidenceCitationId('memory_fav', oid),
          sourceKind: 'memory',
          sourceRef: oid,
          claim: `favorite_look:${oid}`,
          polarity: 'supports',
          strength: 0.75,
          subjectRefs: [subjectId, oid],
        });
      }
      for (const tag of [...memory.dislikedStyleTags].sort()) {
        evidence.push({
          evidenceId: stableEvidenceCitationId('memory_dislike', tag),
          sourceKind: 'memory',
          sourceRef: tag,
          claim: `disliked_style:${tag}`,
          polarity: 'conflicts',
          strength: 0.7,
          subjectRefs: [subjectId],
        });
      }
    }

    for (const g of input.goalDrafts ?? []) {
      evidence.push({
        evidenceId: stableEvidenceCitationId('goal', g.target),
        sourceKind: 'goal',
        sourceRef: g.target,
        claim: `goal_draft:${g.target}`,
        polarity: 'neutral',
        strength: 0.5,
        subjectRefs: [subjectId],
      });
    }

    // Deduplicate by evidenceId (stable)
    const seen = new Set<string>();
    const unique = evidence
      .sort((a, b) => a.evidenceId.localeCompare(b.evidenceId))
      .filter((e) => {
        if (seen.has(e.evidenceId)) return false;
        seen.add(e.evidenceId);
        return true;
      });

    return {
      evidence: unique,
      limitationCodes: [...new Set(limitationCodes)].sort(),
    };
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
