import 'dart:ui';

import '../../domain/entities/outfit_segment_map.dart';

abstract final class OutfitSegmentMapMapper {
  OutfitSegmentMapMapper._();

  static OutfitSegmentMap fromJson(Map<String, dynamic> json) {
    final regionsRaw = json['regions'] as List<dynamic>? ?? const [];
    final regions = regionsRaw
        .map((e) => _regionFromJson(e as Map<String, dynamic>))
        .toList();

    List<String> list(String key) =>
        (json[key] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? const [];

    return OutfitSegmentMap(
      regions: regions,
      upperBodyColors: list('upperBodyColors'),
      lowerBodyColors: list('lowerBodyColors'),
      shoeColors: list('shoeColors'),
      accessoryColors: list('accessoryColors'),
      imageWidth: (json['imageWidth'] as num?)?.toDouble() ?? 0,
      imageHeight: (json['imageHeight'] as num?)?.toDouble() ?? 0,
      source: json['source'] as String? ?? 'server',
    );
  }

  static OutfitSegmentRegion _regionFromJson(Map<String, dynamic> json) {
    final rectJson = json['normalizedRect'] as Map<String, dynamic>? ?? const {};
    final polygonRaw = json['normalizedPolygon'] as List<dynamic>? ?? const [];
    final polygon = polygonRaw.map((p) {
      final map = p as Map<String, dynamic>;
      return Offset(
        (map['x'] as num?)?.toDouble() ?? 0,
        (map['y'] as num?)?.toDouble() ?? 0,
      );
    }).toList();

    return OutfitSegmentRegion(
      zone: _zoneFromString(json['zone'] as String? ?? 'upperBody'),
      normalizedRect: Rect.fromLTWH(
        (rectJson['left'] as num?)?.toDouble() ?? 0,
        (rectJson['top'] as num?)?.toDouble() ?? 0,
        (rectJson['width'] as num?)?.toDouble() ?? 0.1,
        (rectJson['height'] as num?)?.toDouble() ?? 0.1,
      ),
      normalizedPolygon: polygon,
      labelAr: json['labelAr'] as String? ?? '',
      labelEn: json['labelEn'] as String? ?? '',
      colors: (json['colors'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? const [],
      confidence: (json['confidence'] as num?)?.toDouble() ?? 0,
    );
  }

  static OutfitSegmentZone _zoneFromString(String raw) {
    return switch (raw) {
      'head' => OutfitSegmentZone.head,
      'waist' => OutfitSegmentZone.waist,
      'lowerBody' => OutfitSegmentZone.lowerBody,
      'feet' => OutfitSegmentZone.feet,
      'accessories' => OutfitSegmentZone.accessories,
      _ => OutfitSegmentZone.upperBody,
    };
  }
}
