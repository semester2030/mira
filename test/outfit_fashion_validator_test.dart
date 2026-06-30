import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/garment_color_palette.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_body_pose_metrics.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_segment_map.dart';
import 'package:mirra/features/outfit_analysis/domain/helpers/outfit_fashion_validator.dart';

void main() {
  group('OutfitFashionValidator', () {
    test('accepts trusted vision map with reliable palette', () {
      final validation = OutfitFashionValidator.validate(
        segmentMap: OutfitSegmentMap(
          regions: const [
            OutfitSegmentRegion(
              zone: OutfitSegmentZone.upperBody,
              normalizedRect: Rect.fromLTWH(0.2, 0.2, 0.5, 0.25),
              labelAr: 'فستان',
              labelEn: 'Dress',
              confidence: 0.91,
            ),
          ],
          source: 'vision_garment',
          garmentPalette: const GarmentColorPalette(
            primaryColor: 'تركواز',
            secondaryColor: 'ذهبي',
            accentColor: 'كريمي',
            confidence: 0.78,
          ),
          isVisualTrusted: true,
        ),
        palette: const GarmentColorPalette(
          primaryColor: 'تركواز',
          secondaryColor: 'ذهبي',
          accentColor: 'كريمي',
          confidence: 0.78,
        ),
        pose: _pose(),
      );

      expect(validation.isTrusted, isTrue);
      expect(validation.colorConfidence, greaterThan(0.5));
    });

    test('rejects map without vision source', () {
      final validation = OutfitFashionValidator.validate(
        segmentMap: const OutfitSegmentMap(
          regions: [
            OutfitSegmentRegion(
              zone: OutfitSegmentZone.upperBody,
              normalizedRect: Rect.fromLTWH(0.2, 0.2, 0.5, 0.25),
              labelAr: 'فستان',
              labelEn: 'Dress',
              confidence: 0.9,
            ),
          ],
          source: 'deterministic',
        ),
        palette: const GarmentColorPalette(
          primaryColor: 'أزرق',
          secondaryColor: '',
          accentColor: '',
          confidence: 0.8,
        ),
        pose: _pose(),
      );

      expect(validation.isTrusted, isFalse);
    });

    test('applyValidation clears regions when rejected', () {
      const map = OutfitSegmentMap(
        regions: [
          OutfitSegmentRegion(
            zone: OutfitSegmentZone.feet,
            normalizedRect: Rect.fromLTWH(0.3, 0.8, 0.4, 0.12),
            labelAr: 'حذاء',
            labelEn: 'Shoe',
            confidence: 0.9,
          ),
        ],
        source: 'vision_garment',
      );

      final out = OutfitFashionValidator.applyValidation(
        map,
        const OutfitFashionValidation(
          isTrusted: false,
          rejectionReason: 'رفض',
        ),
      );

      expect(out.regions, isEmpty);
      expect(out.isVisualTrusted, isFalse);
      expect(out.validationMessage, 'رفض');
    });
  });
}

OutfitBodyPoseMetrics _pose() {
  return OutfitBodyPoseMetrics(
    personDetected: true,
    headDetected: true,
    shouldersDetected: true,
    torsoDetected: true,
    legsDetected: true,
    feetDetected: true,
    trackingScore: 0.7,
    bodyBounds: const Rect.fromLTWH(0.15, 0.08, 0.7, 0.88),
    landmarkPoints: {
      'nose': const Offset(0.5, 0.12),
      'left_shoulder': const Offset(0.38, 0.22),
      'right_shoulder': const Offset(0.62, 0.22),
      'left_hip': const Offset(0.40, 0.48),
      'right_hip': const Offset(0.60, 0.48),
      'left_ankle': const Offset(0.43, 0.88),
      'right_ankle': const Offset(0.57, 0.88),
    },
  );
}
