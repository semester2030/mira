import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/face_gate/face_gate_rules.dart';
import 'package:mirra/features/face_analysis_experience/capture/policy/strict_frontal_capture_policy.dart';
import 'package:mirra/features/results_experience/presentation/geometry/landmark_aligned_face_geometry.dart';
import 'package:mirra/features/skin_analysis/presentation/live_face_map/models/face_mesh_models.dart';

void main() {
  group('StrictFrontalCapturePolicy', () {
    test('pose limits promote warnCombined band — not legacy 35/30/28', () {
      expect(StrictFrontalCapturePolicy.maxYawDegrees, 15);
      expect(StrictFrontalCapturePolicy.maxPitchDegrees, 15);
      expect(StrictFrontalCapturePolicy.maxRollDegrees, 12);
      expect(StrictFrontalCapturePolicy.maxCenterOffsetX, 0.13);
      expect(StrictFrontalCapturePolicy.maxCenterOffsetY, 0.11);
      expect(StrictFrontalCapturePolicy.version, 'strict-frontal-skin-v1');
    });

    test('strict gate rejects pose accepted by legacy cq-v2.1', () {
      final legacy = FaceGateRules.evaluate(
        faceCount: 1,
        faceAreaRatio: 0.25,
        headYawDegrees: 20,
      );
      expect(legacy.isAccepted, isTrue);

      final strict = FaceGateRules.evaluate(
        faceCount: 1,
        faceAreaRatio: 0.25,
        headYawDegrees: 20,
        limits: StrictFrontalCapturePolicy.gateLimits,
      );
      expect(strict.isAccepted, isFalse);
      expect(strict.reasonCode, 'head_turned');
    });

    test('strict gate rejects roll between 12 and 28', () {
      final strict = FaceGateRules.evaluate(
        faceCount: 1,
        faceAreaRatio: 0.25,
        headRollDegrees: 15,
        limits: StrictFrontalCapturePolicy.gateLimits,
      );
      expect(strict.reasonCode, 'head_tilted');
    });
  });

  group('LandmarkAlignedFaceGeometry', () {
    FaceRegionPolygon poly({
      required FaceRegionId id,
      required bool isLeft,
      required List<Offset> pts,
    }) {
      return FaceRegionPolygon(
        id: id,
        isLeftSide: isLeft,
        points: pts.map((o) => FaceMeshPoint(o.dx, o.dy)).toList(),
      );
    }

    test('maps anatomical left/right cheeks correctly', () {
      expect(
        LandmarkAlignedFaceGeometry.exploreIdForPolygon(
          poly(
            id: FaceRegionId.cheek,
            isLeft: true,
            pts: const [Offset(10, 10), Offset(20, 10), Offset(15, 20)],
          ),
        ),
        'cheeks_left',
      );
      expect(
        LandmarkAlignedFaceGeometry.exploreIdForPolygon(
          poly(
            id: FaceRegionId.cheek,
            isLeft: false,
            pts: const [Offset(80, 10), Offset(90, 10), Offset(85, 20)],
          ),
        ),
        'cheeks_right',
      );
    });

    test('hitTest uses same path geometry and smallest-area overlap rule', () {
      final left = Path()..addRect(const Rect.fromLTWH(0, 0, 40, 40));
      final nested = Path()..addRect(const Rect.fromLTWH(10, 10, 10, 10));
      final paths = <String, Path>{'cheeks_left': left, 'nose': nested};
      expect(
        LandmarkAlignedFaceGeometry.hitTest(
          local: const Offset(15, 15),
          paths: paths,
        ),
        'nose',
      );
      expect(
        LandmarkAlignedFaceGeometry.hitTest(
          local: const Offset(2, 2),
          paths: paths,
        ),
        'cheeks_left',
      );
    });

    test('multi-face differential detects changed region centroids', () {
      final a = <String, Path>{
        'forehead': Path()..addRect(const Rect.fromLTWH(40, 10, 40, 20)),
        'nose': Path()..addRect(const Rect.fromLTWH(55, 40, 10, 20)),
      };
      final b = <String, Path>{
        'forehead': Path()..addRect(const Rect.fromLTWH(30, 5, 50, 30)),
        'nose': Path()..addRect(const Rect.fromLTWH(50, 45, 14, 24)),
      };
      final same = <String, Path>{
        'forehead': Path()..addRect(const Rect.fromLTWH(40, 10, 40, 20)),
        'nose': Path()..addRect(const Rect.fromLTWH(55, 40, 10, 20)),
      };
      expect(LandmarkAlignedFaceGeometry.regionsDifferMaterially(a, b), isTrue);
      expect(
        LandmarkAlignedFaceGeometry.regionsDifferMaterially(a, same),
        isFalse,
      );
    });

    test('pathsFromFrame builds per-user explore ids', () {
      final frame = FaceMeshFrame(
        outline: const [
          FaceMeshPoint(0, 0),
          FaceMeshPoint(100, 0),
          FaceMeshPoint(100, 100),
          FaceMeshPoint(0, 100),
          FaceMeshPoint(0, 50),
          FaceMeshPoint(50, 0),
          FaceMeshPoint(100, 50),
          FaceMeshPoint(50, 100),
        ],
        regions: [
          poly(
            id: FaceRegionId.forehead,
            isLeft: false,
            pts: const [
              Offset(40, 5),
              Offset(60, 5),
              Offset(55, 25),
              Offset(45, 25),
            ],
          ),
          poly(
            id: FaceRegionId.cheek,
            isLeft: true,
            pts: const [
              Offset(10, 40),
              Offset(30, 40),
              Offset(25, 60),
              Offset(15, 60),
            ],
          ),
          poly(
            id: FaceRegionId.cheek,
            isLeft: false,
            pts: const [
              Offset(70, 40),
              Offset(90, 40),
              Offset(85, 60),
              Offset(75, 60),
            ],
          ),
          poly(
            id: FaceRegionId.nose,
            isLeft: false,
            pts: const [
              Offset(48, 35),
              Offset(52, 35),
              Offset(54, 55),
              Offset(46, 55),
            ],
          ),
        ],
        quality: FaceTrackingQuality.high,
        timestamp: DateTime(2026, 9, 9),
      );
      final paths = LandmarkAlignedFaceGeometry.pathsFromFrame(frame);
      expect(
        paths.keys,
        containsAll(['forehead', 'cheeks_left', 'cheeks_right', 'nose']),
      );
      expect(
        LandmarkAlignedFaceGeometry.hitTest(
          local: const Offset(20, 50),
          paths: paths,
        ),
        'cheeks_left',
      );
      expect(
        LandmarkAlignedFaceGeometry.hitTest(
          local: const Offset(80, 50),
          paths: paths,
        ),
        'cheeks_right',
      );
    });
  });
}
