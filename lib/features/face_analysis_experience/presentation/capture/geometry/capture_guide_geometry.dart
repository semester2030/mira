import 'dart:ui';

/// Illustrative capture zone — positioning aid only (Law #40: ILLUSTRATIVE).
///
/// Matches legacy placeholder proportions used by [LiveFaceGuidePainter]
/// so distance/center ratios stay compatible with 9B mesh thresholds.
abstract final class CaptureGuideGeometry {
  CaptureGuideGeometry._();

  static const centerXRatio = 0.5;
  static const centerYRatio = 0.48;
  static const widthRatio = 0.58;
  static const heightRatio = 0.68;

  static Rect illustrativeOval(Size viewport) {
    return Rect.fromCenter(
      center: Offset(
        viewport.width * centerXRatio,
        viewport.height * centerYRatio,
      ),
      width: viewport.width * widthRatio,
      height: viewport.height * heightRatio,
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
