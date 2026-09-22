import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/ai/models/mira_occasion.dart';
import 'package:mirra/features/outfit_analysis/data/mappers/outfit_segment_map_mapper.dart';
import 'package:mirra/features/outfit_analysis/domain/catalog/professional_color_matcher.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/detected_garment_color.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/garment_color_palette.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_analysis.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_segment_map.dart';
import 'package:mirra/features/outfit_analysis/domain/services/outfit_color_preview_service.dart';
import 'package:mirra/features/outfit_analysis/presentation/utils/fashion_color_binding.dart';

OutfitAnalysis _analysis(
  OutfitSegmentMap map, {
  List<String> dominantColors = const ['أسود'],
  List<String> recommended = const ['كحلي', 'أبيض'],
  MiraOccasion occasion = MiraOccasion.casual,
  String clothingType = 'فستان',
  List<String> pieces = const ['فستان'],
}) {
  return OutfitAnalysis(
    occasion: occasion,
    clothingType: clothingType,
    styleType: 'كاجوال',
    dominantColors: dominantColors,
    compatibilityScore: 70,
    recommendedColors: recommended,
    rejectedColors: const [],
    suggestedAccessories: const [],
    suggestedMakeup: '',
    explanation: '',
    confidence: 70,
    detectedPieces: pieces,
    segmentMap: map,
  );
}

void main() {
  group('fabric trust — degraded never auto-trusted', () {
    test('mapper does not trust fashn_geometry_degraded', () {
      final map = OutfitSegmentMapMapper.fromJson({
        'source': 'fashn_geometry_degraded',
        'regions': [
          {
            'zone': 'upperBody',
            'labelAr': 'فستان',
            'labelEn': 'dress',
            'confidence': 0.9,
            'normalizedRect': {
              'left': 0.1,
              'top': 0.05,
              'width': 0.8,
              'height': 0.9,
            },
            'colors': ['رمادي', 'أزرق'],
          },
        ],
      });
      expect(map.isVisualTrusted, isFalse);
      expect(map.supportsFabricRecolorFor(garmentLabelAr: 'فستان'), isFalse);
    });

    test('mapper trusts fashn_geometry_contour when regions present', () {
      final map = OutfitSegmentMapMapper.fromJson({
        'source': 'fashn_geometry_contour',
        'regions': [
          {
            'zone': 'upperBody',
            'labelAr': 'فستان',
            'labelEn': 'dress',
            'confidence': 0.9,
            'normalizedRect': {
              'left': 0.2,
              'top': 0.2,
              'width': 0.5,
              'height': 0.6,
            },
            'normalizedPolygon': [
              {'x': 0.2, 'y': 0.2},
              {'x': 0.7, 'y': 0.2},
              {'x': 0.7, 'y': 0.8},
              {'x': 0.2, 'y': 0.8},
            ],
            'colors': ['أزرق سماوي'],
          },
        ],
      });
      expect(map.isVisualTrusted, isTrue);
    });
  });

  group('forSelectedGarment — no cross-piece borrow', () {
    test('does not use dominantColors when selected piece has no colors', () {
      final map = OutfitSegmentMap(
        regions: [
          OutfitSegmentRegion(
            zone: OutfitSegmentZone.upperBody,
            normalizedRect: const Rect.fromLTWH(0.2, 0.2, 0.5, 0.5),
            labelAr: 'فستان',
            labelEn: 'Dress',
            colors: const [],
            confidence: 0.9,
          ),
          OutfitSegmentRegion(
            zone: OutfitSegmentZone.lowerBody,
            normalizedRect: const Rect.fromLTWH(0.2, 0.55, 0.5, 0.3),
            labelAr: 'بنطلون',
            labelEn: 'Pants',
            colors: const ['رمادي'],
            confidence: 0.9,
          ),
        ],
        source: 'vision_garment',
        isVisualTrusted: true,
        garmentPalette: const GarmentColorPalette(
          primaryColor: 'فوشي',
          secondaryColor: '',
          accentColor: '',
          confidence: 0.9,
          allColors: ['فوشي'],
          detailedColors: [
            DetectedGarmentColor(
              id: 'f',
              nameAr: 'فوشي',
              displayNameAr: 'فوشي',
              hex: '#FF00AA',
              deltaE: 1,
              confidence: 0.99,
              matchTierAr: 'قريب',
              shadeAr: '',
            ),
          ],
        ),
      );
      final bound = FashionColorBinding.forSelectedGarment(
        analysis: _analysis(
          map,
          dominantColors: const ['فوشي', 'رمادي'],
          pieces: const ['فستان', 'بنطلون'],
        ),
        garmentLabelAr: 'فستان',
      );
      expect(bound.isAvailable, isFalse);
      expect(bound.displayNameAr, FashionColorBinding.unavailableLabel);
    });

    test('binds dress sky color from region not gray global palette', () {
      final map = OutfitSegmentMap(
        regions: [
          OutfitSegmentRegion(
            zone: OutfitSegmentZone.upperBody,
            normalizedRect: const Rect.fromLTWH(0.2, 0.15, 0.55, 0.7),
            labelAr: 'فستان',
            labelEn: 'Dress',
            colors: const ['أزرق سماوي'],
            confidence: 0.92,
            normalizedPolygon: const [
              Offset(0.2, 0.15),
              Offset(0.75, 0.15),
              Offset(0.75, 0.85),
              Offset(0.2, 0.85),
            ],
          ),
        ],
        source: 'fashn_geometry_contour',
        isVisualTrusted: true,
        garmentPalette: const GarmentColorPalette(
          primaryColor: 'أزرق سماوي',
          secondaryColor: '',
          accentColor: '',
          confidence: 0.9,
          allColors: ['أزرق سماوي'],
          detailedColors: [
            DetectedGarmentColor(
              id: 'sky_mid',
              nameAr: 'أزرق سماوي',
              displayNameAr: 'أزرق سماوي',
              hex: '#519CC2',
              deltaE: 2,
              confidence: 0.93,
              matchTierAr: 'تطابق عالٍ',
              shadeAr: 'متوسط',
            ),
          ],
        ),
      );
      final bound = FashionColorBinding.forSelectedGarment(
        analysis: _analysis(
          map,
          dominantColors: const ['رمادي', 'رمادي فاتح'],
          occasion: MiraOccasion.evening,
        ),
        garmentLabelAr: 'فستان',
      );
      expect(bound.isAvailable, isTrue);
      expect(bound.displayNameAr, contains('سماوي'));
      expect(bound.hex?.toUpperCase(), contains('519CC2'));
    });
  });

  group('display name honesty', () {
    test('composeDisplayNameAr does not create فاتح غامق', () {
      expect(
        ProfessionalColorMatcher.composeDisplayNameAr('كحلي غامق', 'فاتح'),
        'كحلي غامق',
      );
      expect(
        ProfessionalColorMatcher.composeDisplayNameAr('أزرق', 'غامق'),
        'أزرق غامق',
      );
    });

    test('sky catalog names are not contradictory', () {
      final r = FashionColorBinding.resolveDetailed(nameAr: 'سماوي');
      expect(r.displayNameAr.contains('فاتح غامق'), isFalse);
      expect(r.displayNameAr.contains('فاتح فاتح'), isFalse);
    });
  });

  group('recommendation honesty', () {
    test('does not invent fixed +12 and does not claim skin without data', () {
      final map = OutfitSegmentMap(
        regions: [
          OutfitSegmentRegion(
            zone: OutfitSegmentZone.upperBody,
            normalizedRect: const Rect.fromLTWH(0.2, 0.2, 0.5, 0.6),
            labelAr: 'فستان',
            labelEn: 'Dress',
            colors: const ['أزرق سماوي'],
            confidence: 0.9,
          ),
        ],
        source: 'vision_garment',
        isVisualTrusted: true,
      );
      final alts = OutfitColorPreviewService.alternatives(
        _analysis(map, occasion: MiraOccasion.work),
      );
      expect(alts, isNotEmpty);
      for (final a in alts) {
        expect(a.projectedHarmonyDelta, isNot(equals(12)));
        expect(a.insightAr.contains('يناسب بشرتك'), isFalse);
        expect(a.skinPersonalized, isFalse);
        expect(a.insightAr.contains('غير مخصص للبشرة'), isTrue);
      }
    });

    test('stable ordering for same analysis inputs', () {
      final map = OutfitSegmentMap(
        regions: [
          OutfitSegmentRegion(
            zone: OutfitSegmentZone.upperBody,
            normalizedRect: const Rect.fromLTWH(0.2, 0.2, 0.5, 0.4),
            labelAr: 'بلوزة',
            labelEn: 'Blouse',
            colors: const ['بيج'],
            confidence: 0.9,
          ),
        ],
        source: 'vision_garment',
        isVisualTrusted: true,
      );
      final analysis = _analysis(
        map,
        clothingType: 'بلوزة',
        pieces: const ['بلوزة'],
        dominantColors: const ['بيج'],
        recommended: const ['أبيض', 'كحلي', 'ذهبي'],
      );
      final a = OutfitColorPreviewService.alternatives(analysis)
          .map((e) => e.alternativeColorAr)
          .toList();
      final b = OutfitColorPreviewService.alternatives(analysis)
          .map((e) => e.alternativeColorAr)
          .toList();
      expect(a, equals(b));
    });
  });
}
