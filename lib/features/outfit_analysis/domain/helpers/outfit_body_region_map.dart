import 'dart:ui';

import '../entities/outfit_body_pose_metrics.dart';
import '../entities/outfit_segment_map.dart';
import '../services/outfit_body_silhouette_builder.dart';

/// Pose-derived body structure — gates garment detection by visible anatomy.
class OutfitBodyRegionMap {
  final Rect upperBody;
  final Rect lowerBody;
  final Rect? feet;
  final Rect? neck;
  final Rect? leftHand;
  final Rect? rightHand;

  final bool feetVisible;
  final bool neckVisible;
  final bool handsVisible;
  final bool poseReliable;

  const OutfitBodyRegionMap({
    required this.upperBody,
    required this.lowerBody,
    this.feet,
    this.neck,
    this.leftHand,
    this.rightHand,
    this.feetVisible = false,
    this.neckVisible = false,
    this.handsVisible = false,
    this.poseReliable = false,
  });

  static const empty = OutfitBodyRegionMap(
    upperBody: Rect.fromLTWH(0.22, 0.14, 0.56, 0.30),
    lowerBody: Rect.fromLTWH(0.24, 0.46, 0.52, 0.32),
    poseReliable: false,
  );

  factory OutfitBodyRegionMap.fromPose(OutfitBodyPoseMetrics pose) {
    if (pose.landmarkPoints.length < 8) return empty;

    final points = pose.landmarkPoints;
    final bands = OutfitBodySilhouetteBuilder.regionsFromLandmarks(
      points,
      silhouette: pose.silhouette,
    );

    Rect? band(OutfitSegmentZone zone) =>
        bands.where((b) => b.zone == zone).map((b) => b.normalizedRect).firstOrNull;

    final upper = band(OutfitSegmentZone.upperBody) ?? empty.upperBody;
    final lower = band(OutfitSegmentZone.lowerBody) ?? empty.lowerBody;

    final lWrist = points['left_wrist'];
    final rWrist = points['right_wrist'];
    final lAnkle = points['left_ankle'];
    final rAnkle = points['right_ankle'];
    final nose = points['nose'];
    final lShoulder = points['left_shoulder'];
    final rShoulder = points['right_shoulder'];

    final feetVis = pose.feetDetected &&
        ((lAnkle?.dy ?? 0) >= 0.72 || (rAnkle?.dy ?? 0) >= 0.72);
    final neckVis = pose.headDetected &&
        pose.shouldersDetected &&
        (lShoulder != null && rShoulder != null && nose != null);
    final handsVis = lWrist != null || rWrist != null;

    Rect? neckRect;
    if (neckVis && lShoulder != null && rShoulder != null && nose != null) {
      final top = nose.dy;
      final bottom = (lShoulder.dy + rShoulder.dy) / 2;
      final cx = (lShoulder.dx + rShoulder.dx) / 2;
      final w = (lShoulder.dx - rShoulder.dx).abs().clamp(0.12, 0.35);
      neckRect = Rect.fromLTWH(
        (cx - w / 2).clamp(0, 1 - w),
        top.clamp(0, 0.9),
        w,
        (bottom - top).clamp(0.04, 0.14),
      );
    }

    Rect? handRect(Offset? wrist, Offset? shoulder) {
      if (wrist == null || shoulder == null) return null;
      return Rect.fromCenter(
        center: Offset(wrist.dx, (wrist.dy + shoulder.dy) / 2),
        width: 0.14,
        height: 0.12,
      );
    }

    return OutfitBodyRegionMap(
      upperBody: upper,
      lowerBody: lower,
      feet: feetVis ? band(OutfitSegmentZone.feet) : null,
      neck: neckRect,
      leftHand: handRect(points['left_wrist'], points['left_shoulder']),
      rightHand: handRect(points['right_wrist'], points['right_shoulder']),
      feetVisible: feetVis,
      neckVisible: neckVis,
      handsVisible: handsVis,
      poseReliable: pose.hasDetailedTracking,
    );
  }

  Rect bandForZone(OutfitSegmentZone zone) {
    return switch (zone) {
      OutfitSegmentZone.upperBody => upperBody,
      OutfitSegmentZone.lowerBody => lowerBody,
      OutfitSegmentZone.feet => feet ?? lowerBody,
      OutfitSegmentZone.waist => _waistBand(),
      OutfitSegmentZone.accessories => _accessoryBand(),
      OutfitSegmentZone.head => upperBody,
    };
  }

  Rect _waistBand() {
    return Rect.fromLTRB(
      lowerBody.left,
      upperBody.bottom - 0.04,
      lowerBody.right,
      lowerBody.top + 0.06,
    );
  }

  Rect _accessoryBand() {
    if (leftHand != null && rightHand != null) {
      final hands = leftHand!.expandToInclude(rightHand!);
      return Rect.fromLTRB(
        (hands.left - 0.06).clamp(0, 1),
        (hands.top - 0.04).clamp(0, 1),
        (hands.right + 0.06).clamp(0, 1),
        (hands.bottom + 0.22).clamp(0, 1),
      );
    }
    return Rect.fromLTWH(
      upperBody.right - 0.10,
      upperBody.top + 0.04,
      0.28,
      upperBody.height * 0.72,
    );
  }
}

extension _FirstOrNull<E> on Iterable<E> {
  E? get firstOrNull {
    final it = iterator;
    if (!it.moveNext()) return null;
    return it.current;
  }
}
