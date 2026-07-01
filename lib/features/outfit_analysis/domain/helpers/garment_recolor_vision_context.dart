import 'dart:convert';

import '../entities/outfit_analysis.dart';
import '../entities/outfit_segment_map.dart';

/// Phase Q0 — vision context for contextual recolor prompt + QEL regions.
class GarmentRecolorVisionContext {
  final String? regionRole;
  final String? material;
  final double? materialConfidence;
  final String? fit;
  final String? foldDensity;
  final String? textureHint;
  final String? silhouetteHint;
  final String? glossLevel;
  final Map<String, double>? garmentBbox;
  final List<List<double>>? garmentPolygon;

  const GarmentRecolorVisionContext({
    this.regionRole,
    this.material,
    this.materialConfidence,
    this.fit,
    this.foldDensity,
    this.textureHint,
    this.silhouetteHint,
    this.glossLevel,
    this.garmentBbox,
    this.garmentPolygon,
  });

  static GarmentRecolorVisionContext fromAnalysis(
    OutfitAnalysis analysis, {
    String? garmentLabelAr,
  }) {
    final region = _pickGarmentRegion(analysis.segmentMap, garmentLabelAr);
    final bbox = region != null
        ? {
            'x': region.normalizedRect.left,
            'y': region.normalizedRect.top,
            'w': region.normalizedRect.width,
            'h': region.normalizedRect.height,
          }
        : null;

    final texture = analysis.styleType.isNotEmpty ? analysis.styleType : null;

    final polygon = region != null && region.hasContour
        ? region.normalizedPolygon
            .map((o) => [o.dx, o.dy])
            .toList()
        : null;

    return GarmentRecolorVisionContext(
      regionRole: _regionRole(region?.zone),
      material: null,
      materialConfidence: region?.confidence,
      fit: _inferFit(analysis),
      foldDensity: _inferFoldDensity(analysis),
      textureHint: texture,
      glossLevel: _inferGloss(analysis),
      garmentBbox: bbox,
      garmentPolygon: polygon,
    );
  }

  String toJsonString() => jsonEncode({
        if (regionRole != null) 'regionRole': regionRole,
        if (material != null) 'material': material,
        if (materialConfidence != null) 'materialConfidence': materialConfidence,
        if (fit != null) 'fit': fit,
        if (foldDensity != null) 'foldDensity': foldDensity,
        if (textureHint != null) 'textureHint': textureHint,
        if (silhouetteHint != null) 'silhouetteHint': silhouetteHint,
        if (glossLevel != null) 'glossLevel': glossLevel,
        if (garmentBbox != null) 'garmentBbox': garmentBbox,
        if (garmentPolygon != null) 'garmentPolygon': garmentPolygon,
      });

  static OutfitSegmentRegion? _pickGarmentRegion(
    OutfitSegmentMap? map,
    String? garmentLabelAr,
  ) {
    if (map == null || map.regions.isEmpty) return null;
    final label = garmentLabelAr?.trim() ?? '';
    if (label.isNotEmpty) {
      final match = map.regions.where((r) => r.labelAr.contains(label) || label.contains(r.labelAr));
      if (match.isNotEmpty) return match.first;
    }
    final upper = map.regions.where((r) => r.zone == OutfitSegmentZone.upperBody);
    if (upper.isNotEmpty) return upper.first;
    return map.regions.first;
  }

  static String? _regionRole(OutfitSegmentZone? zone) {
    return switch (zone) {
      OutfitSegmentZone.upperBody => 'upper',
      OutfitSegmentZone.lowerBody => 'lower',
      OutfitSegmentZone.waist => 'upper',
      OutfitSegmentZone.feet => 'lower',
      _ => 'upper',
    };
  }

  static String? _inferFit(OutfitAnalysis analysis) {
    final f = analysis.formalityLevel;
    if (f.contains('رسمي')) return 'structured';
    if (f.contains('كاجوال')) return 'relaxed';
    return 'regular';
  }

  static String? _inferFoldDensity(OutfitAnalysis analysis) {
    final style = analysis.styleType;
    if (style.contains('oversized') || style.contains('واسع')) return 'high';
    if (style.contains('ضيق') || style.contains('slim')) return 'low';
    return 'medium';
  }

  static String? _inferGloss(OutfitAnalysis analysis) {
    final type = analysis.clothingType.toLowerCase();
    if (type.contains('حرير') || type.contains('ساتان') || type.contains('satin')) {
      return 'glossy';
    }
    if (type.contains('قطن') || type.contains('كتان') || type.contains('صوف')) {
      return 'matte';
    }
    return 'semi';
  }
}
