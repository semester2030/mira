import 'dart:math' as math;
import 'dart:ui';

import 'package:mediapipe_face_mesh/mediapipe_face_mesh.dart';

import 'models/face_mesh_models.dart';

/// Maps MediaPipe 468 landmarks → viewport coordinates (BoxFit.cover aware).
class MediapipeCoordinateMapper {
  final FaceMeshResult mesh;
  final Size contentSize;
  final Size viewportSize;
  final int rotationDegrees;
  final bool mirrorHorizontal;

  const MediapipeCoordinateMapper({
    required this.mesh,
    required this.contentSize,
    required this.viewportSize,
    required this.rotationDegrees,
    required this.mirrorHorizontal,
  });

  FaceMeshPoint mapIndex(int index) {
    if (index < 0 || index >= mesh.landmarks.length) {
      return const FaceMeshPoint(0, 0);
    }
    return mapLandmark(mesh.landmarks[index]);
  }

  FaceMeshPoint mapLandmark(FaceMeshLandmark landmark) {
    final offset = mesh.landmarkAsOffset(
      landmark,
      targetSize: contentSize,
      rotationDegrees: rotationDegrees,
      mirrorHorizontal: mirrorHorizontal,
    );
    return _coverMap(offset.dx, offset.dy);
  }

  List<FaceMeshPoint> mapIndices(List<int> indices) =>
      indices.map(mapIndex).where((p) => p.x > 0 || p.y > 0).toList();

  FaceMeshPoint _coverMap(double x, double y) {
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
