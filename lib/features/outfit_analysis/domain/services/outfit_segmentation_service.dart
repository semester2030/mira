import 'dart:io';
import 'dart:math' as math;
import 'dart:ui';

import 'package:image/image.dart' as img;

import '../../data/helpers/vision_color_mapper.dart';
import '../entities/outfit_body_pose_metrics.dart';
import '../entities/outfit_segment_map.dart';
import '../entities/outfit_visual_profile.dart';
import 'outfit_body_pose_analyzer.dart';
import 'outfit_segment_color_extractor.dart';

/// Localized object from Google Vision with bounding box.
class VisionLocalizedObject {
  final String name;
  final double score;
  final Rect normalizedBox;

  const VisionLocalizedObject({
    required this.name,
    required this.score,
    required this.normalizedBox,
  });
}

/// Builds deterministic outfit segment map from frozen image + Vision hits.
class OutfitSegmentationService {
  OutfitSegmentationService({
    OutfitBodyPoseAnalyzer? poseAnalyzer,
  }) : _poseAnalyzer = poseAnalyzer ?? OutfitBodyPoseAnalyzer();

  final OutfitBodyPoseAnalyzer _poseAnalyzer;

  Future<OutfitSegmentMap> buildFromFrozenImage(
    File imageFile, {
    OutfitVisualProfile? visual,
    List<VisionLocalizedObject> visionObjects = const [],
  }) async {
    final bytes = await imageFile.readAsBytes();
    final decoded = img.decodeImage(bytes);
    if (decoded == null) return OutfitSegmentMap.empty;

    final oriented = img.bakeOrientation(decoded);
    OutfitBodyPoseMetrics pose = OutfitBodyPoseMetrics.none;
    try {
      pose = await _poseAnalyzer.analyzeFile(imageFile);
    } catch (_) {
      pose = OutfitBodyPoseMetrics.none;
    }
    final baseRegions = _regionsFromPose(pose);

    final labeled = _attachVisionLabels(baseRegions, visionObjects, visual);
    final colorMap = OutfitSegmentColorExtractor.extractAllZones(oriented, labeled);

    return OutfitSegmentMap(
      regions: labeled,
      upperBodyColors: colorMap[OutfitSegmentZone.upperBody] ?? const [],
      lowerBodyColors: colorMap[OutfitSegmentZone.lowerBody] ?? const [],
      shoeColors: colorMap[OutfitSegmentZone.feet] ?? const [],
      accessoryColors: colorMap[OutfitSegmentZone.accessories] ?? const [],
      imageWidth: oriented.width.toDouble(),
      imageHeight: oriented.height.toDouble(),
      source: visual?.source ?? 'deterministic',
    );
  }

  List<OutfitSegmentRegion> _regionsFromPose(OutfitBodyPoseMetrics pose) {
    if (pose.isFullBodyReady) {
      return _deterministicFallbackRegions();
    }
    return _deterministicFallbackRegions();
  }

  List<OutfitSegmentRegion> _deterministicFallbackRegions() {
    return const [
      OutfitSegmentRegion(
        zone: OutfitSegmentZone.head,
        normalizedRect: Rect.fromLTWH(0.32, 0.04, 0.36, 0.12),
        labelAr: 'الرأس',
        labelEn: 'Head',
      ),
      OutfitSegmentRegion(
        zone: OutfitSegmentZone.upperBody,
        normalizedRect: Rect.fromLTWH(0.22, 0.16, 0.56, 0.28),
        labelAr: 'سترة',
        labelEn: 'Blazer',
      ),
      OutfitSegmentRegion(
        zone: OutfitSegmentZone.waist,
        normalizedRect: Rect.fromLTWH(0.28, 0.44, 0.44, 0.1),
        labelAr: 'الخصر',
        labelEn: 'Waist',
      ),
      OutfitSegmentRegion(
        zone: OutfitSegmentZone.lowerBody,
        normalizedRect: Rect.fromLTWH(0.24, 0.52, 0.52, 0.28),
        labelAr: 'بنطال',
        labelEn: 'Pants',
      ),
      OutfitSegmentRegion(
        zone: OutfitSegmentZone.feet,
        normalizedRect: Rect.fromLTWH(0.26, 0.82, 0.48, 0.14),
        labelAr: 'حذاء',
        labelEn: 'Shoes',
      ),
      OutfitSegmentRegion(
        zone: OutfitSegmentZone.accessories,
        normalizedRect: Rect.fromLTWH(0.62, 0.28, 0.22, 0.22),
        labelAr: 'حقيبة',
        labelEn: 'Bag',
      ),
    ];
  }

  List<OutfitSegmentRegion> _attachVisionLabels(
    List<OutfitSegmentRegion> regions,
    List<VisionLocalizedObject> objects,
    OutfitVisualProfile? visual,
  ) {
    final updated = <OutfitSegmentRegion>[];
    for (final region in regions) {
      var labelAr = region.labelAr;
      var labelEn = region.labelEn;
      var confidence = region.confidence;

      final object = _bestObjectForZone(region.zone, objects);
      if (object != null) {
        labelEn = object.name;
        labelAr = VisionColorMapper.labelToArabic(object.name);
        confidence = object.score;
      } else {
        final visualLabel = _visualLabelForZone(region.zone, visual);
        if (visualLabel != null) {
          labelAr = visualLabel;
          labelEn = visualLabel;
          confidence = visual?.clothingConfidence ?? 0.6;
        }
      }

      updated.add(
        region.copyWith(
          labelAr: labelAr,
          labelEn: labelEn,
          confidence: confidence,
        ),
      );
    }
    return updated;
  }

  VisionLocalizedObject? _bestObjectForZone(
    OutfitSegmentZone zone,
    List<VisionLocalizedObject> objects,
  ) {
    VisionLocalizedObject? best;
    for (final object in objects) {
      final center = object.normalizedBox.center;
      if (!_centerInZone(center, zone)) continue;
      if (best == null || object.score > best.score) best = object;
    }
    return best;
  }

  bool _centerInZone(Offset center, OutfitSegmentZone zone) {
    return switch (zone) {
      OutfitSegmentZone.head => center.dy < 0.18,
      OutfitSegmentZone.upperBody => center.dy >= 0.14 && center.dy < 0.46,
      OutfitSegmentZone.waist => center.dy >= 0.4 && center.dy < 0.52,
      OutfitSegmentZone.lowerBody => center.dy >= 0.48 && center.dy < 0.82,
      OutfitSegmentZone.feet => center.dy >= 0.78,
      OutfitSegmentZone.accessories =>
        center.dx > 0.55 || (center.dy < 0.35 && center.dx < 0.3),
    };
  }

  String? _visualLabelForZone(OutfitSegmentZone zone, OutfitVisualProfile? visual) {
    if (visual == null) return null;
    return switch (zone) {
      OutfitSegmentZone.upperBody =>
        visual.clothingTypes.firstOrNull ?? visual.garmentTypeAr,
      OutfitSegmentZone.lowerBody =>
        visual.clothingTypes.length > 1 ? visual.clothingTypes[1] : null,
      OutfitSegmentZone.feet =>
        visual.accessoryTypes.where((a) => a.contains('حذ')).firstOrNull,
      OutfitSegmentZone.accessories => visual.accessoryTypes.firstOrNull,
      _ => null,
    };
  }

  Future<void> dispose() async {
    await _poseAnalyzer.dispose();
  }
}

extension _FirstOrNull<E> on List<E> {
  E? get firstOrNull => isEmpty ? null : first;
}

/// Parses Vision localized object annotations into bounding boxes.
List<VisionLocalizedObject> parseVisionLocalizedObjects(Map<String, dynamic> response) {
  final localized = response['localizedObjectAnnotations'] as List<dynamic>?;
  if (localized == null) return const [];

  final objects = <VisionLocalizedObject>[];
  for (final entry in localized) {
    final map = entry as Map;
    final name = map['name']?.toString() ?? '';
    if (name.isEmpty) continue;

    final vertices =
        (map['boundingPoly']?['normalizedVertices'] as List<dynamic>?) ?? const [];
    if (vertices.length < 2) continue;

    var minX = 1.0;
    var minY = 1.0;
    var maxX = 0.0;
    var maxY = 0.0;
    for (final v in vertices) {
      final vertex = v as Map;
      final x = (vertex['x'] as num?)?.toDouble() ?? 0;
      final y = (vertex['y'] as num?)?.toDouble() ?? 0;
      minX = math.min(minX, x);
      minY = math.min(minY, y);
      maxX = math.max(maxX, x);
      maxY = math.max(maxY, y);
    }

    objects.add(
      VisionLocalizedObject(
        name: name,
        score: ((map['score'] as num?)?.toDouble() ?? 0.5).clamp(0.0, 1.0),
        normalizedBox: Rect.fromLTRB(minX, minY, maxX, maxY),
      ),
    );
  }
  return objects;
}
