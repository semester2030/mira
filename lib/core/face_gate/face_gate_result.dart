import 'dart:ui';

/// Outcome of on-device face validation before skin analysis.
class FaceGateResult {
  final bool isAccepted;
  final String messageAr;
  final String? messageEn;
  final String? reasonCode;

  /// Face box on the oriented/cropped preview image (for normalization).
  final Rect? faceBox;
  final Size? imageSize;

  /// Measured geometry when available (Phase 2).
  final int? faceCount;
  final double? faceAreaRatio;
  final double? headYawDegrees;
  final double? headPitchDegrees;
  final double? headRollDegrees;
  final double? centerOffsetXRatio;
  final double? centerOffsetYRatio;
  final bool? eyesVisible;
  final bool? mouthVisible;

  const FaceGateResult._({
    required this.isAccepted,
    required this.messageAr,
    this.messageEn,
    this.reasonCode,
    this.faceBox,
    this.imageSize,
    this.faceCount,
    this.faceAreaRatio,
    this.headYawDegrees,
    this.headPitchDegrees,
    this.headRollDegrees,
    this.centerOffsetXRatio,
    this.centerOffsetYRatio,
    this.eyesVisible,
    this.mouthVisible,
  });

  const FaceGateResult.accepted()
      : this._(
          isAccepted: true,
          messageAr: 'وجه مقبول للتحليل',
          messageEn: 'Face accepted for analysis',
        );

  const FaceGateResult.rejected({
    required String messageAr,
    required String reasonCode,
    String? messageEn,
  }) : this._(
          isAccepted: false,
          messageAr: messageAr,
          messageEn: messageEn,
          reasonCode: reasonCode,
        );

  const FaceGateResult.acceptedWithFace({
    required Rect faceBox,
    required Size imageSize,
    int faceCount = 1,
    double? faceAreaRatio,
    double? headYawDegrees,
    double? headPitchDegrees,
    double? headRollDegrees,
    double? centerOffsetXRatio,
    double? centerOffsetYRatio,
    bool? eyesVisible,
    bool? mouthVisible,
  }) : this._(
          isAccepted: true,
          messageAr: 'وجه مقبول للتحليل',
          messageEn: 'Face accepted for analysis',
          faceBox: faceBox,
          imageSize: imageSize,
          faceCount: faceCount,
          faceAreaRatio: faceAreaRatio,
          headYawDegrees: headYawDegrees,
          headPitchDegrees: headPitchDegrees,
          headRollDegrees: headRollDegrees,
          centerOffsetXRatio: centerOffsetXRatio,
          centerOffsetYRatio: centerOffsetYRatio,
          eyesVisible: eyesVisible,
          mouthVisible: mouthVisible,
        );
}
