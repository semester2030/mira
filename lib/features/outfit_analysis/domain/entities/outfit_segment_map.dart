import 'dart:ui';

/// Clothing/body zones for outfit segmentation overlay.
enum OutfitSegmentZone {
  head,
  upperBody,
  waist,
  lowerBody,
  feet,
  accessories,
}

/// A labeled region on the frozen outfit image.
class OutfitSegmentRegion {
  final OutfitSegmentZone zone;
  final Rect normalizedRect;
  final String labelAr;
  final String labelEn;
  final List<String> colors;
  final double confidence;

  const OutfitSegmentRegion({
    required this.zone,
    required this.normalizedRect,
    required this.labelAr,
    required this.labelEn,
    this.colors = const [],
    this.confidence = 0,
  });

  OutfitSegmentRegion copyWith({
    Rect? normalizedRect,
    String? labelAr,
    String? labelEn,
    List<String>? colors,
    double? confidence,
  }) {
    return OutfitSegmentRegion(
      zone: zone,
      normalizedRect: normalizedRect ?? this.normalizedRect,
      labelAr: labelAr ?? this.labelAr,
      labelEn: labelEn ?? this.labelEn,
      colors: colors ?? this.colors,
      confidence: confidence ?? this.confidence,
    );
  }
}

/// Visual outfit segmentation map — deterministic, region-based.
class OutfitSegmentMap {
  final List<OutfitSegmentRegion> regions;
  final List<String> upperBodyColors;
  final List<String> lowerBodyColors;
  final List<String> shoeColors;
  final List<String> accessoryColors;
  final double imageWidth;
  final double imageHeight;
  final String source;

  const OutfitSegmentMap({
    required this.regions,
    this.upperBodyColors = const [],
    this.lowerBodyColors = const [],
    this.shoeColors = const [],
    this.accessoryColors = const [],
    this.imageWidth = 0,
    this.imageHeight = 0,
    this.source = 'deterministic',
  });

  static const empty = OutfitSegmentMap(regions: []);

  List<String> colorsForZone(OutfitSegmentZone zone) {
    return switch (zone) {
      OutfitSegmentZone.upperBody => upperBodyColors,
      OutfitSegmentZone.lowerBody => lowerBodyColors,
      OutfitSegmentZone.feet => shoeColors,
      OutfitSegmentZone.accessories => accessoryColors,
      _ => const [],
    };
  }
}
