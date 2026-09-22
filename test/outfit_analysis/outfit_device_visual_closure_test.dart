import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_segment_map.dart';
import 'package:mirra/features/outfit_analysis/presentation/utils/fashion_color_binding.dart';

void main() {
  group('navy / كحلي swatch truth', () {
    test('كحلي resolves to real navy blue not purple', () {
      final c = FashionColorBinding.resolve(nameAr: 'كحلي');
      expect(c, isNotNull);
      // Navy: blue channel dominates red; not a purple swatch.
      expect(c!.blue, greaterThan(c.red + 20));
      expect(c.red, lessThan(80));
    });

    test('كحلي غامق library hex is navy family', () {
      final c = FashionColorBinding.resolve(nameAr: 'كحلي غامق');
      expect(c, isNotNull);
      expect(c!.blue, greaterThan(c.red));
    });
  });

  group('fashn_geometry_contour fabric gate', () {
    test('trusted contour source can unlock selected garment with mask', () {
      final poly = [
        const Offset(0.2, 0.2),
        const Offset(0.5, 0.15),
        const Offset(0.7, 0.25),
        const Offset(0.75, 0.55),
        const Offset(0.45, 0.65),
        const Offset(0.18, 0.45),
      ];
      final map = OutfitSegmentMap(
        regions: [
          OutfitSegmentRegion(
            zone: OutfitSegmentZone.upperBody,
            normalizedRect: const Rect.fromLTWH(0.18, 0.15, 0.6, 0.5),
            labelAr: 'فستان',
            labelEn: 'Dress',
            confidence: 0.9,
            normalizedPolygon: poly,
          ),
        ],
        source: 'fashn_geometry_contour',
        isVisualTrusted: true,
      );
      expect(map.supportsFabricRecolorFor(garmentLabelAr: 'فستان'), isTrue);
    });

    test('degraded geometry source does not unlock fabric recolor', () {
      final poly = [
        const Offset(0.2, 0.2),
        const Offset(0.5, 0.15),
        const Offset(0.7, 0.25),
        const Offset(0.75, 0.55),
        const Offset(0.45, 0.65),
        const Offset(0.18, 0.45),
      ];
      final map = OutfitSegmentMap(
        regions: [
          OutfitSegmentRegion(
            zone: OutfitSegmentZone.upperBody,
            normalizedRect: const Rect.fromLTWH(0.12, 0.06, 0.76, 0.88),
            labelAr: 'فستان',
            labelEn: 'Dress',
            confidence: 0.85,
            normalizedPolygon: poly,
          ),
        ],
        source: 'fashn_geometry_degraded',
        isVisualTrusted: true,
      );
      expect(map.supportsFabricRecolorFor(garmentLabelAr: 'فستان'), isFalse);
    });
  });
}
