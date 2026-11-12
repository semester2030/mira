/// Beauty lane id compatibility: portal writes legacy category (hair/makeup/…)
/// while taxonomy mids/leaves use beauty.* ids.
/// Mirror of `mira-api/src/marketplace/taxonomy/beauty-id-compat.ts` — keep in sync.

const kBeautyLegacyToMid = <String, String>{
  'hair': 'beauty.hair',
  'makeup': 'beauty.makeup',
  'nails': 'beauty.nails',
  'lashes_brows': 'beauty.lashes_brows',
  'hair_removal': 'beauty.hair_removal',
  'henna': 'beauty.henna',
  'care': 'beauty.spa',
  'spa': 'beauty.spa',
  'skin': 'beauty.face_care',
  'laser': 'beauty.clinic.laser',
  'teeth': 'beauty.clinic.teeth',
};

const kBeautyMidToLegacy = <String, String>{
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

/// Mid/legacy ids that are equivalent for catalog category matching.
List<String> beautyCategoryAliases(String? id) {
  if (id == null || id.isEmpty) return const [];
  final out = <String>{id};
  final toMid = kBeautyLegacyToMid[id];
  if (toMid != null) out.add(toMid);
  final toLegacy = kBeautyMidToLegacy[id];
  if (toLegacy != null) out.add(toLegacy);
  if (id.startsWith('beauty.') && id.split('.').length >= 3) {
    final parts = id.split('.');
    if (parts.length >= 3 && parts[1] == 'clinic' && parts.length >= 4) {
      final mid = parts.take(3).join('.');
      out.add(mid);
      final leg = kBeautyMidToLegacy[mid];
      if (leg != null) out.add(leg);
    } else if (parts[1] != 'clinic') {
      final mid = '${parts[0]}.${parts[1]}';
      out.add(mid);
      final leg = kBeautyMidToLegacy[mid];
      if (leg != null) out.add(leg);
    }
  }
  return out.toList();
}

bool beautyCategoriesEquivalent(String? a, String? b) {
  if (a == null || b == null || a.isEmpty || b.isEmpty) return false;
  if (a == b) return true;
  final aa = beautyCategoryAliases(a).toSet();
  return beautyCategoryAliases(b).any(aa.contains);
}

/// Portal/main-orb legacy category for a taxonomy mid or leaf.
String? legacyBeautyCategoryFor(String? taxonomyId) {
  if (taxonomyId == null || taxonomyId.isEmpty) return null;
  if (kBeautyLegacyToMid.containsKey(taxonomyId)) return taxonomyId;
  final direct = kBeautyMidToLegacy[taxonomyId];
  if (direct != null) return direct;
  for (final a in beautyCategoryAliases(taxonomyId)) {
    final leg = kBeautyMidToLegacy[a];
    if (leg != null) return leg;
    if (kBeautyLegacyToMid.containsKey(a)) return a;
  }
  return null;
}

String? taxonomyMidForLegacyBeauty(String? legacy, {String? partnerType}) {
  if (legacy == null || legacy.isEmpty) return null;
  if (partnerType == 'clinic') {
    if (legacy == 'hair' || legacy == 'skin') return 'beauty.clinic.derm';
    if (legacy == 'laser') return 'beauty.clinic.laser';
    if (legacy == 'teeth') return 'beauty.clinic.teeth';
  }
  return kBeautyLegacyToMid[legacy] ?? (legacy.startsWith('beauty.') ? legacy : null);
}

bool isBeautyTaxonomyLeafId(String? id) {
  if (id == null || !id.startsWith('beauty.')) return false;
  if (id == 'beauty.home_visit' ||
      id == 'beauty.bridal_prep' ||
      id == 'beauty.salons' ||
      id == 'beauty.clinics') {
    return false;
  }
  return id.split('.').length >= 3;
}
