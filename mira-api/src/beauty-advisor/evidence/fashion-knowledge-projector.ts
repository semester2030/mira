/**
 * FK-10 — Projects Fashion Knowledge Advisor fragments → AdvisorEvidenceUnit[].
 * Additive beauty-advisor adapter. Does not redesign envelope schema.
 * Uses subsystemId `unknown` + provenance `fashion_knowledge_claim_locked`.
 */
import type { AdvisorEvidenceUnit } from '../contracts/advisor-evidence-envelope';
import { makeEvidenceUnit } from '../envelope/envelope-builder';
import type { FashionKnowledgeAdvisorProjection } from '../../fashion-knowledge/advisor-integration/projection';

export const FASHION_KNOWLEDGE_CLAIM_LOCKED_PROVENANCE =
  'fashion_knowledge_claim_locked' as const;

export function projectFashionKnowledgeToEvidenceUnits(
  projection: FashionKnowledgeAdvisorProjection,
  now?: string,
): AdvisorEvidenceUnit[] {
  const ts = now ?? projection.createdAt;
  return projection.fragments.map((f) =>
    makeEvidenceUnit({
      subsystemId: 'unknown',
      claimKey: f.claimKey,
      statementAr: f.statementAr,
      confidence: f.confidence,
      capabilityId: f.capabilityId,
      sourceRef: f.sourceRef,
      provenance: FASHION_KNOWLEDGE_CLAIM_LOCKED_PROVENANCE,
      now: ts,
      freshness: {
        builtAt: ts,
        stale: f.stale === true,
        expiresAt: f.expiresAt,
      },
    }),
  );
}
