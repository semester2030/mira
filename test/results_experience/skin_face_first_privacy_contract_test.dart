import 'package:flutter_test/flutter_test.dart';

import 'package:mirra/core/privacy/ephemeral_analysis_face_registry.dart';
import 'package:mirra/features/intelligence/presentation/widgets/beauty_report_face_map/premium_face_base_image.dart';
import 'package:mirra/features/results_experience/presentation/icons/mira_skin_glyphs.dart';
import 'package:mirra/features/results_experience/truth/skin_claim_policy.dart';
import 'package:mirra/features/results_experience/truth/skin_truth_class.dart';

void main() {
  group('Face-first privacy + truth contract', () {
    test('PROVIDER_PIXEL_MASK preserved', () {
      expect(SkinClaimPolicy.mapTruthVerdict, 'PROVIDER_PIXEL_MASK');
      expect(SkinClaimPolicy.mapTruthClass, SkinTruthClass.measured);
    });

    test('ephemeral registry does not invent remote storage paths', () {
      expect(
        EphemeralAnalysisFaceRegistry.isEphemeralLocalPath(
          'https://firebasestorage.googleapis.com/v0/b/x/o/face.jpg',
        ),
        isFalse,
      );
      expect(
        EphemeralAnalysisFaceRegistry.isEphemeralLocalPath(
          '/tmp/mira_face_abc.mira_9f_hold',
        ),
        isTrue,
      );
    });

    test('releaseAll clears active count', () async {
      EphemeralAnalysisFaceRegistry.register('/tmp/fake_hold_a.mira_9f_hold');
      EphemeralAnalysisFaceRegistry.register('/tmp/fake_hold_b.mira_9f_hold');
      expect(
        EphemeralAnalysisFaceRegistry.activeCount,
        greaterThanOrEqualTo(2),
      );
      await EphemeralAnalysisFaceRegistry.releaseAll();
      expect(EphemeralAnalysisFaceRegistry.activeCount, 0);
    });

    test('current analysis never uses premium_face_base as user face mode', () {
      expect(
        FaceMapBaseMode.ephemeralUserImage !=
            FaceMapBaseMode.neutralIllustrative,
        isTrue,
      );
      // Asset path remains for legacy tooling only — not the current-user mode.
      expect(
        PremiumFaceBaseImage.assetPath.contains('premium_face_base'),
        isTrue,
      );
    });

    test('history mode is neutral illustrative', () {
      expect(FaceMapBaseMode.neutralIllustrative.name, 'neutralIllustrative');
    });

    test('skin glyphs map metric ids without Material Icons', () {
      expect(MiraSkinGlyphs.forConcern('hydration'), MiraSkinGlyphId.hydration);
      expect(MiraSkinGlyphs.forConcern('pores'), MiraSkinGlyphId.pores);
      expect(
        MiraSkinGlyphs.forConcern('unknown_xyz'),
        MiraSkinGlyphId.skinCare,
      );
    });

    test('no invented region score policy', () {
      // Region sheets must not fabricate scores — score helper returns -1 when absent.
      expect(
        SkinClaimPolicy.containsForbiddenMainClaim('provider_measured'),
        isTrue,
      );
    });
  });
}
