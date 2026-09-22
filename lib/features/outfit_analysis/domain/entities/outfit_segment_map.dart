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

  /// Real fabric mask: closed contour with enough vertices (not a 4-corner rect stub).
  bool get hasFabricMask =>
      normalizedPolygon.length >= 6 && _polygonArea(normalizedPolygon) > 0.002;

  /// Documented clothing bounds: non-trivial rect within image, not anatomy stub.
  bool get hasDocumentedClothingBounds {
    final r = normalizedRect;
    if (r.width < 0.08 || r.height < 0.08) return false;
    if (r.left < -0.02 || r.top < -0.02 || r.right > 1.02 || r.bottom > 1.02) {
      return false;
    }
    return true;
  }

  static double _polygonArea(List<Offset> pts) {
    if (pts.length < 3) return 0;
    var sum = 0.0;
    for (var i = 0; i < pts.length; i++) {
      final a = pts[i];
      final b = pts[(i + 1) % pts.length];
      sum += a.dx * b.dy - b.dx * a.dy;
    }
    return sum.abs() * 0.5;
  }

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

  static const _trustedGarmentSources = {
    'vision_garment',
    'vision_pixel_contour',
    'server_segment',
    'fashn_geometry_contour',
  };

  bool get _sourceAllowsFabricRecolor =>
      _trustedGarmentSources.contains(source);

  /// Map-level gate: true only if at least one **selected-capable** region exists.
  /// Callers that recolor a piece MUST use [supportsFabricRecolorFor].
  bool get supportsFabricRecolor {
    if (!_sourceAllowsFabricRecolor || !hasTrustedOverlay) return false;
    return regions.any(regionSupportsFabricRecolor);
  }

  /// Fabric recolor for the **selected** garment only.
  /// Another valid region / high confidence / bare rect / vision-* prefix alone
  /// do NOT unlock recolor for a different piece. Anatomy bands never unlock.
  bool supportsFabricRecolorFor({
    String? garmentLabelAr,
    OutfitSegmentRegion? selectedRegion,
  }) {
    if (!_sourceAllowsFabricRecolor || !hasTrustedOverlay) return false;
    final region = selectedRegion ?? regionForGarmentLabel(garmentLabelAr);
    if (region == null) return false;
    return regionSupportsFabricRecolor(region);
  }

  bool regionSupportsFabricRecolor(OutfitSegmentRegion region) {
    if (!_sourceAllowsFabricRecolor || !hasTrustedOverlay) return false;
    if (region.zone == OutfitSegmentZone.head) return false;
    if (isAnatomyBandLabel(region)) return false;
    // Actual fabric mask wins.
    if (region.hasFabricMask) return true;
    // Documented clothing bounds from trusted garment source + clothing label
    // + geometric validity. Contour preferred; pixel-contour source may use
    // documented bounds when polygon is present (≥3) even if area is thin.
    if (source == 'vision_pixel_contour' &&
        region.hasContour &&
        region.hasDocumentedClothingBounds &&
        region.labelAr.trim().isNotEmpty) {
      return true;
    }
    // Bare rect / confidence / generic vision prefix — never enough.
    return false;
  }

  OutfitSegmentRegion? regionForGarmentLabel(String? garmentLabelAr) {
    final label = garmentLabelAr?.trim() ?? '';
    if (label.isEmpty || regions.isEmpty) return null;
    for (final r in regions) {
      if (isAnatomyBandLabel(r)) continue;
      if (r.labelAr == label ||
          r.labelAr.contains(label) ||
          label.contains(r.labelAr)) {
        return r;
      }
    }
    return null;
  }

  static bool isAnatomyBandLabel(OutfitSegmentRegion r) {
    final l = '${r.labelAr} ${r.labelEn}'.toLowerCase().trim();
    return l.contains('الجزء العلوي') ||
        l.contains('الجزء السفلي') ||
        l.contains('upper body') ||
        l.contains('lower body') ||
        l == 'upper' ||
        l == 'lower' ||
        l.contains('القدمين') ||
        l == 'feet' ||
        l.contains('الرأس') ||
        l == 'head';
  }

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
