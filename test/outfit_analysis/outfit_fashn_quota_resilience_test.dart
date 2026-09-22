import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/utils/mira_api_error_message.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/garment_color_palette.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_body_pose_metrics.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_segment_map.dart';
import 'package:mirra/features/outfit_analysis/domain/helpers/outfit_fashion_validator.dart';

void main() {
  group('outfit analyze failure messaging', () {
    test('maps FASHN quota / out of credits to clear Arabic', () {
      final msg = friendlyMiraError(
        Exception('HTTP 429 You are out of credits. Please visit your account'),
      );
      expect(msg.contains('رصيد') || msg.contains('القطع'), isTrue);
      expect(
        msg.contains(
          'تعذر بدء التحليل حاليًا. يمكنك المحاولة مرة أخرى بعد قليل.',
        ),
        isFalse,
      );
    });

    test('maps Dio 503 FASHN_QUOTA_EXCEEDED to clear Arabic', () {
      final msg = friendlyMiraError(
        DioException(
          requestOptions: RequestOptions(path: '/ai/vision/outfit/analyze'),
          type: DioExceptionType.badResponse,
          response: Response(
            requestOptions: RequestOptions(path: '/ai/vision/outfit/analyze'),
            statusCode: 503,
            data: {
              'code': 'FASHN_QUOTA_EXCEEDED',
              'message': 'HTTP 429 You are out of credits',
            },
          ),
        ),
      );
      expect(msg.contains('رصيد'), isTrue);
    });
  });

  group('pose_anatomy trust path', () {
    test('validator accepts pose anatomy bands with reliable palette', () {
      final map = OutfitSegmentMap(
        regions: [
          OutfitSegmentRegion(
            zone: OutfitSegmentZone.upperBody,
            normalizedRect: const Rect.fromLTWH(0.2, 0.15, 0.6, 0.28),
            labelAr: 'الجزء العلوي',
            labelEn: 'Upper body',
            confidence: 0.72,
            colors: const ['أسود'],
          ),
          OutfitSegmentRegion(
            zone: OutfitSegmentZone.lowerBody,
            normalizedRect: const Rect.fromLTWH(0.22, 0.45, 0.56, 0.3),
            labelAr: 'الجزء السفلي',
            labelEn: 'Lower body',
            confidence: 0.72,
            colors: const ['كحلي'],
          ),
        ],
        source: 'pose_anatomy',
        garmentPalette: const GarmentColorPalette(
          primaryColor: 'أسود',
          secondaryColor: 'كحلي',
          accentColor: '',
          confidence: 0.8,
          allColors: ['أسود', 'كحلي'],
        ),
      );
      final pose = OutfitBodyPoseMetrics(
        personDetected: true,
        bodyBounds: const Rect.fromLTWH(0.15, 0.05, 0.7, 0.9),
        landmarkPoints: {
          'nose': const Offset(0.5, 0.12),
          'left_shoulder': const Offset(0.35, 0.22),
          'right_shoulder': const Offset(0.65, 0.22),
          'left_hip': const Offset(0.38, 0.5),
          'right_hip': const Offset(0.62, 0.5),
          'left_ankle': const Offset(0.4, 0.88),
          'right_ankle': const Offset(0.6, 0.88),
        },
        shouldersDetected: true,
        headDetected: true,
        feetDetected: true,
        torsoDetected: true,
        legsDetected: true,
        trackingScore: 0.8,
      );
      final v = OutfitFashionValidator.validate(
        segmentMap: map,
        palette: map.garmentPalette,
        pose: pose,
      );
      expect(v.isTrusted, isTrue);
      final applied = OutfitFashionValidator.applyValidation(map, v);
      expect(applied.hasTrustedOverlay, isTrue);
    });
  });
}
