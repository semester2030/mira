import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/results_experience/truth/skin_claim_policy.dart';
import 'package:mirra/features/results_experience/truth/skin_truth_class.dart';
import 'package:mirra/features/results_experience/semantics/metric_presentation_policy.dart';

void main() {
  group('Skin Interactive Visual Polish truth & handoff', () {
    test('PROVIDER_PIXEL_MASK map truth preserved', () {
      expect(SkinClaimPolicy.mapTruthVerdict, 'PROVIDER_PIXEL_MASK');
      expect(SkinClaimPolicy.mapTruthClass, SkinTruthClass.measured);
      expect(
        SkinClaimPolicy.mapPrecisionDisclaimerAr().contains('أقنعة'),
        isTrue,
      );
      expect(
        SkinClaimPolicy.mapPrecisionDisclaimerAr().toLowerCase().contains(
          'pixel-accurate',
        ),
        isFalse,
      );
    });

    test('main report forbids technical string leaks', () {
      for (final leak in ['provider_measured', 'locally_calculated', 'raw=']) {
        expect(SkinClaimPolicy.containsForbiddenMainClaim(leak), isTrue);
      }
    });

    test('public metric labels stay consumer Arabic', () {
      expect(MetricPresentationPolicy.publicLabelAr('hydration'), isNotEmpty);
      expect(
        MetricPresentationPolicy.publicLabelAr(
          'hydration',
        ).contains('provider'),
        isFalse,
      );
    });

    test('Ask Mira seed stays consumer Arabic without internal tokens', () {
      const seed = 'اشرحي لي مؤشر الترطيب بناءً على تقريري';
      expect(seed.contains('PROVIDER_PIXEL_MASK'), isFalse);
      expect(seed, contains('بناءً على تقريري'));
      expect(seed.contains('pixel'), isFalse);
    });
  });
}
