import 'catalog_product_options.dart';

/// Category-driven option and trait field templates for merchant entry.
/// Presets are suggestions only — never auto-selected or auto-invented as stock.
abstract final class CatalogOptionSchema {
  static List<CatalogOptionGroup> suggestedOptionGroups(String? category) {
    switch (category) {
      case 'clothes':
        return const [
          CatalogOptionGroup(
            id: 'size',
            labelAr: 'المقاس',
            kind: 'size',
            values: [
              CatalogOptionValue(id: 'xs', labelAr: 'XS'),
              CatalogOptionValue(id: 's', labelAr: 'S'),
              CatalogOptionValue(id: 'm', labelAr: 'M'),
              CatalogOptionValue(id: 'l', labelAr: 'L'),
              CatalogOptionValue(id: 'xl', labelAr: 'XL'),
            ],
          ),
          CatalogOptionGroup(
            id: 'color',
            labelAr: 'اللون',
            kind: 'color',
            values: [
              CatalogOptionValue(id: 'custom', labelAr: 'أضيفي لونًا'),
            ],
          ),
        ];
      case 'face':
      case 'body':
      case 'hair':
        return const [
          CatalogOptionGroup(
            id: 'volume',
            labelAr: 'الحجم',
            kind: 'volume',
            values: [
              CatalogOptionValue(id: 'v50', labelAr: '50 مل', amount: 50, unit: 'مل'),
              CatalogOptionValue(id: 'v100', labelAr: '100 مل', amount: 100, unit: 'مل'),
            ],
          ),
        ];
      case 'accessories':
        return const [
          CatalogOptionGroup(
            id: 'finish',
            labelAr: 'التشطيب',
            kind: 'finish',
            values: [
              CatalogOptionValue(id: 'gold', labelAr: 'ذهبي'),
              CatalogOptionValue(id: 'silver', labelAr: 'فضي'),
            ],
          ),
        ];
      default:
        return const [];
    }
  }

  /// Descriptive traits — not selectable variants.
  static List<String> suggestedTraitKeys(String? category) {
    switch (category) {
      case 'clothes':
        return const ['الخامة', 'العناية', 'دليل المقاسات'];
      case 'face':
      case 'body':
      case 'hair':
        return const ['المكونات', 'طريقة الاستخدام', 'الخامة'];
      case 'accessories':
        return const ['الخامة', 'الأبعاد'];
      default:
        return const [];
    }
  }

  static bool isServiceCategory(String? category) {
    return const {'skin', 'makeup', 'nails', 'care', 'hair'}.contains(category);
  }
}
