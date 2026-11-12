/** Shared public-contact redaction for catalog + partner detail responses. */

export type PartnerPublicMeta = {
  publicContactVisible?: boolean;
  providerKind?: 'independent' | 'facility';
  bookingActivated?: boolean;
  identity?: string[];
};

export function readPartnerActivitiesMeta(partner: { activitiesMeta?: unknown }): PartnerPublicMeta {
  const raw = partner.activitiesMeta;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as PartnerPublicMeta;
}

/** Public API never returns registration phone unless partner opted in. */
export function publicContactPhone(partner: {
  contactPhone?: string | null;
  activitiesMeta?: unknown;
}): string | null {
  const meta = readPartnerActivitiesMeta(partner);
  if (meta.publicContactVisible !== true) return null;
  return partner.contactPhone ?? null;
}

export function providerKindOf(partner: {
  type?: string;
  activitiesMeta?: unknown;
}): 'independent' | 'facility' {
  const meta = readPartnerActivitiesMeta(partner);
  if (meta.providerKind === 'independent' || meta.providerKind === 'facility') return meta.providerKind;
  if (
    Array.isArray(meta.identity) &&
    meta.identity.includes('independent') &&
    !meta.identity.some((k) => k === 'salon' || k === 'clinic')
  ) {
    return 'independent';
  }
  return 'facility';
}

export function publicBookingEnabled(
  service: { bookingEnabled: boolean },
  partner: { activitiesMeta?: unknown },
): boolean {
  if (!service.bookingEnabled) return false;
  const meta = readPartnerActivitiesMeta(partner);
  if (meta.bookingActivated === undefined && meta.providerKind === undefined) return true;
  return meta.bookingActivated === true;
}
