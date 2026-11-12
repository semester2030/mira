/**
 * Beauty lane id compatibility: portal writes legacy category (hair/makeup/…)
 * while taxonomy mids/leaves use beauty.* ids. One conversion table for browse + write.
 */

const LEGACY_TO_MID: Record<string, string> = {
  hair: 'beauty.hair',
  makeup: 'beauty.makeup',
  nails: 'beauty.nails',
  lashes_brows: 'beauty.lashes_brows',
  hair_removal: 'beauty.hair_removal',
  henna: 'beauty.henna',
  care: 'beauty.spa',
  spa: 'beauty.spa',
  skin: 'beauty.face_care', // salon cosmetic; clinic derm resolved separately by partner type
  laser: 'beauty.clinic.laser',
  teeth: 'beauty.clinic.teeth',
};

const MID_TO_LEGACY: Record<string, string> = {
  'beauty.hair': 'hair',
  'beauty.makeup': 'makeup',
  'beauty.nails': 'nails',
  'beauty.spa': 'care',
  'beauty.face_care': 'care',
  'beauty.lashes_brows': 'lashes_brows',
  'beauty.hair_removal': 'hair_removal',
  'beauty.henna': 'henna',
  'beauty.clinic.derm': 'skin',
  'beauty.clinic.laser': 'laser',
  'beauty.clinic.teeth': 'teeth',
};

/** Mid/legacy ids that are equivalent for catalog category matching. */
export function beautyCategoryAliases(id: string | null | undefined): string[] {
  if (!id) return [];
  const out = new Set<string>([id]);
  if (LEGACY_TO_MID[id]) out.add(LEGACY_TO_MID[id]);
  if (MID_TO_LEGACY[id]) out.add(MID_TO_LEGACY[id]);
  // Leaf → mid → legacy
  if (id.startsWith('beauty.') && id.split('.').length >= 3) {
    const parts = id.split('.');
    // beauty.hair.color → beauty.hair; beauty.clinic.laser.hair → beauty.clinic.laser
    if (parts[1] === 'clinic' && parts.length >= 4) {
      const mid = parts.slice(0, 3).join('.');
      out.add(mid);
      if (MID_TO_LEGACY[mid]) out.add(MID_TO_LEGACY[mid]);
    } else if (parts[1] !== 'clinic') {
      const mid = `${parts[0]}.${parts[1]}`;
      out.add(mid);
      if (MID_TO_LEGACY[mid]) out.add(MID_TO_LEGACY[mid]);
    }
  }
  return [...out];
}

export function beautyCategoriesEquivalent(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const aa = new Set(beautyCategoryAliases(a));
  return beautyCategoryAliases(b).some((x) => aa.has(x));
}

/** Portal/main-orb legacy category for a taxonomy mid or leaf. */
export function legacyBeautyCategoryFor(taxonomyId: string | null | undefined): string | null {
  if (!taxonomyId) return null;
  if (LEGACY_TO_MID[taxonomyId]) return taxonomyId;
  if (MID_TO_LEGACY[taxonomyId]) return MID_TO_LEGACY[taxonomyId];
  const aliases = beautyCategoryAliases(taxonomyId);
  for (const a of aliases) {
    if (MID_TO_LEGACY[a]) return MID_TO_LEGACY[a];
    if (LEGACY_TO_MID[a]) return a;
  }
  return null;
}

export function taxonomyMidForLegacyBeauty(legacy: string | null | undefined, partnerType?: string): string | null {
  if (!legacy) return null;
  if (partnerType === 'clinic') {
    if (legacy === 'hair' || legacy === 'skin') return 'beauty.clinic.derm';
    if (legacy === 'laser') return 'beauty.clinic.laser';
    if (legacy === 'teeth') return 'beauty.clinic.teeth';
  }
  return LEGACY_TO_MID[legacy] || (legacy.startsWith('beauty.') ? legacy : null);
}

export function isBeautyTaxonomyLeafId(id: string | null | undefined): boolean {
  if (!id || !id.startsWith('beauty.')) return false;
  if (id === 'beauty.home_visit' || id === 'beauty.bridal_prep' || id === 'beauty.salons' || id === 'beauty.clinics') {
    return false;
  }
  const parts = id.split('.');
  return parts.length >= 3;
}
