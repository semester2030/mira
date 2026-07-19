/**
 * Law #32 — frozen evidence source kinds from frozen subsystems.
 * goal / preference / memory alone NEVER qualify.
 */
import { InterpretedStylingEvidence, StylingEvidenceSourceKind } from './styling-evidence';

export const FROZEN_STYLING_EVIDENCE_KINDS: ReadonlySet<StylingEvidenceSourceKind> =
  new Set(['skin', 'face', 'garment', 'outfit', 'wardrobe']);

export function isFrozenEvidenceKind(
  kind: StylingEvidenceSourceKind,
): boolean {
  return FROZEN_STYLING_EVIDENCE_KINDS.has(kind);
}

export function frozenEvidenceOf(
  evidence: InterpretedStylingEvidence[],
): InterpretedStylingEvidence[] {
  return evidence.filter((e) => isFrozenEvidenceKind(e.sourceKind));
}

export function frozenEvidenceIds(
  evidence: InterpretedStylingEvidence[],
): string[] {
  return frozenEvidenceOf(evidence)
    .map((e) => e.evidenceId)
    .sort();
}

/** True if at least one cited id maps to a frozen-kind record. */
export function citesFrozenEvidence(
  evidenceRefs: string[],
  evidence: InterpretedStylingEvidence[],
): boolean {
  const byId = new Map(evidence.map((e) => [e.evidenceId, e]));
  for (const id of evidenceRefs) {
    const rec = byId.get(id);
    if (rec && isFrozenEvidenceKind(rec.sourceKind)) return true;
  }
  return false;
}
