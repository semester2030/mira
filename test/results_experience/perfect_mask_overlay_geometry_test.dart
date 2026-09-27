import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as im;
import 'package:mirra/features/results_experience/presentation/geometry/shared_image_mask_fit.dart';
import 'package:mirra/features/results_experience/presentation/geometry/skin_face_map_visual_tokens.dart';
import 'package:mirra/features/results_experience/presentation/widgets/perfect_mask_overlay.dart';

Uint8List _png({
  required int w,
  required int h,
  required void Function(im.Image img) paint,
}) {
  final img = im.Image(width: w, height: h, numChannels: 4);
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      img.setPixelRgba(x, y, 20, 20, 20, 255);
    }
  }
  paint(img);
  return Uint8List.fromList(im.encodePng(img));
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('PerfectMaskOverlay real render geometry', () {
    testWidgets('photo and mask share identical dest size (mask resampled)', (
      tester,
    ) async {
      // Source 90×120; mask different resolution, same aspect 3:4.
      final source = _png(
        w: 90,
        h: 120,
        paint: (img) {
          // Marker at 25%, 75%
          final mx = (90 * 0.25).round();
          final my = (120 * 0.75).round();
          for (var dy = -1; dy <= 1; dy++) {
            for (var dx = -1; dx <= 1; dx++) {
              img.setPixelRgba(mx + dx, my + dy, 0, 255, 0, 255);
            }
          }
        },
      );
      final mask = _png(
        w: 180,
        h: 240,
        paint: (img) {
          final mx = (180 * 0.25).round();
          final my = (240 * 0.75).round();
          for (var dy = -2; dy <= 2; dy++) {
            for (var dx = -2; dx <= 2; dx++) {
              img.setPixelRgba(mx + dx, my + dy, 255, 255, 255, 255);
            }
          }
        },
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Center(
              child: SizedBox(
                width: 300,
                height: 400,
                child: PerfectMaskOverlay(
                  sourceBytes: source,
                  maskBytes: mask,
                  sourceWidth: 90,
                  sourceHeight: 120,
                  tint: const Color(0xFFFF0000),
                  opacity: 1,
                  presentationDecoded: true,
                  fadeDuration: Duration.zero,
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final images = tester.widgetList<Image>(find.byType(Image)).toList();
      expect(images.length, greaterThanOrEqualTo(2));
      final sizes = images
          .map((i) => Size(i.width ?? -1, i.height ?? -1))
          .where((s) => s.width > 0 && s.height > 0)
          .toList();
      expect(sizes.length, greaterThanOrEqualTo(2));
      expect(sizes[0], sizes[1]);

      // Known marker maps through shared contain math (tolerance 1.5px).
      const viewport = Size(300, 400);
      const sourceSize = Size(90, 120);
      final expected = SharedImageMaskFit.sourceNormToViewport(
        viewport: viewport,
        sourceSize: sourceSize,
        sourceNorm01: const Offset(0.25, 0.75),
      );
      final dest = SharedImageMaskFit.containRect(
        viewport: viewport,
        sourceSize: sourceSize,
      );
      expect(dest.width, closeTo(sizes[0].width, 1.5));
      expect(dest.height, closeTo(sizes[0].height, 1.5));
      expect(expected.dx, inInclusiveRange(dest.left, dest.right));
      expect(expected.dy, inInclusiveRange(dest.top, dest.bottom));
    });

    testWidgets('cover dest differs from fill stretch', (tester) async {
      final source = _png(w: 100, h: 200, paint: (_) {});
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SizedBox(
              width: 300,
              height: 300,
              child: PerfectMaskOverlay(
                sourceBytes: source,
                maskBytes: source,
                sourceWidth: 100,
                sourceHeight: 200,
                tint: Colors.red,
                fit: BoxFit.cover,
                fadeDuration: Duration.zero,
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      final cover = SharedImageMaskFit.coverRect(
        viewport: const Size(300, 300),
        sourceSize: const Size(100, 200),
      );
      final fill = SharedImageMaskFit.fillRect(viewport: const Size(300, 300));
      // Cover crops (taller than viewport); fill is exactly viewport.
      expect(cover.height, greaterThan(fill.height));
      expect(cover.width, closeTo(fill.width, 0.01));
    });
  });

  group('visibility mapping preserves sparse signal vs wash', () {
    test('floor suppresses gray wash; keeps bright lesion', () {
      final profile = PerfectMaskPresentationProfile.acne;
      final wash = SkinFaceMapVisualTokens.presentationAlphaFromPerfectRgba(
        r: 61,
        g: 61,
        b: 61,
        a: 200,
        profile: profile,
      );
      final lesion = SkinFaceMapVisualTokens.presentationAlphaFromPerfectRgba(
        r: 200,
        g: 180,
        b: 160,
        a: 200,
        profile: profile,
      );
      expect(wash, 0);
      expect(lesion, greaterThan(40));
    });
  });
}
