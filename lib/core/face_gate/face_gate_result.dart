import 'dart:ui';

/// Outcome of on-device face validation before skin analysis.
class FaceGateResult {
  final bool isAccepted;
  final String messageAr;
  final String? reasonCode;

  /// Face box on the oriented/cropped preview image (for normalization).
  final Rect? faceBox;
  final Size? imageSize;

  const FaceGateResult._({
    required this.isAccepted,
    required this.messageAr,
    this.reasonCode,
    this.faceBox,
    this.imageSize,
  });

  const FaceGateResult.accepted()
      : this._(
          isAccepted: true,
          messageAr: 'وجه مقبول للتحليل',
        );

  const FaceGateResult.rejected({
    required String messageAr,
    required String reasonCode,
  }) : this._(
          isAccepted: false,
          messageAr: messageAr,
          reasonCode: reasonCode,
        );

  const FaceGateResult.acceptedWithFace({
    required Rect faceBox,
    required Size imageSize,
  }) : this._(
          isAccepted: true,
          messageAr: 'وجه مقبول للتحليل',
          faceBox: faceBox,
          imageSize: imageSize,
        );
}
