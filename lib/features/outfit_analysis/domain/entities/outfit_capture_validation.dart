import '../entities/outfit_body_pose_metrics.dart';

/// Live outfit capture validation result.
enum OutfitCaptureHint {
  moveCloser,
  showFullOutfit,
  feetNotVisible,
  lowLight,
  blurry,
  bodyNotDetected,
}

class OutfitCaptureFrameMetrics {
  final double brightness;
  final double blurScore;
  final int faceCount;
  final double faceAreaRatio;
  final double faceCenterYNormalized;
  final double faceBottomYNormalized;
  final OutfitBodyPoseMetrics pose;

  const OutfitCaptureFrameMetrics({
    required this.brightness,
    required this.blurScore,
    required this.faceCount,
    required this.faceAreaRatio,
    required this.faceCenterYNormalized,
    required this.faceBottomYNormalized,
    this.pose = OutfitBodyPoseMetrics.none,
  });

  static const neutral = OutfitCaptureFrameMetrics(
    brightness: 0.5,
    blurScore: 20,
    faceCount: 0,
    faceAreaRatio: 0,
    faceCenterYNormalized: 0.5,
    faceBottomYNormalized: 0.5,
  );

  OutfitCaptureFrameMetrics copyWith({OutfitBodyPoseMetrics? pose}) {
    return OutfitCaptureFrameMetrics(
      brightness: brightness,
      blurScore: blurScore,
      faceCount: faceCount,
      faceAreaRatio: faceAreaRatio,
      faceCenterYNormalized: faceCenterYNormalized,
      faceBottomYNormalized: faceBottomYNormalized,
      pose: pose ?? this.pose,
    );
  }
}

class OutfitCaptureValidationResult {
  final bool isValid;
  final OutfitCaptureHint? hint;
  final String hintAr;
  final OutfitCaptureFrameMetrics metrics;

  const OutfitCaptureValidationResult({
    required this.isValid,
    required this.hint,
    required this.hintAr,
    required this.metrics,
  });

  static const ready = OutfitCaptureValidationResult(
    isValid: true,
    hint: null,
    hintAr: 'الإطار جاهز — التقطي إطلالتك',
    metrics: OutfitCaptureFrameMetrics.neutral,
  );
}
