import 'package_type.dart';

/// Static catalog — prices in SAR (mock purchase until StoreKit).
class PackageCatalogEntry {
  final PackageType type;
  final int priceSar;
  final int skinCredits;
  final int smartOutfitCredits;
  final int validityDays;
  final List<String> benefitsAr;

  const PackageCatalogEntry({
    required this.type,
    required this.priceSar,
    required this.skinCredits,
    required this.smartOutfitCredits,
    required this.validityDays,
    required this.benefitsAr,
  });
}

abstract final class PackageCatalog {
  PackageCatalog._();

  static const starter = PackageCatalogEntry(
    type: PackageType.starter,
    priceSar: 39,
    skinCredits: 5,
    smartOutfitCredits: 30,
    validityDays: 30,
    benefitsAr: [
      '5 تحليلات بشرة',
      '30 تحليل إطلالة ذكي',
      'إطلالة سريعة غير محدودة',
      'صالحة 30 يوماً',
    ],
  );

  static const plus = PackageCatalogEntry(
    type: PackageType.plus,
    priceSar: 89,
    skinCredits: 15,
    smartOutfitCredits: 120,
    validityDays: 90,
    benefitsAr: [
      '15 تحليل بشرة',
      '120 تحليل إطلالة ذكي',
      'إطلالة سريعة بلا حدود',
      'سجل كامل',
      'توصيات ميرا المتقدمة',
      'صالحة 90 يوماً',
    ],
  );

  static const elite = PackageCatalogEntry(
    type: PackageType.elite,
    priceSar: 159,
    skinCredits: 30,
    smartOutfitCredits: 400,
    validityDays: 180,
    benefitsAr: [
      '30 تحليل بشرة',
      '400 تحليل إطلالة ذكي',
      'إطلالة سريعة بلا حدود',
      'سجل كامل',
      'توصيات موسمية',
      'تحليل تطور البشرة',
      'ملف جمالي كامل',
      'أولوية معالجة',
      'رؤى جمالية Premium',
      'صالحة 180 يوماً',
    ],
  );

  static const all = [starter, plus, elite];

  static PackageCatalogEntry of(PackageType type) => switch (type) {
        PackageType.starter => starter,
        PackageType.plus => plus,
        PackageType.elite => elite,
      };
}
