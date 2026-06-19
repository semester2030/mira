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
    priceSar: 29,
    skinCredits: 5,
    smartOutfitCredits: 20,
    validityDays: 30,
    benefitsAr: [
      '5 تحليلات بشرة',
      '20 تحليل إطلالة ذكي',
      'إطلالة سريعة بلا حدود',
      'صالحة 30 يوماً',
    ],
  );

  static const plus = PackageCatalogEntry(
    type: PackageType.plus,
    priceSar: 79,
    skinCredits: 20,
    smartOutfitCredits: 100,
    validityDays: 90,
    benefitsAr: [
      '20 تحليل بشرة',
      '100 تحليل إطلالة ذكي',
      'إطلالة سريعة بلا حدود',
      'سجل التحليلات الكامل',
      'توصيات ميرا المتقدمة',
      'صالحة 90 يوماً',
    ],
  );

  static const elite = PackageCatalogEntry(
    type: PackageType.elite,
    priceSar: 149,
    skinCredits: 50,
    smartOutfitCredits: 300,
    validityDays: 180,
    benefitsAr: [
      '50 تحليل بشرة',
      '300 تحليل إطلالة ذكي',
      'إطلالة سريعة بلا حدود',
      'أولوية في المعالجة',
      'سجل التحليلات الكامل',
      'توصيات موسمية',
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
