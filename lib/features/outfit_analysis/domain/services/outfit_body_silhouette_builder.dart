import 'dart:math' as math;
import 'dart:ui';

import '../entities/outfit_body_silhouette.dart';
import '../entities/outfit_segment_map.dart';

/// Builds pose-driven body zones + silhouette classification from normalized landmarks.
abstract final class OutfitBodySilhouetteBuilder {
  OutfitBodySilhouetteBuilder._();

  static const _connections = [
    ('left_shoulder', 'right_shoulder'),
    ('left_shoulder', 'left_elbow'),
    ('left_elbow', 'left_wrist'),
    ('right_shoulder', 'right_elbow'),
    ('right_elbow', 'right_wrist'),
    ('left_shoulder', 'left_hip'),
    ('right_shoulder', 'right_hip'),
    ('left_hip', 'right_hip'),
    ('left_hip', 'left_knee'),
    ('left_knee', 'left_ankle'),
    ('right_hip', 'right_knee'),
    ('right_knee', 'right_ankle'),
    ('nose', 'left_shoulder'),
    ('nose', 'right_shoulder'),
  ];

  static List<(String, String)> get skeletonConnections => _connections;

  static OutfitBodySilhouette classify({
    required double bodyHeightRatio,
    required double shoulderWidthRatio,
    required double hipWidthRatio,
    required double torsoToLegRatio,
  }) {
    if (bodyHeightRatio >= 0.78 && shoulderWidthRatio <= 0.36) {
      return OutfitBodySilhouette.tall;
    }
    if (shoulderWidthRatio >= 0.40 ||
        hipWidthRatio >= 0.38 ||
        (shoulderWidthRatio >= 0.36 && bodyHeightRatio <= 0.72)) {
      return OutfitBodySilhouette.plusSize;
    }
    if (bodyHeightRatio <= 0.66 ||
        (shoulderWidthRatio <= 0.28 && bodyHeightRatio <= 0.74)) {
      return OutfitBodySilhouette.petite;
    }
    return OutfitBodySilhouette.average;
  }

  static Rect? bodyBoundsFromLandmarks(Map<String, Offset> points) {
    if (points.length < 6) return null;
    var minX = 1.0;
    var minY = 1.0;
    var maxX = 0.0;
    var maxY = 0.0;
    for (final p in points.values) {
      minX = math.min(minX, p.dx);
      minY = math.min(minY, p.dy);
      maxX = math.max(maxX, p.dx);
      maxY = math.max(maxY, p.dy);
    }
    if (maxX <= minX || maxY <= minY) return null;

    final padX = (maxX - minX) * 0.08;
    final padY = (maxY - minY) * 0.05;
    return Rect.fromLTRB(
      (minX - padX).clamp(0.0, 1.0),
      (minY - padY).clamp(0.0, 1.0),
      (maxX + padX).clamp(0.0, 1.0),
      (maxY + padY).clamp(0.0, 1.0),
    );
  }

  static List<OutfitSegmentRegion> regionsFromLandmarks(
    Map<String, Offset> points, {
    OutfitBodySilhouette silhouette = OutfitBodySilhouette.average,
  }) {
    if (points.length < 8) return const [];

    final nose = points['nose'];
    final lShoulder = points['left_shoulder'];
    final rShoulder = points['right_shoulder'];
    final lHip = points['left_hip'];
    final rHip = points['right_hip'];
    final lKnee = points['left_knee'];
    final rKnee = points['right_knee'];
    final lAnkle = points['left_ankle'];
    final rAnkle = points['right_ankle'];

    final topY = _minY([nose, lShoulder, rShoulder]) ?? 0.08;
    final shoulderY = _avgY([lShoulder, rShoulder]) ?? topY + 0.12;
    final hipY = _avgY([lHip, rHip]) ?? shoulderY + 0.22;
    final kneeY = _avgY([lKnee, rKnee]) ?? hipY + 0.18;
    final ankleY = _maxY([lAnkle, rAnkle]) ?? kneeY + 0.16;

    final shoulderSpan = _spanX(lShoulder, rShoulder) ?? 0.32;
    final hipSpan = _spanX(lHip, rHip) ?? shoulderSpan;
    final widthFactor = silhouette.widthPaddingFactor;
    final upperWidth = math.max(shoulderSpan, hipSpan * 0.92) * widthFactor;
    final lowerWidth = math.max(hipSpan, shoulderSpan * 0.88) * widthFactor;
    final centerX = _avgX([lShoulder, rShoulder, lHip, rHip]) ?? 0.5;

    Rect band(double top, double bottom, double width) {
      final h = (bottom - top).clamp(0.04, 0.45);
      final w = width.clamp(0.18, 0.72);
      return Rect.fromLTWH(
        (centerX - w / 2).clamp(0.0, 1.0 - w),
        top.clamp(0.0, 0.92),
        w,
        h,
      );
    }

    final headBottom = shoulderY - 0.02;
    final headTop = (topY - 0.04).clamp(0.0, headBottom - 0.06);

    final lWrist = points['left_wrist'];
    final rWrist = points['right_wrist'];
    final feetVisible = lAnkle != null &&
        rAnkle != null &&
        ((lAnkle.dy >= 0.68) || (rAnkle.dy >= 0.68));
    final handsVisible = lWrist != null || rWrist != null;

    final regions = <OutfitSegmentRegion>[
      OutfitSegmentRegion(
        zone: OutfitSegmentZone.head,
        normalizedRect: band(headTop, headBottom, shoulderSpan * 0.55),
        labelAr: 'الرأس',
        labelEn: 'Head',
        confidence: 0,
      ),
      OutfitSegmentRegion(
        zone: OutfitSegmentZone.upperBody,
        normalizedRect: band(shoulderY - 0.02, hipY - 0.04, upperWidth),
        labelAr: 'الجزء العلوي',
        labelEn: 'Upper body',
        confidence: 0,
      ),
      OutfitSegmentRegion(
        zone: OutfitSegmentZone.waist,
        normalizedRect: band(hipY - 0.05, hipY + 0.06, hipSpan * 0.78),
        labelAr: 'الخصر',
        labelEn: 'Waist',
        confidence: 0,
      ),
      OutfitSegmentRegion(
        zone: OutfitSegmentZone.lowerBody,
        normalizedRect: band(hipY + 0.02, kneeY + 0.04, lowerWidth),
        labelAr: 'الجزء السفلي',
        labelEn: 'Lower body',
        confidence: 0,
      ),
    ];

    if (feetVisible) {
      regions.add(
        OutfitSegmentRegion(
          zone: OutfitSegmentZone.feet,
          normalizedRect: band(kneeY + 0.02, ankleY + 0.04, lowerWidth * 0.82),
          labelAr: 'الجزء السفلي',
          labelEn: 'Feet zone',
          confidence: 0,
        ),
      );
    }

    if (handsVisible) {
      regions.add(
        OutfitSegmentRegion(
          zone: OutfitSegmentZone.accessories,
          normalizedRect: Rect.fromLTWH(
            (centerX + upperWidth * 0.32).clamp(0.0, 0.78),
            (shoulderY + 0.04).clamp(0.0, 0.72),
            0.18,
            0.16,
          ),
          labelAr: 'الجزء العلوي',
          labelEn: 'Hand zone',
          confidence: 0,
        ),
      );
    }

    return regions;
  }

  static double? _avgY(List<Offset?> points) {
    final ys = points.whereType<Offset>().map((p) => p.dy).toList();
    if (ys.isEmpty) return null;
    return ys.reduce((a, b) => a + b) / ys.length;
  }

  static double? _minY(List<Offset?> points) {
    final ys = points.whereType<Offset>().map((p) => p.dy).toList();
    if (ys.isEmpty) return null;
    return ys.reduce(math.min);
  }

  static double? _maxY(List<Offset?> points) {
    final ys = points.whereType<Offset>().map((p) => p.dy).toList();
    if (ys.isEmpty) return null;
    return ys.reduce(math.max);
  }

  static double? _avgX(List<Offset?> points) {
    final xs = points.whereType<Offset>().map((p) => p.dx).toList();
    if (xs.isEmpty) return null;
    return xs.reduce((a, b) => a + b) / xs.length;
  }

  static double? _spanX(Offset? a, Offset? b) {
    if (a == null || b == null) return null;
    return (a.dx - b.dx).abs();
  }
}
