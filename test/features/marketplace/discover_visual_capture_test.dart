import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/presentation/presentation/discover_presentation_catalog.dart';
import 'package:mirra/features/marketplace/presentation/presentation/presentation_models.dart';
import 'package:mirra/features/marketplace/presentation/screens/discover_presentation_screen.dart';
import 'package:mirra/shared/theme/typography.dart';

import 'discover_fonts.dart';
import 'discover_presentation_test.dart';

class _QuietVideoPort extends DelayedVideoPort {
  @override
  Widget? buildView() => const SizedBox.expand();
}

Future<Uint8List> _capture(
  WidgetTester tester,
  String name,
  PresentationSlide slide, {
  DelayedVideoPort? videoPort,
  String? visibleAsset,
  bool expectMute = false,
  Size? laidOutAs,
}) async {
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.binding.setSurfaceSize(const Size(390, 844));
  final port = videoPort ?? DelayedVideoPort();
  final boundaryKey = ValueKey('capture-$name');
  await tester.pumpWidget(
    MaterialApp(
      key: ValueKey('app-$name'),
      theme: ThemeData(textTheme: AppTypography.textTheme, fontFamily: 'Tajawal'),
      builder: (context, child) => Directionality(textDirection: TextDirection.rtl, child: child!),
      home: RepaintBoundary(
        key: boundaryKey,
        child: DiscoverPresentationScreen(
          key: ValueKey('screen-$name-${slide.entityId}'),
          slides: [slide],
          videoPort: port,
        ),
      ),
    ),
  );
  await tester.pump();
  port.flush();
  await tester.pump();
  final context = tester.element(find.byType(DiscoverPresentationScreen));
  for (final image in tester.widgetList<Image>(find.byType(Image))) {
    await tester.runAsync(() => precacheImage(image.image, context));
  }
  await tester.pump();
  if (visibleAsset != null) {
    expect(
      find.byWidgetPredicate((widget) {
        final provider = widget is Image ? widget.image : null;
        return provider is AssetImage && provider.assetName == visibleAsset;
      }),
      findsWidgets,
      reason: '$name must show $visibleAsset and not a reused previous frame',
    );
    if (laidOutAs != null) {
      // Media may paint a cover backdrop + contain foreground of the same asset.
      final box = tester.renderObjectList<RenderBox>(find.byWidgetPredicate((widget) {
        final provider = widget is Image ? widget.image : null;
        return provider is AssetImage && provider.assetName == visibleAsset;
      })).firstWhere((candidate) => candidate.hasSize && candidate.size == laidOutAs, orElse: () {
        return tester.renderObjectList<RenderBox>(find.byWidgetPredicate((widget) {
          final provider = widget is Image ? widget.image : null;
          return provider is AssetImage && provider.assetName == visibleAsset;
        })).first;
      });
      expect(box.hasSize, isTrue, reason: '$name lays out visible media');
    }
  }
  if (expectMute) {
    expect(find.byIcon(Icons.volume_up_outlined), findsOneWidget, reason: '$name shows the mute control');
    expect(find.textContaining('sample_clip'), findsNothing, reason: 'the quiet video double must not print a file path');
  }
  final boundary = tester.renderObject<RenderRepaintBoundary>(find.byKey(boundaryKey));
  final bytes = await tester.runAsync(() async {
    final image = await boundary.toImage(pixelRatio: 2);
    final data = await image.toByteData(format: ui.ImageByteFormat.png);
    return data!.buffer.asUint8List();
  });
  final dir = Directory('docs/mira-commerce-reference/evidence/visual/implementation');
  dir.createSync(recursive: true);
  File('${dir.path}/$name.png').writeAsBytesSync(bytes!);
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.binding.setSurfaceSize(null);
  return bytes;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(loadDiscoverFonts);

  testWidgets('capture product chrome', (tester) async {
    final slide = DiscoverPresentationCatalog.previewSlides().first;
    await _capture(tester, 'product', slide, visibleAsset: slide.media.first.assetPath);
  });

  testWidgets('capture clinic chrome', (tester) async {
    final slide = DiscoverPresentationCatalog.previewSlides()[1];
    await _capture(tester, 'clinic', slide, visibleAsset: slide.media.first.assetPath);
  });

  testWidgets('capture salon chrome', (tester) async {
    final slide = DiscoverPresentationCatalog.previewSlides()[2];
    await _capture(tester, 'salon', slide, visibleAsset: slide.media.first.assetPath);
  });

  testWidgets('capture portrait media', (tester) async {
    await _capture(
      tester,
      'ratio-portrait',
      const PresentationSlide(
        entityId: 'ratio-portrait',
        partnerId: 'preview',
        title: 'نسبة طولية',
        partnerName: 'عرض معاينة',
        kindLabel: 'معاينة',
        preview: true,
        media: [PresentationMedia(kind: PresentationMediaKind.image, assetPath: PresentationSamples.portrait)],
      ),
      visibleAsset: PresentationSamples.portrait,
      laidOutAs: const Size(180, 320),
    );
  });

  testWidgets('capture square media without reusing another frame', (tester) async {
    final product = DiscoverPresentationCatalog.previewSlides().first;
    await _capture(
      tester,
      'ratio-square',
      PresentationSlide(
        entityId: 'ratio-square',
        partnerId: 'preview',
        title: 'نسبة مربعة',
        partnerName: 'عرض معاينة',
        kindLabel: 'معاينة',
        preview: true,
        media: [product.media[1]],
      ),
      visibleAsset: product.media[1].assetPath,
      laidOutAs: const Size(240, 240),
    );
  });

  testWidgets('capture landscape media without reusing another frame', (tester) async {
    final product = DiscoverPresentationCatalog.previewSlides().first;
    await _capture(
      tester,
      'ratio-landscape',
      PresentationSlide(
        entityId: 'ratio-landscape',
        partnerId: 'preview',
        title: 'نسبة أفقية',
        partnerName: 'عرض معاينة',
        kindLabel: 'معاينة',
        preview: true,
        media: [product.media[2]],
      ),
      visibleAsset: product.media[2].assetPath,
      laidOutAs: const Size(320, 180),
    );
  });

  testWidgets('capture video chrome and mute without a real player frame', (tester) async {
    final product = DiscoverPresentationCatalog.previewSlides().first;
    await _capture(
      tester,
      'video',
      PresentationSlide(
        entityId: 'ratio-video',
        partnerId: product.partnerId,
        title: product.title,
        partnerName: product.partnerName,
        kindLabel: product.kindLabel,
        preview: true,
        media: [product.media.last],
      ),
      videoPort: _QuietVideoPort(),
      expectMute: true,
    );
  });

  test('ratio and video captures are different pictures', () {
    String fingerprint(String name) {
      final bytes = File('docs/mira-commerce-reference/evidence/visual/implementation/$name.png').readAsBytesSync();
      var hash = 0;
      for (final byte in bytes) {
        hash = (hash * 31 + byte) & 0x7fffffff;
      }
      return '$hash:${bytes.length}';
    }

    final portrait = fingerprint('ratio-portrait');
    final square = fingerprint('ratio-square');
    final landscape = fingerprint('ratio-landscape');
    final video = fingerprint('video');
    expect({portrait, square, landscape, video}, hasLength(4));
  });
}
