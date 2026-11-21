import 'dart:math' as math;
import 'dart:ui';

import 'package:mediapipe_face_mesh/mediapipe_face_mesh.dart';

import 'face_mesh_head_pose.dart';
import 'face_mesh_point_mapper.dart';
import 'models/face_mesh_models.dart';
import 'topology/mediapipe_landmark_indices.dart';
import 'utils/cheek_midline_crossing.dart';
import 'utils/region_path_utils.dart';

/// Builds validated anatomical polygons from MediaPipe landmark loops.
class MediapipeRegionBuilder {
  const MediapipeRegionBuilder();

  FaceMeshFrame build({
    required FaceMeshResult mesh,
    required FaceMeshPointMapper mapper,
  }) {
    final outline = mapper.mapIndices(MediapipeLandmarkIndices.faceOval);
    final viewport = mapper.viewportSize;
    final midlineAnchors = [
      for (final i in CheekMidlineCrossing.midlineLandmarkIndices)
        mapper.mapIndex(i),
    ];
    final anatomicalMidlineX =
        CheekMidlineCrossing.midlineXFromAnchors(midlineAnchors);
    final leftFace = mapper.mapIndex(MediapipeLandmarkIndices.geometryLeftFace);
    final rightFace =
        mapper.mapIndex(MediapipeLandmarkIndices.geometryRightFace);
    final anatomicalLeftIsLowerX = CheekMidlineCrossing.anatomicalLeftIsLowerX(
      leftFaceX: leftFace.x,
      rightFaceX: rightFace.x,
    );

    final regions = <FaceRegionPolygon>[
      _forehead(
        mapper,
        outline,
        viewport,
        anatomicalMidlineX,
        anatomicalLeftIsLowerX,
      ),
      ..._underEyes(
        mapper,
        outline,
        viewport,
        anatomicalMidlineX,
        anatomicalLeftIsLowerX,
      ),
      _nose(
        mapper,
        outline,
        viewport,
        anatomicalMidlineX,
        anatomicalLeftIsLowerX,
      ),
      ..._cheeks(
        mapper,
        outline,
        viewport,
        anatomicalMidlineX,
        anatomicalLeftIsLowerX,
      ),
      _chin(
        mapper,
        outline,
        viewport,
        anatomicalMidlineX,
        anatomicalLeftIsLowerX,
      ),
    ].where((r) => r.points.length >= 3).toList();

    final pose = FaceMeshHeadPoseEstimator.fromLandmarks(mesh.landmarks);

    return FaceMeshFrame(
      outline: outline,
      regions: regions,
      quality: _evaluateQuality(mesh, outline, regions),
      boundingBox: _boundingBox(outline),
      debugLandmarks: mapper.mapAllLandmarks(),
      timestamp: DateTime.now(),
      yawDegrees: pose?.yawDegrees,
      pitchDegrees: pose?.pitchDegrees,
      rollDegrees: pose?.rollDegrees,
      anatomicalMidlineX: anatomicalMidlineX,
      midlineAnchors: midlineAnchors,
      anatomicalLeftIsLowerX: anatomicalLeftIsLowerX,
    );
  }

  FaceRegionPolygon _forehead(
    FaceMeshPointMapper mapper,
    List<FaceMeshPoint> outline,
    Size viewport,
    double anatomicalMidlineX,
    bool anatomicalLeftIsLowerX,
  ) {
    final points = mapper.mapIndices(MediapipeLandmarkIndices.forehead);
    if (points.length < 6) {
      return const FaceRegionPolygon(id: FaceRegionId.forehead, points: []);
    }

    return _finalizeRegion(
      id: FaceRegionId.forehead,
      points: points,
      outline: outline,
      viewport: viewport,
      anatomicalMidlineX: anatomicalMidlineX,
      anatomicalLeftIsLowerX: anatomicalLeftIsLowerX,
    );
  }

  List<FaceRegionPolygon> _underEyes(
    FaceMeshPointMapper mapper,
    List<FaceMeshPoint> outline,
    Size viewport,
    double anatomicalMidlineX,
    bool anatomicalLeftIsLowerX,
  ) {
    return [
      _finalizeRegion(
        id: FaceRegionId.underEye,
        points: mapper.mapIndices(MediapipeLandmarkIndices.leftUnderEye),
        outline: outline,
        viewport: viewport,
        isLeft: true,
        anatomicalMidlineX: anatomicalMidlineX,
        anatomicalLeftIsLowerX: anatomicalLeftIsLowerX,
      ),
      _finalizeRegion(
        id: FaceRegionId.underEye,
        points: mapper.mapIndices(MediapipeLandmarkIndices.rightUnderEye),
        outline: outline,
        viewport: viewport,
        isLeft: false,
        anatomicalMidlineX: anatomicalMidlineX,
        anatomicalLeftIsLowerX: anatomicalLeftIsLowerX,
      ),
    ];
  }

  FaceRegionPolygon _nose(
    FaceMeshPointMapper mapper,
    List<FaceMeshPoint> outline,
    Size viewport,
    double anatomicalMidlineX,
    bool anatomicalLeftIsLowerX,
  ) {
    return _finalizeRegion(
      id: FaceRegionId.nose,
      points: mapper.mapIndices(MediapipeLandmarkIndices.nose),
      outline: outline,
      viewport: viewport,
      anatomicalMidlineX: anatomicalMidlineX,
      anatomicalLeftIsLowerX: anatomicalLeftIsLowerX,
    );
  }

  List<FaceRegionPolygon> _cheeks(
    FaceMeshPointMapper mapper,
    List<FaceMeshPoint> outline,
    Size viewport,
    double anatomicalMidlineX,
    bool anatomicalLeftIsLowerX,
  ) {
    return [
      _finalizeRegion(
        id: FaceRegionId.cheek,
        points: mapper.mapIndices(MediapipeLandmarkIndices.leftCheek),
        outline: outline,
        viewport: viewport,
        isLeft: true,
        anatomicalMidlineX: anatomicalMidlineX,
        anatomicalLeftIsLowerX: anatomicalLeftIsLowerX,
      ),
      _finalizeRegion(
        id: FaceRegionId.cheek,
        points: mapper.mapIndices(MediapipeLandmarkIndices.rightCheek),
        outline: outline,
        viewport: viewport,
        isLeft: false,
        anatomicalMidlineX: anatomicalMidlineX,
        anatomicalLeftIsLowerX: anatomicalLeftIsLowerX,
      ),
    ];
  }

  FaceRegionPolygon _chin(
    FaceMeshPointMapper mapper,
    List<FaceMeshPoint> outline,
    Size viewport,
    double anatomicalMidlineX,
    bool anatomicalLeftIsLowerX,
  ) {
    final lip = mapper.mapIndices(MediapipeLandmarkIndices.lowerLip);
    final jaw = mapper.mapIndices(MediapipeLandmarkIndices.chinArc);
    if (lip.length < 4 || jaw.length < 4) {
      return const FaceRegionPolygon(id: FaceRegionId.chin, points: []);
    }

    final lipMaxY = lip.map((p) => p.y).reduce(math.max);
    final lipMinX = lip.map((p) => p.x).reduce(math.min);
    final lipMaxX = lip.map((p) => p.x).reduce(math.max);
    final marginX = _spread(lip.map((p) => p.x)) * 0.18;

    final lowerJaw = jaw
        .where(
          (p) =>
              p.y >= lipMaxY - 2 &&
              p.x >= lipMinX - marginX &&
              p.x <= lipMaxX + marginX,
        )
        .toList()
      ..sort((a, b) => a.x.compareTo(b.x));

    if (lowerJaw.length < 4) {
      return const FaceRegionPolygon(id: FaceRegionId.chin, points: []);
    }

    return _finalizeRegion(
      id: FaceRegionId.chin,
      points: [...lip, ...lowerJaw.reversed],
      outline: outline,
      viewport: viewport,
      anatomicalMidlineX: anatomicalMidlineX,
      anatomicalLeftIsLowerX: anatomicalLeftIsLowerX,
    );
  }

  FaceRegionPolygon _finalizeRegion({
    required FaceRegionId id,
    required List<FaceMeshPoint> points,
    required List<FaceMeshPoint> outline,
    required Size viewport,
    bool isLeft = false,
    double? anatomicalMidlineX,
    bool anatomicalLeftIsLowerX = true,
  }) {
    if (points.length < 3) {
      return FaceRegionPolygon(id: id, points: [], isLeftSide: isLeft);
    }

    final suppressed = RegionPathUtils.shouldSuppress(
      id: id,
      points: points,
      faceOval: outline,
      isLeftSide: isLeft,
      viewportSize: viewport,
      anatomicalMidlineX: anatomicalMidlineX,
      anatomicalLeftIsLowerX: anatomicalLeftIsLowerX,
    );

    return FaceRegionPolygon(
      id: id,
      points: points,
      isLeftSide: isLeft,
      suppressed: suppressed,
    );
  }

  FaceTrackingQuality _evaluateQuality(
    FaceMeshResult mesh,
    List<FaceMeshPoint> outline,
    List<FaceRegionPolygon> regions,
  ) {
    var score = mesh.score.clamp(0.0, 1.0);
    if (outline.length < 12) score -= 0.35;
    if (regions.where((r) => r.points.length >= 3).length < 3) score -= 0.15;
    if (mesh.landmarks.length < 468) score -= 0.15;
    if (score >= 0.55) return FaceTrackingQuality.high;
    if (score >= 0.30) return FaceTrackingQuality.medium;
    return FaceTrackingQuality.low;
  }

  Rect? _boundingBox(List<FaceMeshPoint> outline) {
    if (outline.length < 4) return null;
    final xs = outline.map((p) => p.x);
    final ys = outline.map((p) => p.y);
    return Rect.fromLTRB(
      xs.reduce(math.min),
      ys.reduce(math.min),
      xs.reduce(math.max),
      ys.reduce(math.max),
    );
  }

  double _spread(Iterable<double> values) {
    final list = values.toList();
    return list.reduce(math.max) - list.reduce(math.min);
  }
}
