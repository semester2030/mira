import 'dart:ui';

import '../entities/outfit_body_pose_metrics.dart';

/// Pose-derived person region — gates all garment analysis.
abstract final class OutfitPersonMask {
  OutfitPersonMask._();

  static Rect? bounds(OutfitBodyPoseMetrics pose) {
    if (pose.bodyBounds != null) return pose.bodyBounds;
    if (pose.landmarkPoints.length < 6) return null;

    var minX = 1.0;
    var minY = 1.0;
    var maxX = 0.0;
    var maxY = 0.0;
    for (final p in pose.landmarkPoints.values) {
      minX = minX < p.dx ? minX : p.dx;
      minY = minY < p.dy ? minY : p.dy;
      maxX = maxX > p.dx ? maxX : p.dx;
      maxY = maxY > p.dy ? maxY : p.dy;
    }
    if (maxX <= minX || maxY <= minY) return null;

    final padX = (maxX - minX) * 0.06;
    final padY = (maxY - minY) * 0.04;
    return Rect.fromLTRB(
      (minX - padX).clamp(0, 1),
      (minY - padY).clamp(0, 1),
      (maxX + padX).clamp(0, 1),
      (maxY + padY).clamp(0, 1),
    );
  }

  static bool containsNormalized(OutfitBodyPoseMetrics pose, double nx, double ny) {
    final b = bounds(pose);
    if (b == null) return false;
    return b.contains(Offset(nx, ny));
  }

  static bool isReady(OutfitBodyPoseMetrics pose) =>
      pose.personDetected && bounds(pose) != null;
}
