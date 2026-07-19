/// Phase 4B/4C — Geometry anchors (Flutter).
///
/// JUSTIFICATION: On-device mirror of API GeometryAnchors.
/// Index ownership: [MediapipeLandmarkIndices] — extractor uses those constants only.
library;

import 'dart:math' as math;

import '../../skin_analysis/presentation/live_face_map/models/face_mesh_models.dart';
import '../../skin_analysis/presentation/live_face_map/topology/mediapipe_landmark_indices.dart';

const geometryAnchorsVersion = 'geometry-anchors-v1';

class NormPoint {
  final double x;
  final double y;
  const NormPoint(this.x, this.y);
}

double geomDist(NormPoint a, NormPoint b) {
  final dx = a.x - b.x;
  final dy = a.y - b.y;
  return math.sqrt(dx * dx + dy * dy);
}

class GeometryAnchors {
  final String version;
  final NormPoint foreheadTop;
  final NormPoint browMid;
  final NormPoint noseTip;
  final NormPoint noseBase;
  final NormPoint chin;
  final NormPoint leftEyeOuter;
  final NormPoint leftEyeInner;
  final NormPoint rightEyeInner;
  final NormPoint rightEyeOuter;
  final NormPoint leftMouth;
  final NormPoint rightMouth;
  final NormPoint leftFace;
  final NormPoint rightFace;
  final NormPoint leftAla;
  final NormPoint rightAla;
  final NormPoint leftJaw;
  final NormPoint rightJaw;
  final String source;

  const GeometryAnchors({
    this.version = geometryAnchorsVersion,
    required this.foreheadTop,
    required this.browMid,
    required this.noseTip,
    required this.noseBase,
    required this.chin,
    required this.leftEyeOuter,
    required this.leftEyeInner,
    required this.rightEyeInner,
    required this.rightEyeOuter,
    required this.leftMouth,
    required this.rightMouth,
    required this.leftFace,
    required this.rightFace,
    required this.leftAla,
    required this.rightAla,
    required this.leftJaw,
    required this.rightJaw,
    required this.source,
  });
}

/// Extract anchors from a full 468-length landmark list (normalized coords).
/// Returns null if indices missing — never invents points.
abstract final class GeometryAnchorExtractor {
  GeometryAnchorExtractor._();

  static GeometryAnchors? fromLandmarkList(
    List<FaceMeshPoint> landmarks, {
    String source = 'mediapipe_mesh',
  }) {
    final need = MediapipeLandmarkIndices.geometryAnchorIndices;
    for (final i in need) {
      if (i < 0 || i >= landmarks.length) return null;
    }

    NormPoint at(int i) => NormPoint(landmarks[i].x, landmarks[i].y);

    return GeometryAnchors(
      foreheadTop: at(MediapipeLandmarkIndices.geometryForeheadTop),
      browMid: at(MediapipeLandmarkIndices.geometryBrowMid),
      noseTip: at(MediapipeLandmarkIndices.geometryNoseTip),
      noseBase: at(MediapipeLandmarkIndices.geometryNoseBase),
      chin: at(MediapipeLandmarkIndices.geometryChin),
      leftEyeOuter: at(MediapipeLandmarkIndices.geometryLeftEyeOuter),
      leftEyeInner: at(MediapipeLandmarkIndices.geometryLeftEyeInner),
      rightEyeInner: at(MediapipeLandmarkIndices.geometryRightEyeInner),
      rightEyeOuter: at(MediapipeLandmarkIndices.geometryRightEyeOuter),
      leftMouth: at(MediapipeLandmarkIndices.geometryLeftMouth),
      rightMouth: at(MediapipeLandmarkIndices.geometryRightMouth),
      leftFace: at(MediapipeLandmarkIndices.geometryLeftFace),
      rightFace: at(MediapipeLandmarkIndices.geometryRightFace),
      leftAla: at(MediapipeLandmarkIndices.geometryLeftAla),
      rightAla: at(MediapipeLandmarkIndices.geometryRightAla),
      leftJaw: at(MediapipeLandmarkIndices.geometryLeftJaw),
      rightJaw: at(MediapipeLandmarkIndices.geometryRightJaw),
      source: source,
    );
  }
}
