import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/intelligence/domain/constants/report_face_map_spec.dart';
import 'package:mirra/features/intelligence/presentation/widgets/beauty_report_face_map/luxury_face_geometry.dart';

void main() {
  group('Report face map rendering', () {
    test('overlay paths stay inside local paint bounds', () {
      const faceArea = Rect.fromLTRB(52, 6, 300, 370);
      final faceRect = LuxuryFaceGeometry.faceBoundsIn(faceArea);
      final paintBounds = LuxuryFaceGeometry.faceBoundsLocal(
        Size(faceRect.width, faceRect.height),
      );

      for (final concernId in ReportFaceMapSpec.tabOrder) {
        final highlights = ReportFaceMapSpec.highlightsFor(concernId, const []);
        expect(highlights, isNotEmpty, reason: concernId);

        for (final item in highlights) {
          final path = LuxuryFaceGeometry.regionPath(
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

    test('score opacity bands match spec', () {
      expect(ReportFaceMapSpec.scoreOpacity(35), 0.15);
      expect(ReportFaceMapSpec.scoreOpacity(50), 0.30);
      expect(ReportFaceMapSpec.scoreOpacity(70), 0.50);
      expect(ReportFaceMapSpec.scoreOpacity(90), 0.70);
    });

    test('higher score produces stronger overlay opacity', () {
      final low = ReportFaceMapSpec.fillOpacityFor(
        FaceMapIntensity.high,
        55,
      );
      final mid = ReportFaceMapSpec.fillOpacityFor(
        FaceMapIntensity.high,
        70,
      );
      final high = ReportFaceMapSpec.fillOpacityFor(
        FaceMapIntensity.high,
        85,
      );
      expect(mid, greaterThan(low));
      expect(high, greaterThan(mid));
    });

    test('each concern produces distinct region sets', () {
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
    });

    test('oiliness maps to T-zone only', () {
      final regions = ReportFaceMapSpec.highlightsFor('oiliness', const [])
          .map((h) => h.region)
          .toSet();
      expect(regions, {
        FaceMapRegion.forehead,
        FaceMapRegion.nose,
        FaceMapRegion.chin,
      });
    });

    test('hydration includes mouth perioral region', () {
      final regions = ReportFaceMapSpec.highlightsFor('moisture', const [])
          .map((h) => h.region)
          .toSet();
      expect(regions, contains(FaceMapRegion.mouthPerioral));
      expect(regions, contains(FaceMapRegion.cheeksLeft));
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

    test('hero copy is concern-specific', () {
      expect(
        ReportFaceMapSpec.heroCopyFor('oiliness'),
        isNot(equals(ReportFaceMapSpec.heroCopyFor('pore'))),
      );
      expect(
        ReportFaceMapSpec.heroCopyFor('moisture'),
        isNot(equals(ReportFaceMapSpec.heroCopyFor('dark_circle'))),
      );
    });
  });
}
