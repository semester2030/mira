import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/results_experience/presentation/geometry/skin_face_map_visual_tokens.dart';
import 'package:mirra/features/results_experience/semantics/metric_presentation_policy.dart';
import 'package:mirra/shared/theme/colors.dart';

/// Perfect-mask Face Explorer tokens — accents + soft overlay opacity.
void main() {
  group('SkinFaceMapVisualTokens — metric accents', () {
    test('oil / hydration / pores use distinct AppColors accents', () {
      expect(
        SkinFaceMapVisualTokens.accentForConcern('oiliness'),
        AppColors.analysisOil,
      );
      expect(
        SkinFaceMapVisualTokens.accentForConcern('moisture'),
        AppColors.analysisHydration,
      );
      expect(
        SkinFaceMapVisualTokens.accentForConcern('pore'),
        AppColors.analysisPores,
      );
      expect(
        SkinFaceMapVisualTokens.accentForConcern('oiliness'),
        isNot(SkinFaceMapVisualTokens.accentForConcern('moisture')),
      );
    });

    test('mask overlay opacity keeps face readable', () {
      expect(SkinFaceMapVisualTokens.maskOverlayOpacity, lessThan(0.75));
      expect(SkinFaceMapVisualTokens.maskOverlayOpacity, greaterThan(0.2));
    });

    test('polarity legends describe provider masks', () {
      final oil = SkinFaceMapVisualTokens.polarityLegendAr('oiliness');
      final hydro = SkinFaceMapVisualTokens.polarityLegendAr('hydration');
      final pore = SkinFaceMapVisualTokens.polarityLegendAr('pore');
      expect(oil, isNot(contains('hd_')));
      expect(hydro, contains('ترطيب'));
      expect(pore, contains('المسام'));
      expect(
        MetricPresentationPolicy.containsTechnicalIdentifier(oil),
        isFalse,
      );
    });
  });

  group('SkinFaceMapEducationalZones — deprecated helper retained', () {
    test('unknown metric returns empty educational list (no fake map)', () {
      expect(
        SkinFaceMapEducationalZones.exploreIdsForConcern('unknown_xyz'),
        isEmpty,
      );
    });
  });

  group('Truthfulness contract constants', () {
    test('token version marks perfect-mask Face Explorer', () {
      expect(SkinFaceMapVisualTokens.version, contains('perfect-mask'));
    });
  });
}
