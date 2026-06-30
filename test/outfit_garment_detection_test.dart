import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_body_pose_metrics.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_segment_map.dart';
import 'package:mirra/features/outfit_analysis/domain/helpers/outfit_fashion_taxonomy.dart';
import 'package:mirra/features/outfit_analysis/domain/helpers/outfit_garment_detection_engine.dart';
import 'package:mirra/features/outfit_analysis/domain/helpers/outfit_vision_region_builder.dart';
import 'package:mirra/features/outfit_analysis/domain/services/outfit_segmentation_service.dart';

void main() {
  group('OutfitGarmentDetectionEngine', () {
    test('rejects shoes when feet are not visible', () {
      final regions = OutfitGarmentDetectionEngine.detect(
        visionObjects: [
          VisionLocalizedObject(
            name: 'High heel',
            score: 0.91,
            normalizedBox: const Rect.fromLTWH(0.30, 0.82, 0.40, 0.12),
          ),
        ],
        pose: _pose(feetDetected: false),
      );

      final visible = OutfitFashionTaxonomy.visibleRegions(regions);
      expect(visible.any((r) => r.zone == OutfitSegmentZone.feet), isFalse);
    });

    test('rejects detections below 82% confidence', () {
      final regions = OutfitGarmentDetectionEngine.detect(
        visionObjects: [
          VisionLocalizedObject(
            name: 'Pants',
            score: 0.79,
            normalizedBox: const Rect.fromLTWH(0.26, 0.52, 0.48, 0.28),
          ),
        ],
        pose: _fullBodyPose(),
      );

      expect(regions, isEmpty);
    });

    test('allows layered upper garments', () {
      final regions = OutfitGarmentDetectionEngine.detect(
        visionObjects: [
          VisionLocalizedObject(
            name: 'Blazer',
            score: 0.91,
            normalizedBox: const Rect.fromLTWH(0.22, 0.18, 0.56, 0.22),
          ),
          VisionLocalizedObject(
            name: 'Blouse',
            score: 0.88,
            normalizedBox: const Rect.fromLTWH(0.28, 0.30, 0.44, 0.12),
          ),
          VisionLocalizedObject(
            name: 'Skirt',
            score: 0.89,
            normalizedBox: const Rect.fromLTWH(0.26, 0.52, 0.48, 0.28),
          ),
        ],
        pose: _fullBodyPose(),
      );

      final visible = OutfitFashionTaxonomy.visibleRegions(regions);
      expect(visible.where((r) => r.zone == OutfitSegmentZone.upperBody).length, 2);
      expect(visible.any((r) => r.labelAr.contains('تنورة')), isTrue);
    });

    test('never shows generic placeholder labels', () {
      final regions = [
        OutfitSegmentRegion(
          zone: OutfitSegmentZone.lowerBody,
          normalizedRect: const Rect.fromLTWH(0.2, 0.5, 0.6, 0.3),
          labelAr: 'الجزء السفلي',
          labelEn: 'Lower body',
          confidence: 0.95,
        ),
      ];

      expect(OutfitFashionTaxonomy.visibleRegions(regions), isEmpty);
    });
  });

  group('OutfitVisionRegionBuilder', () {
    test('creates separate bbox regions per Vision object', () {
      final regions = OutfitVisionRegionBuilder.build(
        visionObjects: [
          VisionLocalizedObject(
            name: 'Blazer',
            score: 0.91,
            normalizedBox: const Rect.fromLTWH(0.22, 0.18, 0.56, 0.22),
          ),
          VisionLocalizedObject(
            name: 'Shirt',
            score: 0.88,
            normalizedBox: const Rect.fromLTWH(0.28, 0.30, 0.44, 0.12),
          ),
          VisionLocalizedObject(
            name: 'Pants',
            score: 0.89,
            normalizedBox: const Rect.fromLTWH(0.26, 0.52, 0.48, 0.28),
          ),
        ],
        pose: _fullBodyPose(),
      );

      final visible = OutfitFashionTaxonomy.visibleRegions(regions);
      expect(visible.length, greaterThanOrEqualTo(3));
      expect(visible.any((r) => r.labelAr.contains('بلوز') || r.labelAr.contains('قمي')), isTrue);
      expect(visible.any((r) => r.labelAr == 'بنطلون'), isTrue);
    });

    test('hides bag region when Vision did not detect bag', () {
      final merged = OutfitVisionRegionBuilder.build(
        visionObjects: [
          VisionLocalizedObject(
            name: 'Shirt',
            score: 0.9,
            normalizedBox: const Rect.fromLTWH(0.2, 0.2, 0.6, 0.25),
          ),
        ],
        pose: _fullBodyPose(),
      );

      final visible = OutfitFashionTaxonomy.visibleRegions(merged);
      expect(visible.any((r) => r.zone == OutfitSegmentZone.accessories), isFalse);
    });

    test('shows bag only when Vision detects it with confidence', () {
      final merged = OutfitVisionRegionBuilder.build(
        visionObjects: [
          VisionLocalizedObject(
            name: 'Handbag',
            score: 0.88,
            normalizedBox: const Rect.fromLTWH(0.62, 0.32, 0.18, 0.16),
          ),
        ],
        pose: _pose(handsVisible: true),
      );

      final visible = OutfitFashionTaxonomy.visibleRegions(merged);
      expect(visible.any((r) => r.labelAr == 'حقيبة'), isTrue);
    });
  });
}

OutfitBodyPoseMetrics _fullBodyPose() => _pose(feetDetected: true, handsVisible: true);

OutfitBodyPoseMetrics _pose({
  bool feetDetected = false,
  bool handsVisible = false,
}) {
  return OutfitBodyPoseMetrics(
    personDetected: true,
    headDetected: true,
    shouldersDetected: true,
    torsoDetected: true,
    legsDetected: true,
    feetDetected: feetDetected,
    trackingScore: 0.72,
    bodyBounds: const Rect.fromLTWH(0.12, 0.06, 0.76, 0.90),
    landmarkPoints: {
      'nose': const Offset(0.5, 0.12),
      'left_shoulder': const Offset(0.38, 0.22),
      'right_shoulder': const Offset(0.62, 0.22),
      'left_hip': const Offset(0.40, 0.48),
      'right_hip': const Offset(0.60, 0.48),
      'left_knee': const Offset(0.42, 0.68),
      'right_knee': const Offset(0.58, 0.68),
      if (feetDetected) ...{
        'left_ankle': const Offset(0.43, 0.88),
        'right_ankle': const Offset(0.57, 0.88),
      },
      if (handsVisible) ...{
        'left_wrist': const Offset(0.32, 0.42),
        'right_wrist': const Offset(0.68, 0.42),
        'left_elbow': const Offset(0.34, 0.32),
        'right_elbow': const Offset(0.66, 0.32),
      },
    },
  );
}
