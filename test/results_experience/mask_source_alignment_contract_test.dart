import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/results_experience/domain/mask_source_alignment_contract.dart';

void main() {
  group('MaskSourceAlignmentContract', () {
    test('identical dims → fullFrameAligned overlay OK', () {
      final d = MaskSourceAlignmentContract.decide(
        sourceWidth: 1200,
        sourceHeight: 1680,
        maskWidth: 1200,
        maskHeight: 1680,
        alignedWithSource: true,
      );
      expect(d.mode, MaskSourceAlignmentMode.fullFrameAligned);
      expect(d.mayOverlaySpatially, isTrue);
    });

    test('same aspect different resolution → resampled overlay OK', () {
      final d = MaskSourceAlignmentContract.decide(
        sourceWidth: 1200,
        sourceHeight: 1680,
        maskWidth: 600,
        maskHeight: 840,
        alignedWithSource: false,
      );
      expect(d.mode, MaskSourceAlignmentMode.fullFrameResampled);
      expect(d.mayOverlaySpatially, isTrue);
    });

    test('aspect mismatch → refuse distorting fill', () {
      final d = MaskSourceAlignmentContract.decide(
        sourceWidth: 1200,
        sourceHeight: 1680,
        maskWidth: 800,
        maskHeight: 800,
        alignedWithSource: false,
      );
      expect(d.mode, MaskSourceAlignmentMode.unknownIncompatible);
      expect(d.mayOverlaySpatially, isFalse);
    });

    test('missing mask dims → incompatible', () {
      final d = MaskSourceAlignmentContract.decide(
        sourceWidth: 1200,
        sourceHeight: 1680,
        maskWidth: null,
        maskHeight: null,
        alignedWithSource: null,
      );
      expect(d.mayOverlaySpatially, isFalse);
    });
  });
}
