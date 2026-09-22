/// Truth classes for Skin Report claims (presentation must not upgrade class).
enum SkinTruthClass {
  measured,
  derived,
  regionBased,
  illustrative,
  unavailable,
}

extension SkinTruthClassLabelAr on SkinTruthClass {
  String get labelAr => switch (this) {
        SkinTruthClass.measured => 'مقاس من التحليل',
        SkinTruthClass.derived => 'محسوب من التحليل',
        SkinTruthClass.regionBased => 'منطقة إرشادية',
        SkinTruthClass.illustrative => 'توضيحي',
        SkinTruthClass.unavailable => 'غير متاح',
      };

  String get shortBadgeAr => switch (this) {
        SkinTruthClass.measured => 'مقاس',
        SkinTruthClass.derived => 'محسوب',
        SkinTruthClass.regionBased => 'إرشادي',
        SkinTruthClass.illustrative => 'خريطة مناطق استرشادية',
        SkinTruthClass.unavailable => 'غير متاح',
      };
}
