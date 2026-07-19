/**
 * Advisor Evidence Envelope — sole input to Conversation Planner (Law #34).
 * Immutable after seal. No provider payloads. No frozen engine internals.
 */
import { ADVISOR_ENVELOPE_VERSION } from '../release';

export type AdvisorConfidence = 'high' | 'medium' | 'low';

export type AdvisorSubsystemId =
  | 'skin_intelligence'
  | 'face_intelligence'
  | 'wardrobe_foundation'
  | 'garment_intelligence'
  | 'outfit_intelligence'
  | 'styling_intelligence'
  | 'beauty_experience'
  | 'unknown';

export interface EvidenceFreshness {
  builtAt: string;
  expiresAt?: string;
  stale: boolean;
}

/** Public claim unit — already projected from frozen outputs; never Canonical* bodies. */
export interface AdvisorEvidenceUnit {
  evidenceId: string;
  subsystemId: AdvisorSubsystemId;
  claimKey: string;
  statementAr: string;
  statementEn?: string;
  confidence: AdvisorConfidence;
  citationId: string;
  freshness: EvidenceFreshness;
  capabilityId?: string;
  sourceRef?: string;
  /**
   * Provenance tag. Frozen subsystem ids require a frozen provenance
   * (see evidence/provenance.ts). Legacy MCE → use subsystemId `unknown`.
   */
  provenance?: string;
}

export interface AdvisorEvidenceEnvelope {
  envelopeId: string;
  sessionId: string;
  version: typeof ADVISOR_ENVELOPE_VERSION;
  evidenceIds: string[];
  subsystemIds: AdvisorSubsystemId[];
  confidence: AdvisorConfidence;
  limitations: string[];
  allowedClaims: string[];
  forbiddenClaims: string[];
  freshness: EvidenceFreshness;
  citations: Array<{ citationId: string; evidenceId: string }>;
  capabilitiesUsed: string[];
  traceability: {
    traceId: string;
    sourceRefs: string[];
  };
  /** Sealed claim statements keyed by claimKey — planner/response only. */
  claims: Record<
    string,
    {
      evidenceId: string;
      statementAr: string;
      statementEn?: string;
      confidence: AdvisorConfidence;
      citationId: string;
      subsystemId: AdvisorSubsystemId;
    }
  >;
  sealed: true;
  sealedAt: string;
}

export const DEFAULT_FORBIDDEN_CLAIMS = [
  'medical_diagnosis',
  'prescription',
  'invented_score',
  'invented_analysis',
  'invented_recommendation',
  'provider_payload',
  'decision_ledger_body',
  'canonical_garment_internal',
  'canonical_outfit_internal',
  'styling_engine_internal',
  'beauty_experience_internal',
] as const;

export function envelopeSchemaVersion(): typeof ADVISOR_ENVELOPE_VERSION {
  return ADVISOR_ENVELOPE_VERSION;
}
