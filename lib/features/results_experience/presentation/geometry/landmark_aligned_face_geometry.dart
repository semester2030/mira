import 'dart:math' as math;
import 'dart:ui';

import '../../../skin_analysis/presentation/live_face_map/models/face_mesh_models.dart';
import '../../../skin_analysis/presentation/live_face_map/topology/mediapipe_landmark_indices.dart';
import 'skin_report_landmark_indices.dart';

/// Per-user Skin Map region geometry derived from MediaPipe Face Mesh.
///
/// Truth remains LANDMARK_TEMPLATE / illustrative — warping improves geometric
/// alignment only; it does NOT create pixel-level provider measurement.
///
/// Disposition vs [LuxuryFaceGeometry]:
/// - Current-user interactive face → THIS module (authoritative draw + hit).
/// - History / neutral illustrative → LuxuryFaceGeometry retained only as
///   RETAIN_ONLY_FOR_HISTORY_ILLUSTRATION.
abstract final class LandmarkAlignedFaceGeometry {
  LandmarkAlignedFaceGeometry._();

  static const disposition =
      'REMOVED_FROM_CURRENT_USER_RUNTIME;'
      'RETAIN_ONLY_FOR_HISTORY_ILLUSTRATION';

  /// Accessibility expansion around polygon (logical px). Not a giant box.
  static const accessibilityHitTolerancePx = 4.0;

  /// Critical interactive regions for Skin Face Map precision gate.
  static const criticalRegionIds = <String>[
    'forehead',
    'cheeks_right',
    'cheeks_left',
    'nose',
    'chin',
  ];

  /// Landmark index groups used to build critical regions (documentation + tests).
  static List<int> landmarkIndicesFor(String exploreId) => switch (exploreId) {
        'forehead' => [
            ...SkinReportLandmarkIndices.browRidge,
            ...SkinReportLandmarkIndices.foreheadTopSupport,
          ],
        'cheeks_left' => SkinReportLandmarkIndices.leftCheek,
        'cheeks_right' => SkinReportLandmarkIndices.rightCheek,
        'nose' => SkinReportLandmarkIndices.nose,
        'chin' => [
            ...SkinReportLandmarkIndices.lowerLip,
            ...SkinReportLandmarkIndices.chinArcTight,
          ],
        'under_eyes_left' => MediapipeLandmarkIndices.leftUnderEye,
        'under_eyes_right' => MediapipeLandmarkIndices.rightUnderEye,
        _ => const [],
      };

  /// Explore-region id → anatomical MediaPipe side mapping.
  ///
  /// RIGHT/LEFT = user's anatomical sides (not screen left/right).
  /// MediaPipe `isLeftSide: true` = subject's anatomical left.
  static String? exploreIdForPolygon(FaceRegionPolygon polygon) {
    if (!polygon.isValid) return null;
    return switch (polygon.id) {
      FaceRegionId.forehead => 'forehead',
      FaceRegionId.nose => 'nose',
      FaceRegionId.chin => 'chin',
      FaceRegionId.underEye =>
        polygon.isLeftSide ? 'under_eyes_left' : 'under_eyes_right',
      FaceRegionId.cheek =>
        polygon.isLeftSide ? 'cheeks_left' : 'cheeks_right',
      FaceRegionId.jawline => null,
    };
  }

  /// Build HIT-TEST paths — linear anatomical polygons (precision).
  /// Prefer [hitPathsFromFrame]; kept for call-site compatibility.
  static Map<String, Path> pathsFromFrame(FaceMeshFrame frame) =>
      hitPathsFromFrame(frame);

  /// Linear closed paths for tap targeting — not for production paint.
  static Map<String, Path> hitPathsFromFrame(FaceMeshFrame frame) {
    final out = <String, Path>{};
    for (final region in frame.regions) {
      final id = exploreIdForPolygon(region);
      if (id == null) continue;
      final path = region.toLinearPath();
      if (path.getBounds().isEmpty) continue;
      out.putIfAbsent(id, () => path);
    }
    return out;
  }

  /// True when all five critical regions are present and drawable.
  static bool hasCriticalRegions(Map<String, Path> paths) {
    for (final id in criticalRegionIds) {
      final path = paths[id];
      if (path == null || path.getBounds().isEmpty) return false;
    }
    return true;
  }

  /// Deterministic overlap rule: smallest containing path area wins.
  /// Does not depend on widget paint order.
  static String? hitTest({
    required Offset local,
    required Map<String, Path> paths,
    double accessibilityTolerancePx = accessibilityHitTolerancePx,
    Iterable<String>? onlyIds,
  }) {
    final ids = onlyIds?.toSet() ?? paths.keys.toSet();
    String? bestId;
    var bestArea = double.infinity;
    for (final id in ids) {
      final path = paths[id];
      if (path == null) continue;
      if (_containsWithTolerance(path, local, accessibilityTolerancePx)) {
        final area = _pathArea(path);
        if (area < bestArea) {
          bestArea = area;
          bestId = id;
        }
      }
    }
    return bestId;
  }

  /// Polygon centroid via path metrics sampling (not bounding-box center).
  static Offset? polygonCentroid(Path path, {int samples = 48}) {
    final metrics = path.computeMetrics();
    if (metrics.isEmpty) return null;
    var sumX = 0.0;
    var sumY = 0.0;
    var count = 0;
    for (final metric in metrics) {
      if (metric.length <= 0) continue;
      for (var i = 0; i < samples; i++) {
        final t = (i + 0.5) / samples;
        final tangent = metric.getTangentForOffset(metric.length * t);
        if (tangent == null) continue;
        sumX += tangent.position.dx;
        sumY += tangent.position.dy;
        count++;
      }
    }
    if (count == 0) {
      final b = path.getBounds();
      if (b.isEmpty) return null;
      return b.center;
    }
    return Offset(sumX / count, sumY / count);
  }

  /// Interior samples toward centroid from bounds (safe interior, not edges).
  static List<Offset> interiorSamplePoints(
    Path path, {
    int ringSamples = 8,
  }) {
    final centroid = polygonCentroid(path);
    final bounds = path.getBounds();
    if (centroid == null || bounds.isEmpty) return const [];

    final points = <Offset>[centroid];
    final rx = bounds.width * 0.22;
    final ry = bounds.height * 0.22;
    for (var i = 0; i < ringSamples; i++) {
      final angle = (i / ringSamples) * math.pi * 2;
      final candidate = Offset(
        centroid.dx + math.cos(angle) * rx,
        centroid.dy + math.sin(angle) * ry,
      );
      if (path.contains(candidate)) points.add(candidate);
    }
    // Half-way points between centroid and mid-edge of bounds.
    final mids = <Offset>[
      Offset(bounds.center.dx, bounds.top + bounds.height * 0.25),
      Offset(bounds.center.dx, bounds.bottom - bounds.height * 0.25),
      Offset(bounds.left + bounds.width * 0.25, bounds.center.dy),
      Offset(bounds.right - bounds.width * 0.25, bounds.center.dy),
    ];
    for (final m in mids) {
      final mid = Offset(
        (centroid.dx + m.dx) / 2,
        (centroid.dy + m.dy) / 2,
      );
      if (path.contains(mid)) points.add(mid);
    }
    return points;
  }

  /// Stable hash of normalized path bounds + centroid for differential tests.
  static String geometryHash(Path path, {Size? normalizeTo}) {
    final b = path.getBounds();
    final c = polygonCentroid(path) ?? b.center;
    final w = (normalizeTo?.width ?? 1).clamp(1.0, double.infinity);
    final h = (normalizeTo?.height ?? 1).clamp(1.0, double.infinity);
    String f(double v) => v.toStringAsFixed(4);
    return [
      f(b.left / w),
      f(b.top / h),
      f(b.width / w),
      f(b.height / h),
      f(c.dx / w),
      f(c.dy / h),
    ].join('|');
  }

  static Map<String, String> criticalHashes(
    Map<String, Path> paths, {
    required Size normalizeTo,
  }) {
    return {
      for (final id in criticalRegionIds)
        if (paths[id] != null)
          id: geometryHash(paths[id]!, normalizeTo: normalizeTo),
    };
  }

  /// Mean / max centroid displacement between two path maps (same ids).
  static ({double mean, double max}) centroidDisplacement(
    Map<String, Path> a,
    Map<String, Path> b, {
    Iterable<String> ids = criticalRegionIds,
  }) {
    var sum = 0.0;
    var max = 0.0;
    var n = 0;
    for (final id in ids) {
      final pa = a[id];
      final pb = b[id];
      if (pa == null || pb == null) continue;
      final ca = polygonCentroid(pa);
      final cb = polygonCentroid(pb);
      if (ca == null || cb == null) continue;
      final d = (ca - cb).distance;
      sum += d;
      if (d > max) max = d;
      n++;
    }
    return (mean: n == 0 ? 0.0 : sum / n, max: max);
  }

  /// True when two faces produce materially different critical region layout.
  static bool regionsDifferMaterially(
    Map<String, Path> a,
    Map<String, Path> b, {
    double minCenterDeltaPx = 4.0,
  }) {
    final keys = a.keys.toSet().intersection(b.keys.toSet());
    if (keys.isEmpty) return false;
    for (final key in keys) {
      final ca = polygonCentroid(a[key]!) ?? a[key]!.getBounds().center;
      final cb = polygonCentroid(b[key]!) ?? b[key]!.getBounds().center;
      if ((ca - cb).distance >= minCenterDeltaPx) return true;
      final aa = a[key]!.getBounds();
      final bb = b[key]!.getBounds();
      if ((aa.width - bb.width).abs() >= minCenterDeltaPx ||
          (aa.height - bb.height).abs() >= minCenterDeltaPx) {
        return true;
      }
    }
    return false;
  }

  /// Anatomical envelope check: region centroid must stay within envelope.
  static bool centroidInsideEnvelope({
    required Path region,
    required Path envelope,
  }) {
    final c = polygonCentroid(region);
    if (c == null) return false;
    return envelope.contains(c);
  }

  static Map<String, Offset> regionCentroids(Map<String, Path> paths) {
    final out = <String, Offset>{};
    for (final e in paths.entries) {
      final c = polygonCentroid(e.value);
      if (c != null) out[e.key] = c;
    }
    return out;
  }

  static bool _containsWithTolerance(
    Path path,
    Offset local,
    double tolerancePx,
  ) {
    if (path.contains(local)) return true;
    if (tolerancePx <= 0) return false;
    final inflated = path.getBounds().inflate(tolerancePx);
    if (!inflated.contains(local)) return false;
    for (var i = 0; i < 8; i++) {
      final angle = (i / 8) * math.pi * 2;
      final probe = Offset(
        local.dx + math.cos(angle) * tolerancePx,
        local.dy + math.sin(angle) * tolerancePx,
      );
      if (path.contains(probe)) return true;
    }
    return false;
  }

  static double _pathArea(Path path) {
    final b = path.getBounds();
    return b.width * b.height;
  }
}

/// Display face rect for CURRENT user — not LuxuryFaceGeometry template aspect.
abstract final class CurrentUserFaceDisplayGeometry {
  CurrentUserFaceDisplayGeometry._();

  /// Soft inset over the map canvas. Image + landmarks share this exact rect.
  static Rect faceRectIn(Size mapSize) {
    const left = 10.0;
    const top = 8.0;
    const right = 10.0;
    const bottom = 12.0;
    return Rect.fromLTWH(
      left,
      top,
      mapSize.width - left - right,
      mapSize.height - top - bottom,
    );
  }
}
