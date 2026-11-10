/**
 * Server-side partner create capabilities. Source of truth is DB Partner.type —
 * never trust client-sent type or display name.
 *
 * event_planner: independent occasions coordinator — may create services.
 * Product (favors) requires Partner.canSellProducts === true (never storeUrl markers).
 */
export type PartnerCatalogKind = 'product' | 'service';

export type PartnerCapabilitySource = {
  type?: string | null;
  canSellProducts?: boolean | null;
  /** Ignored for sell capability — kept only so callers do not confuse storeUrl with caps. */
  storeUrl?: string | null;
};

/** Explicit DB flag only. storeUrl must never grant sell rights. */
export function partnerCanSellProducts(partner: PartnerCapabilitySource | null | undefined): boolean {
  if (!partner) return false;
  return partner.canSellProducts === true;
}

export function partnerCanCreateKind(
  partnerType: string | null | undefined,
  kind: PartnerCatalogKind,
  opts?: { canSellProducts?: boolean | null },
): boolean {
  const type = String(partnerType || '').trim();
  if (!type) return false;
  // Authorized MIRA commercial developer account: both kinds (never generalize).
  if (type === 'developer') return true;
  if (kind === 'product') {
    if (type === 'brand') return true;
    if (type === 'event_planner') return opts?.canSellProducts === true;
    return false;
  }
  if (kind === 'service') {
    return type === 'salon' || type === 'clinic' || type === 'event_planner';
  }
  return false;
}

export function partnerCanCreateKindFromPartner(
  partner: PartnerCapabilitySource | null | undefined,
  kind: PartnerCatalogKind,
): boolean {
  if (!partner) return false;
  return partnerCanCreateKind(partner.type, kind, {
    canSellProducts: partnerCanSellProducts(partner),
  });
}

export function partnerCanShowBulkKind(
  partnerType: string | null | undefined,
  kind: PartnerCatalogKind,
): boolean {
  return partnerCanCreateKind(partnerType, kind);
}

export const PARTNER_KIND_FORBIDDEN = 'PARTNER_KIND_FORBIDDEN';
