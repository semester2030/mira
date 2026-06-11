import 'dart:ui';

import '../face_tracking_quality.dart';

export '../face_tracking_quality.dart';

/// Anatomical regions — educational only, never diagnostic.
enum FaceRegionId {
  forehead,
  underEye,
  nose,
  cheek,
  chin,
  jawline,
}

extension FaceRegionIdLabels on FaceRegionId {
  String get labelAr => switch (this) {
        FaceRegionId.forehead => 'منطقة الجبهة',
        FaceRegionId.underEye => 'منطقة تحت العين',
        FaceRegionId.nose => 'منطقة الأنف',
        FaceRegionId.cheek => 'منطقة الخدين',
        FaceRegionId.chin => 'منطقة الذقن',
        FaceRegionId.jawline => 'خط الفك',
      };
}

enum FaceOverlayPhase {
  idle,
  faceDetected,
  meshReady,
  regionsRevealing,
  scanning,
  processing,
}

/// Camera overlay UI states.
enum LiveCameraOverlayState {
  initial,
  faceDetected,
  captured,
  analyzing,
}

/// A point in viewport (overlay) coordinates.
class FaceMeshPoint {
  final double x;
  final double y;

  const FaceMeshPoint(this.x, this.y);

  Offset toOffset() => Offset(x, y);

  FaceMeshPoint lerp(FaceMeshPoint other, double t) => FaceMeshPoint(
        x + (other.x - x) * t,
        y + (other.y - y) * t,
      );
}

/// Closed polygon for one anatomical region in viewport space.
class FaceRegionPolygon {
  final FaceRegionId id;
  final List<FaceMeshPoint> points;
  final bool isLeftSide;
  final bool suppressed;

  const FaceRegionPolygon({
    required this.id,
    required this.points,
    this.isLeftSide = false,
    this.suppressed = false,
  });

  bool get isValid => points.length >= 3 && !suppressed;

  FaceRegionPolygon lerp(FaceRegionPolygon other, double t) {
    if (points.length != other.points.length) return other;
    return FaceRegionPolygon(
      id: id,
      isLeftSide: isLeftSide,
      suppressed: t > 0.5 ? other.suppressed : suppressed,
      points: [
        for (var i = 0; i < points.length; i++)
          points[i].lerp(other.points[i], t),
      ],
    );
  }

  Path toPath({double smoothness = 0.35}) {
    final path = Path();
    if (points.length < 3) return path;

    final offsets = points.map((p) => p.toOffset()).toList();
    path.moveTo(offsets.first.dx, offsets.first.dy);

    for (var i = 0; i < offsets.length; i++) {
      final current = offsets[i];
      final next = offsets[(i + 1) % offsets.length];
      final control = Offset(
        (current.dx + next.dx) / 2,
        (current.dy + next.dy) / 2,
      );
      path.quadraticBezierTo(
        current.dx + (control.dx - current.dx) * smoothness,
        current.dy + (control.dy - current.dy) * smoothness,
        control.dx,
        control.dy,
      );
    }
    path.close();
    return path;
  }
}

/// Full face mesh frame mapped to the overlay viewport.
class FaceMeshFrame {
  final List<FaceMeshPoint> outline;
  final List<FaceRegionPolygon> regions;
  final FaceTrackingQuality quality;
  final Rect? boundingBox;
  final List<FaceMeshPoint> debugLandmarks;
  final DateTime timestamp;

  const FaceMeshFrame({
    required this.outline,
    required this.regions,
    required this.quality,
    this.boundingBox,
    this.debugLandmarks = const [],
    required this.timestamp,
  });

  static final empty = FaceMeshFrame(
    outline: [],
    regions: [],
    quality: FaceTrackingQuality.low,
    timestamp: DateTime.fromMillisecondsSinceEpoch(0),
  );

  bool get hasFace => outline.length >= 8;

  bool get hasRegions => regions.any((r) => r.points.length >= 3);

  bool get hasPaintableRegions =>
      regions.any((r) => r.points.length >= 3 && !r.suppressed);

  FaceMeshFrame lerp(FaceMeshFrame other, double t) {
    if (outline.length < 8 || other.outline.length < 8) return other;
    if (outline.length != other.outline.length) return other;

    return FaceMeshFrame(
      outline: [
        for (var i = 0; i < outline.length; i++)
          outline[i].lerp(other.outline[i], t),
      ],
      regions: [
        for (var i = 0; i < regions.length; i++)
          i < other.regions.length
              ? regions[i].lerp(other.regions[i], t)
              : regions[i],
      ],
      quality: other.quality,
      boundingBox: other.boundingBox,
      debugLandmarks: other.debugLandmarks,
      timestamp: other.timestamp,
    );
  }
}
