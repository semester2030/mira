/**
 * Provenance rules for envelope subsystem attribution (Critical #3).
 * Only verified frozen-canonical sources may claim frozen subsystem ids.
 */
import type { AdvisorSubsystemId } from '../contracts/advisor-evidence-envelope';

const FROZEN_SUBSYSTEM_IDS: ReadonlySet<AdvisorSubsystemId> = new Set([
  'skin_intelligence',
  'face_intelligence',
  'wardrobe_foundation',
  'garment_intelligence',
  'outfit_intelligence',
  'styling_intelligence',
  'beauty_experience',
]);

/** Provenance tags allowed to claim a frozen subsystem id. */
const FROZEN_PROVENANCE: ReadonlySet<string> = new Set([
  'canonical_skin_report',
  'canonical_face_report',
  'canonical_wardrobe',
  'canonical_garment',
  'canonical_outfit',
  'canonical_styling_profile',
  'beauty_experience_public',
]);

export interface ProvenanceValidationIssue {
  code: string;
  message: string;
}

export function isFrozenSubsystemId(id: AdvisorSubsystemId): boolean {
  return FROZEN_SUBSYSTEM_IDS.has(id);
}

/**
 * Legacy MCE / unknown projections must use subsystemId `unknown`
 * unless provenance explicitly marks a frozen canonical source.
 */
export function assertHonestSubsystemAttribution(input: {
  subsystemId: AdvisorSubsystemId;
  provenance?: string;
}): ProvenanceValidationIssue | null {
  if (input.subsystemId === 'unknown') return null;
  if (!isFrozenSubsystemId(input.subsystemId)) {
    return {
      code: 'invalid_subsystem',
      message: `Unknown subsystem ${input.subsystemId}`,
    };
  }
  if (!input.provenance || !FROZEN_PROVENANCE.has(input.provenance)) {
    return {
      code: 'false_subsystem_attribution',
      message: `Frozen subsystem ${input.subsystemId} requires frozen provenance; got ${input.provenance ?? 'none'}`,
    };
  }
  return null;
}

export function validateEnvelopeProvenance(units: Array<{
  subsystemId: AdvisorSubsystemId;
  provenance?: string;
  claimKey: string;
}>): { ok: boolean; issues: ProvenanceValidationIssue[] } {
  const issues: ProvenanceValidationIssue[] = [];
  for (const u of units) {
    const issue = assertHonestSubsystemAttribution({
      subsystemId: u.subsystemId,
      provenance: u.provenance,
    });
    if (issue) {
      issues.push({
        ...issue,
        message: `${issue.message} (claim ${u.claimKey})`,
      });
    }
  }
  return { ok: issues.length === 0, issues };
}
