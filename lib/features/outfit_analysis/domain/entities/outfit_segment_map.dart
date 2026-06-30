import 'dart:ui';

import 'garment_color_palette.dart';

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

  /// Pixel-refined contour (normalized 0–1). Empty → draw [normalizedRect] only.
  final List<Offset> normalizedPolygon;

  const OutfitSegmentRegion({
    required this.zone,
    required this.normalizedRect,
    required this.labelAr,
    required this.labelEn,
    this.colors = const [],
    this.confidence = 0,
    this.normalizedPolygon = const [],
  });

  bool get hasContour => normalizedPolygon.length >= 3;

  OutfitSegmentRegion copyWith({
    Rect? normalizedRect,
    String? labelAr,
    String? labelEn,
    List<String>? colors,
    double? confidence,
    List<Offset>? normalizedPolygon,
  }) {
    return OutfitSegmentRegion(
      zone: zone,
      normalizedRect: normalizedRect ?? this.normalizedRect,
      labelAr: labelAr ?? this.labelAr,
      labelEn: labelEn ?? this.labelEn,
      colors: colors ?? this.colors,
      confidence: confidence ?? this.confidence,
      normalizedPolygon: normalizedPolygon ?? this.normalizedPolygon,
    );
  }
}

/// Visual outfit segmentation map — vision garment regions only when trusted.
class OutfitSegmentMap {
  final List<OutfitSegmentRegion> regions;
  final List<String> upperBodyColors;
  final List<String> lowerBodyColors;
  final List<String> shoeColors;
  final List<String> accessoryColors;
  final GarmentColorPalette garmentPalette;
  final double imageWidth;
  final double imageHeight;
  final String source;
  final bool isVisualTrusted;
  final String? validationMessage;

  const OutfitSegmentMap({
    required this.regions,
    this.upperBodyColors = const [],
    this.lowerBodyColors = const [],
    this.shoeColors = const [],
    this.accessoryColors = const [],
    this.garmentPalette = GarmentColorPalette.empty,
    this.imageWidth = 0,
    this.imageHeight = 0,
    this.source = 'deterministic',
    this.isVisualTrusted = false,
    this.validationMessage,
  });

  static const empty = OutfitSegmentMap(regions: []);

  bool get hasTrustedOverlay => isVisualTrusted && regions.isNotEmpty;

  List<String> get garmentColors => garmentPalette.ordered;

  OutfitSegmentMap copyWith({
    List<OutfitSegmentRegion>? regions,
    List<String>? upperBodyColors,
    List<String>? lowerBodyColors,
    List<String>? shoeColors,
    List<String>? accessoryColors,
    GarmentColorPalette? garmentPalette,
    double? imageWidth,
    double? imageHeight,
    String? source,
    bool? isVisualTrusted,
    String? validationMessage,
  }) {
    return OutfitSegmentMap(
      regions: regions ?? this.regions,
      upperBodyColors: upperBodyColors ?? this.upperBodyColors,
      lowerBodyColors: lowerBodyColors ?? this.lowerBodyColors,
      shoeColors: shoeColors ?? this.shoeColors,
      accessoryColors: accessoryColors ?? this.accessoryColors,
      garmentPalette: garmentPalette ?? this.garmentPalette,
      imageWidth: imageWidth ?? this.imageWidth,
      imageHeight: imageHeight ?? this.imageHeight,
      source: source ?? this.source,
      isVisualTrusted: isVisualTrusted ?? this.isVisualTrusted,
      validationMessage: validationMessage,
    );
  }

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
