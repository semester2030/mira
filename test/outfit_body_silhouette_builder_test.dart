import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_body_silhouette.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_segment_map.dart';
import 'package:mirra/features/outfit_analysis/domain/services/outfit_body_silhouette_builder.dart';

void main() {
  group('OutfitBodySilhouetteBuilder', () {
    test('classifies tall silhouette', () {
      expect(
        OutfitBodySilhouetteBuilder.classify(
          bodyHeightRatio: 0.82,
          shoulderWidthRatio: 0.32,
          hipWidthRatio: 0.30,
          torsoToLegRatio: 0.5,
        ),
        OutfitBodySilhouette.tall,
      );
    });

    test('classifies plus-size silhouette', () {
      expect(
        OutfitBodySilhouetteBuilder.classify(
          bodyHeightRatio: 0.70,
          shoulderWidthRatio: 0.42,
          hipWidthRatio: 0.39,
          torsoToLegRatio: 0.55,
        ),
        OutfitBodySilhouette.plusSize,
      );
    });

    test('builds adaptive regions from landmarks', () {
      final points = {
        'nose': const Offset(0.5, 0.12),
        'left_shoulder': const Offset(0.38, 0.22),
        'right_shoulder': const Offset(0.62, 0.22),
        'left_hip': const Offset(0.40, 0.48),
        'right_hip': const Offset(0.60, 0.48),
        'left_knee': const Offset(0.42, 0.68),
        'right_knee': const Offset(0.58, 0.68),
        'left_ankle': const Offset(0.43, 0.88),
        'right_ankle': const Offset(0.57, 0.88),
      };

      final regions = OutfitBodySilhouetteBuilder.regionsFromLandmarks(
        points,
        silhouette: OutfitBodySilhouette.average,
      );

      expect(regions.length, 5);
      expect(regions.map((r) => r.zone).toSet().length, 5);
    });

    test('plus-size uses wider segment padding than petite', () {
      final points = {
        'nose': const Offset(0.5, 0.10),
        'left_shoulder': const Offset(0.30, 0.20),
        'right_shoulder': const Offset(0.70, 0.20),
        'left_hip': const Offset(0.32, 0.46),
        'right_hip': const Offset(0.68, 0.46),
        'left_knee': const Offset(0.34, 0.66),
        'right_knee': const Offset(0.66, 0.66),
        'left_ankle': const Offset(0.35, 0.86),
        'right_ankle': const Offset(0.65, 0.86),
      };

      final petite = OutfitBodySilhouetteBuilder.regionsFromLandmarks(
        points,
        silhouette: OutfitBodySilhouette.petite,
      );
      final plus = OutfitBodySilhouetteBuilder.regionsFromLandmarks(
        points,
        silhouette: OutfitBodySilhouette.plusSize,
      );

      final petiteUpper = petite.firstWhere((r) => r.zone == OutfitSegmentZone.upperBody);
      final plusUpper = plus.firstWhere((r) => r.zone == OutfitSegmentZone.upperBody);
      expect(plusUpper.normalizedRect.width, greaterThan(petiteUpper.normalizedRect.width));
    });
  });
}
