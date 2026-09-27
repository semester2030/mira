import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/results_experience/presentation/geometry/landmark_aligned_face_geometry.dart';
import 'package:mirra/features/results_experience/presentation/geometry/skin_report_landmark_indices.dart';
import 'package:mirra/features/results_experience/presentation/geometry/skin_report_region_builder.dart';
import 'package:mirra/features/skin_analysis/presentation/live_face_map/models/face_mesh_models.dart';

/// Synthetic per-user face geometry in a 200×280 face space.
Map<String, Path> _syntheticFace({
  required double faceWidth,
  required double faceHeight,
  required double foreheadTop,
  required double noseWidth,
  required double cheekInset,
  required Offset origin,
}) {
  Path oval(Rect r) => Path()..addOval(r);

  final forehead = oval(
    Rect.fromLTWH(
      origin.dx + faceWidth * 0.18,
      origin.dy + foreheadTop,
      faceWidth * 0.64,
      faceHeight * 0.18,
    ),
  );
  final nose = oval(
    Rect.fromLTWH(
      origin.dx + faceWidth * 0.5 - noseWidth / 2,
      origin.dy + faceHeight * 0.32,
      noseWidth,
      faceHeight * 0.28,
    ),
  );
  final leftCheek = oval(
    Rect.fromLTWH(
      origin.dx + cheekInset,
      origin.dy + faceHeight * 0.38,
      faceWidth * 0.28,
      faceHeight * 0.28,
    ),
  );
  final rightCheek = oval(
    Rect.fromLTWH(
      origin.dx + faceWidth - cheekInset - faceWidth * 0.28,
      origin.dy + faceHeight * 0.38,
      faceWidth * 0.28,
      faceHeight * 0.28,
    ),
  );
  final chin = oval(
    Rect.fromLTWH(
      origin.dx + faceWidth * 0.32,
      origin.dy + faceHeight * 0.72,
      faceWidth * 0.36,
      faceHeight * 0.18,
    ),
  );

  return {
    'forehead': forehead,
    'cheeks_left': leftCheek,
    'cheeks_right': rightCheek,
    'nose': nose,
    'chin': chin,
  };
}

void main() {
  group('landmark index ownership', () {
    test('critical regions resolve to non-empty MediaPipe index lists', () {
      for (final id in LandmarkAlignedFaceGeometry.criticalRegionIds) {
        expect(
          LandmarkAlignedFaceGeometry.landmarkIndicesFor(id),
          isNotEmpty,
          reason: id,
        );
      }
      expect(
        LandmarkAlignedFaceGeometry.landmarkIndicesFor('cheeks_left'),
        SkinReportLandmarkIndices.leftCheek,
      );
      expect(
        LandmarkAlignedFaceGeometry.landmarkIndicesFor('cheeks_right'),
        SkinReportLandmarkIndices.rightCheek,
      );
      expect(
        LandmarkAlignedFaceGeometry.landmarkIndicesFor('nose'),
        SkinReportLandmarkIndices.nose,
      );
    });

    test('report cheek indices exclude live under-eye bleed points', () {
      const underEyeBleedLeft = {117, 118, 119, 120, 121, 128, 245, 189};
      const underEyeBleedRight = {
        347,
        346,
        340,
        265,
        261,
        448,
        449,
        450,
        451,
        452,
        453,
        412,
      };
      expect(
        SkinReportLandmarkIndices.leftCheek.toSet().intersection(
          underEyeBleedLeft,
        ),
        isEmpty,
      );
      expect(
        SkinReportLandmarkIndices.rightCheek.toSet().intersection(
          underEyeBleedRight,
        ),
        isEmpty,
      );
    });

    test('forehead rise factor is conservative (< 0.5 of top support)', () {
      expect(SkinReportRegionBuilder.foreheadRiseFactor, lessThan(0.5));
      expect(SkinReportRegionBuilder.foreheadRiseFactor, greaterThan(0.2));
    });

    test('anatomical left/right mapping is not screen-relative', () {
      expect(
        LandmarkAlignedFaceGeometry.exploreIdForPolygon(
          const FaceRegionPolygon(
            id: FaceRegionId.cheek,
            isLeftSide: true,
            points: [
              FaceMeshPoint(10, 10),
              FaceMeshPoint(20, 10),
              FaceMeshPoint(15, 20),
            ],
          ),
        ),
        'cheeks_left',
      );
      expect(
        LandmarkAlignedFaceGeometry.exploreIdForPolygon(
          const FaceRegionPolygon(
            id: FaceRegionId.cheek,
            isLeftSide: false,
            points: [
              FaceMeshPoint(80, 10),
              FaceMeshPoint(90, 10),
              FaceMeshPoint(85, 20),
            ],
          ),
        ),
        'cheeks_right',
      );
    });
  });

  group('centroid + interior + negative hit tests', () {
    late Map<String, Path> face;
    const viewport = Size(200, 280);

    setUp(() {
      face = _syntheticFace(
        faceWidth: 160,
        faceHeight: 220,
        foreheadTop: 20,
        noseWidth: 28,
        cheekInset: 8,
        origin: const Offset(20, 20),
      );
    });

    test('hasCriticalRegions requires all five', () {
      expect(LandmarkAlignedFaceGeometry.hasCriticalRegions(face), isTrue);
      final missing = Map<String, Path>.from(face)..remove('chin');
      expect(LandmarkAlignedFaceGeometry.hasCriticalRegions(missing), isFalse);
    });

    test('centroid hit tests 5/5', () {
      var pass = 0;
      for (final id in LandmarkAlignedFaceGeometry.criticalRegionIds) {
        final c = LandmarkAlignedFaceGeometry.polygonCentroid(face[id]!);
        expect(c, isNotNull, reason: id);
        final hit = LandmarkAlignedFaceGeometry.hitTest(
          local: c!,
          paths: face,
          onlyIds: LandmarkAlignedFaceGeometry.criticalRegionIds,
          accessibilityTolerancePx: 0,
        );
        expect(hit, id, reason: 'centroid of $id');
        if (hit == id) pass++;
      }
      expect(pass, 5);
    });

    test('interior sample points resolve 100% to own region', () {
      var total = 0;
      var pass = 0;
      for (final id in LandmarkAlignedFaceGeometry.criticalRegionIds) {
        final samples = LandmarkAlignedFaceGeometry.interiorSamplePoints(
          face[id]!,
        );
        expect(samples, isNotEmpty, reason: id);
        for (final p in samples) {
          total++;
          final hit = LandmarkAlignedFaceGeometry.hitTest(
            local: p,
            paths: face,
            onlyIds: LandmarkAlignedFaceGeometry.criticalRegionIds,
            accessibilityTolerancePx: 0,
          );
          if (hit == id) pass++;
        }
      }
      expect(total, greaterThan(20));
      expect(pass, total);
    });

    test('negative hits outside face return null — 0 false positives', () {
      const negatives = <Offset>[
        Offset(2, 2),
        Offset(198, 2),
        Offset(2, 278),
        Offset(198, 278),
        Offset(100, 5),
        Offset(100, 275),
      ];
      var falsePositives = 0;
      for (final p in negatives) {
        final hit = LandmarkAlignedFaceGeometry.hitTest(
          local: p,
          paths: face,
          onlyIds: LandmarkAlignedFaceGeometry.criticalRegionIds,
          accessibilityTolerancePx: 0,
        );
        if (hit != null) falsePositives++;
      }
      expect(falsePositives, 0);
    });

    test('draw path == hit path identity (same Map entries)', () {
      for (final id in LandmarkAlignedFaceGeometry.criticalRegionIds) {
        final draw = face[id]!;
        final c = LandmarkAlignedFaceGeometry.polygonCentroid(draw)!;
        expect(
          LandmarkAlignedFaceGeometry.hitTest(
            local: c,
            paths: {id: draw},
            accessibilityTolerancePx: 0,
          ),
          id,
        );
      }
    });

    test('current-user display geometry is not Luxury template aspect', () {
      final rect = CurrentUserFaceDisplayGeometry.faceRectIn(viewport);
      expect(rect.left, 10);
      expect(rect.top, 8);
      expect(rect.width, viewport.width - 20);
      expect(rect.height, viewport.height - 20);
      // Template Luxury uses viewW/viewH = 200/280 aspect inside inset —
      // current-user rect fills inset without that aspect lock.
      expect(rect.width / rect.height, isNot(closeTo(200 / 280, 0.001)));
    });
  });

  group('multi-face differential + repeatability', () {
    test('three different faces produce distinct geometry hashes', () {
      const viewport = Size(200, 280);
      final faceA = _syntheticFace(
        faceWidth: 140,
        faceHeight: 200,
        foreheadTop: 28,
        noseWidth: 22,
        cheekInset: 14,
        origin: const Offset(30, 30),
      );
      final faceB = _syntheticFace(
        faceWidth: 170,
        faceHeight: 240,
        foreheadTop: 12,
        noseWidth: 36,
        cheekInset: 4,
        origin: const Offset(15, 10),
      );
      final faceC = _syntheticFace(
        faceWidth: 155,
        faceHeight: 210,
        foreheadTop: 22,
        noseWidth: 30,
        cheekInset: 10,
        origin: const Offset(22, 25),
      );

      final ha = LandmarkAlignedFaceGeometry.criticalHashes(
        faceA,
        normalizeTo: viewport,
      );
      final hb = LandmarkAlignedFaceGeometry.criticalHashes(
        faceB,
        normalizeTo: viewport,
      );
      final hc = LandmarkAlignedFaceGeometry.criticalHashes(
        faceC,
        normalizeTo: viewport,
      );

      expect(ha, isNot(equals(hb)));
      expect(hb, isNot(equals(hc)));
      expect(ha, isNot(equals(hc)));
      expect(
        LandmarkAlignedFaceGeometry.regionsDifferMaterially(faceA, faceB),
        isTrue,
      );
      expect(
        LandmarkAlignedFaceGeometry.regionsDifferMaterially(faceB, faceC),
        isTrue,
      );
    });

    test(
      'same-person near-identical captures stay within repeatability band',
      () {
        final capture1 = _syntheticFace(
          faceWidth: 160,
          faceHeight: 220,
          foreheadTop: 20,
          noseWidth: 28,
          cheekInset: 8,
          origin: const Offset(20, 20),
        );
        // ±2px jitter — simulates detector noise under strict frontal gate.
        final capture2 = _syntheticFace(
          faceWidth: 160,
          faceHeight: 220,
          foreheadTop: 21,
          noseWidth: 28,
          cheekInset: 8,
          origin: const Offset(21, 19),
        );
        final capture3 = _syntheticFace(
          faceWidth: 161,
          faceHeight: 219,
          foreheadTop: 20,
          noseWidth: 29,
          cheekInset: 7,
          origin: const Offset(19, 21),
        );

        final d12 = LandmarkAlignedFaceGeometry.centroidDisplacement(
          capture1,
          capture2,
        );
        final d13 = LandmarkAlignedFaceGeometry.centroidDisplacement(
          capture1,
          capture3,
        );

        // Calibration: under strict frontal, same-subject centroid drift for
        // synthetic ±2px jitter stays well below 8px mean / 16px max.
        const meanTol = 8.0;
        const maxTol = 16.0;
        expect(d12.mean, lessThan(meanTol));
        expect(d12.max, lessThan(maxTol));
        expect(d13.mean, lessThan(meanTol));
        expect(d13.max, lessThan(maxTol));
      },
    );
  });
}
