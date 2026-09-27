import 'dart:ui' show Offset, Rect, Size;

import 'shared_image_mask_fit.dart';

/// Geometry only: the same source pixel is at the centre at both zoom levels.
/// Zoom is relative to the main photo, not a contain-fit inside the short lens.
abstract final class FaceExplorerLensGeometry {
  static Rect imageRect({
    required Size sourceSize,
    required Size stageViewport,
    required Size lensViewport,
    required Offset focusSourceNorm,
    required double zoom,
  }) {
    if (!_valid(sourceSize) ||
        !_valid(stageViewport) ||
        !_valid(lensViewport) ||
        !focusSourceNorm.dx.isFinite ||
        !focusSourceNorm.dy.isFinite ||
        !zoom.isFinite) {
      return Rect.zero;
    }
    final stageImage = SharedImageMaskFit.containRect(
      viewport: stageViewport,
      sourceSize: sourceSize,
    );
    final scale = stageImage.width / sourceSize.width * zoom.clamp(2.0, 3.0);
    final width = sourceSize.width * scale;
    final height = sourceSize.height * scale;
    final nx = focusSourceNorm.dx.clamp(0.0, 1.0);
    final ny = focusSourceNorm.dy.clamp(0.0, 1.0);
    return Rect.fromLTWH(
      lensViewport.width / 2 - nx * width,
      lensViewport.height / 2 - ny * height,
      width,
      height,
    );
  }

  /// Main-photo indicator centre, independent of the indicator's diameter.
  static Offset stageFocusPoint({
    required Size sourceSize,
    required Size stageViewport,
    required Offset focusSourceNorm,
  }) {
    final image = SharedImageMaskFit.containRect(
      viewport: stageViewport,
      sourceSize: sourceSize,
    );
    return Offset(
      image.left + focusSourceNorm.dx.clamp(0.0, 1.0) * image.width,
      image.top + focusSourceNorm.dy.clamp(0.0, 1.0) * image.height,
    );
  }

  static bool _valid(Size size) =>
      size.width.isFinite &&
      size.height.isFinite &&
      size.width > 0 &&
      size.height > 0;
}
