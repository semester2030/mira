import 'dart:io';
import 'dart:math' as math;
import 'dart:ui';

import 'package:image/image.dart' as img;

import '../entities/outfit_segment_map.dart';
import '../entities/outfit_visual_profile.dart';
import '../helpers/outfit_fashion_taxonomy.dart';
import '../helpers/outfit_fashion_validator.dart';
import '../helpers/outfit_vision_region_builder.dart';
import 'outfit_body_pose_analyzer.dart';
import 'outfit_contour_refiner.dart';
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

/// Person mask → Vision garments → contour → KMeans colors → validation.
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
    final pose = await _poseAnalyzer.analyzeFile(imageFile);

    final detected = OutfitVisionRegionBuilder.build(
      visionObjects: visionObjects,
      pose: pose,
    );

    final withContours = detected
        .map(
          (region) => region.copyWith(
            normalizedPolygon: OutfitContourRefiner.refine(
              oriented,
              normalizedRect: region.normalizedRect,
            ),
          ),
        )
        .toList();

    final regions = OutfitFashionTaxonomy.visibleRegions(withContours);
    final colorMap = OutfitSegmentColorExtractor.extractAllZones(
      oriented,
      regions,
      pose: pose,
    );

    final regionsWithColors = regions
        .map(
          (r) => r.copyWith(
            colors: colorMap[r.zone] ?? const [],
          ),
        )
        .toList();

    final palette = OutfitSegmentColorExtractor.extractGarmentPalette(
      oriented,
      regions: regionsWithColors,
      pose: pose,
    );

    var map = OutfitSegmentMap(
      regions: regionsWithColors,
      upperBodyColors: colorMap[OutfitSegmentZone.upperBody] ?? const [],
      lowerBodyColors: colorMap[OutfitSegmentZone.lowerBody] ?? const [],
      shoeColors: colorMap[OutfitSegmentZone.feet] ?? const [],
      accessoryColors: colorMap[OutfitSegmentZone.accessories] ?? const [],
      garmentPalette: palette,
      imageWidth: oriented.width.toDouble(),
      imageHeight: oriented.height.toDouble(),
      source: visionObjects.isNotEmpty ? 'vision_garment' : 'unvalidated',
    );

    final validation = OutfitFashionValidator.validate(
      segmentMap: map,
      palette: palette,
      pose: pose,
    );
    map = OutfitFashionValidator.applyValidation(map, validation);

    return map;
  }

  Future<void> dispose() async {
    await _poseAnalyzer.dispose();
  }
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
