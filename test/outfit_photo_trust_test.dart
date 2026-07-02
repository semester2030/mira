import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:mirra/core/ai/models/mira_occasion.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/garment_color_palette.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_analysis.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_analysis_mode.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_body_pose_metrics.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_capture_validation.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_photo_trust.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_segment_map.dart';
import 'package:mirra/features/outfit_analysis/domain/helpers/outfit_result_trust.dart';
import 'package:mirra/features/outfit_analysis/domain/services/outfit_photo_trust_gate.dart';

void main() {
  group('OutfitPhotoTrustGate', () {
    test('rejects still metrics without face', () {
      final result = OutfitPhotoTrustGate.evaluateStill(
        metrics: const OutfitCaptureFrameMetrics(
          brightness: 0.5,
          blurScore: 12,
          faceCount: 0,
          faceAreaRatio: 0,
          faceCenterYNormalized: 0.5,
          faceBottomYNormalized: 0.5,
          pose: OutfitBodyPoseMetrics(
            personDetected: true,
            headDetected: true,
            shouldersDetected: true,
            torsoDetected: true,
            trackingScore: 0.6,
            bodyBounds: Rect.fromLTWH(0.2, 0.1, 0.6, 0.75),
          ),
        ),
        image: _portraitImage(),
      );
      expect(result.isAccepted, isFalse);
      expect(result.reasonCode, 'no_face');
    });

    test('rejects small body in frame', () {
      final result = OutfitPhotoTrustGate.evaluateStill(
        metrics: OutfitCaptureFrameMetrics(
          brightness: 0.5,
          blurScore: 12,
          faceCount: 1,
          faceAreaRatio: 0.02,
          faceCenterYNormalized: 0.2,
          faceBottomYNormalized: 0.28,
          pose: const OutfitBodyPoseMetrics(
            personDetected: true,
            headDetected: true,
            shouldersDetected: true,
            torsoDetected: true,
            trackingScore: 0.55,
            bodyBounds: Rect.fromLTWH(0.35, 0.4, 0.3, 0.22),
          ),
        ),
        image: _portraitImage(),
      );
      expect(result.isAccepted, isFalse);
      expect(result.reasonCode, 'body_too_small');
    });

    test('accepts valid full-body metrics', () {
      final result = OutfitPhotoTrustGate.evaluateStill(
        metrics: OutfitCaptureFrameMetrics(
          brightness: 0.5,
          blurScore: 12,
          faceCount: 1,
          faceAreaRatio: 0.04,
          faceCenterYNormalized: 0.16,
          faceBottomYNormalized: 0.24,
          pose: const OutfitBodyPoseMetrics(
            personDetected: true,
            headDetected: true,
            shouldersDetected: true,
            torsoDetected: true,
            legsDetected: true,
            trackingScore: 0.72,
            bodyBounds: Rect.fromLTWH(0.18, 0.08, 0.64, 0.82),
          ),
        ),
        image: _portraitImage(),
      );
      expect(result.isAccepted, isTrue);
    });

    test('accepts studio-style flat backdrop when person is in center', () {
      final image = _studioBackdropImage();
      final result = OutfitPhotoTrustGate.evaluateImageOnly(image);
      expect(result.isAccepted, isTrue);
    });

    test('rejects flat UI card with no subject texture', () {
      final image = _flatUiCardImage();
      final result = OutfitPhotoTrustGate.evaluateImageOnly(image);
      expect(result.isAccepted, isFalse);
      expect(result.reasonCode, 'screen_or_marketing');
    });

    test('accepts verified gallery still without screenshot heuristics', () {
      final result = OutfitPhotoTrustGate.evaluateStill(
        metrics: OutfitCaptureFrameMetrics(
          brightness: 0.55,
          blurScore: 14,
          faceCount: 1,
          faceAreaRatio: 0.035,
          faceCenterYNormalized: 0.14,
          faceBottomYNormalized: 0.22,
          pose: const OutfitBodyPoseMetrics(
            personDetected: true,
            headDetected: true,
            shouldersDetected: true,
            torsoDetected: true,
            legsDetected: true,
            trackingScore: 0.58,
            bodyBounds: Rect.fromLTWH(0.22, 0.1, 0.56, 0.78),
          ),
        ),
        image: _studioBackdropImage(),
      );
      expect(result.isAccepted, isTrue);
    });

    test('accepts when pose+face pass even on flat studio backdrop', () {
      final result = OutfitPhotoTrustGate.evaluateStill(
        metrics: OutfitCaptureFrameMetrics(
          brightness: 0.55,
          blurScore: 14,
          faceCount: 1,
          faceAreaRatio: 0.018,
          faceCenterYNormalized: 0.12,
          faceBottomYNormalized: 0.2,
          pose: const OutfitBodyPoseMetrics(
            personDetected: true,
            headDetected: true,
            shouldersDetected: true,
            torsoDetected: true,
            legsDetected: true,
            trackingScore: 0.72,
            bodyBounds: Rect.fromLTWH(0.2, 0.08, 0.6, 0.84),
          ),
        ),
        image: _flatUiCardImage(),
      );
      expect(result.isAccepted, isTrue);
    });
  });

  group('OutfitResultTrustPolicy', () {
    test('blocks when segment map is not trusted', () {
      final analysis = _baseAnalysis(
        segmentMap: const OutfitSegmentMap(
          regions: [],
          validationMessage: 'لم نتمكن من تحديد قطع ملابس',
        ),
      );
      final trust = OutfitResultTrustPolicy.evaluate(analysis);
      expect(trust.level, OutfitResultTrustLevel.blocked);
      expect(trust.showScore, isFalse);
    });

    test('trusted when overlay and gate proceed', () {
      final analysis = _baseAnalysis(
        segmentMap: OutfitSegmentMap(
          regions: const [
            OutfitSegmentRegion(
              zone: OutfitSegmentZone.upperBody,
              normalizedRect: Rect.fromLTWH(0.2, 0.2, 0.5, 0.3),
              labelAr: 'فستان',
              labelEn: 'Dress',
              confidence: 0.9,
            ),
          ],
          source: 'vision_garment',
          isVisualTrusted: true,
          garmentPalette: const GarmentColorPalette(
            primaryColor: 'أسود',
            secondaryColor: 'ذهبي',
            accentColor: 'كريمي',
            confidence: 0.8,
          ),
        ),
        analysisGate: 'proceed',
        visualConfidence: 78,
      );
      final trust = OutfitResultTrustPolicy.evaluate(analysis);
      expect(trust.isTrusted, isTrue);
      expect(trust.showPhotoInHero, isTrue);
    });
  });
}

OutfitAnalysis _baseAnalysis({
  OutfitSegmentMap? segmentMap,
  String analysisGate = 'proceed',
  int visualConfidence = 70,
}) {
  return OutfitAnalysis(
    occasion: MiraOccasion.casual,
    mode: OutfitAnalysisMode.quick,
    clothingType: 'فستان',
    styleType: 'كاجوال',
    dominantColors: const ['أسود'],
    compatibilityScore: 75,
    recommendedColors: const [],
    rejectedColors: const [],
    suggestedAccessories: const [],
    suggestedMakeup: '',
    explanation: '',
    confidence: 70,
    segmentMap: segmentMap,
    analysisGate: analysisGate,
    visualConfidence: visualConfidence,
  );
}

img.Image _portraitImage() {
  final image = img.Image(width: 1080, height: 1920);
  for (var y = 0; y < image.height; y++) {
    for (var x = 0; x < image.width; x++) {
      final noise = ((x * 17 + y * 31) % 28) - 14;
      final v = (128 + (y / image.height * 30) + noise).round().clamp(40, 220);
      image.setPixelRgb(x, y, v, v - 8, v - 16);
    }
  }
  return image;
}

/// Gray studio backdrop + textured subject (saved gallery / studio still).
img.Image _studioBackdropImage() {
  final image = img.Image(width: 1080, height: 1920);
  for (var y = 0; y < image.height; y++) {
    for (var x = 0; x < image.width; x++) {
      final inSubject = x > 260 && x < 820 && y > 180 && y < 1720;
      if (inSubject) {
        final noise = ((x * 11 + y * 19) % 38);
        final g = (70 + noise).clamp(0, 255);
        image.setPixelRgb(x, y, 40, g, g - 12);
      } else {
        image.setPixelRgb(x, y, 205, 205, 205);
      }
    }
  }
  return image;
}

/// Flat marketing card — no person texture in center.
img.Image _flatUiCardImage() {
  final image = img.Image(width: 1080, height: 1920);
  for (var y = 0; y < image.height; y++) {
    for (var x = 0; x < image.width; x++) {
      final inCard = x > 120 && x < 960 && y > 280 && y < 1640;
      final v = inCard ? 235 : 210;
      image.setPixelRgb(x, y, v, v, v);
    }
  }
  return image;
}
