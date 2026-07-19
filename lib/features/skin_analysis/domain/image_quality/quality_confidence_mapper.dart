import '../entities/capture_quality_signals.dart';
import 'capture_quality_thresholds.dart';
import 'image_quality_metric.dart';
import 'image_quality_report.dart';

export 'capture_quality_thresholds.dart' show ImageQualityThresholds;

/// Deterministic quality→confidence (qc-v1.1). Never fabricates measured signals.
abstract final class QualityConfidenceMapper {
  QualityConfidenceMapper._();

  static const version = kQualityConfidenceVersion;

  static ({
    ImageQualityVerdict verdict,
    int confidencePercent,
    CaptureQualitySignals signals,
    List<String> blockingReasons,
    String messageAr,
    String messageEn,
  }) map({
    required Map<String, ImageQualityMetric> byId,
  }) {
    final blocking = <String>[];

    double? v(String id) => byId[id]?.isMeasured == true ? byId[id]!.value : null;

    final blurVar = v('blur');
    final brightness = v('brightness');
    final overExp = v('overexposure');
    final underExp = v('underexposure');
    final shadow = v('shadowImbalance');
    final faceCount = v('faceCount');
    final coverage = v('faceCoverage');
    final yaw = v('yaw');
    final pitch = v('pitch');
    final roll = v('roll');
    final shortEdge = v('resolutionShortEdge');

    // contrast / dynamicRange: informational only — never block

    if (faceCount != null && faceCount < 1) {
      blocking.add('no_face');
    }
    if (faceCount != null && faceCount > 1) {
      blocking.add('multiple_faces');
    }
    if (coverage != null &&
        coverage < CaptureQualityThresholds.minFaceAreaRatio) {
      blocking.add('face_too_small');
    }
    if (coverage != null &&
        coverage > CaptureQualityThresholds.maxFaceAreaRatio) {
      blocking.add('face_too_large');
    }
    if (yaw != null && yaw.abs() > CaptureQualityThresholds.maxYawDegrees) {
      blocking.add('head_yaw');
    }
    if (roll != null && roll.abs() > CaptureQualityThresholds.maxRollDegrees) {
      blocking.add('head_roll');
    }
    if (pitch != null &&
        pitch.abs() > CaptureQualityThresholds.maxPitchDegrees) {
      blocking.add('head_pitch');
    }
    if (blurVar != null &&
        blurVar < CaptureQualityThresholds.minBlurVariance) {
      blocking.add('blur');
    }
    if (brightness != null &&
        (brightness < CaptureQualityThresholds.minBrightness ||
            brightness > CaptureQualityThresholds.maxBrightness)) {
      blocking.add('brightness');
    }
    if (overExp != null &&
        overExp > CaptureQualityThresholds.maxOverExposureRatio) {
      blocking.add('overexposure');
    }
    if (underExp != null &&
        underExp > CaptureQualityThresholds.maxUnderExposureRatio) {
      blocking.add('underexposure');
    }
    if (shadow != null &&
        shadow > CaptureQualityThresholds.maxShadowImbalance) {
      blocking.add('shadow_imbalance');
    }
    if (shortEdge != null &&
        shortEdge < CaptureQualityThresholds.minShortEdgePx) {
      blocking.add('resolution');
    }

    final signals = _buildSignals(
      brightness: brightness,
      blurVar: blurVar,
      yaw: yaw,
      pitch: pitch,
      roll: roll,
    );

    if (blocking.isNotEmpty) {
      return (
        verdict: ImageQualityVerdict.blocked,
        confidencePercent: 0,
        signals: signals,
        blockingReasons: blocking,
        messageAr: _ar(blocking.first),
        messageEn: _en(blocking.first),
      );
    }

    var score = 100.0;
    if (blurVar != null &&
        blurVar < CaptureQualityThresholds.warnBlurVariance) {
      score -= 18;
    }
    if (brightness != null &&
        (brightness < CaptureQualityThresholds.idealBrightnessLow ||
            brightness > CaptureQualityThresholds.idealBrightnessHigh)) {
      score -= 12;
    }
    final angle = _combinedAngle(yaw, pitch, roll);
    if (angle != null &&
        angle > CaptureQualityThresholds.warnCombinedAngleDegrees) {
      score -= 10;
    }
    if (shadow != null &&
        shadow > CaptureQualityThresholds.warnShadowImbalance) {
      score -= 8;
    }

    final conf = score.round().clamp(55, 100);
    final verdict = conf >= 85
        ? ImageQualityVerdict.excellent
        : conf >= 70
            ? ImageQualityVerdict.acceptable
            : ImageQualityVerdict.poor;

    if (verdict == ImageQualityVerdict.poor) {
      return (
        verdict: ImageQualityVerdict.blocked,
        confidencePercent: conf,
        signals: signals,
        blockingReasons: const ['overall_poor'],
        messageAr:
            'جودة الصورة غير كافية للتحليل — حسّني الإضاءة وثبّتي الجوال وأعيدي الالتقاط.',
        messageEn:
            'Image quality is too low for analysis — improve lighting, hold steady, and retake.',
      );
    }

    return (
      verdict: verdict,
      confidencePercent: conf,
      signals: signals,
      blockingReasons: const [],
      messageAr: verdict == ImageQualityVerdict.excellent
          ? 'جودة التقاط ممتازة — جاهزة للتحليل.'
          : 'جودة التقاط مقبولة — يمكنك المتابعة.',
      messageEn: verdict == ImageQualityVerdict.excellent
          ? 'Excellent capture quality — ready for analysis.'
          : 'Acceptable capture quality — you may continue.',
    );
  }

  /// Builds signals without fabricating missing measurements.
  static CaptureQualitySignals _buildSignals({
    required double? brightness,
    required double? blurVar,
    required double? yaw,
    required double? pitch,
    required double? roll,
  }) {
    final angle = _combinedAngle(yaw, pitch, roll);
    final blurAmount = blurVar == null
        ? null
        : (1.0 - (blurVar / 200.0).clamp(0.0, 1.0));

    if (brightness == null && blurAmount == null && angle == null) {
      return const CaptureQualitySignals.unavailable();
    }

    return CaptureQualitySignals(
      lightingQuality: brightness ?? 0,
      faceAngleDegrees: angle ?? 0,
      blurAmount: blurAmount ?? 0,
      lightingProvenance: brightness != null
          ? CaptureSignalProvenance.measured
          : CaptureSignalProvenance.unavailable,
      angleProvenance: angle != null
          ? CaptureSignalProvenance.measured
          : CaptureSignalProvenance.unavailable,
      blurProvenance: blurAmount != null
          ? CaptureSignalProvenance.measured
          : CaptureSignalProvenance.unavailable,
    );
  }

  static double? _combinedAngle(double? yaw, double? pitch, double? roll) {
    if (yaw == null && pitch == null && roll == null) return null;
    final y = yaw?.abs() ?? 0;
    final p = pitch?.abs() ?? 0;
    final r = roll?.abs() ?? 0;
    return y > p && y > r ? y : (p > r ? p : r);
  }

  static String _ar(String code) => switch (code) {
        'no_face' =>
          'لم نتعرف على وجه — التقطي selfie واضح وثبّتي وجهك في المنتصف.',
        'multiple_faces' => 'وجدنا أكثر من وجه — التقطي صورة لوجه واحد فقط.',
        'face_too_small' => 'الوجه بعيد — قرّبي الكاميرا حتى يملأ الإطار.',
        'face_too_large' => 'الوجه قريب جداً — تراجعي قليلاً.',
        'head_yaw' || 'head_roll' || 'head_pitch' =>
          'انظري مباشرة إلى الكاميرا بدون التفات أو إمالة.',
        'blur' => 'الصورة غير واضحة — ثبّتي الجوال وأعيدي الالتقاط.',
        'brightness' => 'الإضاءة غير مناسبة — انتقلي لمكان بإضاءة أمامية متساوية.',
        'overexposure' => 'الصورة مُعرَّضة بإفراط — خفّفي الإضاءة القوية.',
        'underexposure' => 'الإضاءة ضعيفة — حسّني الإضاءة الأمامية.',
        'shadow_imbalance' => 'ظلال غير متوازنة — وزّعي الإضاءة على الوجه.',
        'resolution' => 'دقة الصورة منخفضة — استخدمي كاميرا أوضح.',
        _ => 'جودة الصورة غير كافية — أعيدي الالتقاط.',
      };

  static String _en(String code) => switch (code) {
        'no_face' => 'No face detected — take a clear centered selfie.',
        'multiple_faces' => 'Multiple faces detected — capture one face only.',
        'face_too_small' => 'Face too far — move closer to fill the frame.',
        'face_too_large' => 'Face too close — move back slightly.',
        'head_yaw' || 'head_roll' || 'head_pitch' =>
          'Look straight at the camera without turning or tilting.',
        'blur' => 'Image is blurry — hold still and retake.',
        'brightness' => 'Lighting is unsuitable — use even front lighting.',
        'overexposure' => 'Image is overexposed — reduce harsh light.',
        'underexposure' => 'Image is underexposed — improve front lighting.',
        'shadow_imbalance' => 'Uneven shadows — balance light across the face.',
        'resolution' => 'Resolution too low — use a clearer camera.',
        _ => 'Image quality is insufficient — please retake.',
      };
}
