/// Which product detail template family to render for a published catalog item.
///
/// Selection is driven by taxonomy signals that already exist on old ads
/// (`category` / `subcategory` / `profileId`). Missing optional merchant fields
/// (gold weight, certificate, fabric notes) must not invent values — only hide
/// or show an honest empty state (e.g. jewelry certificate «غير مرفقة»).
enum CatalogDetailFamily {
  fashion,
  jewelry,
  generic,
}

abstract final class CatalogDetailFamilyResolver {
  static CatalogDetailFamily resolve({
    String? category,
    String? subcategory,
    String? profileId,
  }) {
    final profile = (profileId ?? '').trim().toLowerCase();
    final cat = (category ?? '').trim().toLowerCase();
    final sub = (subcategory ?? '').trim().toLowerCase();

    if (profile == 'product.jewelry' ||
        profile.startsWith('product.jewelry') ||
        cat == 'jewelry' ||
        cat == 'jewellery' ||
        sub.startsWith('jewelry.')) {
      return CatalogDetailFamily.jewelry;
    }

    if (profile == 'product.clothes' ||
        profile == 'product.abaya' ||
        profile.startsWith('product.clothes') ||
        cat == 'clothes' ||
        sub.startsWith('clothes.')) {
      return CatalogDetailFamily.fashion;
    }

    return CatalogDetailFamily.generic;
  }

  /// Arabic labels for known attribute keys. Unknown keys keep a readable fallback.
  static String attributeLabelAr(String key) {
    const map = <String, String>{
      'metal': 'المعدن',
      'metalType': 'المعدن',
      'metalColor': 'لون المعدن',
      'purity': 'العيار',
      'purityKarat': 'العيار',
      'goldWeight': 'وزن الذهب',
      'goldWeightG': 'وزن الذهب',
      'stone': 'الحجر',
      'stoneType': 'الحجر',
      'stoneWeight': 'وزن الحجر',
      'stoneWeightCt': 'وزن الحجر',
      'stoneShape': 'شكل الحجر',
      'sellUnit': 'وحدة البيع',
      'pieceStyle': 'شكل القطعة',
      'ringSize': 'مقاس الخاتم',
      'chainLength': 'طول السلسلة',
      'fabric': 'الخامة',
      'material': 'الخامة',
      'cut': 'القصة',
      'details': 'التفاصيل',
      'color': 'اللون',
      'size': 'المقاس',
    };
    // Never surface camelCase to the customer.
    return map[key] ?? '';
  }

  static bool hasCertificate(Map<String, String> traits, Map<String, dynamic>? attributes) {
    final cert = traits['certificate'] ??
        traits['شهادة'] ??
        attributes?['certificateUrl']?.toString() ??
        attributes?['certificateMediaId']?.toString() ??
        attributes?['certificate']?.toString();
    return cert != null && cert.trim().isNotEmpty;
  }
}
