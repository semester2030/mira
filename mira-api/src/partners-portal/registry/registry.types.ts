export type RegistryFieldDef = {
  id: string;
  labelAr: string;
  type: string;
  values?: Array<{ id?: string; value?: string } | string>;
  draftRequired?: boolean;
  publishRequiredWhen?: string | null;
  min?: number | null;
  max?: number | null;
  dependsOn?: unknown;
  unknownHandling?: string;
};

export type RegistryProfile = {
  id: string;
  labelAr: string;
  kind: 'product' | 'service' | string;
  legacyCategory?: string | null;
  phase?: string;
  enabledByDefault?: boolean;
  partnerTypes: string[];
  fields: string[];
  draftRequired?: string[];
  schemaVersion?: number;
};

export type FieldRegistryV2 = {
  status?: string;
  version: number;
  fields: Record<string, RegistryFieldDef>;
  profiles: RegistryProfile[];
  policies?: Record<string, unknown>;
  legacyTemplateAliases?: Record<string, unknown>;
};

export type ServiceProfileDoc = {
  templateId: string;
  templateVersion: number;
  priceMode: string;
  answers: Record<string, unknown>;
};

export const EDITOR_SCHEMA_VERSION = 2;
export const MAX_VALUES_BYTES = 200_000;
export const MAX_VALUES_DEPTH = 8;
export const MAX_VALUES_KEYS = 200;
