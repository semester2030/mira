export type TaxonomyNode = {
  id: string;
  parentId: string | null;
  labelAr: string;
  sort: number;
  active: boolean;
  browseOnly?: boolean;
  writeEnabled?: boolean;
  imageKey?: string;
  profileId?: string;
  /** product | service — occasions mixed lane leaves. */
  offerKind?: 'product' | 'service';
  children: string[];
};

/** One lane document (elegance, jewelry, …). */
export type LaneTaxonomyDoc = {
  schemaVersion: number;
  lane: string;
  definitionsVersion: number;
  compatMinAppBuild: number;
  status: string;
  publicBrowse?: boolean;
  notes?: string;
  nodes: TaxonomyNode[];
};

/** @deprecated Use LaneTaxonomyDoc — kept for elegance call sites. */
export type EleganceTaxonomyDoc = LaneTaxonomyDoc & { lane: 'elegance' | string };

export type LaneManifestEntry = {
  id: string;
  labelAr: string;
  offerKind: 'product' | 'service' | 'mixed';
  publicBrowse: boolean;
  partnerWrite: boolean;
  taxonomyFile: string | null;
  notes?: string;
};

export type LanesManifest = {
  schemaVersion: number;
  definitionsVersion: number;
  lanes: LaneManifestEntry[];
};

/** Public HTTP projection — no storage paths or internal validation rules. */
export type PublicTaxonomyNode = {
  id: string;
  parentId: string | null;
  labelAr: string;
  sort: number;
  active: boolean;
  browseOnly: boolean;
  writeEnabled: boolean;
  imageKey: string | null;
  profileId: string | null;
  offerKind: 'product' | 'service' | null;
  children: string[];
  /** Field ids from central registry profile (empty when browseOnly / no profile). */
  fieldIds: string[];
  /** Filter keys declared on those fields (non-empty for write leaves with filterable attrs). */
  filterKeys: string[];
};

export type PublicTaxonomyResponse = {
  schemaVersion: number;
  lane: string;
  definitionsVersion: number;
  compatMinAppBuild: number;
  publicBrowse: boolean;
  descriptionPhrasesVersion: number;
  nodes: PublicTaxonomyNode[];
  /** Phrases keyed by subcategory id — read contract for portal/app. */
  descriptionPhrases: Record<string, Array<{ id: string; textAr: string }>>;
};

export type PublicLaneListItem = {
  id: string;
  labelAr: string;
  offerKind: 'product' | 'service' | 'mixed';
  publicBrowse: boolean;
  partnerWrite: boolean;
  definitionsVersion: number | null;
  hasTaxonomy: boolean;
};

export type TaxonomyFieldError = {
  fieldId: string;
  code: string;
  messageAr?: string;
};
