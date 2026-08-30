import '../../data/helpers/vision_color_mapper.dart';
import '../entities/canonical_garment.dart';
import '../entities/outfit_visual_profile.dart';

/// Bounded translation from frozen GI output to existing Flutter engine input.
///
/// It consumes canonical fields only. In particular, it does not reconstruct
/// the internal FashionVisionDocument or invent geometry from geometryRef.
abstract final class CanonicalGarmentToEngineAdapter {
  CanonicalGarmentToEngineAdapter._();

  static const _colorIdToAr = <String, String>{
    'beige_linen': 'بيج',
    'cream_soft': 'كريمي',
    'black_pure': 'أسود',
    'navy_deep': 'كحلي',
    'ivory_warm': 'عاجي',
    'gray_soft': 'رمادي',
    'silver_metal': 'فضي',
    'gold_warm': 'ذهبي',
    'nude_heel': 'نود',
    'pearl_white': 'لؤلؤي',
    'brown_tortoise': 'بني',
    'blush_lilac': 'لافندر',
    'emerald_deep': 'زمردي',
    'teal_satin': 'تركواز داكن',
    'forest_green': 'أخضر',
    'ruby_red': 'أحمر',
    'white_pure': 'أبيض',
  };

  static const _typeIdToEn = <String, String>{
    'blazer': 'Blazer',
    'jacket': 'Jacket',
    'dress': 'Dress',
    'skirt': 'Skirt',
    'pants': 'Pants',
    'jeans': 'Jeans',
    'shirt': 'Shirt',
    'blouse': 'Blouse',
    'top': 'Top',
    'coat': 'Coat',
    'abaya': 'Abaya',
    'suit': 'Suit',
    'heels': 'Shoe',
    'bag': 'Handbag',
    'jewelry': 'Jewelry',
    'scarf': 'Scarf',
  };

  static const _styleFormality = <String, double>{
    'quiet_luxury': 0.78,
    'old_money': 0.82,
    'minimal': 0.55,
    'business': 0.75,
    'evening': 0.88,
    'wedding': 0.95,
    'casual': 0.35,
    'resort': 0.42,
    'travel': 0.38,
  };

  static const _styleAr = <String, String>{
    'quiet_luxury': 'رفاهية هادئة',
    'old_money': 'كلاسيكي',
    'minimal': 'بسيط',
    'business': 'مهني',
    'evening': 'سهرة',
    'wedding': 'زفاف',
    'casual': 'كاجوال',
    'resort': 'منتجع',
    'travel': 'سفر',
  };

  static OutfitVisualProfile toVisualProfile(List<CanonicalGarment> garments) {
    if (garments.isEmpty) {
      throw const FormatException(
        'Cannot adapt an empty canonical garment set',
      );
    }

    final sorted = [...garments]
      ..sort((a, b) => b.confidence.compareTo(a.confidence));
    final primary = sorted.first;
    final clothingTypes = <String>[];
    final accessoryTypes = <String>[];
    final colors = <String>[];
    final styleHints = <String>[];

    for (final garment in garments) {
      final label = _garmentLabelAr(garment);
      final target = garment.identity.entityClass == 'accessory'
          ? accessoryTypes
          : clothingTypes;
      if (!target.contains(label)) target.add(label);

      for (final colorId in garment.attributes.colors) {
        final color = _colorIdToAr[colorId];
        if (color != null && !colors.contains(color)) colors.add(color);
      }
      for (final hint in garment.attributes.styleHints) {
        if (!styleHints.contains(hint)) styleHints.add(hint);
      }
    }

    final primaryStyle = styleHints.isEmpty ? null : styleHints.first;
    final styleAr = primaryStyle == null
        ? 'غير محدد'
        : (_styleAr[primaryStyle] ?? primaryStyle);
    final averageConfidence =
        garments.fold<double>(0, (sum, garment) => sum + garment.confidence) /
        garments.length;

    return OutfitVisualProfile(
      labels: clothingTypes,
      dominantColors: colors,
      clothingTypes: clothingTypes,
      accessoryTypes: accessoryTypes,
      styleSignals: styleHints.map((hint) => _styleAr[hint] ?? hint).toList(),
      confidence: (averageConfidence * 100).round().clamp(0, 100),
      clothingConfidence: primary.confidence,
      source: 'canonical_garment',
      garmentTypeAr: _garmentLabelAr(primary),
      garmentTypeEn:
          primary.localeLabels?.en ??
          _typeIdToEn[primary.identity.typeId] ??
          primary.identity.typeId,
      styleTypeAr: styleAr,
      styleTypeEn: primaryStyle ?? '',
      contrastLevel: _contrastFromColors(colors),
      formalityLevel: primaryStyle == null
          ? 0.5
          : (_styleFormality[primaryStyle] ?? 0.5),
      brightness: 0.55,
    );
  }

  static String _garmentLabelAr(CanonicalGarment garment) {
    final contractLabel = garment.localeLabels?.ar;
    if (contractLabel != null && contractLabel.trim().isNotEmpty) {
      return contractLabel;
    }
    final en = _typeIdToEn[garment.identity.typeId] ?? garment.identity.typeId;
    return VisionColorMapper.labelToArabic(en);
  }

  static double _contrastFromColors(List<String> colors) {
    if (colors.length < 2) return 0.45;
    final hasDark = colors.any(
      (color) => color == 'أسود' || color == 'كحلي' || color == 'بني',
    );
    final hasLight = colors.any(
      (color) =>
          color == 'أبيض' ||
          color == 'كريمي' ||
          color == 'بيج' ||
          color == 'عاجي' ||
          color == 'لؤلؤي',
    );
    return hasDark && hasLight ? 0.78 : 0.52;
  }
}
