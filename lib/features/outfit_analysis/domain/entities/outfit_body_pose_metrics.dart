import 'dart:ui';

import 'outfit_body_silhouette.dart';
import 'outfit_segment_map.dart';

/// Deterministic body pose signals for full-body outfit capture.
class OutfitBodyPoseMetrics {
  final bool personDetected;
  final bool headDetected;
  final bool shouldersDetected;
  final bool torsoDetected;
  final bool legsDetected;
  final bool feetDetected;

  /// Normalized landmark positions (0–1), keys e.g. `left_shoulder`.
  final Map<String, Offset> landmarkPoints;

  /// Full-body bounding box in normalized image space.
  final Rect? bodyBounds;

  /// Classified body shape for adaptive framing.
  final OutfitBodySilhouette silhouette;

  /// Pose-driven clothing zones (empty when landmarks insufficient).
  final List<OutfitSegmentRegion> segmentRegions;

  /// 0–1 aggregate landmark confidence.
  final double trackingScore;

  const OutfitBodyPoseMetrics({
    this.personDetected = false,
    this.headDetected = false,
    this.shouldersDetected = false,
    this.torsoDetected = false,
    this.legsDetected = false,
    this.feetDetected = false,
    this.landmarkPoints = const {},
    this.bodyBounds,
    this.silhouette = OutfitBodySilhouette.average,
    this.segmentRegions = const [],
    this.trackingScore = 0,
  });

  static const none = OutfitBodyPoseMetrics();

  bool get hasDetailedTracking => landmarkPoints.length >= 10 && trackingScore >= 0.45;

  bool get isFullBodyReady =>
      personDetected &&
      headDetected &&
      shouldersDetected &&
      torsoDetected &&
      legsDetected &&
      feetDetected;

  /// Minimum pose for post-capture acceptance when quality is good.
  bool get isCaptureAcceptable =>
      personDetected &&
      headDetected &&
      (shouldersDetected || torsoDetected);
}
