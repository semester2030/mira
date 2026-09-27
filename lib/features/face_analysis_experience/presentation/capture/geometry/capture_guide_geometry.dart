import 'dart:ui';

/// Illustrative capture zone — positioning aid only (Law #40: ILLUSTRATIVE).
///
/// Matches legacy placeholder proportions used by [LiveFaceGuidePainter]
/// so distance/center ratios stay compatible with 9B mesh thresholds.
///
/// [forCameraKit] sizes the oval to Perfect MODERATE faceSizeRatio (0.65):
/// filling the guide ≈ meeting CameraKit face-area acceptance.
abstract final class CaptureGuideGeometry {
  CaptureGuideGeometry._();

  static const centerXRatio = 0.5;
  static const centerYRatio = 0.48;
  static const widthRatio = 0.58;
  static const heightRatio = 0.68;

  /// CameraKit MODERATE requires face width ≥ 0.65 × frame width (portrait).
  /// Guide is slightly larger so a face that fills the oval clears the gate.
  static const cameraKitWidthRatio = 0.72;
  static const cameraKitHeightRatio = 0.84;

  static Rect illustrativeOval(Size viewport, {bool forCameraKit = false}) {
    final wr = forCameraKit ? cameraKitWidthRatio : widthRatio;
    final hr = forCameraKit ? cameraKitHeightRatio : heightRatio;
    return Rect.fromCenter(
      center: Offset(
        viewport.width * centerXRatio,
        viewport.height * centerYRatio,
      ),
      width: viewport.width * wr,
      height: viewport.height * hr,
    );
  }

  /// Normalized offsets for 9B adapter (fraction of guide size, signed).
  static (double?, double?, double?) meshMetrics({
    required Rect? boundingBox,
    required Size viewport,
  }) {
    if (boundingBox == null || viewport.isEmpty) {
      return (null, null, null);
    }
    final guide = illustrativeOval(viewport);
    if (guide.width <= 0 || guide.height <= 0) {
      return (null, null, null);
    }
    final centerX =
        (boundingBox.center.dx - guide.center.dx) / guide.width;
    final centerY =
        (boundingBox.center.dy - guide.center.dy) / guide.height;
    final heightRatio = boundingBox.height / guide.height;
    return (centerX, centerY, heightRatio);
  }

  static (double?, double?) normalizedBoxCenter({
    required Rect? boundingBox,
    required Size viewport,
  }) {
    if (boundingBox == null || viewport.width <= 0 || viewport.height <= 0) {
      return (null, null);
    }
    return (
      boundingBox.center.dx / viewport.width,
      boundingBox.center.dy / viewport.height,
    );
  }
}
