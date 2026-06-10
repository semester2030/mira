import 'dart:math' as math;
import 'dart:ui';

import 'package:mediapipe_face_mesh/mediapipe_face_mesh.dart';

import 'mediapipe_coordinate_mapper.dart';
import 'models/face_mesh_models.dart';
import 'painters/smooth_path_builder.dart';
import 'topology/mediapipe_landmark_indices.dart';

/// Builds anatomical region polygons purely from MediaPipe landmark indices.
class MediapipeRegionBuilder {
  const MediapipeRegionBuilder();

  FaceMeshFrame build({
    required FaceMeshResult mesh,
    required MediapipeCoordinateMapper mapper,
  }) {
    final outline = mapper.mapIndices(MediapipeLandmarkIndices.faceOval);
    final regions = <FaceRegionPolygon>[
      _forehead(mesh, mapper, outline),
      ..._underEyes(mapper),
      _nose(mapper),
      ..._cheeks(mapper),
      _chin(mapper),
    ].where((r) => r.isValid).toList();

    return FaceMeshFrame(
      outline: outline,
      regions: regions,
      quality: _evaluateQuality(mesh, outline, regions),
      boundingBox: _boundingBox(mesh, mapper),
      timestamp: DateTime.now(),
    );
  }

  FaceRegionPolygon _forehead(
    FaceMeshResult mesh,
    MediapipeCoordinateMapper mapper,
    List<FaceMeshPoint> outline,
  ) {
    final browBottom = [
      ...mapper.mapIndices(MediapipeLandmarkIndices.leftEyebrowTop),
      ...mapper.mapIndices(MediapipeLandmarkIndices.rightEyebrowTop.reversed.toList()),
    ];
    if (browBottom.length < 4 || outline.length < 8) {
      return const FaceRegionPolygon(id: FaceRegionId.forehead, points: []);
    }

    final browY = browBottom.map((p) => p.y).reduce(math.min);
    final topArc = outline.where((p) => p.y <= browY).toList()
      ..sort((a, b) => a.x.compareTo(b.x));

    if (topArc.length < 4) {
      return const FaceRegionPolygon(id: FaceRegionId.forehead, points: []);
    }

    return FaceRegionPolygon(
      id: FaceRegionId.forehead,
      points: SmoothPathBuilder.simplify(
        [...topArc, ...browBottom.reversed],
        target: 14,
      ),
    );
  }

  List<FaceRegionPolygon> _underEyes(MediapipeCoordinateMapper mapper) {
    return [
      _regionFromIndices(
        FaceRegionId.underEye,
        MediapipeLandmarkIndices.leftUnderEye,
        mapper,
        isLeft: true,
      ),
      _regionFromIndices(
        FaceRegionId.underEye,
        MediapipeLandmarkIndices.rightUnderEye,
        mapper,
        isLeft: false,
      ),
    ];
  }

  FaceRegionPolygon _nose(MediapipeCoordinateMapper mapper) {
    return _regionFromIndices(
      FaceRegionId.nose,
      MediapipeLandmarkIndices.nose,
      mapper,
    );
  }

  List<FaceRegionPolygon> _cheeks(MediapipeCoordinateMapper mapper) {
    return [
      _regionFromIndices(
        FaceRegionId.cheek,
        MediapipeLandmarkIndices.leftCheek,
        mapper,
        isLeft: true,
      ),
      _regionFromIndices(
        FaceRegionId.cheek,
        MediapipeLandmarkIndices.rightCheek,
        mapper,
        isLeft: false,
      ),
    ];
  }

  FaceRegionPolygon _chin(MediapipeCoordinateMapper mapper) {
    final lip = mapper.mapIndices(MediapipeLandmarkIndices.lowerLip);
    final jaw = mapper.mapIndices(MediapipeLandmarkIndices.chin);
    if (lip.length < 4 || jaw.length < 4) {
      return const FaceRegionPolygon(id: FaceRegionId.chin, points: []);
    }

    final lipMaxY = lip.map((p) => p.y).reduce(math.max);
    final lowerJaw = jaw.where((p) => p.y >= lipMaxY - 2).toList()
      ..sort((a, b) => a.x.compareTo(b.x));

    return FaceRegionPolygon(
      id: FaceRegionId.chin,
      points: SmoothPathBuilder.simplify(
        [...lip, ...lowerJaw.reversed],
        target: 12,
      ),
    );
  }

  FaceRegionPolygon _regionFromIndices(
    FaceRegionId id,
    List<int> indices,
    MediapipeCoordinateMapper mapper, {
    bool isLeft = false,
    int simplifyTarget = 12,
  }) {
    final points = mapper.mapIndices(indices);
    if (points.length < 3) {
      return FaceRegionPolygon(id: id, points: [], isLeftSide: isLeft);
    }

    return FaceRegionPolygon(
      id: id,
      points: SmoothPathBuilder.simplify(points, target: simplifyTarget),
      isLeftSide: isLeft,
    );
  }

  FaceTrackingQuality _evaluateQuality(
    FaceMeshResult mesh,
    List<FaceMeshPoint> outline,
    List<FaceRegionPolygon> regions,
  ) {
    var score = mesh.score.clamp(0.0, 1.0);
    if (outline.length < 20) score -= 0.3;
    if (regions.where((r) => r.isValid).length < 4) score -= 0.25;
    if (mesh.landmarks.length < 468) score -= 0.2;
    if (score >= 0.72) return FaceTrackingQuality.high;
    if (score >= 0.45) return FaceTrackingQuality.medium;
    return FaceTrackingQuality.low;
  }

  Rect? _boundingBox(FaceMeshResult mesh, MediapipeCoordinateMapper mapper) {
    if (mesh.landmarks.isEmpty) return null;
    final corners = [
      mapper.mapLandmark(mesh.landmarks[MediapipeLandmarkIndices.faceOval.first]),
      mapper.mapLandmark(mesh.landmarks[152]),
    ];
    final xs = corners.map((p) => p.x);
    final ys = corners.map((p) => p.y);
    return Rect.fromLTRB(
      xs.reduce(math.min),
      ys.reduce(math.min),
      xs.reduce(math.max),
      ys.reduce(math.max),
    );
  }
}
