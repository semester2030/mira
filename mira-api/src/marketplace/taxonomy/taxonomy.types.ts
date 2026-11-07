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
  children: string[];
};

export type EleganceTaxonomyDoc = {
  schemaVersion: number;
  lane: 'elegance';
  definitionsVersion: number;
  compatMinAppBuild: number;
  status: string;
  notes?: string;
  nodes: TaxonomyNode[];
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
  children: string[];
};

export type PublicTaxonomyResponse = {
  schemaVersion: number;
  lane: 'elegance';
  definitionsVersion: number;
  compatMinAppBuild: number;
  nodes: PublicTaxonomyNode[];
};

export type TaxonomyFieldError = {
  fieldId: string;
  code: string;
  messageAr?: string;
};
