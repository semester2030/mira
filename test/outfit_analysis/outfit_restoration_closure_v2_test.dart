import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/ai/models/mira_occasion.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/detected_garment_color.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/garment_color_palette.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_analysis.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_segment_map.dart';
import 'package:mirra/features/outfit_analysis/domain/helpers/outfit_topology.dart';
import 'package:mirra/features/outfit_analysis/domain/services/outfit_color_preview_service.dart';
import 'package:mirra/features/outfit_analysis/presentation/utils/fashion_color_binding.dart';

OutfitSegmentRegion _region({
  required OutfitSegmentZone zone,
  required String labelAr,
  List<Offset> polygon = const [],
  List<String> colors = const [],
  double confidence = 0.9,
  Rect? rect,
}) {
  return OutfitSegmentRegion(
    zone: zone,
    normalizedRect: rect ?? const Rect.fromLTWH(0.2, 0.2, 0.5, 0.35),
    labelAr: labelAr,
    labelEn: labelAr,
    colors: colors,
    confidence: confidence,
    normalizedPolygon: polygon,
  );
}

List<Offset> _hexagon() => const [
      Offset(0.2, 0.2),
      Offset(0.5, 0.15),
      Offset(0.7, 0.25),
      Offset(0.75, 0.55),
      Offset(0.45, 0.65),
      Offset(0.18, 0.45),
    ];

OutfitAnalysis _analysis(OutfitSegmentMap map) {
  return OutfitAnalysis(
    occasion: MiraOccasion.casual,
    clothingType: 'بلوزة',
    styleType: 'كاجوال',
    dominantColors: const ['أسود'],
    compatibilityScore: 70,
    recommendedColors: const ['كحلي', 'ذهبي'],
    rejectedColors: const [],
    suggestedAccessories: const [],
    suggestedMakeup: '',
    explanation: '',
    confidence: 60,
    matchReasons: const [],
    mismatchReasons: const [],
    recommendations: const [],
    styleVerdict: '',
    detectedPieces: const ['بلوزة', 'بنطلون'],
    visionLabels: const [],
    visualConfidence: 60,
    contrastLevel: '',
    formalityLevel: '',
    analysisSource: 'test',
    visualSource: 'test',
    skinCompatibilityScore: 0,
    occasionMatchScore: 70,
    styleBalanceScore: 70,
    colorHarmonyScore: 70,
    segmentMap: map,
  );
}

void main() {
  group('supportsFabricRecolorFor selected garment', () {
    test('pose_anatomy never unlocks fabric recolor', () {
      final map = OutfitSegmentMap(
        regions: [
          _region(
            zone: OutfitSegmentZone.upperBody,
            labelAr: 'الجزء العلوي',
            polygon: _hexagon(),
            confidence: 0.95,
          ),
        ],
        source: 'pose_anatomy',
        isVisualTrusted: true,
      );
      expect(map.supportsFabricRecolor, isFalse);
      expect(
        map.supportsFabricRecolorFor(garmentLabelAr: 'الجزء العلوي'),
        isFalse,
      );
    });

    test('other valid mask does not unlock selected piece without mask', () {
      final blouseMask = _region(
        zone: OutfitSegmentZone.upperBody,
        labelAr: 'بلوزة',
        polygon: _hexagon(),
      );
      final pantsRectOnly = _region(
        zone: OutfitSegmentZone.lowerBody,
        labelAr: 'بنطلون',
        confidence: 0.99,
        rect: const Rect.fromLTWH(0.2, 0.55, 0.5, 0.3),
      );
      final map = OutfitSegmentMap(
        regions: [blouseMask, pantsRectOnly],
        source: 'vision_garment',
        isVisualTrusted: true,
      );
      expect(map.supportsFabricRecolorFor(garmentLabelAr: 'بلوزة'), isTrue);
      expect(map.supportsFabricRecolorFor(garmentLabelAr: 'بنطلون'), isFalse);
    });

    test('high confidence rect alone is insufficient', () {
      final map = OutfitSegmentMap(
        regions: [
          _region(
            zone: OutfitSegmentZone.upperBody,
            labelAr: 'جاكيت',
            confidence: 0.99,
          ),
        ],
        source: 'vision_garment',
        isVisualTrusted: true,
      );
      expect(map.supportsFabricRecolorFor(garmentLabelAr: 'جاكيت'), isFalse);
    });
  });

  group('OutfitTopologyInfer clothing evidence', () {
    test('anatomy upper/lower + feet stays unknown', () {
      final map = OutfitSegmentMap(
        regions: [
          _region(zone: OutfitSegmentZone.upperBody, labelAr: 'الجزء العلوي'),
          _region(zone: OutfitSegmentZone.lowerBody, labelAr: 'الجزء السفلي'),
          _region(zone: OutfitSegmentZone.feet, labelAr: 'القدمين'),
        ],
        isVisualTrusted: true,
      );
      final result = OutfitTopologyInfer.infer(map);
      expect(result.silhouetteHint, OutfitSilhouetteHint.unknown);
      expect(result.pieceCount, 0);
    });

    test('dress alone is one_piece', () {
      final map = OutfitSegmentMap(
        regions: [
          _region(zone: OutfitSegmentZone.upperBody, labelAr: 'فستان'),
          _region(zone: OutfitSegmentZone.lowerBody, labelAr: 'فستان'),
        ],
        isVisualTrusted: true,
      );
      final result = OutfitTopologyInfer.infer(map, garmentLabelAr: 'فستان');
      expect(result.silhouetteHint, OutfitSilhouetteHint.onePiece);
      expect(result.pieceCount, 1);
      expect(result.onePiece, isTrue);
    });

    test('dress + jacket is layered not dress-alone', () {
      final map = OutfitSegmentMap(
        regions: [
          _region(zone: OutfitSegmentZone.upperBody, labelAr: 'فستان'),
          _region(zone: OutfitSegmentZone.upperBody, labelAr: 'جاكيت'),
        ],
        isVisualTrusted: true,
      );
      final result = OutfitTopologyInfer.infer(map, garmentLabelAr: 'فستان');
      expect(result.silhouetteHint, OutfitSilhouetteHint.layered);
      expect(result.pieceCount, 2);
      expect(result.onePiece, isFalse);
    });
  });

  group('FashionColorBinding piece + gray', () {
    test('current color binds to selected garment not global top confidence', () {
      final map = OutfitSegmentMap(
        regions: [
          _region(
            zone: OutfitSegmentZone.upperBody,
            labelAr: 'بلوزة',
            colors: const ['كحلي'],
          ),
          _region(
            zone: OutfitSegmentZone.lowerBody,
            labelAr: 'بنطلون',
            colors: const ['أسود'],
          ),
        ],
        garmentPalette: GarmentColorPalette(
          primaryColor: 'فوشي',
          secondaryColor: 'كحلي',
          accentColor: '',
          confidence: 0.9,
          detailedColors: [
            const DetectedGarmentColor(
              id: 'f',
              nameAr: 'فوشي',
              displayNameAr: 'فوشي',
              hex: '#FF00AA',
              deltaE: 1,
              confidence: 0.99,
              matchTierAr: 'قريب',
              shadeAr: '',
            ),
            const DetectedGarmentColor(
              id: 'k',
              nameAr: 'كحلي',
              displayNameAr: 'كحلي',
              hex: '#1A3A6B',
              deltaE: 2,
              confidence: 0.7,
              matchTierAr: 'قريب',
              shadeAr: '',
            ),
          ],
        ),
        source: 'vision_garment',
        isVisualTrusted: true,
      );
      final bound = FashionColorBinding.forSelectedGarment(
        analysis: _analysis(map),
        garmentLabelAr: 'بلوزة',
      );
      expect(bound.displayNameAr, 'كحلي');
      expect(bound.hex?.toUpperCase(), contains('1A3A6B'));
      expect(bound.source, FashionColorSource.detected);
    });

    test('switching garment switches current color', () {
      final map = OutfitSegmentMap(
        regions: [
          _region(
            zone: OutfitSegmentZone.upperBody,
            labelAr: 'بلوزة',
            colors: const ['كحلي'],
          ),
          _region(
            zone: OutfitSegmentZone.lowerBody,
            labelAr: 'بنطلون',
            colors: const ['أسود'],
          ),
        ],
        source: 'vision_garment',
        isVisualTrusted: true,
        upperBodyColors: const ['كحلي'],
        lowerBodyColors: const ['أسود'],
      );
      final a = _analysis(map);
      final blouse = OutfitColorPreviewService.currentForGarment(a, 'بلوزة');
      final pants = OutfitColorPreviewService.currentForGarment(a, 'بنطلون');
      expect(blouse.displayNameAr, isNot(equals(pants.displayNameAr)));
    });

    test('true gray hex kept without gray name when detected', () {
      final c = FashionColorBinding.resolveDetailed(
        hex: '#8A8A8A',
        nameAr: null,
        source: FashionColorSource.detected,
      );
      expect(c.color, isNotNull);
      expect(FashionColorBinding.isTrueGrayHex('#8A8A8A'), isTrue);
    });

    test('false gray matcher fallback rejected without gray name', () {
      expect(
        FashionColorBinding.resolve(
          hex: '#9E9E9E',
          nameAr: 'فوشي',
          source: FashionColorSource.matcherFallback,
        ),
        isNull,
      );
    });

    test('unknown shows غير متاح', () {
      final r = FashionColorBinding.resolveDetailed(nameAr: 'لون_xyz_غير_موجود');
      expect(r.displayNameAr, FashionColorBinding.unavailableLabel);
      expect(r.color, isNull);
    });
  });
}
