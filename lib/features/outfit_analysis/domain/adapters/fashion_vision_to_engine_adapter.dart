import 'dart:ui';

import '../../data/helpers/vision_color_mapper.dart';
import '../entities/fashion_vision_document.dart';
import '../entities/outfit_visual_profile.dart';
import '../services/outfit_segmentation_service.dart';

/// Maps [FashionVisionDocument] → engine inputs (Phase 7).
/// Reference: docs/mira-vision-platform.html
abstract final class FashionVisionToEngineAdapter {
  FashionVisionToEngineAdapter._();

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
    'unknown': 'Clothing',
  };

  static const _archetypeFormality = <String, double>{
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

  static const _archetypeStyleAr = <String, String>{
    'quiet_luxury': 'رفاهية هادئة',
    'old_money': 'كلاسيكي',
    'minimal': 'مينimal',
    'business': 'مهني',
    'evening': 'سهرة',
    'wedding': 'زفاف',
    'casual': 'كاجوال',
    'resort': 'منتجع',
    'travel': 'سفر',
  };

  static OutfitVisualProfile toVisualProfile(FashionVisionDocument fashion) {
    final semantics = fashion.semantics;
    final garments = _listOfMaps(semantics['garments']);
    final accessories = _listOfMaps(semantics['accessories']);

    final dominantIds = _stringList(semantics['dominantColorIds']);
    final secondaryIds = _stringList(semantics['secondaryColorIds']);
    final dominantColors = _colorsToAr([
      ...dominantIds,
      ...secondaryIds,
    ]);

    final clothingTypes = <String>[];
    final accessoryTypes = <String>[];
    var bestConfidence = 0.0;
    String primaryTypeId = 'unknown';

    for (final g in garments) {
      final typeId = g['typeId'] as String? ?? 'unknown';
      final ar = _garmentLabelAr(typeId);
      if (!clothingTypes.contains(ar)) clothingTypes.add(ar);
      final conf = (g['providerConfidence'] as num?)?.toDouble() ?? 0;
      if (conf >= bestConfidence) {
        bestConfidence = conf;
        primaryTypeId = typeId;
      }
    }

    for (final a in accessories) {
      final typeId = a['typeId'] as String? ?? 'unknown';
      final ar = _garmentLabelAr(typeId);
      if (!accessoryTypes.contains(ar)) accessoryTypes.add(ar);
    }

    final archetype = semantics['styleArchetypeId'] as String? ?? 'casual';
    final formality = _archetypeFormality[archetype] ?? 0.5;
    final styleAr = _archetypeStyleAr[archetype] ?? 'أنيق';
    final primaryAr = _garmentLabelAr(primaryTypeId);

    final fusionConf = fashion.overallConfidence;
    final confidence = ((fusionConf > 0 ? fusionConf : bestConfidence) * 100)
        .round()
        .clamp(15, 98);

    return OutfitVisualProfile(
      labels: clothingTypes.map((e) => _typeIdToEn.entries
          .firstWhere((kv) => _garmentLabelAr(kv.key) == e, orElse: () => MapEntry('unknown', e))
          .value).toList(),
      dominantColors: dominantColors.isNotEmpty ? dominantColors : const ['مختلط'],
      clothingTypes: clothingTypes,
      accessoryTypes: accessoryTypes,
      styleSignals: [styleAr],
      confidence: confidence,
      clothingConfidence: bestConfidence,
      source: 'vision_platform',
      garmentTypeAr: primaryAr,
      garmentTypeEn: _typeIdToEn[primaryTypeId] ?? 'Outfit',
      styleTypeAr: styleAr,
      styleTypeEn: archetype,
      contrastLevel: _contrastFromColors(dominantColors),
      formalityLevel: formality,
      brightness: 0.55,
    );
  }

  static List<VisionLocalizedObject> toLocalizedObjects(
    FashionVisionDocument fashion,
  ) {
    final segments = _listOfMaps(fashion.geometry['segments']);
    return segments.map((seg) {
      final role = seg['regionRole'] as String? ?? 'unknown';
      final bbox = seg['bbox'] as Map? ?? const {};
      final x = (bbox['x'] as num?)?.toDouble() ?? 0;
      final y = (bbox['y'] as num?)?.toDouble() ?? 0;
      final w = (bbox['w'] as num?)?.toDouble() ?? 0.2;
      final h = (bbox['h'] as num?)?.toDouble() ?? 0.2;
      final name = _visionNameForRole(role, seg);
      return VisionLocalizedObject(
        name: name,
        score: 0.88,
        normalizedBox: Rect.fromLTWH(x, y, w, h),
      );
    }).toList();
  }

  static String _visionNameForRole(String role, Map<String, dynamic> seg) {
    final garments = _listOfMaps(
      (seg['garment'] != null) ? [seg['garment']] : const [],
    );
    if (garments.isNotEmpty) {
      final typeId = garments.first['typeId'] as String? ?? '';
      if (typeId.isNotEmpty) return _typeIdToEn[typeId] ?? typeId;
    }
    return switch (role) {
      'upper' => 'Top',
      'lower' => 'Pants',
      'outerwear' => 'Blazer',
      'feet' => 'Shoe',
      'accessory' => 'Handbag',
      'full_body' => 'Dress',
      _ => 'Clothing',
    };
  }

  static String _garmentLabelAr(String typeId) {
    final en = _typeIdToEn[typeId] ?? typeId;
    return VisionColorMapper.labelToArabic(en);
  }

  static List<String> _colorsToAr(List<String> ids) {
    final out = <String>[];
    for (final id in ids) {
      final ar = _colorIdToAr[id];
      if (ar != null && !out.contains(ar)) out.add(ar);
    }
    return out;
  }

  static double _contrastFromColors(List<String> colors) {
    if (colors.length < 2) return 0.45;
    final hasDark = colors.any((c) => c == 'أسود' || c == 'كحلي' || c == 'بني');
    final hasLight = colors.any((c) =>
        c == 'أبيض' || c == 'كريمي' || c == 'بيج' || c == 'عاجي' || c == 'لؤلؤي');
    if (hasDark && hasLight) return 0.78;
    return 0.52;
  }

  static List<Map<String, dynamic>> _listOfMaps(dynamic raw) {
    if (raw is! List) return const [];
    return raw
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  static List<String> _stringList(dynamic raw) {
    if (raw is! List) return const [];
    return raw.map((e) => e.toString()).where((e) => e.isNotEmpty).toList();
  }
}
