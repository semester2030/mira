import { createHash } from 'crypto';
import {
  AdvisorConfidence,
  AdvisorEvidenceEnvelope,
  AdvisorEvidenceUnit,
  AdvisorSubsystemId,
  DEFAULT_FORBIDDEN_CLAIMS,
  EvidenceFreshness,
} from '../contracts/advisor-evidence-envelope';
import { ADVISOR_ENVELOPE_VERSION } from '../release';
import { validateEnvelopeProvenance } from '../evidence/provenance';

function hashId(prefix: string, payload: string, len = 20): string {
  return `${prefix}_${createHash('sha256').update(payload, 'utf8').digest('hex').slice(0, len)}`;
}

function aggregateConfidence(units: AdvisorEvidenceUnit[]): AdvisorConfidence {
  if (units.length === 0) return 'low';
  const rank = { high: 3, medium: 2, low: 1 };
  const min = units.reduce(
    (acc, u) => Math.min(acc, rank[u.confidence]),
    3,
  );
  if (min >= 3) return 'high';
  if (min >= 2) return 'medium';
  return 'low';
}

function envelopeFreshness(units: AdvisorEvidenceUnit[], now: string): EvidenceFreshness {
  if (units.length === 0) {
    /** Empty ≠ expired — missing evidence is a separate planner path. */
    return { builtAt: now, stale: false };
  }
  const anyStale = units.some((u) => u.freshness.stale);
  const expires = units
    .map((u) => u.freshness.expiresAt)
    .filter((x): x is string => !!x)
    .sort()[0];
  return {
    builtAt: now,
    expiresAt: expires,
    stale: anyStale || (!!expires && expires < now),
  };
}

export interface SealEnvelopeInput {
  sessionId: string;
  units: AdvisorEvidenceUnit[];
  limitations?: string[];
  extraForbiddenClaims?: string[];
  traceId?: string;
  now?: string;
}

/**
 * Builds and seals an Advisor Evidence Envelope.
 * Input units must already be public projections — never Canonical* internals.
 */
export function sealAdvisorEvidenceEnvelope(
  input: SealEnvelopeInput,
): AdvisorEvidenceEnvelope {
  const provenanceCheck = validateEnvelopeProvenance(
    input.units.map((u) => ({
      subsystemId: u.subsystemId,
      provenance: u.provenance,
      claimKey: u.claimKey,
    })),
  );
  if (!provenanceCheck.ok) {
    throw new Error(
      `False subsystem attribution: ${provenanceCheck.issues.map((i) => i.code).join(',')}`,
    );
  }

  const now = input.now ?? new Date().toISOString();
  const units = [...input.units];
  const evidenceIds = units.map((u) => u.evidenceId).sort();
  const subsystemIds = [
    ...new Set(units.map((u) => u.subsystemId)),
  ] as AdvisorSubsystemId[];
  const allowedClaims = [...new Set(units.map((u) => u.claimKey))].sort();
  const forbiddenClaims = [
    ...new Set([
      ...DEFAULT_FORBIDDEN_CLAIMS,
      ...(input.extraForbiddenClaims ?? []),
    ]),
  ].sort();
  const citations = units
    .map((u) => ({ citationId: u.citationId, evidenceId: u.evidenceId }))
    .sort((a, b) => a.citationId.localeCompare(b.citationId));
  const capabilitiesUsed = [
    ...new Set(
      units.map((u) => u.capabilityId).filter((x): x is string => !!x),
    ),
  ].sort();
  const sourceRefs = [
    ...new Set(
      units.map((u) => u.sourceRef).filter((x): x is string => !!x),
    ),
  ].sort();

  /** Deterministic claim map: sort units so duplicate claimKeys resolve stably. */
  const sortedUnits = [...units].sort((a, b) =>
    a.evidenceId.localeCompare(b.evidenceId),
  );
  const claims: AdvisorEvidenceEnvelope['claims'] = {};
  for (const u of sortedUnits) {
    claims[u.claimKey] = Object.freeze({
      evidenceId: u.evidenceId,
      statementAr: u.statementAr,
      statementEn: u.statementEn,
      confidence: u.confidence,
      citationId: u.citationId,
      subsystemId: u.subsystemId,
    });
  }
  Object.freeze(claims);

  const envelopeId = hashId(
    'aenv',
    `${input.sessionId}|${evidenceIds.join(',')}|${allowedClaims.join(',')}`,
  );
  const traceId =
    input.traceId ??
    hashId('atrace', `${envelopeId}|${input.sessionId}`, 16);

  const limitations = [...(input.limitations ?? [])];
  if (units.length === 0) {
    limitations.push('no_evidence_units');
  }
  if (envelopeFreshness(units, now).stale) {
    limitations.push('stale_or_expired_evidence');
  }

  const frozenCitations = Object.freeze(
    citations.map((c) => Object.freeze({ ...c })),
  );
  const frozenFreshness = Object.freeze(envelopeFreshness(units, now));
  const frozenTrace = Object.freeze({
    traceId,
    sourceRefs: Object.freeze([...sourceRefs]) as string[],
  });

  const envelope: AdvisorEvidenceEnvelope = {
    envelopeId,
    sessionId: input.sessionId,
    version: ADVISOR_ENVELOPE_VERSION,
    evidenceIds: Object.freeze([...evidenceIds]) as string[],
    subsystemIds: Object.freeze([...subsystemIds]) as AdvisorSubsystemId[],
    confidence: aggregateConfidence(units),
    limitations: Object.freeze([...new Set(limitations)].sort()) as string[],
    allowedClaims: Object.freeze([...allowedClaims]) as string[],
    forbiddenClaims: Object.freeze([...forbiddenClaims]) as string[],
    freshness: frozenFreshness,
    citations: frozenCitations as AdvisorEvidenceEnvelope['citations'],
    capabilitiesUsed: Object.freeze([...capabilitiesUsed]) as string[],
    traceability: frozenTrace,
    claims,
    sealed: true,
    sealedAt: now,
  };

  return Object.freeze(envelope) as AdvisorEvidenceEnvelope;
}

export function makeEvidenceUnit(
  partial: Omit<AdvisorEvidenceUnit, 'evidenceId' | 'citationId' | 'freshness'> & {
    evidenceId?: string;
    citationId?: string;
    freshness?: Partial<EvidenceFreshness>;
    now?: string;
  },
): AdvisorEvidenceUnit {
  const now = partial.now ?? new Date().toISOString();
  const evidenceId =
    partial.evidenceId ??
    hashId(
      'aev',
      `${partial.subsystemId}|${partial.claimKey}|${partial.statementAr}`,
      16,
    );
  const citationId =
    partial.citationId ?? hashId('acit', evidenceId, 14);
  return {
    evidenceId,
    subsystemId: partial.subsystemId,
    claimKey: partial.claimKey,
    statementAr: partial.statementAr,
    statementEn: partial.statementEn,
    confidence: partial.confidence,
    citationId,
    capabilityId: partial.capabilityId,
    sourceRef: partial.sourceRef,
    provenance: partial.provenance,
    freshness: {
      builtAt: partial.freshness?.builtAt ?? now,
      expiresAt: partial.freshness?.expiresAt,
      stale: partial.freshness?.stale ?? false,
    },
  };
}
