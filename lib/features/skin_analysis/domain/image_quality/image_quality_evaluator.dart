import 'dart:io';
import 'dart:ui';

import 'package:image/image.dart' as img;

import '../../../../core/face_gate/face_gate_result.dart';
import '../../../../core/face_gate/face_gate_validator.dart';
import '../../../face_intelligence/data/face_intel_production_bridge.dart';
import '../../../face_intelligence/data/face_intel_upload_payload.dart';
import '../../../face_intelligence/domain/face_intel_runtime_state.dart';
import '../../presentation/utils/face_image_processor.dart';
import '../entities/capture_quality_signals.dart';
import 'image_pixel_metrics.dart';
import 'image_quality_metric.dart';
import 'image_quality_report.dart';
import 'quality_confidence_mapper.dart';

/// Thrown when post-capture quality blocks upload / provider calls.
class ImageQualityException implements Exception {
  final String messageAr;
  final String messageEn;
  final String reasonCode;
  final ImageQualityReport report;

  const ImageQualityException({
    required this.messageAr,
    required this.messageEn,
    required this.reasonCode,
    required this.report,
  });

  @override
  String toString() => messageAr;
}

/// Phase 2 — unified evaluator. Never invents metric values.
abstract final class ImageQualityEvaluator {
  ImageQualityEvaluator._();

  static const calculationVersion = 'iq-v2.0';

  /// Evaluate a still image with optional ML Kit face gate metrics.
  static Future<ImageQualityReport> evaluateFile(
    File imageFile, {
    FaceGateResult? faceGate,
  }) async {
    final bytes = await imageFile.readAsBytes();
    final decoded = img.decodeImage(bytes);
    if (decoded == null) {
      final metrics = _unavailableSuite(
        extra: [
          ImageQualityMetric.unavailable(
            id: 'decode',
            limitations: const ['Image decode failed'],
          ),
        ],
      );
      final mapped = QualityConfidenceMapper.map(byId: {
        for (final m in metrics) m.id: m,
      });
      return ImageQualityReport(
        metrics: metrics,
        verdict: ImageQualityVerdict.blocked,
        calculationVersion: calculationVersion,
        messageAr: 'تعذر قراءة الصورة — أعيدي الالتقاط.',
        messageEn: 'Could not read the image — please retake.',
        captureSignals: mapped.signals,
        overallConfidencePercent: 0,
        blockingReasons: const ['decode_failed'],
      );
    }

    final oriented = img.bakeOrientation(decoded);
    final report = evaluateImage(oriented, faceGate: faceGate);
    return _withCompressionMetric(report, bytes.length, oriented);
  }

  static ImageQualityReport _withCompressionMetric(
    ImageQualityReport report,
    int byteLength,
    img.Image oriented,
  ) {
    final area = oriented.width * oriented.height;
    if (area <= 0) return report;
    // bytes per pixel — typical JPEG selfie ~0.05–0.4; very low → heavy compression.
    final bpp = byteLength / area;
    final metrics = [
      for (final m in report.metrics)
        if (m.id != 'compressionQuality') m,
      ImageQualityMetric.measured(
        id: 'compressionQuality',
        value: bpp,
        unit: 'bytes_per_pixel',
        confidence: 0.7,
        limitations: const [
          'Heuristic from file size / pixel area — not JPEG Q-table inspection.',
        ],
      ),
    ];
    return ImageQualityReport(
      metrics: metrics,
      verdict: report.verdict,
      calculationVersion: report.calculationVersion,
      messageAr: report.messageAr,
      messageEn: report.messageEn,
      captureSignals: report.captureSignals,
      overallConfidencePercent: report.overallConfidencePercent,
      blockingReasons: report.blockingReasons,
    );
  }

  static ImageQualityReport evaluateImage(
    img.Image oriented, {
    FaceGateResult? faceGate,
  }) {
    final metrics = <ImageQualityMetric>[];

    final blur = ImagePixelMetrics.blurLaplacianVariance(oriented);
    final brightness = ImagePixelMetrics.averageBrightness(oriented);
    final contrast = ImagePixelMetrics.contrastScore(oriented);
    final overExp = ImagePixelMetrics.overExposureRatio(oriented);
    final underExp = ImagePixelMetrics.underExposureRatio(oriented);
    final shadow = ImagePixelMetrics.shadowImbalance(oriented);
    final shortEdge = mathMin(oriented.width, oriented.height).toDouble();
    final longEdge = mathMax(oriented.width, oriented.height).toDouble();
    final dynamicRange = (contrast * 2).clamp(0.0, 1.0);

    metrics.addAll([
      ImageQualityMetric.measured(
        id: 'blur',
        value: blur,
        unit: 'laplacian_variance',
        confidence: 0.9,
        limitations: const [
          'Laplacian variance on subsampled luma; not a sensor-native focus score.',
        ],
      ),
      ImageQualityMetric.measured(
        id: 'brightness',
        value: brightness,
        unit: 'mean_luma_0_1',
        confidence: 0.92,
      ),
      ImageQualityMetric.measured(
        id: 'contrast',
        value: contrast,
        unit: 'luma_stddev_0_1',
        confidence: 0.88,
        limitations: const [
          'Informational only (Phase 2.1 Option A) — not used in proceed/block.',
        ],
      ),
      ImageQualityMetric.measured(
        id: 'dynamicRange',
        value: dynamicRange,
        unit: 'proxy_0_1',
        confidence: 0.7,
        limitations: const [
          'Informational only — derived from contrast proxy, not HDR histogram.',
        ],
      ),
      ImageQualityMetric.measured(
        id: 'overexposure',
        value: overExp,
        unit: 'pixel_ratio',
        confidence: 0.9,
      ),
      ImageQualityMetric.measured(
        id: 'underexposure',
        value: underExp,
        unit: 'pixel_ratio',
        confidence: 0.9,
      ),
      ImageQualityMetric.measured(
        id: 'shadowImbalance',
        value: shadow,
        unit: 'luma_delta_0_1',
        confidence: 0.85,
      ),
      ImageQualityMetric.measured(
        id: 'resolutionShortEdge',
        value: shortEdge,
        unit: 'px',
        confidence: 1.0,
      ),
      ImageQualityMetric.measured(
        id: 'resolution',
        value: shortEdge * longEdge,
        unit: 'px_area',
        confidence: 1.0,
      ),
    ]);

    // Compression: JPEG size/area heuristic when we only have pixels in memory.
    // Mark unavailable without original file byte length — caller may add later.
    metrics.add(
      ImageQualityMetric.unavailable(
        id: 'compressionQuality',
        limitations: const [
          'Requires original file byte length; not attached in pure pixel path.',
        ],
      ),
    );

    metrics.add(
      ImageQualityMetric.unavailable(
        id: 'captureDistance',
        limitations: const ['No depth / focal-length metadata in pipeline.'],
      ),
    );
    metrics.add(
      ImageQualityMetric.unavailable(
        id: 'cameraConfidence',
        limitations: const ['Device AF confidence not exposed to app.'],
      ),
    );
    metrics.add(
      ImageQualityMetric.unavailable(
        id: 'occlusion',
        limitations: const ['No occlusion classifier in Phase 2.'],
      ),
    );
    metrics.add(
      ImageQualityMetric.unavailable(
        id: 'hairObstruction',
        limitations: const ['No hair-obstruction model in Phase 2.'],
      ),
    );
    metrics.add(
      ImageQualityMetric.unavailable(
        id: 'glassesReflection',
        limitations: const ['No glasses reflection detector in Phase 2.'],
      ),
    );

    // Face geometry from ML Kit gate when provided.
    if (faceGate != null && faceGate.isAccepted) {
      final count = faceGate.faceCount ?? 1;
      metrics.add(ImageQualityMetric.measured(
        id: 'faceCount',
        value: count.toDouble(),
        confidence: 0.95,
        source: ImageQualityMetricSource.localMeasured,
      ));
      if (faceGate.faceAreaRatio != null) {
        metrics.add(ImageQualityMetric.measured(
          id: 'faceCoverage',
          value: faceGate.faceAreaRatio!,
          unit: 'area_ratio',
          confidence: 0.9,
        ));
      } else {
        metrics.add(ImageQualityMetric.unavailable(id: 'faceCoverage'));
      }
      if (faceGate.centerOffsetXRatio != null &&
          faceGate.centerOffsetYRatio != null) {
        final centering = 1.0 -
            ((faceGate.centerOffsetXRatio!.abs() +
                    faceGate.centerOffsetYRatio!.abs()) /
                2.0);
        metrics.add(ImageQualityMetric.measured(
          id: 'faceCentering',
          value: centering.clamp(0.0, 1.0),
          unit: 'score_0_1',
          confidence: 0.88,
        ));
      } else {
        metrics.add(ImageQualityMetric.unavailable(id: 'faceCentering'));
      }
      _poseMetric(metrics, 'yaw', faceGate.headYawDegrees);
      _poseMetric(metrics, 'pitch', faceGate.headPitchDegrees);
      _poseMetric(metrics, 'roll', faceGate.headRollDegrees);

      metrics.add(
        faceGate.eyesVisible == null
            ? ImageQualityMetric.unavailable(
                id: 'eyeVisibility',
                limitations: const ['Landmark presence not classified.'],
              )
            : ImageQualityMetric.measured(
                id: 'eyeVisibility',
                value: faceGate.eyesVisible! ? 1.0 : 0.0,
                confidence: 0.75,
                limitations: const [
                  'Binary from landmark presence — not eyelid openness.',
                ],
              ),
      );
      metrics.add(
        faceGate.mouthVisible == null
            ? ImageQualityMetric.unavailable(id: 'mouthVisibility')
            : ImageQualityMetric.measured(
                id: 'mouthVisibility',
                value: faceGate.mouthVisible! ? 1.0 : 0.0,
                confidence: 0.75,
              ),
      );
    } else if (faceGate != null && !faceGate.isAccepted) {
      metrics.add(ImageQualityMetric.measured(
        id: 'faceCount',
        value: faceGate.faceCount?.toDouble() ?? 0,
        confidence: 0.9,
      ));
      for (final id in [
        'faceCoverage',
        'faceCentering',
        'yaw',
        'pitch',
        'roll',
        'eyeVisibility',
        'mouthVisibility',
      ]) {
        if (!metrics.any((m) => m.id == id)) {
          metrics.add(ImageQualityMetric.unavailable(
            id: id,
            limitations: const ['Face gate rejected before geometry export.'],
          ));
        }
      }
    } else {
      for (final id in [
        'faceCount',
        'faceCoverage',
        'faceCentering',
        'yaw',
        'pitch',
        'roll',
        'eyeVisibility',
        'mouthVisibility',
      ]) {
        metrics.add(ImageQualityMetric.unavailable(
          id: id,
          limitations: const ['ML Kit face gate not run for this evaluation.'],
        ));
      }
    }

    final byId = {for (final m in metrics) m.id: m};
    final mapped = QualityConfidenceMapper.map(byId: byId);

    // If face gate already rejected, force blocked.
    if (faceGate != null && !faceGate.isAccepted) {
      return ImageQualityReport(
        metrics: [
          ...metrics,
          ImageQualityMetric.measured(
            id: 'overallQuality',
            value: 0,
            confidence: 1,
          ),
          ImageQualityMetric.measured(
            id: 'overallConfidence',
            value: 0,
            confidence: 1,
          ),
        ],
        verdict: ImageQualityVerdict.blocked,
        calculationVersion: calculationVersion,
        messageAr: faceGate.messageAr,
        messageEn: faceGate.messageEn ?? mapped.messageEn,
        captureSignals: mapped.signals,
        overallConfidencePercent: 0,
        blockingReasons: [faceGate.reasonCode ?? 'face_gate'],
      );
    }

    metrics.add(ImageQualityMetric.measured(
      id: 'overallQuality',
      value: mapped.confidencePercent / 100.0,
      confidence: 0.9,
    ));
    metrics.add(ImageQualityMetric.measured(
      id: 'overallConfidence',
      value: mapped.confidencePercent / 100.0,
      confidence: 1.0,
      limitations: const ['qc-v1 deterministic map — see quality docs.'],
    ));

    return ImageQualityReport(
      metrics: metrics,
      verdict: mapped.verdict,
      calculationVersion: '$calculationVersion+${QualityConfidenceMapper.version}',
      messageAr: mapped.messageAr,
      messageEn: mapped.messageEn,
      captureSignals: mapped.signals,
      overallConfidencePercent: mapped.confidencePercent,
      blockingReasons: mapped.blockingReasons,
    );
  }

  static void _poseMetric(
    List<ImageQualityMetric> metrics,
    String id,
    double? degrees,
  ) {
    if (degrees == null) {
      metrics.add(ImageQualityMetric.unavailable(
        id: id,
        limitations: const ['Head Euler angle not provided by detector.'],
      ));
    } else {
      metrics.add(ImageQualityMetric.measured(
        id: id,
        value: degrees,
        unit: 'degrees',
        confidence: 0.85,
      ));
    }
  }

  static List<ImageQualityMetric> _unavailableSuite({
    List<ImageQualityMetric> extra = const [],
  }) {
    const ids = [
      'faceCount',
      'faceCoverage',
      'faceCentering',
      'yaw',
      'pitch',
      'roll',
      'eyeVisibility',
      'mouthVisibility',
      'occlusion',
      'hairObstruction',
      'glassesReflection',
      'blur',
      'brightness',
      'contrast',
      'dynamicRange',
      'overexposure',
      'underexposure',
      'shadowImbalance',
      'resolution',
      'resolutionShortEdge',
      'compressionQuality',
      'captureDistance',
      'cameraConfidence',
      'overallQuality',
      'overallConfidence',
    ];
    return [
      ...extra,
      for (final id in ids)
        if (!extra.any((e) => e.id == id))
          ImageQualityMetric.unavailable(id: id),
    ];
  }

  static int mathMin(int a, int b) => a < b ? a : b;
  static int mathMax(int a, int b) => a > b ? a : b;
}

/// Post-capture gate: quality → ML Kit → align → faceIntel → ready file.
/// No upload on fail.
abstract final class SkinCaptureQualityGate {
  SkinCaptureQualityGate._();

  /// Full Phase 2 (+ Face Intel runtime) pipeline step before provider upload.
  static Future<
      ({
        File readyFile,
        ImageQualityReport report,
        String faceIntelJson,
        FaceIntelRuntimeState faceIntelRuntime,
      })> run(
    File source,
  ) async {
    final faceGate = await FaceGateValidator.instance.validate(source);
    final report = await ImageQualityEvaluator.evaluateFile(
      source,
      faceGate: faceGate,
    );

    if (!report.mayProceedToProvider) {
      throw ImageQualityException(
        messageAr: report.messageAr,
        messageEn: report.messageEn,
        reasonCode: report.blockingReasons.isNotEmpty
            ? report.blockingReasons.first
            : 'quality_blocked',
        report: report,
      );
    }

    File ready = source;
    if (faceGate.faceBox != null && faceGate.imageSize != null) {
      ready = await FaceImageProcessor.alignForAnalysis(
        source,
        faceBox: faceGate.faceBox!,
        imageSize: faceGate.imageSize!,
        rollDegrees: faceGate.headRollDegrees,
      );
    }

    // Operational Hardening — always emit explicit Face Intel runtime (never silent).
    FaceIntelUploadBundle bundle;
    try {
      bundle = await FaceIntelProductionBridge.buildUploadBundle(
        alignedImage: ready,
        faceGate: faceGate,
        captureQualityAcceptable: report.mayProceedToProvider,
      );
    } catch (_) {
      bundle = FaceIntelUploadPayload.build(
        gate: faceGate,
        captureQualityAcceptable: report.mayProceedToProvider,
        runtime: FaceIntelRuntimeState.failed(
          reason: 'bridge_exception',
          stage: 'face_intel_bridge',
        ),
      );
    }

    return (
      readyFile: ready,
      report: report,
      faceIntelJson: bundle.json,
      faceIntelRuntime: bundle.runtime,
    );
  }

  /// Assert-only helper for guest / repository paths.
  static Future<CaptureQualitySignals> assertProviderReady(File source) async {
    final result = await run(source);
    if (result.readyFile.path != source.path) {
      try {
        await result.readyFile.delete();
      } catch (_) {}
    }
    final signals = result.report.captureSignals;
    if (signals == null ||
        signals.lightingProvenance == CaptureSignalProvenance.legacyNeutral) {
      throw StateError('Quality gate passed without capture signals');
    }
    return signals;
  }
}
