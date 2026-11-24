export const IDENTITY_KINDS = {
  shop: 'متجر متعدد العلامات',
  brand: 'علامة تجارية',
  salon: 'صالون نسائي',
  independent: 'مختصّة مستقلة',
  clinic: 'عيادة',
  events: 'جهة تنظيم مناسبات',
  /** Celebrity / creator — may advertise others' offers without owning a store. */
  creator: 'مشهور',
} as const;

/** Where the service is delivered — not who owns the account. */
export const SERVICE_MODES = {
  venue: 'في المقر',
  client_home: 'في موقع العميلة (منزل / فندق / قاعة)',
  provider_home: 'في استوديو معتمد لمقدمة الخدمة',
  remote: 'عن بُعد',
} as const;

/** Facility identities that may create branches and a team roster. */
export const FACILITY_IDENTITY_KINDS = ['salon', 'clinic', 'shop', 'brand', 'events'] as const;

export type IdentityKind = keyof typeof IDENTITY_KINDS;
export type ServiceMode = keyof typeof SERVICE_MODES;
export type ProviderKind = 'independent' | 'facility' | 'creator';

/** Account ownership kind derived from registration identity — never inferred from placeMode. */
export function providerKindFromIdentity(identity: IdentityKind[]): ProviderKind {
  if (identity.includes('creator') && !identity.includes('independent')) {
    return 'creator';
  }
  if (identity.includes('independent') && !identity.some((k) => (FACILITY_IDENTITY_KINDS as readonly string[]).includes(k))) {
    return 'independent';
  }
  return 'facility';
}

export type ActivityDef = {
  id: string;
  label: string;
  group: string;
  kind: 'product' | 'service';
  selectable: true;
  imageKey?: string | null;
  icon?: {
    key: string;
    smallUrl: string;
    largeUrl: string;
    version: string;
  } | null;
  profileId?: string | null;
};

export type ActivityLineInput = {
  activity: string;
  scope: 'category' | 'one';
  itemName?: string;
};

export type ActivityRequestInput = {
  identity: IdentityKind[];
  locations: ServiceMode[];
  description: string;
  lines: ActivityLineInput[];
  /** Celebrity may register to advertise others' offers with zero owned taxonomy lines. */
  advertiseForOthers?: boolean;
  sellProducts?: boolean;
  provideServices?: boolean;
};

export type ActivityActor = {
  id: string;
  role: 'partner' | 'admin' | 'developer';
  active: boolean;
  partnerId?: string | null;
  display?: string;
};

export type WriteTarget = {
  partnerId: string;
  kind: 'product' | 'service';
  activity: string;
  title: string;
  lineageId: string;
};

export class PolicyError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
    this.name = 'PolicyError';
  }
}

export const ACTIVITY_NOT_APPROVED = 'ACTIVITY_NOT_APPROVED';
export const LEGACY_UNSCOPED = 'LEGACY_UNSCOPED';
