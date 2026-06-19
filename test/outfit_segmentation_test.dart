import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_segment_map.dart';
import 'package:mirra/features/outfit_analysis/domain/services/outfit_segment_color_extractor.dart';
import 'package:mirra/features/outfit_analysis/domain/services/outfit_segmentation_service.dart';

void main() {
  group('OutfitSegmentation', () {
    test('extracts region colors from normalized rects', () {
      final image = img.Image(width: 200, height: 400);
      for (var y = 0; y < 120; y++) {
        for (var x = 0; x < 200; x++) {
          image.setPixelRgba(x, y, 20, 40, 180, 255);
        }
      }
      for (var y = 120; y < 280; y++) {
        for (var x = 0; x < 200; x++) {
          image.setPixelRgba(x, y, 180, 180, 180, 255);
        }
      }
      for (var y = 280; y < 400; y++) {
        for (var x = 0; x < 200; x++) {
          image.setPixelRgba(x, y, 30, 30, 30, 255);
        }
      }

      final upper = OutfitSegmentColorExtractor.extractRegionColors(
        image,
        normalizedRect: const OutfitSegmentRegion(
          zone: OutfitSegmentZone.upperBody,
          normalizedRect: Rect.fromLTWH(0.1, 0.1, 0.8, 0.25),
          labelAr: 'سترة',
          labelEn: 'Blazer',
        ).normalizedRect,
      );
      final lower = OutfitSegmentColorExtractor.extractRegionColors(
        image,
        normalizedRect: const OutfitSegmentRegion(
          zone: OutfitSegmentZone.lowerBody,
          normalizedRect: Rect.fromLTWH(0.1, 0.55, 0.8, 0.25),
          labelAr: 'بنطال',
          labelEn: 'Pants',
        ).normalizedRect,
      );

      expect(upper, isNotEmpty);
      expect(lower, isNotEmpty);
      expect(upper, isNot(equals(lower)));
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

    test('segment map uses deterministic zones', () {
      const map = OutfitSegmentMap(
        regions: [
          OutfitSegmentRegion(
            zone: OutfitSegmentZone.upperBody,
            normalizedRect: Rect.fromLTWH(0.2, 0.16, 0.6, 0.28),
            labelAr: 'سترة',
            labelEn: 'Blazer',
            colors: ['كحلي'],
          ),
        ],
        upperBodyColors: ['كحلي'],
        lowerBodyColors: ['رمادي'],
        shoeColors: ['أسود'],
      );

      expect(map.upperBodyColors, ['كحلي']);
      expect(map.colorsForZone(OutfitSegmentZone.feet), ['أسود']);
    });
  });
}
