import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/results_experience/presentation/geometry/landmark_aligned_face_geometry.dart';
import 'package:mirra/features/results_experience/presentation/geometry/skin_face_map_visual_path_builder.dart';
import 'package:mirra/features/results_experience/presentation/geometry/skin_face_map_visual_tokens.dart';
import 'package:mirra/features/skin_analysis/presentation/live_face_map/models/face_mesh_models.dart';
import 'package:mirra/shared/theme/colors.dart';

void main() {
  FaceRegionPolygon cheek({required bool left}) {
    final baseX = left ? 40.0 : 160.0;
    return FaceRegionPolygon(
      id: FaceRegionId.cheek,
      isLeftSide: left,
      points: [
        FaceMeshPoint(baseX, 80),
        FaceMeshPoint(baseX + 40, 75),
        FaceMeshPoint(baseX + 48, 110),
        FaceMeshPoint(baseX + 35, 140),
        FaceMeshPoint(baseX + 10, 135),
        FaceMeshPoint(baseX - 5, 105),
      ],
    );
  }

  FaceRegionPolygon nose() => const FaceRegionPolygon(
    id: FaceRegionId.nose,
    points: [
      FaceMeshPoint(95, 70),
      FaceMeshPoint(105, 70),
      FaceMeshPoint(112, 100),
      FaceMeshPoint(105, 120),
      FaceMeshPoint(95, 120),
      FaceMeshPoint(88, 100),
    ],
  );

  group('SkinFaceMapVisualPathBuilder', () {
    test('produces non-empty smooth visual path', () {
      final path = SkinFaceMapVisualPathBuilder.fromPolygon(
        polygon: cheek(left: true),
        exploreId: 'cheeks_left',
      );
      expect(path.getBounds().isEmpty, isFalse);
    });

    test('visual stays within expansion budget of hit', () {
      final poly = cheek(left: false);
      final hit = poly.toLinearPath();
      final visual = SkinFaceMapVisualPathBuilder.fromPolygon(
        polygon: poly,
        exploreId: 'cheeks_right',
      );
      final hb = hit.getBounds();
      final vb = visual.getBounds();
      expect(
        vb.width,
        lessThanOrEqualTo(
          hb.width *
                  (1 +
                      SkinFaceMapVisualPathBuilder.maxBoundsExpansionFraction) +
              1,
        ),
      );
      expect(
        vb.height,
        lessThanOrEqualTo(
          hb.height *
                  (1 +
                      SkinFaceMapVisualPathBuilder.maxBoundsExpansionFraction) +
              1,
        ),
      );
    });

    test('right/left explore ids preserved from anatomy', () {
      expect(
        LandmarkAlignedFaceGeometry.exploreIdForPolygon(cheek(left: true)),
        'cheeks_left',
      );
      expect(
        LandmarkAlignedFaceGeometry.exploreIdForPolygon(cheek(left: false)),
        'cheeks_right',
      );
    });

    test('hit and visual maps from frame keep critical ids', () {
      final frame = FaceMeshFrame(
        outline: List.generate(12, (i) => FaceMeshPoint(50.0 + i, 50.0 + i)),
        regions: [
          const FaceRegionPolygon(
            id: FaceRegionId.forehead,
            points: [
              FaceMeshPoint(60, 20),
              FaceMeshPoint(140, 20),
              FaceMeshPoint(150, 55),
              FaceMeshPoint(50, 55),
            ],
          ),
          nose(),
          cheek(left: true),
          cheek(left: false),
          const FaceRegionPolygon(
            id: FaceRegionId.chin,
            points: [
              FaceMeshPoint(80, 150),
              FaceMeshPoint(120, 150),
              FaceMeshPoint(115, 180),
              FaceMeshPoint(85, 180),
            ],
          ),
        ],
        quality: FaceTrackingQuality.high,
        timestamp: DateTime.now(),
      );
      final hit = LandmarkAlignedFaceGeometry.hitPathsFromFrame(frame);
      final visual = SkinFaceMapVisualPathBuilder.visualPathsFromFrame(frame);
      expect(LandmarkAlignedFaceGeometry.hasCriticalRegions(hit), isTrue);
      for (final id in LandmarkAlignedFaceGeometry.criticalRegionIds) {
        expect(visual[id], isNotNull);
        expect(visual[id]!.getBounds().isEmpty, isFalse);
      }
    });

    test(
      'hitTest still uses linear hit paths (nose wins over cheek overlap)',
      () {
        final nosePath = nose().toLinearPath();
        final cheekPath = cheek(left: false).toLinearPath();
        final paths = {'nose': nosePath, 'cheeks_right': cheekPath};
        final probe = LandmarkAlignedFaceGeometry.polygonCentroid(nosePath)!;
        final hit = LandmarkAlignedFaceGeometry.hitTest(
          local: probe,
          paths: paths,
          onlyIds: const ['nose', 'cheeks_right'],
        );
        expect(hit, 'nose');
      },
    );
  });

  group('SkinFaceMapVisualTokens', () {
    test('accents derive from AppColors only', () {
      expect(
        SkinFaceMapVisualTokens.accentForConcern('hydration'),
        AppColors.analysisHydration,
      );
      expect(
        SkinFaceMapVisualTokens.accentForConcern('pigmentation'),
        AppColors.analysisPigmentation,
      );
      expect(SkinFaceMapVisualTokens.accentForConcern(null), AppColors.primary);
      final fill = SkinFaceMapVisualTokens.selectedFill(
        concernId: 'acne',
        globalScore01to100: 40,
      );
      expect(fill.a, lessThanOrEqualTo(0.40));
      expect(fill.a, greaterThanOrEqualTo(0.20));
    });
  });
}
