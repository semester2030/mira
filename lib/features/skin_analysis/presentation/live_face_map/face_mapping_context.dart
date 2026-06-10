import 'dart:ui';

import 'package:camera/camera.dart';

/// Preview mapping context for MediaPipe landmark → screen projection.
class FaceMappingContext {
  final Size rawImageSize;
  final Size contentSize;
  final Size viewportSize;
  final CameraLensDirection lensDirection;

  const FaceMappingContext({
    required this.rawImageSize,
    required this.contentSize,
    required this.viewportSize,
    required this.lensDirection,
  });

  static const empty = FaceMappingContext(
    rawImageSize: Size.zero,
    contentSize: Size.zero,
    viewportSize: Size.zero,
    lensDirection: CameraLensDirection.front,
  );

  bool get isValid => contentSize.width > 0 && viewportSize.width > 0;
}
