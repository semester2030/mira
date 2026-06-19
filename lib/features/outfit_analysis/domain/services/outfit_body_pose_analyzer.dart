import 'dart:io';

import 'package:google_mlkit_pose_detection/google_mlkit_pose_detection.dart';

import '../entities/outfit_body_pose_metrics.dart';

/// Pose-based full-body validation — runs on frozen/temp files only (iOS-safe).
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

    final head = _hasLandmark(pose, PoseLandmarkType.nose) ||
        _hasLandmark(pose, PoseLandmarkType.leftEye) ||
        _hasLandmark(pose, PoseLandmarkType.rightEye);

    final shoulders = _hasLandmark(pose, PoseLandmarkType.leftShoulder) ||
        _hasLandmark(pose, PoseLandmarkType.rightShoulder);

    final torso = _hasLandmark(pose, PoseLandmarkType.leftHip) ||
        _hasLandmark(pose, PoseLandmarkType.rightHip);

    final legs = _hasLandmark(pose, PoseLandmarkType.leftKnee) ||
        _hasLandmark(pose, PoseLandmarkType.rightKnee);

    final leftAnkle = pose.landmarks[PoseLandmarkType.leftAnkle];
    final rightAnkle = pose.landmarks[PoseLandmarkType.rightAnkle];
    final feet = _ankleVisible(leftAnkle, imageHeight, imageWidth) ||
        _ankleVisible(rightAnkle, imageHeight, imageWidth);

    return OutfitBodyPoseMetrics(
      personDetected: pose.landmarks.length >= 8,
      headDetected: head,
      shouldersDetected: shoulders,
      torsoDetected: torso,
      legsDetected: legs,
      feetDetected: feet,
    );
  }

  bool _hasLandmark(Pose pose, PoseLandmarkType type) {
    final landmark = pose.landmarks[type];
    return landmark != null && landmark.likelihood >= 0.42;
  }

  bool _ankleVisible(PoseLandmark? landmark, double imageHeight, double imageWidth) {
    if (landmark == null || landmark.likelihood < 0.38) return false;
    if (imageHeight <= 0 || imageWidth <= 0) return true;
    final yNorm = landmark.y / imageHeight;
    final xNorm = landmark.x / imageWidth;
    return yNorm >= 0.58 && xNorm > 0.05 && xNorm < 0.95;
  }

  Future<void> dispose() async {
    await _detector?.close();
    _detector = null;
  }
}
