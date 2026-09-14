/**
 * FK-5A — Source ingestion contract.
 * Rejects fabricated / Tier-D-only activation paths.
 */
import {
  ProvenanceApprovalStatus,
  ProvenanceSourceType,
  type FashionProvenance,
} from '../contracts/provenance';
import {
  SourceAuthorityTier,
  canIndependentlyActivateTier,
  defaultTierForSourceType,
} from '../curated/source-authority';
import { FASHION_KNOWLEDGE_SOURCE_INGEST_VERSION } from '../versioning/release';
import type { EvidenceClass } from './source-requirements';

export interface IngestedFashionSource {
  readonly schemaVersion: typeof FASHION_KNOWLEDGE_SOURCE_INGEST_VERSION | string;
  readonly sourceId: string;
  readonly tier: SourceAuthorityTier;
  readonly sourceType: ProvenanceSourceType;
  readonly title: string;
  readonly authorOrganization: string;
  readonly editionVersion?: string;
  readonly publicationDate?: string;
  readonly locator?: string;
  readonly domains: readonly string[];
  readonly relevance: string;
  readonly evidenceClasses: readonly EvidenceClass[];
  readonly copyrightSafeNormalizedNote: string;
  readonly reviewerState: 'NOT_REVIEWED' | 'PENDING' | 'REVIEWED' | 'REJECTED';
  /** Must be true only when material is actually present in-repo or supplied. */
  readonly materialPresent: boolean;
  readonly notes?: string;
}

export interface SourceIngestValidation {
  readonly ok: boolean;
  readonly issues: readonly string[];
  readonly maySupportActivation: boolean;
}

const FAKE_TITLE_MARKERS = Object.freeze([
  'chatgpt',
  'invented',
  'placeholder book',
  'todo cite',
  'lorem ipsum',
  'fake citation',
  'unregistered_dior',
  'vogue styling guide 2025',
]);

export function validateIngestedSource(
  source: IngestedFashionSource,
): SourceIngestValidation {
  const issues: string[] = [];
  if (!source.sourceId || source.sourceId.trim().length < 3) {
    issues.push('invalid_source_id');
  }
  if (!source.title || source.title.trim().length < 3) {
    issues.push('missing_title');
  }
  if (!source.authorOrganization || source.authorOrganization.trim().length < 2) {
    issues.push('missing_author_organization');
  }
  if (!source.materialPresent) {
    issues.push('material_not_present');
  }
  if (source.copyrightSafeNormalizedNote.length > 400) {
    issues.push('copyright_note_too_long');
  }
  const blob = `${source.title} ${source.authorOrganization} ${source.notes ?? ''}`.toLowerCase();
  for (const m of FAKE_TITLE_MARKERS) {
    if (blob.includes(m)) issues.push(`fabricated_marker:${m}`);
  }
  if (source.tier === SourceAuthorityTier.TIER_D) {
    issues.push('tier_d_cannot_activate');
  }
  if (!canIndependentlyActivateTier(source.tier)) {
    // Tier C also cannot independently activate — still recordable as support
  }
  const expectedTier = defaultTierForSourceType(source.sourceType);
  if (
    source.sourceType === ProvenanceSourceType.LLM_GENERAL_KNOWLEDGE ||
    source.sourceType === ProvenanceSourceType.UNKNOWN
  ) {
    issues.push('source_type_not_curatable');
  }

  const maySupportActivation =
    source.materialPresent &&
    canIndependentlyActivateTier(source.tier) &&
    !issues.includes('material_not_present') &&
    !issues.some((i) => i.startsWith('fabricated_marker')) &&
    !issues.includes('source_type_not_curatable');

  // Filter activation-blocking issues for ok flag of ingest record itself
  const structuralOk =
    !issues.includes('invalid_source_id') &&
    !issues.includes('missing_title') &&
    !issues.includes('missing_author_organization') &&
    !issues.some((i) => i.startsWith('fabricated_marker'));

  return {
    ok: structuralOk && source.materialPresent,
    issues: Object.freeze([
      ...issues,
      ...(expectedTier !== source.tier ? [`tier_mismatch_hint:expected_${expectedTier}`] : []),
    ]),
    maySupportActivation:
      maySupportActivation &&
      structuralOk &&
      !issues.includes('tier_d_cannot_activate'),
  };
}

export function toFashionProvenance(
  source: IngestedFashionSource,
  approval: ProvenanceApprovalStatus = ProvenanceApprovalStatus.RESEARCHED,
): FashionProvenance {
  return {
    sourceId: source.sourceId,
    sourceType: source.sourceType,
    title: source.title,
    author: source.authorOrganization,
    edition: source.editionVersion,
    publicationDate: source.publicationDate,
    referenceLocator: source.locator,
    approvalStatus: approval,
    sourceConfidence:
      source.tier === SourceAuthorityTier.TIER_A
        ? 0.85
        : source.tier === SourceAuthorityTier.TIER_B
          ? 0.7
          : 0.4,
    notes: source.copyrightSafeNormalizedNote,
  };
}

/** Empty catalog — no externally supplied Tier A/B materials in repo for FK-5A. */
export const FK5A_INGESTED_SOURCES: readonly IngestedFashionSource[] =
  Object.freeze([]);

export function listActivationCapableSources(
  sources: readonly IngestedFashionSource[] = FK5A_INGESTED_SOURCES,
): readonly IngestedFashionSource[] {
  return sources.filter((s) => validateIngestedSource(s).maySupportActivation);
}
