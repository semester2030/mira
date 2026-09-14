/**
 * FK-5A — Rule ↔ source evidence map.
 */
import { FASHION_KNOWLEDGE_EVIDENCE_MAP_VERSION } from '../versioning/release';
import type { IngestedFashionSource } from './source-ingest';
import {
  buildFk5aCandidateInventory,
  type CandidateSourceRequirement,
  type EvidenceClass,
} from './source-requirements';

export const SourceCoverage = {
  NONE: 'NONE',
  PARTIAL: 'PARTIAL',
  FULL: 'FULL',
} as const;

export type SourceCoverage =
  (typeof SourceCoverage)[keyof typeof SourceCoverage];

export const EvidenceStrength = {
  NONE: 'NONE',
  WEAK: 'WEAK',
  MODERATE: 'MODERATE',
  STRONG: 'STRONG',
} as const;

export type EvidenceStrength =
  (typeof EvidenceStrength)[keyof typeof EvidenceStrength];

export interface RuleSourceEvidenceMap {
  readonly schemaVersion: typeof FASHION_KNOWLEDGE_EVIDENCE_MAP_VERSION | string;
  readonly ruleId: string;
  readonly supportingSourceIds: readonly string[];
  readonly qualifyingSourceIds: readonly string[];
  readonly conflictingSourceIds: readonly string[];
  readonly unsupportedClaimFragments: readonly string[];
  readonly sourceCoverage: SourceCoverage;
  readonly evidenceStrength: EvidenceStrength;
  readonly matchedEvidenceClasses: readonly EvidenceClass[];
  readonly missingEvidenceClasses: readonly EvidenceClass[];
  readonly reviewerNotes: string;
}

function classesCoveredBy(
  req: CandidateSourceRequirement,
  sources: readonly IngestedFashionSource[],
): {
  matched: EvidenceClass[];
  missing: EvidenceClass[];
  supportingIds: string[];
} {
  const matched: EvidenceClass[] = [];
  const supportingIds: string[] = [];
  for (const cls of req.requiredEvidenceClasses) {
    const hit = sources.find(
      (s) =>
        s.materialPresent &&
        s.evidenceClasses.includes(cls) &&
        (s.domains.includes(req.domain) || s.domains.length === 0),
    );
    if (hit) {
      matched.push(cls);
      if (!supportingIds.includes(hit.sourceId)) supportingIds.push(hit.sourceId);
    }
  }
  const missing = req.requiredEvidenceClasses.filter((c) => !matched.includes(c));
  return { matched, missing, supportingIds };
}

export function buildEvidenceMapForRule(
  req: CandidateSourceRequirement,
  sources: readonly IngestedFashionSource[],
): RuleSourceEvidenceMap {
  const { matched, missing, supportingIds } = classesCoveredBy(req, sources);
  let coverage: SourceCoverage = SourceCoverage.NONE;
  if (matched.length === 0) coverage = SourceCoverage.NONE;
  else if (missing.length === 0) coverage = SourceCoverage.FULL;
  else coverage = SourceCoverage.PARTIAL;

  let strength: EvidenceStrength = EvidenceStrength.NONE;
  if (coverage === SourceCoverage.FULL && supportingIds.length >= 2) {
    strength = EvidenceStrength.STRONG;
  } else if (coverage === SourceCoverage.FULL) {
    strength = EvidenceStrength.MODERATE;
  } else if (coverage === SourceCoverage.PARTIAL) {
    strength = EvidenceStrength.WEAK;
  }

  const unsupported =
    coverage === SourceCoverage.NONE
      ? Object.freeze([req.normalizedPrinciple])
      : missing.length > 0
        ? Object.freeze([
            `unsupported_evidence_classes:${missing.join(',')}`,
          ])
        : Object.freeze([]);

  return Object.freeze({
    schemaVersion: FASHION_KNOWLEDGE_EVIDENCE_MAP_VERSION,
    ruleId: req.ruleId,
    supportingSourceIds: Object.freeze(supportingIds),
    qualifyingSourceIds: Object.freeze([] as string[]),
    conflictingSourceIds: Object.freeze([] as string[]),
    unsupportedClaimFragments: unsupported,
    sourceCoverage: coverage,
    evidenceStrength: strength,
    matchedEvidenceClasses: Object.freeze(matched),
    missingEvidenceClasses: Object.freeze([...missing]),
    reviewerNotes:
      coverage === SourceCoverage.NONE
        ? 'SOURCING_REQUIRED — no Tier A/B material present for this candidate'
        : coverage === SourceCoverage.PARTIAL
          ? 'Partial source coverage — narrow or RESEARCH_MORE'
          : 'Source coverage complete pending human approval',
  });
}

export function buildAllEvidenceMaps(
  sources: readonly IngestedFashionSource[],
): readonly RuleSourceEvidenceMap[] {
  return Object.freeze(
    buildFk5aCandidateInventory().map((req) =>
      buildEvidenceMapForRule(req, sources),
    ),
  );
}
