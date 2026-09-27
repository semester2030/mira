import 'dart:ui';

import 'package:flutter/painting.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/results_experience/presentation/geometry/shared_image_mask_fit.dart';

void main() {
  group('SharedImageMaskFit.containRect', () {
    test('portrait source in square viewport letterboxes horizontally', () {
      final dest = SharedImageMaskFit.containRect(
        viewport: const Size(300, 300),
        sourceSize: const Size(100, 200),
      );
      // scale = min(3, 1.5) = 1.5 → 150×300, centered
      expect(dest.width, closeTo(150, 0.01));
      expect(dest.height, closeTo(300, 0.01));
      expect(dest.left, closeTo(75, 0.01));
      expect(dest.top, closeTo(0, 0.01));
    });

    test('landscape source in square viewport letterboxes vertically', () {
      final dest = SharedImageMaskFit.containRect(
        viewport: const Size(300, 300),
        sourceSize: const Size(200, 100),
      );
      expect(dest.width, closeTo(300, 0.01));
      expect(dest.height, closeTo(150, 0.01));
      expect(dest.left, closeTo(0, 0.01));
      expect(dest.top, closeTo(75, 0.01));
    });

    test('matching aspect fills viewport (no double letterbox)', () {
      final dest = SharedImageMaskFit.containRect(
        viewport: const Size(240, 336), // 1200/1680
        sourceSize: const Size(1200, 1680),
      );
      expect(dest.left, closeTo(0, 0.01));
      expect(dest.top, closeTo(0, 0.01));
      expect(dest.width, closeTo(240, 0.01));
      expect(dest.height, closeTo(336, 0.01));
    });

    test(
      'mismatched photo vs hardcoded 1200/1680 would drift — shared grid does not',
      () {
        // Old bug: AspectRatio(1200/1680) + independent contain of a 1080×1440
        // photo vs a 1200×1680 mask → different letterbox insets.
        const viewport = Size(300, 420); // 5:7 ≈ 1200:1680
        const photo = Size(1080, 1440); // 3:4
        const mask = Size(1200, 1680);

        final photoOnly = SharedImageMaskFit.containRect(
          viewport: viewport,
          sourceSize: photo,
        );
        final maskOnly = SharedImageMaskFit.containRect(
          viewport: viewport,
          sourceSize: mask,
        );
        // Independent contains diverge (proves the old dual-contain hazard).
        final drift =
            (photoOnly.top - maskOnly.top).abs() +
            (photoOnly.height - maskOnly.height).abs();
        expect(drift > 0.5, isTrue);

        // Production contract: ONE dest from SOURCE photo; mask forced into it.
        final shared = SharedImageMaskFit.containRect(
          viewport: viewport,
          sourceSize: photo,
        );
        expect(shared, photoOnly);
        expect(shared.width, isPositive);
        expect(shared.height, isPositive);
      },
    );

    test('zero / invalid sizes yield empty rect', () {
      expect(
        SharedImageMaskFit.containRect(
          viewport: Size.zero,
          sourceSize: const Size(100, 100),
        ),
        Rect.zero,
      );
    });
  });

  group('SharedImageMaskFit sourceNorm mapping', () {
    test('corners map to dest corners', () {
      const viewport = Size(200, 400);
      const source = Size(100, 200);
      final dest = SharedImageMaskFit.containRect(
        viewport: viewport,
        sourceSize: source,
      );
      final tl = SharedImageMaskFit.sourceNormToViewport(
        viewport: viewport,
        sourceSize: source,
        sourceNorm01: Offset.zero,
      );
      final br = SharedImageMaskFit.sourceNormToViewport(
        viewport: viewport,
        sourceSize: source,
        sourceNorm01: const Offset(1, 1),
      );
      expect(tl.dx, closeTo(dest.left, 0.01));
      expect(tl.dy, closeTo(dest.top, 0.01));
      expect(br.dx, closeTo(dest.right, 0.01));
      expect(br.dy, closeTo(dest.bottom, 0.01));
    });

    test('center maps to viewport center for matching aspect', () {
      const viewport = Size(300, 400);
      const source = Size(900, 1200);
      final mid = SharedImageMaskFit.sourceNormToViewport(
        viewport: viewport,
        sourceSize: source,
        sourceNorm01: const Offset(0.5, 0.5),
      );
      expect(mid.dx, closeTo(150, 0.5));
      expect(mid.dy, closeTo(200, 0.5));
    });

    test('alignment conversion is symmetric around center', () {
      expect(
        SharedImageMaskFit.sourceNormToAlignment(const Offset(0.5, 0.5)),
        Alignment.center,
      );
      expect(
        SharedImageMaskFit.sourceNormToAlignment(Offset.zero),
        const Alignment(-1, -1),
      );
      expect(
        SharedImageMaskFit.sourceNormToAlignment(const Offset(1, 1)),
        const Alignment(1, 1),
      );
    });
  });

  group('no double-transform contract', () {
    test('contain then norm-to-viewport is identity for fill case', () {
      const viewport = Size(120, 168);
      const source = Size(1200, 1680);
      // Same aspect → dest fills viewport; scale applied once.
      final dest = SharedImageMaskFit.containRect(
        viewport: viewport,
        sourceSize: source,
      );
      expect(dest, Offset.zero & viewport);
      final p = SharedImageMaskFit.sourceNormToViewport(
        viewport: viewport,
        sourceSize: source,
        sourceNorm01: const Offset(0.25, 0.75),
      );
      expect(p.dx, closeTo(30, 0.01));
      expect(p.dy, closeTo(126, 0.01));
    });
    test('cover crops; fill stretches to viewport — not interchangeable', () {
      const viewport = Size(300, 300);
      const source = Size(100, 200);
      final cover = SharedImageMaskFit.coverRect(
        viewport: viewport,
        sourceSize: source,
      );
      final fill = SharedImageMaskFit.fillRect(viewport: viewport);
      expect(cover, isNot(fill));
      expect(cover.width, closeTo(300, 0.01));
      expect(cover.height, closeTo(600, 0.01));
      expect(cover.top, closeTo(-150, 0.01));
      expect(fill, Offset.zero & viewport);
    });
  });
}
