import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:mediapipe_face_mesh/mediapipe_face_mesh.dart';
import 'package:mirra/features/face_analysis_experience/presentation/capture/geometry/capture_guide_geometry.dart';
import 'package:mirra/features/skin_analysis/presentation/live_face_map/face_mesh_head_pose.dart';
import 'package:mirra/features/skin_analysis/presentation/live_face_map/face_mesh_quality_gate.dart';
import 'package:mirra/features/skin_analysis/presentation/live_face_map/models/face_mesh_models.dart';
import 'package:mirra/features/skin_analysis/presentation/live_face_map/topology/mediapipe_landmark_indices.dart';
import 'package:mirra/features/skin_analysis/presentation/live_face_map/utils/region_path_utils.dart';
import 'package:mirra/features/results_experience/presentation/geometry/skin_report_landmark_indices.dart';

void main() {
  group('cheek landmark indices', () {
    test('live cheeks exclude under-eye bleed points', () {
      const underEyeBleedLeft = {117, 118, 119, 120, 121, 128, 245, 189};
      const underEyeBleedRight = {
        347, 346, 340, 265, 261, 448, 449, 450, 451, 452, 453, 412,
      };
      expect(
        MediapipeLandmarkIndices.leftCheek
            .toSet()
            .intersection(underEyeBleedLeft),
        isEmpty,
      );
      expect(
        MediapipeLandmarkIndices.rightCheek
            .toSet()
            .intersection(underEyeBleedRight),
        isEmpty,
      );
    });

    test('report cheeks alias live malar sets (single source)', () {
      expect(
        SkinReportLandmarkIndices.leftCheek,
        MediapipeLandmarkIndices.leftCheek,
      );
      expect(
        SkinReportLandmarkIndices.rightCheek,
        MediapipeLandmarkIndices.rightCheek,
      );
    });

    test('left/right cheek lists are anatomical (not mirrored copies)', () {
      expect(
        MediapipeLandmarkIndices.leftCheek
            .toSet()
            .intersection(MediapipeLandmarkIndices.rightCheek.toSet()),
        isEmpty,
      );
    });
  });

  group('centerY equation', () {
    test('is guide-relative drift, not absolute normalized Y', () {
      const viewport = Size(390, 700);
      final guide = CaptureGuideGeometry.illustrativeOval(viewport);
      // Face AABB perfectly matching guide → drift 0
      final (cx, cy, scale) = CaptureGuideGeometry.meshMetrics(
        boundingBox: guide,
        viewport: viewport,
      );
      expect(cx, closeTo(0, 1e-9));
      expect(cy, closeTo(0, 1e-9));
      expect(scale, closeTo(1.0, 1e-9));

      // Absolute Y of guide center ≈ 0.48 — must NOT be reported as centerY
      final absNormY = guide.center.dy / viewport.height;
      expect(absNormY, closeTo(0.48, 0.001));
      expect(cy, isNot(closeTo(absNormY, 0.1)));
    });

    test('off-center down fails maxCenterDriftY', () {
      const viewport = Size(390, 700);
      final guide = CaptureGuideGeometry.illustrativeOval(viewport);
      final low = guide.translate(0, guide.height * 0.25);
      final (_, cy, _) = CaptureGuideGeometry.meshMetrics(
        boundingBox: low,
        viewport: viewport,
      );
      expect(cy!.abs(), greaterThan(FaceMeshQualityGate.maxCenterDriftY));
      expect(
        FaceMeshQualityGate.evaluate(
          FaceMeshFrame(
            outline: [
              for (var i = 0; i < 8; i++) FaceMeshPoint(i.toDouble(), i.toDouble()),
            ],
            regions: const [],
            quality: FaceTrackingQuality.high,
            boundingBox: low,
            timestamp: DateTime.fromMillisecondsSinceEpoch(1),
            yawDegrees: 0,
            pitchDegrees: 0,
            rollDegrees: 0,
          ),
          guide,
        ).reasonCode,
        anyOf('face_off_center', 'mesh_region_missing'),
      );
    });
  });

  group('head pose from landmarks', () {
    List<FaceMeshLandmark> _frontalLandmarks() {
      // Build a sparse 468 list with key anchors near frontal.
      return List<FaceMeshLandmark>.generate(468, (i) {
        return FaceMeshLandmark(x: 0.5, y: 0.5, z: 0);
      })
        ..[MediapipeLandmarkIndices.geometryLeftEyeOuter] =
            FaceMeshLandmark(x: 0.35, y: 0.42, z: -0.02)
        ..[MediapipeLandmarkIndices.geometryRightEyeOuter] =
            FaceMeshLandmark(x: 0.65, y: 0.42, z: -0.02)
        ..[MediapipeLandmarkIndices.geometryNoseTip] =
            FaceMeshLandmark(x: 0.5, y: 0.52, z: -0.08)
        ..[MediapipeLandmarkIndices.geometryChin] =
            FaceMeshLandmark(x: 0.5, y: 0.78, z: 0.01)
        ..[MediapipeLandmarkIndices.geometryForeheadTop] =
            FaceMeshLandmark(x: 0.5, y: 0.22, z: 0.01)
        ..[MediapipeLandmarkIndices.geometryLeftFace] =
            FaceMeshLandmark(x: 0.28, y: 0.55, z: 0.0)
        ..[MediapipeLandmarkIndices.geometryRightFace] =
            FaceMeshLandmark(x: 0.72, y: 0.55, z: 0.0);
    }

    test('frontal synthetic pose is within strict limits', () {
      final pose = FaceMeshHeadPoseEstimator.fromLandmarks(_frontalLandmarks());
      expect(pose, isNotNull);
      expect(pose!.yawDegrees.abs(), lessThan(FaceMeshQualityGate.maxYawDegrees));
      expect(pose.pitchDegrees.abs(), lessThan(2),
          reason: 'frontal face-plane pitch must be ~0, not nose protrusion');
      expect(pose.rollDegrees.abs(), lessThan(FaceMeshQualityGate.maxRollDegrees));
    });

    test('asymmetric face depth increases |yaw|', () {
      final turned = _frontalLandmarks()
        ..[MediapipeLandmarkIndices.geometryLeftFace] =
            FaceMeshLandmark(x: 0.28, y: 0.55, z: 0.12)
        ..[MediapipeLandmarkIndices.geometryRightFace] =
            FaceMeshLandmark(x: 0.72, y: 0.55, z: -0.12);
      final pose = FaceMeshHeadPoseEstimator.fromLandmarks(turned)!;
      expect(pose.yawDegrees.abs(), greaterThan(5));
    });

    test('tilted eye line increases |roll|', () {
      final tilted = _frontalLandmarks()
        ..[MediapipeLandmarkIndices.geometryLeftEyeOuter] =
            FaceMeshLandmark(x: 0.35, y: 0.38, z: -0.02)
        ..[MediapipeLandmarkIndices.geometryRightEyeOuter] =
            FaceMeshLandmark(x: 0.65, y: 0.48, z: -0.02);
      final pose = FaceMeshHeadPoseEstimator.fromLandmarks(tilted)!;
      expect(pose.rollDegrees.abs(), greaterThan(5));
    });
  });

  group('malar cheek suppress', () {
    test('compact cheek polygon is not suppressed by area/midline', () {
      const viewport = Size(390, 700);
      // Face oval roughly filling center.
      final oval = <FaceMeshPoint>[
        const FaceMeshPoint(120, 120),
        const FaceMeshPoint(270, 120),
        const FaceMeshPoint(300, 350),
        const FaceMeshPoint(270, 580),
        const FaceMeshPoint(120, 580),
        const FaceMeshPoint(90, 350),
      ];
      // Left cheek — left of midline, modest area.
      final leftCheek = <FaceMeshPoint>[
        const FaceMeshPoint(130, 300),
        const FaceMeshPoint(175, 290),
        const FaceMeshPoint(180, 360),
        const FaceMeshPoint(135, 370),
      ];
      expect(
        RegionPathUtils.suppressReason(
          id: FaceRegionId.cheek,
          points: leftCheek,
          faceOval: oval,
          isLeftSide: true,
          viewportSize: viewport,
        ),
        isNull,
      );
    });
  });
}
