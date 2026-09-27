import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/results_experience/domain/face_map_overlay_decision.dart';
import 'package:mirra/features/results_experience/domain/perfect_mask_session.dart';
import 'package:mirra/features/results_experience/domain/perfect_spatial_skin_concern_contract.dart';
import 'package:mirra/features/results_experience/presentation/geometry/skin_face_map_visual_tokens.dart';
import 'package:mirra/features/results_experience/presentation/widgets/perfect_mask_overlay.dart';
import 'package:mirra/features/results_experience/semantics/metric_presentation_policy.dart';
import 'package:mirra/shared/theme/colors.dart';

void main() {
  group('presentation mapping — no technical IDs', () {
    test('public labels are Arabic and never leak provider ids', () {
      expect(
        MetricPresentationPolicy.publicLabelAr('hd_dark_circle'),
        'الهالات',
      );
      expect(MetricPresentationPolicy.publicLabelAr('dark_circle'), 'الهالات');
      expect(
        MetricPresentationPolicy.publicLabelAr('pigmentation'),
        'التصبغات',
      );
      expect(MetricPresentationPolicy.publicLabelAr('pores'), 'المسام');
      expect(MetricPresentationPolicy.publicLabelAr('wrinkles'), 'التجاعيد');
      expect(MetricPresentationPolicy.publicLabelAr('acne'), 'الحبوب');
      for (final id in [
        'hd_pore',
        'hd_wrinkle',
        'glabellar',
        'unknown_xyz_metric',
      ]) {
        final label = MetricPresentationPolicy.publicLabelAr(id);
        expect(
          MetricPresentationPolicy.containsTechnicalIdentifier(label),
          isFalse,
        );
        expect(label.contains(RegExp(r'[a-z_]')), isFalse);
      }
    });

    test('subregion labels are canonical Arabic', () {
      expect(MetricPresentationPolicy.subregionLabelAr('whole'), 'الكل');
      expect(
        MetricPresentationPolicy.subregionLabelAr('glabellar'),
        'بين الحاجبين',
      );
      expect(
        MetricPresentationPolicy.subregionLabelAr('crowfeet'),
        'حول العين الخارجي',
      );
      expect(
        MetricPresentationPolicy.subregionLabelAr('nasolabial'),
        'خطوط الابتسامة',
      );
      expect(
        MetricPresentationPolicy.subregionLabelAr('marionette'),
        'خطوط أسفل الفم',
      );
      expect(
        MetricPresentationPolicy.containsTechnicalIdentifier(
          MetricPresentationPolicy.subregionLabelAr('periocular'),
        ),
        isFalse,
      );
    });

    test('face explorer status bands are consumer Arabic', () {
      expect(MetricPresentationPolicy.faceExplorerStatusAr(88), 'مستوى جيد');
      expect(MetricPresentationPolicy.faceExplorerStatusAr(55), 'مستوى متوسط');
      expect(
        MetricPresentationPolicy.faceExplorerStatusAr(12),
        'يحتاج اهتمامًا',
      );
      expect(MetricPresentationPolicy.faceExplorerStatusAr(null), '');
    });
  });

  group('face explorer interaction contracts', () {
    test('tap same metric keeps contract key; UI toggles separately', () {
      expect(
        nextSelectedMaskKey(
          previousKey: 'redness',
          nextKey: 'redness',
          availableKeys: const ['redness', 'pores'],
        ),
        'redness',
      );
    });

    test('stale key cleared when missing', () {
      expect(
        nextSelectedMaskKey(
          previousKey: 'pigmentation',
          nextKey: 'pores',
          availableKeys: const ['pigmentation'],
        ),
        isNull,
      );
    });

    test('missing mask never invents spatial overlay', () {
      expect(
        mayShowSpatialOverlay(
          classifySpatialMode(hasRootMask: false, subregionMaskCount: 0),
        ),
        isFalse,
      );
    });

    test('callout alignment is informational and never technical', () {
      expect(
        SkinFaceMapVisualTokens.calloutAlignmentForSubregion('forehead'),
        AlignmentDirectional.topCenter,
      );
      expect(
        SkinFaceMapVisualTokens.calloutAlignmentForSubregion('cheek'),
        AlignmentDirectional.centerStart,
      );
      expect(
        MetricPresentationPolicy.containsTechnicalIdentifier(
          MetricPresentationPolicy.subregionLabelAr('glabellar'),
        ),
        isFalse,
      );
    });

    test('mask clarity token is clear but not opaque paint', () {
      expect(
        SkinFaceMapVisualTokens.maskOverlayOpacity,
        greaterThanOrEqualTo(0.5),
      );
      expect(SkinFaceMapVisualTokens.maskOverlayOpacity, lessThan(0.75));
      expect(
        SkinFaceMapVisualTokens.version.contains('spatial-truth-cpu-decode'),
        isTrue,
      );
    });

    test(
      'age-spot acne pores oiliness wrinkles use luminance-gate profiles',
      () {
        final pigment = SkinFaceMapVisualTokens.presentationProfileForConcern(
          'pigmentation',
        );
        final acne = SkinFaceMapVisualTokens.presentationProfileForConcern(
          'acne',
        );
        final pores = SkinFaceMapVisualTokens.presentationProfileForConcern(
          'pores',
        );
        final oil = SkinFaceMapVisualTokens.presentationProfileForConcern(
          'oiliness',
        );
        final wrinkles = SkinFaceMapVisualTokens.presentationProfileForConcern(
          'wrinkles',
        );
        expect(pigment.alphaMode, PerfectMaskAlphaMode.luminanceGate);
        expect(acne.alphaMode, PerfectMaskAlphaMode.luminanceGate);
        expect(pores.alphaMode, PerfectMaskAlphaMode.luminanceGate);
        expect(oil.alphaMode, PerfectMaskAlphaMode.luminanceGate);
        expect(wrinkles.alphaMode, PerfectMaskAlphaMode.luminanceGate);
        expect(
          SkinFaceMapVisualTokens.presentationProfileForConcern(
            'redness',
          ).alphaMode,
          PerfectMaskAlphaMode.luminanceGate,
        );
        expect(
          SkinFaceMapVisualTokens.presentationProfileForConcern(
            'texture',
          ).alphaMode,
          PerfectMaskAlphaMode.luminanceGate,
        );
        expect(
          SkinFaceMapVisualTokens.presentationProfileForConcern(
            'hydration',
          ).alphaMode,
          PerfectMaskAlphaMode.luminanceGate,
        );
        expect(
          SkinFaceMapVisualTokens.presentationProfileForConcern('radiance'),
          PerfectMaskPresentationProfile.standard,
        );
        expect(
          SkinFaceMapVisualTokens.accentForConcern('pigmentation'),
          isNot(SkinFaceMapVisualTokens.accentForConcern('acne')),
        );
        expect(
          SkinFaceMapVisualTokens.accentForConcern('pores'),
          isNot(SkinFaceMapVisualTokens.accentForConcern('oiliness')),
        );
      },
    );

    test(
      'presentation alpha: zero stays zero; wash suppressed; lesion visible',
      () {
        final acne = PerfectMaskPresentationProfile.acne;
        expect(
          SkinFaceMapVisualTokens.presentationAlphaFromPerfectRgba(
            r: 0,
            g: 0,
            b: 0,
            a: 0,
            profile: acne,
          ),
          0,
        );
        // Face-wide gray wash (measured Perfect acne encoding).
        expect(
          SkinFaceMapVisualTokens.presentationAlphaFromPerfectRgba(
            r: 61,
            g: 61,
            b: 61,
            a: 92,
            profile: acne,
          ),
          0,
        );
        // Lesion pixel (high luminance, A=255).
        final lesion = SkinFaceMapVisualTokens.presentationAlphaFromPerfectRgba(
          r: 253,
          g: 248,
          b: 245,
          a: 255,
          profile: acne,
        );
        expect(lesion, greaterThan(120));
      },
    );

    test('oiliness wash suppressed; orange signal remains', () {
      final oil = PerfectMaskPresentationProfile.oiliness;
      expect(
        SkinFaceMapVisualTokens.presentationAlphaFromPerfectRgba(
          r: 61,
          g: 61,
          b: 61,
          a: 51,
          profile: oil,
        ),
        0,
      );
      final signal = SkinFaceMapVisualTokens.presentationAlphaFromPerfectRgba(
        r: 255,
        g: 139,
        b: 12,
        a: 152,
        profile: oil,
      );
      expect(signal, greaterThan(60));
    });

    test(
      'wrinkles: wash suppressed; bright line cores remain; no soft paint',
      () {
        final w = PerfectMaskPresentationProfile.wrinkles;
        expect(w.softPresenceOpacity, 0);
        expect(w.luminanceGateFloor, greaterThan(61));
        expect(w.luminanceGateFloor, lessThan(82));
        expect(w.minVisibleAlpha, greaterThan(0));
        // Gray wash must not paint (barcode density artifact).
        expect(
          SkinFaceMapVisualTokens.presentationAlphaFromPerfectRgba(
            r: 61,
            g: 61,
            b: 61,
            a: 92,
            profile: w,
          ),
          0,
        );
        // Bright Perfect line core remains visible.
        final line = SkinFaceMapVisualTokens.presentationAlphaFromPerfectRgba(
          r: 240,
          g: 235,
          b: 230,
          a: 200,
          profile: w,
        );
        expect(line, greaterThan(80));
        expect(line, lessThan(255));
        // Mid-luminance wrinkle stroke (killed by floor 82 previously).
        final mid = SkinFaceMapVisualTokens.presentationAlphaFromPerfectRgba(
          r: 90,
          g: 88,
          b: 86,
          a: 200,
          profile: w,
        );
        expect(mid, greaterThan(0));
        expect(mid, greaterThanOrEqualTo(w.minVisibleAlpha));
      },
    );

    test('acne/pores sparse cores get clear presentation alpha', () {
      final acne = PerfectMaskPresentationProfile.acne;
      final pores = PerfectMaskPresentationProfile.pores;
      final acneSpot = SkinFaceMapVisualTokens.presentationAlphaFromPerfectRgba(
        r: 120,
        g: 110,
        b: 105,
        a: 220,
        profile: acne,
      );
      final poreSpot = SkinFaceMapVisualTokens.presentationAlphaFromPerfectRgba(
        r: 110,
        g: 108,
        b: 100,
        a: 210,
        profile: pores,
      );
      expect(acneSpot, greaterThanOrEqualTo(acne.minVisibleAlpha));
      expect(poreSpot, greaterThanOrEqualTo(pores.minVisibleAlpha));
      expect(
        SkinFaceMapVisualTokens.presentationAlphaFromPerfectRgba(
          r: 61,
          g: 61,
          b: 61,
          a: 92,
          profile: acne,
        ),
        0,
      );
    });

    test('hydration area profile is readable without opaque paint', () {
      final h = PerfectMaskPresentationProfile.hydration;
      expect(h.opacity, greaterThanOrEqualTo(0.55));
      expect(h.opacity, lessThan(0.85));
      expect(h.minVisibleAlpha, 0);
      expect(
        SkinFaceMapVisualTokens.presentationAlphaFromPerfectRgba(
          r: 61,
          g: 61,
          b: 61,
          a: 92,
          profile: h,
        ),
        0,
      );
      final area = SkinFaceMapVisualTokens.presentationAlphaFromPerfectRgba(
        r: 180,
        g: 160,
        b: 150,
        a: 180,
        profile: h,
      );
      expect(area, greaterThan(40));
    });

    test('mapLegendAr distinguishes lines vs marks vs area tint', () {
      expect(
        SkinFaceMapVisualTokens.mapLegendAr(
          'wrinkles',
          dataKind: PerfectMaskMapDataKind.discoveredPaths,
        ),
        contains('مسارات'),
      );
      expect(
        SkinFaceMapVisualTokens.mapLegendAr(
          'acne',
          dataKind: PerfectMaskMapDataKind.discoveredPoints,
        ),
        contains('مواضع'),
      );
      expect(
        SkinFaceMapVisualTokens.mapLegendAr(
          'hydration',
          dataKind: PerfectMaskMapDataKind.intensityAreaMask,
        ),
        contains('التلوين'),
      );
    });

    test(
      'redness texture hydration use luminance-gate; radiance stays standard',
      () {
        for (final id in ['redness', 'texture', 'moisture', 'hydration']) {
          expect(
            SkinFaceMapVisualTokens.presentationProfileForConcern(id).alphaMode,
            PerfectMaskAlphaMode.luminanceGate,
          );
        }
        expect(
          SkinFaceMapVisualTokens.presentationProfileForConcern('radiance'),
          PerfectMaskPresentationProfile.standard,
        );
      },
    );

    test('session exposes oiliness even when absent from map concern ids', () {
      final session = PerfectMaskSession.fromApiPayload([
        {
          'concernType': 'hd_oiliness',
          'maskBase64':
              'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          'scoreOnly': false,
          'uiScore': 75,
        },
      ]);
      expect(session, isNotNull);
      expect(session!.providersWithMaskBytes(), contains('hd_oiliness'));
      expect(session.providersPresent(), contains('hd_oiliness'));
      expect(
        PerfectMaskSession.consumerMetricIdForProvider('hd_oiliness'),
        'oiliness',
      );
      expect(session.lookup(consumerMetricId: 'oiliness')?.bytes, isNotNull);
    });

    test(
      'providersPresent includes score-only / empty-bytes; bytes gate separate',
      () {
        final session = PerfectMaskSession.fromApiPayload([
          {'concernType': 'hd_moisture', 'scoreOnly': true, 'uiScore': 80},
          {
            'concernType': 'hd_oiliness',
            'maskBase64': '',
            'scoreOnly': false,
            'uiScore': 70,
          },
          {
            'concernType': 'hd_pore',
            'maskBase64':
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
            'scoreOnly': false,
            'uiScore': 60,
          },
          {'concernType': 'hd_radiance', 'scoreOnly': true},
        ]);
        expect(session, isNotNull);
        expect(
          session!.providersPresent(),
          containsAll(['hd_moisture', 'hd_oiliness', 'hd_pore', 'hd_radiance']),
        );
        expect(session.providersWithMaskBytes(), contains('hd_pore'));
        expect(
          session.providersWithMaskBytes(),
          isNot(contains('hd_moisture')),
        );
        expect(
          session.providersWithMaskBytes(),
          isNot(contains('hd_oiliness')),
        );
        expect(
          session.providersWithLegitimateResult(),
          containsAll(['hd_moisture', 'hd_oiliness', 'hd_pore']),
        );
        expect(
          session.providersWithLegitimateResult(),
          isNot(contains('hd_radiance')),
        );
        expect(session.lookup(consumerMetricId: 'hydration')?.uiScore, 80);
        expect(session.lookup(consumerMetricId: 'hydration')?.bytes, isNull);
        expect(session.lookup(consumerMetricId: 'pores')?.bytes, isNotNull);
      },
    );

    test('accents come from Design System AppColors', () {
      expect(
        SkinFaceMapVisualTokens.accentForConcern('pigmentation'),
        AppColors.analysisPigmentation,
      );
      expect(
        SkinFaceMapVisualTokens.accentForConcern('pores'),
        AppColors.analysisPores,
      );
      expect(
        SkinFaceMapVisualTokens.accentForConcern('moisture'),
        AppColors.analysisHydration,
      );
    });

    test('session cache prevents re-decode hits', () {
      final session = PerfectMaskSession.fromApiPayload([
        {
          'concernType': 'hd_age_spot',
          'maskBase64':
              'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          'scoreOnly': false,
        },
      ]);
      expect(session, isNotNull);
      session!.lookup(consumerMetricId: 'pigmentation');
      session.lookup(consumerMetricId: 'pigmentation');
      expect(
        session.cacheHitsFor('hd_age_spot::root'),
        greaterThanOrEqualTo(1),
      );
    });

    test(
      'ColorFilter luminanceGate bias is 0-1 scale (not raw 0-255 floor)',
      () {
        final pores = PerfectMaskPresentationProfile.pores;
        final m = PerfectMaskOverlay.debugPresentationAlphaMatrix(pores);
        expect(m.length, 20);
        final bias = m[19];
        final expected = -(pores.luminanceGateFloor / 255.0) * pores.alphaGain;
        expect(bias, closeTo(expected, 1e-9));
        // Old bug: bias ~= -floor*gain (~-100) zeroes every GPU alpha.
        expect(bias.abs(), lessThan(1.0));
        expect(bias, greaterThan(-1.0));
        // RGB forced to 1 for clean srcIn tint.
        expect(m[4], 1.0);
        expect(m[9], 1.0);
        expect(m[14], 1.0);
      },
    );

    test('canonical consumer→provider mapper is single-sourced', () {
      expect(
        PerfectMaskSession.providerTypeForConsumerMetric('pores'),
        'hd_pore',
      );
      expect(
        PerfectMaskSession.providerTypeForConsumerMetric('pigmentation'),
        'hd_age_spot',
      );
      expect(
        PerfectMaskSession.providerTypeForConsumerMetric('wrinkles'),
        'hd_wrinkle',
      );
      expect(
        PerfectMaskSession.providerTypeForConsumerMetric('redness'),
        'hd_redness',
      );
      expect(
        PerfectMaskSession.providerTypeForConsumerMetric('texture'),
        'hd_texture',
      );
      expect(
        PerfectMaskSession.providerTypeForConsumerMetric('acne'),
        'hd_acne',
      );
      expect(
        PerfectMaskSession.providerTypeForConsumerMetric('hydration'),
        'hd_moisture',
      );
      expect(
        PerfectMaskSession.providerTypeForConsumerMetric('oiliness'),
        'hd_oiliness',
      );
    });
  });
}
