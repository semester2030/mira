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

  /// Linear closed polygon — preferred for Skin Report (no bezier bulge).
  Path toLinearPath() {
    if (points.length < 3) return Path();
    return Path()
      ..addPolygon(
        points.map((p) => p.toOffset()).toList(growable: false),
        true,
      );
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

  /// Live head pose from MediaPipe 3D landmarks (degrees). Null if unavailable.
  final double? yawDegrees;
  final double? pitchDegrees;
  final double? rollDegrees;

  /// Anatomical midline X in viewport space (nose/brow/chin axis).
  final double? anatomicalMidlineX;
  final List<FaceMeshPoint> midlineAnchors;
  /// Derived from landmarks 234 vs 454 in the same viewport space.
  final bool anatomicalLeftIsLowerX;

  const FaceMeshFrame({
    required this.outline,
    required this.regions,
    required this.quality,
    this.boundingBox,
    this.debugLandmarks = const [],
    required this.timestamp,
    this.yawDegrees,
    this.pitchDegrees,
    this.rollDegrees,
    this.anatomicalMidlineX,
    this.midlineAnchors = const [],
    this.anatomicalLeftIsLowerX = true,
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

    final lerpedOutline = [
      for (var i = 0; i < outline.length; i++)
        outline[i].lerp(other.outline[i], t),
    ];
    final xs = lerpedOutline.map((p) => p.x);
    final ys = lerpedOutline.map((p) => p.y);
    final lerpedBox = Rect.fromLTRB(
      xs.reduce((a, b) => a < b ? a : b),
      ys.reduce((a, b) => a < b ? a : b),
      xs.reduce((a, b) => a > b ? a : b),
      ys.reduce((a, b) => a > b ? a : b),
    );

    return FaceMeshFrame(
      outline: lerpedOutline,
      regions: [
        for (var i = 0; i < regions.length; i++)
          i < other.regions.length
              ? regions[i].lerp(other.regions[i], t)
              : regions[i],
      ],
      quality: other.quality,
      boundingBox: lerpedBox,
      debugLandmarks: other.debugLandmarks,
      timestamp: other.timestamp,
      yawDegrees: other.yawDegrees,
      pitchDegrees: other.pitchDegrees,
      rollDegrees: other.rollDegrees,
      anatomicalMidlineX: other.anatomicalMidlineX,
      midlineAnchors: other.midlineAnchors,
      anatomicalLeftIsLowerX: other.anatomicalLeftIsLowerX,
    );
  }
}
