import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/results_experience/presentation/geometry/magnifier_focus_binder.dart';
import 'package:mirra/features/results_experience/presentation/geometry/shared_image_mask_fit.dart';

void main() {
  group('MagnifierFocusBinder', () {
    test('user tap survives rebuild / zoom / compare for same binding', () {
      final binder = MagnifierFocusBinder();
      const binding = 'maskA|whole|luminanceGate|src1';
      binder.setUserFocus(
        sourceNorm01: const Offset(0.22, 0.78),
        bindingKey: binding,
      );

      // Simulate rebuild with auto centroid elsewhere — user wins.
      final resolved = binder.resolve(
        bindingKey: binding,
        autoSourceNorm: const Offset(0.5, 0.5),
      );
      expect(resolved, const Offset(0.22, 0.78));
      expect(binder.shouldSkipAutoFor(binding), isTrue);

      // Zoom / compare do not clear binding.
      expect(
        binder.resolve(
          bindingKey: binding,
          autoSourceNorm: const Offset(0.1, 0.1),
        ),
        const Offset(0.22, 0.78),
      );
    });

    test('metric/mask change clears user focus only when caller clears', () {
      final binder = MagnifierFocusBinder();
      binder.setUserFocus(
        sourceNorm01: const Offset(0.3, 0.4),
        bindingKey: 'maskA|whole|x|src1',
      );
      // Different binding without clear → auto may apply for new key.
      expect(
        binder.resolve(
          bindingKey: 'maskB|whole|x|src1',
          autoSourceNorm: const Offset(0.55, 0.55),
        ),
        const Offset(0.55, 0.55),
      );
      binder.clearUserFocus();
      expect(binder.hasUserFocus, isFalse);
    });
  });

  group('tap → sourceNorm → viewport alignment (unified)', () {
    testWidgets('tap on image dest maps to same alignment used by ring/lens', (
      tester,
    ) async {
      // Portrait letterbox in square viewport — classic offset bug surface.
      const viewport = Size(300, 300);
      const source = Size(100, 200);
      final dest = SharedImageMaskFit.containRect(
        viewport: viewport,
        sourceSize: source,
      );
      // Tap at 30%, 70% of the painted photo dest (not the chip row).
      final tap = Offset(
        dest.left + dest.width * 0.30,
        dest.top + dest.height * 0.70,
      );
      final norm = SharedImageMaskFit.viewportToSourceNorm(
        viewport: viewport,
        sourceSize: source,
        viewportPoint: tap,
      );
      expect(norm, isNotNull);
      expect(norm!.dx, closeTo(0.30, 0.01));
      expect(norm.dy, closeTo(0.70, 0.01));

      final align = SharedImageMaskFit.sourceNormToViewportAlignment(
        viewport: viewport,
        sourceSize: source,
        sourceNorm01: norm,
      );
      // Round-trip: alignment center should land back near tap.
      final back = Offset(
        (align.x + 1) / 2 * viewport.width,
        (align.y + 1) / 2 * viewport.height,
      );
      expect(back.dx, closeTo(tap.dx, 0.5));
      expect(back.dy, closeTo(tap.dy, 0.5));

      // Outside dest (e.g. zoom-chip strip above image) must not map.
      expect(
        SharedImageMaskFit.viewportToSourceNorm(
          viewport: viewport,
          sourceSize: source,
          viewportPoint: Offset(10, dest.top - 20),
        ),
        isNull,
      );
    });

    testWidgets('zoom chip column offset must not feed image transform', (
      tester,
    ) async {
      // Reproduce the review bug: chips above image → local Y includes chip
      // height if GestureDetector wraps Column. Image-only detector uses
      // local coords relative to the image box (y starts at 0 on photo).
      const chipRowHeight = 40.0;
      const imageVp = Size(240, 300);
      const source = Size(120, 160);

      // Wrong: Column-local tap meant for face center, still fed as image-local.
      final wrongLocal = Offset(
        imageVp.width / 2,
        chipRowHeight + imageVp.height / 2,
      );
      final wrongNorm = SharedImageMaskFit.viewportToSourceNorm(
        viewport: imageVp,
        sourceSize: source,
        viewportPoint: wrongLocal,
      );

      // Correct: image-local tap at center.
      final rightLocal = Offset(imageVp.width / 2, imageVp.height / 2);
      final rightNorm = SharedImageMaskFit.viewportToSourceNorm(
        viewport: imageVp,
        sourceSize: source,
        viewportPoint: rightLocal,
      );
      expect(rightNorm, isNotNull);
      expect(rightNorm!.dx, closeTo(0.5, 0.02));
      expect(rightNorm.dy, closeTo(0.5, 0.02));
      // Feeding chip-offset Y shifts the mapped source point downward.
      expect(wrongNorm, isNotNull);
      expect(wrongNorm!.dy, greaterThan(rightNorm.dy + 0.05));
    });
  });
}
