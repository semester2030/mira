import 'face_capture_truth.dart';

/// Immutable normalized capture signals for one evaluation tick.
///
/// Only fields actually supported by existing Mira capture stack.
/// Missing values remain null → treated as UNKNOWN by the evaluator.
class FaceCaptureQualityInput {
  final bool? cameraReady;
  final bool? permissionGranted;
  final bool? cameraPaused;
  final bool? controllerDisposed;

  /// null = UNKNOWN presence.
  final int? faceCount;

  /// Face area / image area (ML Kit style) when known.
  final double? faceAreaRatio;

  /// Mesh face height / guide height when known (live overlay).
  final double? faceHeightVsGuideRatio;

  /// Center offset as fraction of image/guide size (signed).
  final double? centerOffsetXRatio;
  final double? centerOffsetYRatio;

  /// Head pose degrees from ML Kit when known.
  ///
  /// Yaw sign convention (D12): positive yaw ≈ face turned toward
  /// **SUBJECT_LEFT** (subject's left). Presentation maps cues accordingly.
  final double? yawDegrees;
  final double? pitchDegrees;
  final double? rollDegrees;

  /// 0–1 average brightness when known (still-image path).
  final double? brightness01;

  /// Laplacian variance when known.
  final double? blurVariance;

  final bool? eyesVisible;

  /// Live MediaPipe tracking not low when true.
  final bool? trackingAcceptable;

  final DateTime frameTimestamp;
  final DateTime evaluationNow;

  /// Optional box center in normalized 0–1 image space for stability.
  final double? normalizedBoxCenterX;
  final double? normalizedBoxCenterY;

  final FaceCaptureSignalSource primarySource;

  const FaceCaptureQualityInput({
    required this.frameTimestamp,
    required this.evaluationNow,
    this.cameraReady,
    this.permissionGranted,
    this.cameraPaused,
    this.controllerDisposed,
    this.faceCount,
    this.faceAreaRatio,
    this.faceHeightVsGuideRatio,
    this.centerOffsetXRatio,
    this.centerOffsetYRatio,
    this.yawDegrees,
    this.pitchDegrees,
    this.rollDegrees,
    this.brightness01,
    this.blurVariance,
    this.eyesVisible,
    this.trackingAcceptable,
    this.normalizedBoxCenterX,
    this.normalizedBoxCenterY,
    this.primarySource = FaceCaptureSignalSource.unknown,
  });

  Duration get frameAge => evaluationNow.difference(frameTimestamp);

  FaceCaptureQualityInput copyWith({
    DateTime? evaluationNow,
    DateTime? frameTimestamp,
  }) {
    return FaceCaptureQualityInput(
      frameTimestamp: frameTimestamp ?? this.frameTimestamp,
      evaluationNow: evaluationNow ?? this.evaluationNow,
      cameraReady: cameraReady,
      permissionGranted: permissionGranted,
      cameraPaused: cameraPaused,
      controllerDisposed: controllerDisposed,
      faceCount: faceCount,
      faceAreaRatio: faceAreaRatio,
      faceHeightVsGuideRatio: faceHeightVsGuideRatio,
      centerOffsetXRatio: centerOffsetXRatio,
      centerOffsetYRatio: centerOffsetYRatio,
      yawDegrees: yawDegrees,
      pitchDegrees: pitchDegrees,
      rollDegrees: rollDegrees,
      brightness01: brightness01,
      blurVariance: blurVariance,
      eyesVisible: eyesVisible,
      trackingAcceptable: trackingAcceptable,
      normalizedBoxCenterX: normalizedBoxCenterX,
      normalizedBoxCenterY: normalizedBoxCenterY,
      primarySource: primarySource,
    );
  }
}
