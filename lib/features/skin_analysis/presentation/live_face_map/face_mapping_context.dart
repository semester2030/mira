import 'dart:ui';

import 'package:camera/camera.dart';

/// Preview mapping context for MediaPipe landmark → screen projection.
class FaceMappingContext {
  final Size rawImageSize;
  final Size contentSize;
  final Size viewportSize;
  final CameraLensDirection lensDirection;

  /// Must match [Transform.flip] on the camera preview (front = mirrored selfie).
  final bool mirrorPreview;

  const FaceMappingContext({
    required this.rawImageSize,
    required this.contentSize,
    required this.viewportSize,
    required this.lensDirection,
    this.mirrorPreview = false,
  });

  static const empty = FaceMappingContext(
    rawImageSize: Size.zero,
    contentSize: Size.zero,
    viewportSize: Size.zero,
    lensDirection: CameraLensDirection.front,
  );

  bool get isValid => contentSize.width > 0 && viewportSize.width > 0;
}
