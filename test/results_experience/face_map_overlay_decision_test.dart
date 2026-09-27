import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/results_experience/domain/face_map_overlay_decision.dart';
import 'package:mirra/features/results_experience/domain/perfect_mask_data_kind_contract.dart';
import 'package:mirra/features/results_experience/domain/perfect_mask_session.dart';
import 'package:mirra/features/results_experience/presentation/geometry/shared_image_mask_fit.dart';
import 'package:mirra/features/results_experience/presentation/geometry/skin_face_map_visual_tokens.dart';
import 'package:mirra/shared/theme/colors.dart';
import 'package:flutter/painting.dart';

void main() {
  const tinyPngB64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  group('PerfectMaskDataKindContract', () {
    test(
      'wrinkle/oil/pore/acne from artifact concernType not display name',
      () {
        PerfectMaskArtifact art(String type, {String? region}) =>
            PerfectMaskArtifact(
              concernType: type,
              region: region,
              scoreOnly: false,
              bytes: base64Decode(tinyPngB64),
              uiScore: 70,
              width: 1,
              height: 1,
              aligned: true,
            );

        expect(
          PerfectMaskDataKindContract.classifyArtifact(
            artifact: art('hd_wrinkle', region: 'forehead'),
            regionRequested: true,
            regionMaskBound: true,
          ),
          PerfectMaskMapDataKind.discoveredPaths,
        );
        expect(
          PerfectMaskDataKindContract.classifyArtifact(
            artifact: art('hd_oiliness'),
            regionRequested: false,
            regionMaskBound: true,
          ),
          PerfectMaskMapDataKind.intensityAreaMask,
        );
        expect(
          PerfectMaskDataKindContract.classifyArtifact(
            artifact: art('hd_pore', region: 'nose'),
            regionRequested: true,
            regionMaskBound: true,
          ),
          PerfectMaskMapDataKind.discoveredPoints,
        );
        expect(
          PerfectMaskDataKindContract.classifyArtifact(
            artifact: art('hd_acne'),
            regionRequested: false,
            regionMaskBound: true,
          ),
          PerfectMaskMapDataKind.discoveredPoints,
        );
      },
    );

    test('hd_skin_type returns measurementRegionBoundary', () {
      final art = PerfectMaskArtifact(
        concernType: 'hd_skin_type',
        region: 't_zone',
        scoreOnly: false,
        bytes: base64Decode(tinyPngB64),
        width: 1,
        height: 1,
        aligned: true,
      );
      expect(
        PerfectMaskDataKindContract.classifyArtifact(
          artifact: art,
          regionRequested: true,
          regionMaskBound: true,
        ),
        PerfectMaskMapDataKind.measurementRegionBoundary,
      );
      expect(
        SkinFaceMapVisualTokens.mapLegendAr(
          'skin_type',
          dataKind: PerfectMaskMapDataKind.measurementRegionBoundary,
        ),
        isNot(contains('مسارات')),
      );
      expect(
        SkinFaceMapVisualTokens.mapLegendAr(
          'skin_type',
          dataKind: PerfectMaskMapDataKind.measurementRegionBoundary,
        ),
        contains('منطقة القياس'),
      );
    });

    test('score-only artifact is scoreOnly even for wrinkle provider', () {
      final art = PerfectMaskArtifact(
        concernType: 'hd_wrinkle',
        scoreOnly: true,
        uiScore: 76,
        bytes: null,
      );
      expect(
        PerfectMaskDataKindContract.classifyArtifact(
          artifact: art,
          regionRequested: false,
          regionMaskBound: true,
        ),
        PerfectMaskMapDataKind.scoreOnly,
      );
    });
  });

  group('FaceMapOverlayDecision region strictness', () {
    test('missing region mask does not show whole-face overlay', () {
      final session = PerfectMaskSession.fromApiPayload([
        {
          'concernType': 'hd_wrinkle',
          'region': 'whole',
          'maskBase64': tinyPngB64,
          'uiScore': 76,
          'alignedWithSource': true,
          'width': 1,
          'height': 1,
        },
      ])!;
      final d = FaceMapOverlayDecision.resolve(
        selectedMetricId: 'wrinkles',
        session: session,
        selectedSubregion: 'forehead',
        sourceWidth: 1,
        sourceHeight: 1,
        holdingOriginal: false,
        showPerfectMaskLayer: true,
      );
      expect(d.showSpatialOverlay, isFalse);
      expect(d.dataKind, PerfectMaskMapDataKind.regionMaskAbsent);
    });
  });

  group('SharedImageMaskFit tap mapping', () {
    test('viewport tap maps into source norm inside contain dest', () {
      const vp = Size(200, 250);
      const src = Size(100, 100);
      final dest = SharedImageMaskFit.containRect(
        viewport: vp,
        sourceSize: src,
      );
      final mid = Offset(dest.center.dx, dest.center.dy);
      final norm = SharedImageMaskFit.viewportToSourceNorm(
        viewport: vp,
        sourceSize: src,
        viewportPoint: mid,
      );
      expect(norm, isNotNull);
      expect(norm!.dx, closeTo(0.5, 0.05));
      expect(norm.dy, closeTo(0.5, 0.05));
      expect(
        SharedImageMaskFit.viewportToSourceNorm(
          viewport: vp,
          sourceSize: src,
          viewportPoint: const Offset(1, 1),
        ),
        isNull,
      );
    });
  });

  group('visual language accents extended', () {
    test('texture turquoise, radiance gold, oil amber', () {
      expect(
        SkinFaceMapVisualTokens.accentForConcern('texture'),
        AppColors.analysisTexture,
      );
      expect(
        SkinFaceMapVisualTokens.accentForConcern('radiance'),
        AppColors.analysisRadiance,
      );
      expect(
        SkinFaceMapVisualTokens.accentForConcern('oiliness'),
        AppColors.analysisOil,
      );
    });
  });
}
