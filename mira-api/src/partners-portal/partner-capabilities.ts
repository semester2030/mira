/**
 * Server-side partner create capabilities. Source of truth is DB Partner.type —
 * never trust client-sent type or display name.
 */
export type PartnerCatalogKind = 'product' | 'service';

export function partnerCanCreateKind(
  partnerType: string | null | undefined,
  kind: PartnerCatalogKind,
): boolean {
  const type = String(partnerType || '').trim();
  if (!type) return false;
  // Authorized MIRA commercial developer account: both kinds.
  if (type === 'developer') return true;
  if (kind === 'product') return type === 'brand';
  if (kind === 'service') return type === 'salon' || type === 'clinic';
  return false;
}

export function partnerCanShowBulkKind(
  partnerType: string | null | undefined,
  kind: PartnerCatalogKind,
): boolean {
  return partnerCanCreateKind(partnerType, kind);
}

export const PARTNER_KIND_FORBIDDEN = 'PARTNER_KIND_FORBIDDEN';
