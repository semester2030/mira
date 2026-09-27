import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/skin_analysis/presentation/live_face_map/models/face_mesh_models.dart';
import 'package:mirra/features/skin_analysis/presentation/live_face_map/topology/mediapipe_landmark_indices.dart';
import 'package:mirra/features/skin_analysis/presentation/live_face_map/utils/cheek_midline_crossing.dart';
import 'package:mirra/features/skin_analysis/presentation/live_face_map/utils/region_path_utils.dart';

void main() {
  const viewport = Size(390, 700);
  const midX = 195.0;

  final oval = <FaceMeshPoint>[
    const FaceMeshPoint(100, 100),
    const FaceMeshPoint(290, 100),
    const FaceMeshPoint(320, 360),
    const FaceMeshPoint(290, 600),
    const FaceMeshPoint(100, 600),
    const FaceMeshPoint(70, 360),
  ];

  group('CheekMidlineCrossing', () {
    test('midline landmarks are brow/nose/chin axis', () {
      expect(
        CheekMidlineCrossing.midlineLandmarkIndices,
        [
          MediapipeLandmarkIndices.geometryBrowMid,
          MediapipeLandmarkIndices.geometryNoseTip,
          MediapipeLandmarkIndices.geometryNoseBase,
          MediapipeLandmarkIndices.geometryChin,
        ],
      );
    });

    test('self-calibrates anatomical left from 234 vs 454 X order', () {
      expect(
        CheekMidlineCrossing.anatomicalLeftIsLowerX(
          leftFaceX: 120,
          rightFaceX: 270,
        ),
        isTrue,
      );
      // Unmirrored selfie: anatomical left is on image-right (higher X).
      expect(
        CheekMidlineCrossing.anatomicalLeftIsLowerX(
          leftFaceX: 270,
          rightFaceX: 120,
        ),
        isFalse,
      );
    });

    test('unmirrored space: left cheek on high-X side PASSES', () {
      // Anatomical left face at higher X → left cheek must be majority > mid.
      final leftCheek = <FaceMeshPoint>[
        const FaceMeshPoint(210, 300),
        const FaceMeshPoint(270, 300),
        const FaceMeshPoint(270, 370),
        const FaceMeshPoint(210, 370),
      ];
      final report = CheekMidlineCrossing.evaluate(
        cheekPoints: leftCheek,
        isAnatomicalLeft: true,
        midlineX: midX,
        anatomicalLeftIsLowerX: false,
      );
      expect(report.crossedMidline, isFalse);
      expect(report.correctSideRatio, greaterThanOrEqualTo(0.55));

      expect(
        RegionPathUtils.suppressReason(
          id: FaceRegionId.cheek,
          points: leftCheek,
          faceOval: oval,
          isLeftSide: true,
          viewportSize: viewport,
          anatomicalMidlineX: midX,
          anatomicalLeftIsLowerX: false,
        ),
        isNull,
      );
    });

    test('broken screen-left assumption would fail unmirrored left cheek', () {
      final leftCheek = <FaceMeshPoint>[
        const FaceMeshPoint(210, 300),
        const FaceMeshPoint(270, 300),
        const FaceMeshPoint(270, 370),
        const FaceMeshPoint(210, 370),
      ];
      // Old formula assumed lower X == anatomical left.
      final broken = CheekMidlineCrossing.evaluate(
        cheekPoints: leftCheek,
        isAnatomicalLeft: true,
        midlineX: midX,
        anatomicalLeftIsLowerX: true, // WRONG for unmirrored selfie
      );
      expect(broken.crossedMidline, isTrue);
    });

    test('right/left labels stay anatomical (not screen-relative)', () {
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
      // Mirrored preview: anatomical left is lower X.
      expect(
        CheekMidlineCrossing.evaluate(
          cheekPoints: left,
          isAnatomicalLeft: true,
          midlineX: midX,
          anatomicalLeftIsLowerX: true,
        ).crossedMidline,
        isFalse,
      );
      expect(
        CheekMidlineCrossing.evaluate(
          cheekPoints: right,
          isAnatomicalLeft: false,
          midlineX: midX,
          anatomicalLeftIsLowerX: true,
        ).crossedMidline,
        isFalse,
      );
      // Swapped labels must fail.
      expect(
        CheekMidlineCrossing.evaluate(
          cheekPoints: left,
          isAnatomicalLeft: false,
          midlineX: midX,
          anatomicalLeftIsLowerX: true,
        ).crossedMidline,
        isTrue,
      );
    });
  });
}
