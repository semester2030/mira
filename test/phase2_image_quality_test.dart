import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;

import 'package:mirra/features/skin_analysis/domain/entities/capture_quality_signals.dart';
import 'package:mirra/features/skin_analysis/domain/image_quality/capture_quality_thresholds.dart';
import 'package:mirra/features/skin_analysis/domain/image_quality/image_pixel_metrics.dart';
import 'package:mirra/features/skin_analysis/domain/image_quality/image_quality_evaluator.dart';
import 'package:mirra/features/skin_analysis/domain/image_quality/image_quality_metric.dart';
import 'package:mirra/features/skin_analysis/domain/image_quality/image_quality_report.dart';
import 'package:mirra/features/skin_analysis/domain/image_quality/quality_confidence_mapper.dart';
import 'package:mirra/features/skin_analysis/presentation/utils/face_image_processor.dart';

img.Image _solid(int w, int h, int r, int g, int b) {
  final image = img.Image(width: w, height: h);
  for (final p in image) {
    p
      ..r = r
      ..g = g
      ..b = b;
  }
  return image;
}

img.Image _checker(int w, int h) {
  final image = img.Image(width: w, height: h);
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      final on = ((x ~/ 8) + (y ~/ 8)).isEven;
      final v = on ? 220 : 40;
      image.setPixelRgb(x, y, v, v, v);
    }
  }
  return image;
}

void main() {
  group('Phase 2 image pixel metrics', () {
    test('blur: sharp checker has higher Laplacian variance than flat', () {
      final sharp = _checker(320, 400);
      final flat = _solid(320, 400, 128, 128, 128);
      final sharpBlur = ImagePixelMetrics.blurLaplacianVariance(sharp);
      final flatBlur = ImagePixelMetrics.blurLaplacianVariance(flat);
      expect(sharpBlur, greaterThan(flatBlur));
      expect(flatBlur, lessThan(ImageQualityThresholds.minBlurVariance));
    });

    test('brightness: dark vs bright are measured distinctly', () {
      final dark = _solid(200, 200, 20, 20, 20);
      final bright = _solid(200, 200, 230, 230, 230);
      expect(ImagePixelMetrics.averageBrightness(dark), lessThan(0.2));
      expect(ImagePixelMetrics.averageBrightness(bright), greaterThan(0.8));
    });

    test('same image → stable blur/brightness (repeatability)', () {
      final image = _checker(256, 320);
      final b1 = ImagePixelMetrics.blurLaplacianVariance(image);
      final b2 = ImagePixelMetrics.blurLaplacianVariance(image);
      final l1 = ImagePixelMetrics.averageBrightness(image);
      final l2 = ImagePixelMetrics.averageBrightness(image);
      expect(b1, b2);
      expect(l1, l2);
    });

    test('brightness variation → predictable gate behavior', () {
      final ok = ImageQualityEvaluator.evaluateImage(
        _checker(640, 800),
      );
      // No face gate → faceCount unavailable; mapper may not block on face.
      final dark = ImageQualityEvaluator.evaluateImage(
        _solid(640, 800, 8, 8, 8),
      );
      expect(dark.metric('brightness')?.isMeasured, isTrue);
      expect(dark.metric('brightness')!.value!, lessThan(0.18));
      expect(dark.blockingReasons, contains('brightness'));
      expect(ok.metric('blur')?.status, ImageQualityMetricStatus.measured);
    });
  });

  group('Phase 2 quality model honesty', () {
    test('unavailable metrics never claim measured fake neutrals', () {
      final report = ImageQualityEvaluator.evaluateImage(_checker(200, 240));
      final occlusion = report.metric('occlusion');
      expect(occlusion?.status, ImageQualityMetricStatus.unavailable);
      expect(occlusion?.value, isNull);

      final hair = report.metric('hairObstruction');
      expect(hair?.status, ImageQualityMetricStatus.unavailable);
      expect(hair?.value, isNull);
    });

    test('qc-v1 confidence mapping is deterministic', () {
      final byId = <String, ImageQualityMetric>{
        'blur': ImageQualityMetric.measured(id: 'blur', value: 120),
        'brightness': ImageQualityMetric.measured(id: 'brightness', value: 0.55),
        'faceCount': ImageQualityMetric.measured(id: 'faceCount', value: 1),
        'faceCoverage':
            ImageQualityMetric.measured(id: 'faceCoverage', value: 0.25),
        'yaw': ImageQualityMetric.measured(id: 'yaw', value: 5),
        'pitch': ImageQualityMetric.measured(id: 'pitch', value: 3),
        'roll': ImageQualityMetric.measured(id: 'roll', value: 2),
        'resolutionShortEdge':
            ImageQualityMetric.measured(id: 'resolutionShortEdge', value: 720),
      };
      final a = QualityConfidenceMapper.map(byId: byId);
      final b = QualityConfidenceMapper.map(byId: byId);
      expect(a.confidencePercent, b.confidencePercent);
      expect(a.verdict, b.verdict);
      expect(a.signals.fromMeasuredQuality, isTrue);
      expect(QualityConfidenceMapper.version, 'qc-v1.1');
    });

    test('mapper never fabricates measured signals when metrics missing', () {
      final mapped = QualityConfidenceMapper.map(byId: {
        'blur': ImageQualityMetric.measured(id: 'blur', value: 100),
        // brightness / pose omitted → unavailable provenance
      });
      expect(mapped.signals.fromMeasuredQuality, isFalse);
      expect(
        mapped.signals.lightingProvenance,
        CaptureSignalProvenance.unavailable,
      );
      expect(
        mapped.signals.angleProvenance,
        CaptureSignalProvenance.unavailable,
      );
    });

    test('critical blur blocks analysis', () {
      final byId = <String, ImageQualityMetric>{
        'blur': ImageQualityMetric.measured(id: 'blur', value: 5),
        'brightness': ImageQualityMetric.measured(id: 'brightness', value: 0.5),
        'faceCount': ImageQualityMetric.measured(id: 'faceCount', value: 1),
        'faceCoverage':
            ImageQualityMetric.measured(id: 'faceCoverage', value: 0.2),
        'resolutionShortEdge':
            ImageQualityMetric.measured(id: 'resolutionShortEdge', value: 800),
      };
      final mapped = QualityConfidenceMapper.map(byId: byId);
      expect(mapped.verdict, ImageQualityVerdict.blocked);
      expect(mapped.blockingReasons, contains('blur'));
    });

    test('multiple faces block', () {
      final mapped = QualityConfidenceMapper.map(byId: {
        'faceCount': ImageQualityMetric.measured(id: 'faceCount', value: 2),
        'blur': ImageQualityMetric.measured(id: 'blur', value: 100),
        'brightness': ImageQualityMetric.measured(id: 'brightness', value: 0.5),
        'resolutionShortEdge':
            ImageQualityMetric.measured(id: 'resolutionShortEdge', value: 800),
      });
      expect(mapped.blockingReasons, contains('multiple_faces'));
    });

    test('neutral CaptureQualitySignals is not fromMeasuredQuality', () {
      expect(const CaptureQualitySignals.neutral().fromMeasuredQuality, isFalse);
    });
  });

  group('Phase 2 face alignment', () {
    test('alignment constants are documented', () {
      expect(FaceAlignmentLimits.maxAbsRollDegrees, 28);
      expect(FaceAlignmentLimits.outputMinShortSide, 1280);
      expect(FaceAlignmentLimits.faceHeightFraction, 0.58);
    });

    test('stable preprocess encode of same pixels', () {
      final image = _checker(200, 260);
      final a = Uint8List.fromList(img.encodeJpg(image, quality: 95));
      final b = Uint8List.fromList(img.encodeJpg(image, quality: 95));
      expect(a, equals(b));
    });
  });
}
