import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/results_experience/presentation/face_explorer/face_explorer_mask_presentation.dart';
import 'package:mirra/features/results_experience/presentation/face_explorer/face_explorer_lens_panel.dart';
import 'package:mirra/features/results_experience/presentation/face_explorer/face_explorer_image_loader.dart';
import 'package:mirra/features/results_experience/presentation/face_explorer/face_explorer_metrics.dart';
import 'package:mirra/features/results_experience/presentation/geometry/face_explorer_lens_geometry.dart';
import 'package:mirra/features/results_experience/presentation/geometry/skin_face_map_visual_tokens.dart';
import 'package:mirra/features/results_experience/presentation/widgets/perfect_mask_overlay.dart';

void main() {
  group('Lens geometry regressions', () {
    test(
      'off-centre selection stays centred across width, aspect and zoom',
      () {
        for (final source in [
          const Size(720, 1280),
          const Size(1280, 720),
          const Size(1080, 1080),
        ]) {
          for (final width in [220.0, 300.0, 376.0, 500.0]) {
            for (final zoom in [2.0, 3.0]) {
              for (final focus in [
                const Offset(0.05, 0.05),
                const Offset(0.22, 0.78),
                const Offset(0.76, 0.60),
                const Offset(0.95, 0.95),
              ]) {
                final rect = FaceExplorerLensGeometry.imageRect(
                  sourceSize: source,
                  stageViewport: const Size(285, 380),
                  lensViewport: Size(width, 150),
                  focusSourceNorm: focus,
                  zoom: zoom,
                );
                expect(
                  rect.left + focus.dx * rect.width,
                  closeTo(width / 2, 1e-8),
                );
                expect(rect.top + focus.dy * rect.height, closeTo(75, 1e-8));
                expect(
                  rect.width / rect.height,
                  closeTo(source.width / source.height, 1e-8),
                );
              }
            }
          }
        }
      },
    );

    test(
      '2x and 3x are relative to the MAIN photo, including letterboxing',
      () {
        for (final zoom in [2.0, 3.0]) {
          final rect = FaceExplorerLensGeometry.imageRect(
            sourceSize: const Size(1000, 1000),
            stageViewport: const Size(200, 400),
            lensViewport: const Size(340, 150),
            focusSourceNorm: const Offset(0.25, 0.75),
            zoom: zoom,
          );
          expect(rect.width, closeTo(200 * zoom, 1e-9));
          expect(rect.height, closeTo(200 * zoom, 1e-9));
        }
      },
    );

    test(
      'stage ring centre follows source point rather than Align child bounds',
      () {
        final point = FaceExplorerLensGeometry.stageFocusPoint(
          sourceSize: const Size(1000, 1000),
          stageViewport: const Size(200, 400),
          focusSourceNorm: const Offset(0.25, 0.75),
        );
        expect(point, const Offset(50, 250));
      },
    );

    test('unknown stage geometry does not fabricate a lens transform', () {
      final rect = FaceExplorerLensGeometry.imageRect(
        sourceSize: const Size(720, 1280),
        stageViewport: Size.zero,
        lensViewport: const Size(300, 150),
        focusSourceNorm: const Offset(0.5, 0.5),
        zoom: 2,
      );
      expect(rect, Rect.zero);
    });
  });

  group('One mask presentation for both views', () {
    test('raw fallback is never labelled already decoded', () {
      final raw = Uint8List.fromList([1, 2, 3]);
      for (final remapped in <Uint8List?>[null, Uint8List(0)]) {
        final presentation = FaceExplorerMaskPresentation.resolve(
          profile: PerfectMaskPresentationProfile.wrinkles,
          showSpatialOverlay: true,
          rawBytes: raw,
          remappedBytes: remapped,
        );
        expect(presentation.maskBytes, same(raw));
        expect(presentation.presentationDecoded, isFalse);
      }
    });

    test('converted mask is reused without a second alpha conversion', () {
      final converted = Uint8List.fromList([4, 5, 6]);
      final presentation = FaceExplorerMaskPresentation.resolve(
        profile: PerfectMaskPresentationProfile.wrinkles,
        showSpatialOverlay: true,
        rawBytes: Uint8List.fromList([1, 2, 3]),
        remappedBytes: converted,
      );
      expect(presentation.maskBytes, same(converted));
      expect(presentation.presentationDecoded, isTrue);
    });

    test(
      'compare/unavailable decision removes both raw and converted masks',
      () {
        final presentation = FaceExplorerMaskPresentation.resolve(
          profile: PerfectMaskPresentationProfile.wrinkles,
          showSpatialOverlay: false,
          rawBytes: Uint8List.fromList([1, 2, 3]),
          remappedBytes: Uint8List.fromList([4, 5, 6]),
        );
        expect(presentation.maskBytes, isNull);
      },
    );

    test('clarity preserves inactive pixels and existing detection gates', () {
      for (final id in [
        'wrinkles',
        'pores',
        'acne',
        'pigmentation',
        'oiliness',
      ]) {
        final before = SkinFaceMapVisualTokens.presentationProfileForConcern(
          id,
        );
        final after = FaceExplorerMaskPresentation.profileForConcern(id);
        expect(after.alphaMode, before.alphaMode);
        expect(after.alphaGain, before.alphaGain);
        expect(after.luminanceGateFloor, before.luminanceGateFloor);
        for (final alpha in [0, 1, 32, 128, 255]) {
          for (var channel = 0; channel <= 255; channel++) {
            int mapped(PerfectMaskPresentationProfile profile) =>
                SkinFaceMapVisualTokens.presentationAlphaFromPerfectRgba(
                  r: channel,
                  g: channel,
                  b: channel,
                  a: alpha,
                  profile: profile,
                );
            expect(
              mapped(after) == 0,
              mapped(before) == 0,
              reason: '$id alpha=$alpha luminance=$channel',
            );
          }
        }
        if (id == 'oiliness') {
          expect(after.minVisibleAlpha, before.minVisibleAlpha);
        }
      }
    });
  });

  test(
    'new source load clears the old picture before the first await',
    () async {
      final loader = FaceExplorerImageLoader(
        onChanged: () {},
        isMounted: () => true,
      );
      loader.snapshot = FaceExplorerImageSnapshot(
        sourceBytes: Uint8List.fromList([1, 2, 3]),
        sourceWidth: 720,
        sourceHeight: 1280,
      );
      final loading = loader.load(
        path: '/nonexistent-mira-four-fixes-test/photo.png',
        fromHistory: false,
      );
      expect(loader.snapshot.sourceBytes, isNull);
      expect(loader.snapshot.sourceWidth, isNull);
      loader.invalidate();
      await loading;
    },
  );

  testWidgets('rectangular lens centres the selected pixel at its actual width', (
    tester,
  ) async {
    final source = base64Decode(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    );
    const focus = Offset(0.22, 0.78);
    for (final width in [280.0, 360.0, 430.0]) {
      for (final zoom in [2.0, 3.0]) {
        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: Center(
                child: SizedBox(
                  width: width,
                  child: FaceExplorerLensPanel(
                    sourceBytes: source,
                    tint: Colors.green,
                    presentation: const FaceExplorerMaskPresentation(
                      profile: PerfectMaskPresentationProfile.standard,
                    ),
                    focusSourceNorm: focus,
                    zoom: zoom,
                    stageViewport: const Size(200, 400),
                    sourceWidth: 1,
                    sourceHeight: 1,
                    onToggleZoom: () {},
                    onHorizontal: (_) {},
                    onVertical: (_) {},
                  ),
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        final lens = tester.getRect(find.byType(ClipRRect).first);
        final image = tester.getRect(find.byType(PerfectMaskOverlay));
        expect(
          image.left + focus.dx * image.width,
          closeTo(lens.center.dx, 1e-6),
        );
        expect(
          image.top + focus.dy * image.height,
          closeTo(lens.center.dy, 1e-6),
        );
        expect(tester.takeException(), isNull);
      }
    }
  });

  Future<void> reading(
    WidgetTester tester, {
    String? region,
    double? score,
  }) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Directionality(
            textDirection: TextDirection.rtl,
            child: FaceExplorerReadingStrip(
              metricId: 'wrinkles',
              uiScore: score,
              accent: Colors.green,
              scoreRegion: region,
            ),
          ),
        ),
      ),
    );
  }

  testWidgets('regional score is named after the region, not whole face', (
    tester,
  ) async {
    await reading(tester, region: 'forehead', score: 77);
    expect(find.text('درجة الجبهة'), findsOneWidget);
    expect(find.text('77'), findsOneWidget);
    expect(find.text('الدرجة العامة'), findsNothing);
  });

  testWidgets(
    'missing region score is not replaced by zero or a general score',
    (tester) async {
      await reading(tester, region: 'forehead');
      expect(find.text('الجبهة — لا تتوفر درجة'), findsOneWidget);
      expect(find.text('الدرجة العامة'), findsNothing);
      expect(find.text('0'), findsNothing);
      expect(find.text('الأعلى أفضل'), findsNothing);
    },
  );

  testWidgets('whole-face score keeps its general scope', (tester) async {
    await reading(tester, region: 'whole', score: 74);
    expect(find.text('الدرجة العامة'), findsOneWidget);
    expect(find.text('74'), findsOneWidget);
  });
}
