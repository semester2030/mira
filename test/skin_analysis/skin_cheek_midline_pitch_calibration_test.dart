import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:mediapipe_face_mesh/mediapipe_face_mesh.dart';
import 'package:mirra/features/skin_analysis/presentation/live_face_map/face_mesh_head_pose.dart';
import 'package:mirra/features/skin_analysis/presentation/live_face_map/face_mesh_quality_gate.dart';
import 'package:mirra/features/skin_analysis/presentation/live_face_map/models/face_mesh_models.dart';
import 'package:mirra/features/skin_analysis/presentation/live_face_map/topology/mediapipe_landmark_indices.dart';
import 'package:mirra/features/skin_analysis/presentation/live_face_map/utils/region_path_utils.dart';

void main() {
  const viewport = Size(390, 700);

  final oval = <FaceMeshPoint>[
    const FaceMeshPoint(100, 100),
    const FaceMeshPoint(290, 100),
    const FaceMeshPoint(320, 360),
    const FaceMeshPoint(290, 600),
    const FaceMeshPoint(100, 600),
    const FaceMeshPoint(70, 360),
  ];

  /// Anatomical midline ≈ nose X (not oval mean).
  const anatomicalMidlineX = 195.0;

  group('anatomical cheek midline', () {
    test('left malar near nose does not trip cheek_crossed_midline', () {
      // Centroid is close to midline (would fail old ±2% oval-mean rule).
      final leftCheek = <FaceMeshPoint>[
        const FaceMeshPoint(120, 300),
        const FaceMeshPoint(185, 295),
        const FaceMeshPoint(190, 370),
        const FaceMeshPoint(125, 375),
      ];
      expect(
        RegionPathUtils.suppressReason(
          id: FaceRegionId.cheek,
          points: leftCheek,
          faceOval: oval,
          isLeftSide: true,
          viewportSize: viewport,
          anatomicalMidlineX: anatomicalMidlineX,
        ),
        isNull,
      );
    });

    test('right malar near nose does not trip cheek_crossed_midline', () {
      final rightCheek = <FaceMeshPoint>[
        const FaceMeshPoint(205, 295),
        const FaceMeshPoint(270, 300),
        const FaceMeshPoint(265, 375),
        const FaceMeshPoint(200, 370),
      ];
      expect(
        RegionPathUtils.suppressReason(
          id: FaceRegionId.cheek,
          points: rightCheek,
          faceOval: oval,
          isLeftSide: false,
          viewportSize: viewport,
          anatomicalMidlineX: anatomicalMidlineX,
        ),
        isNull,
      );
    });

    test('left cheek wholly on right of midline is suppressed', () {
      final swapped = <FaceMeshPoint>[
        const FaceMeshPoint(220, 300),
        const FaceMeshPoint(270, 300),
        const FaceMeshPoint(270, 370),
        const FaceMeshPoint(220, 370),
      ];
      expect(
        RegionPathUtils.suppressReason(
          id: FaceRegionId.cheek,
          points: swapped,
          faceOval: oval,
          isLeftSide: true,
          viewportSize: viewport,
          anatomicalMidlineX: anatomicalMidlineX,
        ),
        'cheek_crossed_midline',
      );
    });

    test('right/left semantics: anatomical left expects majority x < midline', () {
      final left = <FaceMeshPoint>[
        const FaceMeshPoint(110, 300),
        const FaceMeshPoint(160, 300),
        const FaceMeshPoint(160, 360),
        const FaceMeshPoint(110, 360),
      ];
      final right = <FaceMeshPoint>[
        const FaceMeshPoint(230, 300),
        const FaceMeshPoint(280, 300),
        const FaceMeshPoint(280, 360),
        const FaceMeshPoint(230, 360),
      ];
      expect(
        RegionPathUtils.suppressReason(
          id: FaceRegionId.cheek,
          points: left,
          faceOval: oval,
          isLeftSide: true,
          viewportSize: viewport,
          anatomicalMidlineX: anatomicalMidlineX,
        ),
        isNull,
      );
      expect(
        RegionPathUtils.suppressReason(
          id: FaceRegionId.cheek,
          points: right,
          faceOval: oval,
          isLeftSide: false,
          viewportSize: viewport,
          anatomicalMidlineX: anatomicalMidlineX,
        ),
        isNull,
      );
      // Labels must not pass when sides are swapped.
      expect(
        RegionPathUtils.suppressReason(
          id: FaceRegionId.cheek,
          points: left,
          faceOval: oval,
          isLeftSide: false,
          viewportSize: viewport,
          anatomicalMidlineX: anatomicalMidlineX,
        ),
        'cheek_crossed_midline',
      );
    });
  });

  group('pitch zero calibration', () {
    List<FaceMeshLandmark> landmarks({
      required double foreheadZ,
      required double chinZ,
      double noseZ = -0.08,
    }) {
      return List<FaceMeshLandmark>.generate(468, (i) {
        return FaceMeshLandmark(x: 0.5, y: 0.5, z: 0);
      })
        ..[MediapipeLandmarkIndices.geometryLeftEyeOuter] =
            FaceMeshLandmark(x: 0.35, y: 0.42, z: -0.02)
        ..[MediapipeLandmarkIndices.geometryRightEyeOuter] =
            FaceMeshLandmark(x: 0.65, y: 0.42, z: -0.02)
        ..[MediapipeLandmarkIndices.geometryNoseTip] =
            FaceMeshLandmark(x: 0.5, y: 0.52, z: noseZ)
        ..[MediapipeLandmarkIndices.geometryChin] =
            FaceMeshLandmark(x: 0.5, y: 0.78, z: chinZ)
        ..[MediapipeLandmarkIndices.geometryForeheadTop] =
            FaceMeshLandmark(x: 0.5, y: 0.22, z: foreheadZ)
        ..[MediapipeLandmarkIndices.geometryLeftFace] =
            FaceMeshLandmark(x: 0.28, y: 0.55, z: 0.0)
        ..[MediapipeLandmarkIndices.geometryRightFace] =
            FaceMeshLandmark(x: 0.72, y: 0.55, z: 0.0);
    }

    test('legacy nose-protrusion pitch has large frontal baseline', () {
      // Deeper nose (MediaPipe units) matches physical frontal ~15–18°.
      final frontal = landmarks(foreheadZ: 0.02, chinZ: 0.02, noseZ: -0.16);
      final legacy =
          FaceMeshHeadPoseEstimator.legacyNoseProtrusionPitchDegrees(frontal);
      expect(legacy, greaterThan(12));
      expect(legacy, lessThan(30));
      // Calibrated estimator on same landmarks stays near zero.
      final calibrated =
          FaceMeshHeadPoseEstimator.fromLandmarks(frontal)!.pitchDegrees;
      expect(calibrated.abs(), lessThan(2));
    });

    test('calibrated frontal pitch is near zero (limit unchanged at 15°)', () {
      final frontal = landmarks(foreheadZ: 0.01, chinZ: 0.01, noseZ: -0.08);
      final pose = FaceMeshHeadPoseEstimator.fromLandmarks(frontal)!;
      expect(pose.pitchDegrees.abs(), lessThan(2));
      expect(FaceMeshQualityGate.maxPitchDegrees, 15.0);
    });

    test('look up increases pitch; look down decreases', () {
      final up = FaceMeshHeadPoseEstimator.fromLandmarks(
        landmarks(foreheadZ: -0.04, chinZ: 0.06),
      )!;
      final down = FaceMeshHeadPoseEstimator.fromLandmarks(
        landmarks(foreheadZ: 0.06, chinZ: -0.04),
      )!;
      expect(up.pitchDegrees, greaterThan(5));
      expect(down.pitchDegrees, lessThan(-5));
    });
  });
}
