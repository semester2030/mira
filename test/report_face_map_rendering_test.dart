import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/intelligence/domain/constants/report_face_map_spec.dart';
import 'package:mirra/features/intelligence/presentation/widgets/beauty_report_face_map/luxury_face_geometry.dart';
import 'package:mirra/features/intelligence/presentation/widgets/beauty_report_face_map/organic_face_geometry.dart';

void main() {
  group('Report face map rendering', () {
    test('heatmap overlay paths stay inside local paint bounds', () {
      const faceArea = Rect.fromLTRB(52, 6, 300, 396);
      final faceRect = LuxuryFaceGeometry.faceBoundsIn(faceArea);
      final paintBounds = LuxuryFaceGeometry.faceBoundsLocal(
        Size(faceRect.width, faceRect.height),
      );

      for (final concernId in ReportFaceMapSpec.tabOrder) {
        if (ReportFaceMapSpec.renderModeFor(concernId) !=
            FaceMapRenderMode.heatmap) {
          continue;
        }

        final highlights = ReportFaceMapSpec.highlightsFor(concernId, const []);
        expect(highlights, isNotEmpty, reason: concernId);

        for (final item in highlights) {
          final path = OrganicFaceGeometry.regionPath(
            paintBounds,
            ReportFaceMapSpec.regionId(item.region),
          );
          final bounds = path.getBounds();
          expect(bounds.isEmpty, isFalse, reason: '$concernId → ${item.region}');
          expect(bounds.left, greaterThanOrEqualTo(-1));
          expect(bounds.top, greaterThanOrEqualTo(-1));
          expect(bounds.right, lessThanOrEqualTo(paintBounds.width + 1));
          expect(bounds.bottom, lessThanOrEqualTo(paintBounds.height + 1));
        }
      }
    });

    test('score opacity bands match production spec', () {
      expect(ReportFaceMapSpec.scoreOpacity(25), 0.15);
      expect(ReportFaceMapSpec.scoreOpacity(40), 0.25);
      expect(ReportFaceMapSpec.scoreOpacity(60), 0.40);
      expect(ReportFaceMapSpec.scoreOpacity(80), 0.55);
      expect(ReportFaceMapSpec.scoreOpacity(95), 0.72);
    });

    test('higher score produces stronger overlay opacity and spread', () {
      final low = ReportFaceMapSpec.fillOpacityFor(
        FaceMapIntensity.high,
        35,
      );
      final mid = ReportFaceMapSpec.fillOpacityFor(
        FaceMapIntensity.high,
        60,
      );
      final high = ReportFaceMapSpec.fillOpacityFor(
        FaceMapIntensity.high,
        90,
      );
      expect(mid, greaterThan(low));
      expect(high, greaterThan(mid));
      expect(
        ReportFaceMapSpec.scoreSpread(90),
        greaterThan(ReportFaceMapSpec.scoreSpread(35)),
      );
    });

    test('each concern uses distinct render mode or region sets', () {
      Set<FaceMapRegion> regions(String id) =>
          ReportFaceMapSpec.highlightsFor(id, const [])
              .map((h) => h.region)
              .toSet();

      final oiliness = regions('oiliness');
      final pores = regions('pore');
      final hydration = regions('moisture');
      final darkCircles = regions('dark_circle');

      expect(oiliness, isNot(equals(pores)));
      expect(oiliness, isNot(equals(hydration)));
      expect(pores, isNot(equals(hydration)));
      expect(darkCircles, isNot(equals(oiliness)));
      expect(darkCircles, isNot(equals(pores)));
      expect(darkCircles, isNot(equals(hydration)));

      expect(ReportFaceMapSpec.renderModeFor('wrinkle'),
          FaceMapRenderMode.wrinkleLines);
      expect(ReportFaceMapSpec.renderModeFor('acne'),
          FaceMapRenderMode.acneSpots);
      expect(ReportFaceMapSpec.renderModeFor('texture'),
          FaceMapRenderMode.textureGrain);
    });

    test('oiliness maps to T-zone micro-regions', () {
      final regions = ReportFaceMapSpec.highlightsFor('oiliness', const [])
          .map((h) => h.region)
          .toSet();
      expect(regions, {
        FaceMapRegion.foreheadCenter,
        FaceMapRegion.noseBridge,
        FaceMapRegion.noseTip,
        FaceMapRegion.chinCenter,
      });
    });

    test('hydration includes wide cheeks and mouth perioral', () {
      final regions = ReportFaceMapSpec.highlightsFor('moisture', const [])
          .map((h) => h.region)
          .toSet();
      expect(regions, contains(FaceMapRegion.mouthPerioral));
      expect(regions, contains(FaceMapRegion.cheekWideLeft));
      expect(regions, contains(FaceMapRegion.foreheadWide));
    });

    test('dark circles map to under-eye regions only', () {
      final regions = ReportFaceMapSpec.highlightsFor('dark_circle', const [])
          .map((h) => h.region)
          .toSet();
      expect(regions, {
        FaceMapRegion.underEyesLeft,
        FaceMapRegion.underEyesRight,
      });
    });

    test('concern aliases resolve to same overlays', () {
      final pore = ReportFaceMapSpec.highlightsFor('pore', const []);
      final pores = ReportFaceMapSpec.highlightsFor('pores', const []);
      expect(pore, equals(pores));

      final moisture = ReportFaceMapSpec.highlightsFor('moisture', const []);
      final hydration = ReportFaceMapSpec.highlightsFor('hydration', const []);
      expect(moisture, equals(hydration));
    });

    test('hero copy and disclaimer are concern-specific', () {
      expect(
        ReportFaceMapSpec.heroCopyFor('oiliness'),
        isNot(equals(ReportFaceMapSpec.heroCopyFor('pore'))),
      );
      expect(
        ReportFaceMapSpec.disclaimerAr,
        contains('المناطق الأكثر ارتباطاً'),
      );
      expect(ReportFaceMapSpec.disclaimerAr, isNot(contains('ليست')));
    });
  });
}
