/// Single axis on the skin health matrix (0–100, higher = healthier).
class SkinConcernScore {
  final String id;
  final String labelAr;
  final String labelEn;
  final int score;

  const SkinConcernScore({
    required this.id,
    required this.labelAr,
    required this.labelEn,
    required this.score,
  });
}

/// Catalog keys aligned with YouCam SD concerns.
abstract final class SkinConcernCatalog {
  SkinConcernCatalog._();

  static const radarIds = [
    'redness',
    'age_spot',
    'pore',
    'texture',
    'dark_circle',
    'wrinkle',
  ];

  static const allIds = [
    ...radarIds,
    'moisture',
    'oiliness',
    'acne',
    'radiance',
    'firmness',
    'eye_bag',
  ];

  static const _labels = <String, ({String ar, String en})>{
    'redness': (ar: 'الاحمرار', en: 'Redness'),
    'age_spot': (ar: 'البقع', en: 'Spots'),
    'pore': (ar: 'المسام', en: 'Pores'),
    'texture': (ar: 'الملمس', en: 'Texture'),
    'dark_circle': (ar: 'الهالات', en: 'Dark Circles'),
    'wrinkle': (ar: 'التجاعيد', en: 'Wrinkles'),
    'moisture': (ar: 'الترطيب', en: 'Moisture'),
    'oiliness': (ar: 'الدهون', en: 'Oiliness'),
    'acne': (ar: 'الحبوب', en: 'Acne'),
    'radiance': (ar: 'الإشراق', en: 'Radiance'),
    'firmness': (ar: 'المرونة', en: 'Firmness'),
    'eye_bag': (ar: 'انتفاخ العين', en: 'Eye Bags'),
  };

  static SkinConcernScore labeled(String id, int score) {
    final labels = _labels[id] ?? (ar: id, en: id);
    return SkinConcernScore(
      id: id,
      labelAr: labels.ar,
      labelEn: labels.en,
      score: score.clamp(0, 100),
    );
  }
}
