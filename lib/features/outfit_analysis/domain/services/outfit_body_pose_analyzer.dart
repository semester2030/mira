import 'dart:io';
import 'dart:math' as math;
import 'dart:ui';

import 'package:google_mlkit_pose_detection/google_mlkit_pose_detection.dart';

import '../entities/outfit_body_pose_metrics.dart';
import '../entities/outfit_body_silhouette.dart';
import 'outfit_body_silhouette_builder.dart';

/// Pose-based full-body validation — accurate model, adaptive body zones.
class OutfitBodyPoseAnalyzer {
  PoseDetector? _detector;

  PoseDetector get _poseDetector {
    _detector ??= PoseDetector(
      options: PoseDetectorOptions(
        model: PoseDetectionModel.base,
        mode: PoseDetectionMode.single,
      ),
    );
    return _detector!;
  }

  Future<OutfitBodyPoseMetrics> analyzeFile(File file) async {
    if (!await file.exists()) return OutfitBodyPoseMetrics.none;

    final input = InputImage.fromFilePath(file.path);
    final poses = await _poseDetector.processImage(input);
    if (poses.isEmpty) return OutfitBodyPoseMetrics.none;

    final pose = poses.first;
    final imageHeight = input.metadata?.size.height ?? 1920;
    final imageWidth = input.metadata?.size.width ?? 1080;
    if (imageHeight <= 0 || imageWidth <= 0) return OutfitBodyPoseMetrics.none;

    final points = _extractLandmarks(pose, imageWidth, imageHeight);
    if (points.isEmpty) return OutfitBodyPoseMetrics.none;

    final trackingScore = _trackingScore(points);
    final bodyBounds = OutfitBodySilhouetteBuilder.bodyBoundsFromLandmarks(points);
    final silhouette = _classifySilhouette(points, bodyBounds);
    final segmentRegions = OutfitBodySilhouetteBuilder.regionsFromLandmarks(
      points,
      silhouette: silhouette,
    );

    final head = _has(points, 'nose') ||
        _has(points, 'left_eye') ||
        _has(points, 'right_eye');
    final shoulders = _has(points, 'left_shoulder') || _has(points, 'right_shoulder');
    final torso = _has(points, 'left_hip') || _has(points, 'right_hip');
    final legs = _has(points, 'left_knee') || _has(points, 'right_knee');
    final feet = _ankleVisible(points['left_ankle']) || _ankleVisible(points['right_ankle']);

    return OutfitBodyPoseMetrics(
      personDetected: points.length >= 8,
      headDetected: head,
      shouldersDetected: shoulders,
      torsoDetected: torso,
      legsDetected: legs,
      feetDetected: feet,
      landmarkPoints: points,
      bodyBounds: bodyBounds,
      silhouette: silhouette,
      segmentRegions: segmentRegions,
      trackingScore: trackingScore,
    );
  }

  Map<String, Offset> _extractLandmarks(
    Pose pose,
    double imageWidth,
    double imageHeight,
  ) {
    const minLikelihood = 0.35;
    const keys = {
      PoseLandmarkType.nose: 'nose',
      PoseLandmarkType.leftEye: 'left_eye',
      PoseLandmarkType.rightEye: 'right_eye',
      PoseLandmarkType.leftEar: 'left_ear',
      PoseLandmarkType.rightEar: 'right_ear',
      PoseLandmarkType.leftShoulder: 'left_shoulder',
      PoseLandmarkType.rightShoulder: 'right_shoulder',
      PoseLandmarkType.leftElbow: 'left_elbow',
      PoseLandmarkType.rightElbow: 'right_elbow',
      PoseLandmarkType.leftWrist: 'left_wrist',
      PoseLandmarkType.rightWrist: 'right_wrist',
      PoseLandmarkType.leftHip: 'left_hip',
      PoseLandmarkType.rightHip: 'right_hip',
      PoseLandmarkType.leftKnee: 'left_knee',
      PoseLandmarkType.rightKnee: 'right_knee',
      PoseLandmarkType.leftAnkle: 'left_ankle',
      PoseLandmarkType.rightAnkle: 'right_ankle',
    };

    final out = <String, Offset>{};
    for (final entry in keys.entries) {
      final lm = pose.landmarks[entry.key];
      if (lm == null || lm.likelihood < minLikelihood) continue;
      out[entry.value] = Offset(
        (lm.x / imageWidth).clamp(0.0, 1.0),
        (lm.y / imageHeight).clamp(0.0, 1.0),
      );
    }
    return out;
  }

  double _trackingScore(Map<String, Offset> points) {
    const core = [
      'nose',
      'left_shoulder',
      'right_shoulder',
      'left_hip',
      'right_hip',
      'left_knee',
      'right_knee',
      'left_ankle',
      'right_ankle',
    ];
    var hit = 0;
    for (final key in core) {
      if (points.containsKey(key)) hit++;
    }
    return hit / core.length;
  }

  OutfitBodySilhouette _classifySilhouette(Map<String, Offset> points, Rect? bounds) {
    if (bounds == null) return OutfitBodySilhouette.average;

    final bodyHeightRatio = bounds.height;
    final shoulderWidthRatio = _span(points, 'left_shoulder', 'right_shoulder') ?? 0.3;
    final hipWidthRatio = _span(points, 'left_hip', 'right_hip') ?? shoulderWidthRatio;

    final shoulderY = _y(points, 'left_shoulder') ?? bounds.top + bounds.height * 0.15;
    final hipY = _y(points, 'left_hip') ?? bounds.top + bounds.height * 0.45;
    final ankleY = math.max(
      _y(points, 'left_ankle') ?? bounds.bottom,
      _y(points, 'right_ankle') ?? bounds.bottom,
    );
    final torso = (hipY - shoulderY).abs();
    final leg = (ankleY - hipY).abs().clamp(0.01, 1.0);
    final torsoToLegRatio = torso / leg;

    return OutfitBodySilhouetteBuilder.classify(
      bodyHeightRatio: bodyHeightRatio,
      shoulderWidthRatio: shoulderWidthRatio,
      hipWidthRatio: hipWidthRatio,
      torsoToLegRatio: torsoToLegRatio,
    );
  }

  double? _span(Map<String, Offset> points, String a, String b) {
    final pa = points[a];
    final pb = points[b];
    if (pa == null || pb == null) return null;
    return (pa.dx - pb.dx).abs();
  }

  double? _y(Map<String, Offset> points, String key) => points[key]?.dy;

  bool _has(Map<String, Offset> points, String key) => points.containsKey(key);

  bool _ankleVisible(Offset? point) {
    if (point == null) return false;
    return point.dy >= 0.55 && point.dx > 0.04 && point.dx < 0.96;
  }

  Future<void> dispose() async {
    await _detector?.close();
    _detector = null;
  }
}
