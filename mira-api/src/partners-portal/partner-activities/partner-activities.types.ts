export const IDENTITY_KINDS = {
  shop: 'متجر متعدد العلامات',
  brand: 'علامة تجارية',
  salon: 'صالون نسائي',
  independent: 'مقدمة خدمة مستقلة',
  clinic: 'عيادة',
  events: 'جهة تنظيم مناسبات',
} as const;

export const SERVICE_MODES = {
  venue: 'في مقر المنشأة',
  client_home: 'في منزل العميلة',
  provider_home: 'في استوديو أو مقر مقدمة الخدمة',
  remote: 'عن بُعد',
} as const;

export type IdentityKind = keyof typeof IDENTITY_KINDS;
export type ServiceMode = keyof typeof SERVICE_MODES;

export type ActivityDef = {
  id: string;
  label: string;
  group: string;
  kind: 'product' | 'service';
  selectable: true;
  imageKey?: string | null;
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
