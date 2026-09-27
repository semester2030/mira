import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/results_experience/domain/perfect_spatial_skin_concern_contract.dart';

void main() {
  group('Perfect spatial skin concern contract', () {
    test('score-only never allows spatial overlay', () {
      final mode = classifySpatialMode(
        hasRootMask: false,
        subregionMaskCount: 0,
      );
      expect(mode, PerfectSpatialMode.scoreOnly);
      expect(mayShowSpatialOverlay(mode), isFalse);
    });

    test('provider pixel mask allows overlay', () {
      final mode = classifySpatialMode(
        hasRootMask: true,
        subregionMaskCount: 0,
      );
      expect(mode, PerfectSpatialMode.providerPixelMask);
      expect(mayShowSpatialOverlay(mode), isTrue);
    });

    test('subregion masks classify correctly', () {
      final mode = classifySpatialMode(
        hasRootMask: false,
        subregionMaskCount: 4,
      );
      expect(mode, PerfectSpatialMode.providerSubregionMasks);
      expect(mayShowSpatialOverlay(mode), isTrue);
    });

    test('inventory roles cover all proven HD concerns', () {
      const expected = [
        'hd_age_spot',
        'hd_pore',
        'hd_wrinkle',
        'hd_redness',
        'hd_texture',
        'hd_acne',
        'hd_moisture',
        'hd_oiliness',
        'hd_radiance',
        'hd_dark_circle',
        'hd_eye_bag',
        'hd_droopy_upper_eyelid',
        'hd_droopy_lower_eyelid',
        'hd_firmness',
        'hd_tear_trough',
        'hd_skin_type',
      ];
      for (final id in expected) {
        expect(kPerfectHdFaceExplorerRoles.containsKey(id), isTrue, reason: id);
      }
      expect(
        kPerfectHdFaceExplorerRoles['hd_skin_type'],
        FaceExplorerRole.separateComponent,
      );
      expect(
        kPerfectHdFaceExplorerRoles['hd_moisture'],
        FaceExplorerRole.primary,
      );
    });

    test('metric switch does not keep stale key when next missing', () {
      final next = nextSelectedMaskKey(
        previousKey: 'hd_age_spot::root',
        nextKey: 'hd_moisture::root',
        availableKeys: const ['hd_age_spot::root'],
      );
      expect(next, isNull);
    });

    test('metric switch replaces previous key when available', () {
      final next = nextSelectedMaskKey(
        previousKey: 'hd_age_spot::root',
        nextKey: 'hd_moisture::root',
        availableKeys: const ['hd_age_spot::root', 'hd_moisture::root'],
      );
      expect(next, 'hd_moisture::root');
      expect(next, isNot('hd_age_spot::root'));
    });
  });
}
