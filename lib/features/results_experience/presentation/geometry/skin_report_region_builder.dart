import 'dart:math' as math;
import 'dart:ui';

import 'package:mediapipe_face_mesh/mediapipe_face_mesh.dart';

import '../../../skin_analysis/presentation/live_face_map/face_mesh_point_mapper.dart';
import '../../../skin_analysis/presentation/live_face_map/mediapipe_region_builder.dart';
import '../../../skin_analysis/presentation/live_face_map/models/face_mesh_models.dart';
import '../../../skin_analysis/presentation/live_face_map/topology/mediapipe_landmark_indices.dart';
import 'skin_report_landmark_indices.dart';

/// Report-only conservative regions from the CURRENT user's Face Mesh.
///
/// Smaller + truthful beats large inaccurate polygons.
/// Paths are consumed as linear polygons (no bezier bulge).
class SkinReportRegionBuilder extends MediapipeRegionBuilder {
  const SkinReportRegionBuilder();

  /// How far from brow toward forehead-top support (0 = brow only, 1 = full top).
  /// Face Mesh has no hairline — keep well below the top support arc.
  static const foreheadRiseFactor = 0.42;

  /// Inset cheeks away from nose midline (fraction of face width).
  static const cheekNoseClearance = 0.06;

  @override
  FaceMeshFrame build({
    required FaceMeshResult mesh,
    required FaceMeshPointMapper mapper,
  }) {
    final outline = mapper.mapIndices(MediapipeLandmarkIndices.faceOval);
    final viewport = mapper.viewportSize;
    // viewport retained for API parity / future clamps
    assert(viewport.width >= 0);

    final regions = <FaceRegionPolygon>[
      _conservativeForehead(mapper, outline),
      _nose(mapper),
      _cheek(mapper, outline, isLeft: true),
      _cheek(mapper, outline, isLeft: false),
      _conservativeChin(mapper),
    ].where((r) => r.points.length >= 3).toList();

    return FaceMeshFrame(
      outline: outline,
      regions: regions,
      quality: _quality(mesh, outline, regions),
      boundingBox: _box(outline),
      debugLandmarks: mapper.mapAllLandmarks(),
      timestamp: DateTime.now(),
    );
  }

  FaceRegionPolygon _conservativeForehead(
    FaceMeshPointMapper mapper,
    List<FaceMeshPoint> outline,
  ) {
    final brow = mapper.mapIndices(SkinReportLandmarkIndices.browRidge);
    final topSupport =
        mapper.mapIndices(SkinReportLandmarkIndices.foreheadTopSupport);
    if (brow.length < 4 || topSupport.length < 3 || outline.length < 8) {
      return const FaceRegionPolygon(id: FaceRegionId.forehead, points: []);
    }

    final browY = brow.map((p) => p.y).reduce(math.max);
    final topY = topSupport.map((p) => p.y).reduce(math.min);
    final upperY = browY + (topY - browY) * foreheadRiseFactor;

    final faceMinX = outline.map((p) => p.x).reduce(math.min);
    final faceMaxX = outline.map((p) => p.x).reduce(math.max);
    final faceW = faceMaxX - faceMinX;
    final inset = faceW * 0.12;
    final leftX = faceMinX + inset;
    final rightX = faceMaxX - inset;

    final browSorted = [...brow]..sort((a, b) => a.x.compareTo(b.x));
    final upperArc = <FaceMeshPoint>[
      for (final p in browSorted)
        FaceMeshPoint(
          p.x.clamp(leftX, rightX),
          upperY + (p.y - browY) * 0.08,
        ),
    ];

    final lowerArc = browSorted.reversed
        .map(
          (p) => FaceMeshPoint(
            p.x.clamp(leftX, rightX),
            math.min(p.y - 1.0, p.y),
          ),
        )
        .toList();

    final points = <FaceMeshPoint>[...upperArc, ...lowerArc];
    if (points.length < 6) {
      return const FaceRegionPolygon(id: FaceRegionId.forehead, points: []);
    }
    return FaceRegionPolygon(id: FaceRegionId.forehead, points: points);
  }

  FaceRegionPolygon _nose(FaceMeshPointMapper mapper) {
    final points = mapper.mapIndices(SkinReportLandmarkIndices.nose);
    if (points.length < 5) {
      return const FaceRegionPolygon(id: FaceRegionId.nose, points: []);
    }
    final cx = points.map((p) => p.x).reduce((a, b) => a + b) / points.length;
    final cy = points.map((p) => p.y).reduce((a, b) => a + b) / points.length;
    final inset = points
        .map(
          (p) => FaceMeshPoint(
            cx + (p.x - cx) * 0.88,
            cy + (p.y - cy) * 0.88,
          ),
        )
        .toList();
    return FaceRegionPolygon(id: FaceRegionId.nose, points: inset);
  }

  FaceRegionPolygon _cheek(
    FaceMeshPointMapper mapper,
    List<FaceMeshPoint> outline, {
    required bool isLeft,
  }) {
    final raw = mapper.mapIndices(
      isLeft
          ? SkinReportLandmarkIndices.leftCheek
          : SkinReportLandmarkIndices.rightCheek,
    );
    if (raw.length < 5 || outline.length < 8) {
      return FaceRegionPolygon(
        id: FaceRegionId.cheek,
        points: const [],
        isLeftSide: isLeft,
      );
    }

    final faceMinX = outline.map((p) => p.x).reduce(math.min);
    final faceMaxX = outline.map((p) => p.x).reduce(math.max);
    final faceCenterX = (faceMinX + faceMaxX) / 2;
    final faceW = faceMaxX - faceMinX;
    final noseClear = faceW * cheekNoseClearance;

    final brow = mapper.mapIndices(SkinReportLandmarkIndices.browRidge);
    final lip = mapper.mapIndices(SkinReportLandmarkIndices.lowerLip);
    final browY = brow.isEmpty
        ? raw.map((p) => p.y).reduce(math.min)
        : brow.map((p) => p.y).reduce(math.max);
    final lipY = lip.isEmpty
        ? raw.map((p) => p.y).reduce(math.max)
        : lip.map((p) => p.y).reduce(math.min);

    final filtered = raw.where((p) {
      if (p.y < browY + 2) return false;
      if (p.y > lipY - 2) return false;
      if (isLeft && p.x > faceCenterX - noseClear) return false;
      if (!isLeft && p.x < faceCenterX + noseClear) return false;
      return true;
    }).toList();

    if (filtered.length < 5) {
      return FaceRegionPolygon(
        id: FaceRegionId.cheek,
        points: const [],
        isLeftSide: isLeft,
      );
    }

    final cx =
        filtered.map((p) => p.x).reduce((a, b) => a + b) / filtered.length;
    final cy =
        filtered.map((p) => p.y).reduce((a, b) => a + b) / filtered.length;
    final inset = filtered
        .map(
          (p) => FaceMeshPoint(
            cx + (p.x - cx) * 0.82,
            cy + (p.y - cy) * 0.82,
          ),
        )
        .toList();

    return FaceRegionPolygon(
      id: FaceRegionId.cheek,
      points: inset,
      isLeftSide: isLeft,
    );
  }

  FaceRegionPolygon _conservativeChin(FaceMeshPointMapper mapper) {
    final lip = mapper.mapIndices(SkinReportLandmarkIndices.lowerLip);
    final jaw = mapper.mapIndices(SkinReportLandmarkIndices.chinArcTight);
    if (lip.length < 4 || jaw.length < 4) {
      return const FaceRegionPolygon(id: FaceRegionId.chin, points: []);
    }

    final lipMaxY = lip.map((p) => p.y).reduce(math.max);
    final lipMinX = lip.map((p) => p.x).reduce(math.min);
    final lipMaxX = lip.map((p) => p.x).reduce(math.max);
    final lipW = lipMaxX - lipMinX;
    final jawMaxY = jaw.map((p) => p.y).reduce(math.max);
    final chinTopY = lipMaxY + (jawMaxY - lipMaxY) * 0.12;

    final lowerJaw = jaw
        .where(
          (p) =>
              p.y >= chinTopY &&
              p.x >= lipMinX - lipW * 0.05 &&
              p.x <= lipMaxX + lipW * 0.05,
        )
        .toList()
      ..sort((a, b) => a.x.compareTo(b.x));

    if (lowerJaw.length < 3) {
      return const FaceRegionPolygon(id: FaceRegionId.chin, points: []);
    }

    final upper = <FaceMeshPoint>[
      FaceMeshPoint(lowerJaw.first.x, chinTopY),
      FaceMeshPoint(lowerJaw.last.x, chinTopY),
    ];

    final points = <FaceMeshPoint>[...upper, ...lowerJaw.reversed];
    final cx = points.map((p) => p.x).reduce((a, b) => a + b) / points.length;
    final cy = points.map((p) => p.y).reduce((a, b) => a + b) / points.length;
    final inset = points
        .map(
          (p) => FaceMeshPoint(
            cx + (p.x - cx) * 0.85,
            cy + (p.y - cy) * 0.85,
          ),
        )
        .toList();

    return FaceRegionPolygon(id: FaceRegionId.chin, points: inset);
  }

  FaceTrackingQuality _quality(
    FaceMeshResult mesh,
    List<FaceMeshPoint> outline,
    List<FaceRegionPolygon> regions,
  ) {
    var score = mesh.score.clamp(0.0, 1.0);
    if (outline.length < 12) score -= 0.35;
    if (regions.where((r) => r.points.length >= 3).length < 5) score -= 0.25;
    if (mesh.landmarks.length < 468) score -= 0.15;
    if (score >= 0.55) return FaceTrackingQuality.high;
    if (score >= 0.30) return FaceTrackingQuality.medium;
    return FaceTrackingQuality.low;
  }

  Rect? _box(List<FaceMeshPoint> outline) {
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
}
