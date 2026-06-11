import 'dart:math' as math;
import 'dart:ui';

import 'package:mediapipe_face_mesh/mediapipe_face_mesh.dart';

import 'face_mapping_context.dart';
import 'models/face_mesh_models.dart';

/// Single source of truth: MediaPipe landmark → preview viewport coordinates.
///
/// Handles rotation, front-camera preview mirroring, [BoxFit.cover] scale, and crop offset.
class FaceMeshPointMapper {
  FaceMeshPointMapper({
    required this.mesh,
    required this.context,
    required this.rotationDegrees,
  });

  final FaceMeshResult mesh;
  final FaceMappingContext context;
  final int rotationDegrees;

  Size get contentSize => context.contentSize;
  Size get viewportSize => context.viewportSize;

  /// Maps one landmark into overlay/preview coordinates.
  FaceMeshPoint mapLandmarkToPreview(FaceMeshLandmark landmark) {
    final contentOffset = mesh.landmarkAsOffset(
      landmark,
      targetSize: contentSize,
      rotationDegrees: rotationDegrees,
      mirrorHorizontal: context.mirrorPreview,
    );
    return _mapContentToViewport(contentOffset.dx, contentOffset.dy);
  }

  FaceMeshPoint mapIndex(int index) {
    if (index < 0 || index >= mesh.landmarks.length) {
      return const FaceMeshPoint(0, 0);
    }
    return mapLandmarkToPreview(mesh.landmarks[index]);
  }

  List<FaceMeshPoint> mapIndices(List<int> indices) =>
      indices.map(mapIndex).where((p) => p.x != 0 || p.y != 0).toList();

  List<FaceMeshPoint> mapAllLandmarks() {
    return [
      for (final landmark in mesh.landmarks) mapLandmarkToPreview(landmark),
    ];
  }

  Rect mapBoundingRect({bool clampToViewport = true}) {
    final rect = mesh.boundingRect(
      targetSize: contentSize,
      clampToBounds: false,
    );
    final topLeft = _mapContentToViewport(rect.left, rect.top);
    final bottomRight = _mapContentToViewport(rect.right, rect.bottom);
    final mapped = Rect.fromLTRB(
      math.min(topLeft.x, bottomRight.x),
      math.min(topLeft.y, bottomRight.y),
      math.max(topLeft.x, bottomRight.x),
      math.max(topLeft.y, bottomRight.y),
    );
    if (!clampToViewport) return mapped;
    return mapped.intersect(
      Rect.fromLTWH(0, 0, viewportSize.width, viewportSize.height),
    );
  }

  FaceMeshPoint _mapContentToViewport(double x, double y) {
    final scale = math.max(
      viewportSize.width / contentSize.width,
      viewportSize.height / contentSize.height,
    );
    final displayedW = contentSize.width * scale;
    final displayedH = contentSize.height * scale;
    final offsetX = (viewportSize.width - displayedW) / 2;
    final offsetY = (viewportSize.height - displayedH) / 2;
    return FaceMeshPoint(x * scale + offsetX, y * scale + offsetY);
  }
}
