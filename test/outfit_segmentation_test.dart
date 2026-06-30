import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_body_pose_metrics.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_segment_map.dart';
import 'package:mirra/features/outfit_analysis/domain/services/outfit_segment_color_extractor.dart';
import 'package:mirra/features/outfit_analysis/domain/services/outfit_segmentation_service.dart';

void main() {
  final pose = OutfitBodyPoseMetrics(
    personDetected: true,
    bodyBounds: const Rect.fromLTWH(0, 0, 1, 1),
    landmarkPoints: const {
      'left_shoulder': Offset(0.3, 0.2),
      'right_shoulder': Offset(0.7, 0.2),
    },
  );

  group('OutfitSegmentation', () {
    test('extracts garment colors from masked region via KMeans', () {
      final image = img.Image(width: 200, height: 400);
      for (var y = 0; y < 120; y++) {
        for (var x = 0; x < 200; x++) {
          image.setPixelRgba(x, y, 20, 40, 180, 255);
        }
      }
      for (var y = 120; y < 280; y++) {
        for (var x = 0; x < 200; x++) {
          image.setPixelRgba(x, y, 30, 30, 90, 255);
        }
      }
      for (var y = 280; y < 400; y++) {
        for (var x = 0; x < 200; x++) {
          image.setPixelRgba(x, y, 30, 30, 30, 255);
        }
      }

      final upper = OutfitSegmentColorExtractor.extractRegionColors(
        image,
        pose: pose,
        region: const OutfitSegmentRegion(
          zone: OutfitSegmentZone.upperBody,
          normalizedRect: Rect.fromLTWH(0.1, 0.1, 0.8, 0.25),
          labelAr: 'سترة',
          labelEn: 'Blazer',
        ),
      );
      final lower = OutfitSegmentColorExtractor.extractRegionColors(
        image,
        pose: pose,
        region: const OutfitSegmentRegion(
          zone: OutfitSegmentZone.lowerBody,
          normalizedRect: Rect.fromLTWH(0.1, 0.55, 0.8, 0.25),
          labelAr: 'بنطال',
          labelEn: 'Pants',
        ),
      );

      expect(upper, isNotEmpty);
      expect(lower, isNotEmpty);
      expect(upper, isNot(equals(lower)));
    });

    test('garment palette returns primary secondary with confidence', () {
      final image = img.Image(width: 100, height: 200);
      for (var y = 40; y < 120; y++) {
        for (var x = 20; x < 80; x++) {
          image.setPixelRgba(x, y, 0, 120, 130, 255);
        }
      }

      final palette = OutfitSegmentColorExtractor.extractGarmentPalette(
        image,
        regions: const [
          OutfitSegmentRegion(
            zone: OutfitSegmentZone.upperBody,
            normalizedRect: Rect.fromLTWH(0.2, 0.2, 0.6, 0.4),
            labelAr: 'فستان',
            labelEn: 'Dress',
          ),
        ],
        pose: pose,
      );

      expect(palette.primaryColor, isNotEmpty);
      expect(palette.confidence, greaterThan(0));
    });

    test('parseVisionLocalizedObjects maps bounding boxes', () {
      final objects = parseVisionLocalizedObjects({
        'localizedObjectAnnotations': [
          {
            'name': 'Shirt',
            'score': 0.91,
            'boundingPoly': {
              'normalizedVertices': [
                {'x': 0.2, 'y': 0.2},
                {'x': 0.7, 'y': 0.2},
                {'x': 0.7, 'y': 0.5},
                {'x': 0.2, 'y': 0.5},
              ],
            },
          },
        ],
      });

      expect(objects, hasLength(1));
      expect(objects.first.name, 'Shirt');
      expect(objects.first.normalizedBox.width, closeTo(0.5, 0.01));
    });
  });
}
