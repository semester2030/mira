/**
 * FK-2 — Provenance contract.
 * Knowledge provenance ≠ provider execution metadata.
 */
export const ProvenanceSourceType = {
  BOOK: 'book',
  ACADEMIC_REFERENCE: 'academic_reference',
  FASHION_SCHOOL_MATERIAL: 'fashion_school_material',
  PROFESSIONAL_STYLIST: 'professional_stylist',
  MIRA_EDITORIAL: 'mira_editorial',
  FASHION_PUBLICATION: 'fashion_publication',
  CULTURAL_REVIEWER: 'cultural_reviewer',
  USER_DATA_PATTERN: 'user_data_pattern',
  LLM_GENERAL_KNOWLEDGE: 'llm_general_knowledge',
  UNKNOWN: 'unknown',
} as const;

export type ProvenanceSourceType =
  (typeof ProvenanceSourceType)[keyof typeof ProvenanceSourceType];

export const ProvenanceApprovalStatus = {
  DRAFT: 'DRAFT',
  RESEARCHED: 'RESEARCHED',
  REVIEWED: 'REVIEWED',
  APPROVED: 'APPROVED',
  ACTIVE: 'ACTIVE',
  DEPRECATED: 'DEPRECATED',
  REJECTED: 'REJECTED',
  UNCURATED: 'UNCURATED',
} as const;

export type ProvenanceApprovalStatus =
  (typeof ProvenanceApprovalStatus)[keyof typeof ProvenanceApprovalStatus];

export const ALL_PROVENANCE_SOURCE_TYPES: readonly ProvenanceSourceType[] =
  Object.freeze(Object.values(ProvenanceSourceType));

export const ALL_PROVENANCE_APPROVAL_STATUSES: readonly ProvenanceApprovalStatus[] =
  Object.freeze(Object.values(ProvenanceApprovalStatus));

export interface FashionProvenance {
  readonly sourceId: string;
  readonly sourceType: ProvenanceSourceType;
  readonly title?: string;
  readonly author?: string;
  readonly edition?: string;
  readonly publicationDate?: string;
  readonly referenceLocator?: string;
  readonly reviewer?: string;
  readonly reviewedAt?: string;
  readonly approvalStatus: ProvenanceApprovalStatus;
  /** 0..1 source confidence — not garment/outfit/styling confidence. */
  readonly sourceConfidence: number;
  readonly jurisdiction?: string;
  readonly culturalContext?: string;
  readonly notes?: string;
}

/** LLM general knowledge must always map to this shape. */
export function llmUncuratedProvenance(sourceId: string): FashionProvenance {
  return {
    sourceId,
    sourceType: ProvenanceSourceType.LLM_GENERAL_KNOWLEDGE,
    approvalStatus: ProvenanceApprovalStatus.UNCURATED,
    sourceConfidence: 0.4,
    notes: 'Mode B LLM general fashion knowledge — not Mira curated truth',
  };
}

export function isProvenanceSourceType(
  value: unknown,
): value is ProvenanceSourceType {
  return (
    typeof value === 'string' &&
    (ALL_PROVENANCE_SOURCE_TYPES as readonly string[]).includes(value)
  );
}

export function isProvenanceApprovalStatus(
  value: unknown,
): value is ProvenanceApprovalStatus {
  return (
    typeof value === 'string' &&
    (ALL_PROVENANCE_APPROVAL_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Detect fake curated citations for LLM / unknown sources.
 * Publication titles alone do not prove registered evidence.
 */
export function isFalseCuratedAttribution(
  provenance: FashionProvenance,
  registeredSourceIds: ReadonlySet<string>,
): boolean {
  if (
    provenance.sourceType === ProvenanceSourceType.LLM_GENERAL_KNOWLEDGE ||
    provenance.sourceType === ProvenanceSourceType.UNKNOWN
  ) {
    if (
      provenance.approvalStatus === ProvenanceApprovalStatus.APPROVED ||
      provenance.approvalStatus === ProvenanceApprovalStatus.ACTIVE
    ) {
      return true;
    }
  }
  const claimsPublication =
    Boolean(provenance.title) ||
    Boolean(provenance.author) ||
    Boolean(provenance.referenceLocator);
  if (
    claimsPublication &&
    provenance.sourceType !== ProvenanceSourceType.LLM_GENERAL_KNOWLEDGE &&
    !registeredSourceIds.has(provenance.sourceId)
  ) {
    return true;
  }
  return false;
}
