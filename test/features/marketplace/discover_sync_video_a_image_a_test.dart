import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/navigation/mira_route_observer.dart';
import 'package:mirra/features/marketplace/domain/entities/catalog_product.dart';
import 'package:mirra/features/marketplace/presentation/presentation/discover_presentation_catalog.dart';
import 'package:mirra/features/marketplace/presentation/presentation/presentation_models.dart';
import 'package:mirra/features/marketplace/presentation/presentation/presentation_video_port.dart';
import 'package:mirra/features/marketplace/presentation/screens/discover_presentation_screen.dart';
import 'package:mirra/shared/theme/theme.dart';

import 'controllable_video_controller.dart';

PresentationSlide _mixSlide() {
  return PresentationSlide(
    entityId: 'mix-screen',
    partnerId: 'partner-mix',
    title: 'مزيج وسائط',
    partnerName: 'شريك',
    kindLabel: 'منتج',
    priceLabel: '10 ر.س',
    product: CatalogProduct(
      id: 'mix-screen',
      partnerId: 'partner-mix',
      partnerNameAr: 'شريك',
      nameAr: 'مزيج',
      nameEn: 'Mix',
      priceHalalas: 1000,
      priceLabel: '10 ر.س',
      externalUrl: 'https://example.invalid/product',
      matchScore: 0,
    ),
    media: const [
      PresentationMedia(
        kind: PresentationMediaKind.video,
        assetPath: PresentationSamples.clip,
      ),
      PresentationMedia(
        kind: PresentationMediaKind.image,
        assetPath: PresentationSamples.square,
      ),
    ],
    sampleMedia: true,
  );
}

(AssetVideoPort, ControllableVideoController, ControllableVideoController) _portPair() {
  final first = ControllableVideoController(PresentationSamples.clip)..advanceOnPlay = true;
  final second = ControllableVideoController(PresentationSamples.clip)..advanceOnPlay = true;
  var created = 0;
  final port = AssetVideoPort(
    createController: (_) {
      created += 1;
      return created == 1 ? first : second;
    },
  );
  return (port, first, second);
}

Future<PageController> _pumpScreen(WidgetTester tester, AssetVideoPort port) async {
  tester.view.physicalSize = const Size(400, 800);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.lightTheme,
      navigatorObservers: [miraRouteObserver],
      home: DiscoverPresentationScreen(slides: [_mixSlide()], videoPort: port),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 80));
  final horizontal = tester.widget<PageView>(find.byType(PageView).last);
  final c = horizontal.controller;
  expect(c, isNotNull);
  return c!;
}

/// Real [DiscoverPresentationScreen] tests — fling and jump stay separate.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(ControllableVideoController.instances.clear);

  testWidgets('horizontal fling alone moves video→image→video pages', (tester) async {
    final (port, first, _) = _portPair();
    addTearDown(() async {
      await port.release();
    });
    final pageController = await _pumpScreen(tester, port);
    expect(port.activeSlot?.mediaIndex, 0);
    expect(first.lastVolume, 1);

    final horizontalFinder = find.byType(PageView).last;
    await tester.fling(horizontalFinder, const Offset(-320, 0), 800);
    await tester.pumpAndSettle();
    expect(
      pageController.page?.round(),
      1,
      reason: 'fling must reach image — do not hide failure with jumpToPage',
    );

    await tester.fling(horizontalFinder, const Offset(320, 0), 800);
    await tester.pumpAndSettle();
    expect(
      pageController.page?.round(),
      0,
      reason: 'fling back must reach video — do not hide failure with jumpToPage',
    );
  });

  testWidgets(
    'PageController jump video→image→video: delayed cut does not release new attach',
    (tester) async {
      final first = ControllableVideoController(PresentationSamples.clip)
        ..advanceOnPlay = true;
      final second = ControllableVideoController(PresentationSamples.clip)
        ..advanceOnPlay = true;
      var created = 0;
      final port = AssetVideoPort(
        createController: (_) {
          created += 1;
          return created == 1 ? first : second;
        },
      );
      addTearDown(() async {
        await port.release();
      });

      final pageController = await _pumpScreen(tester, port);
      expect(port.activeSlot?.mediaIndex, 0);
      final genAtVideo = port.debugGeneration;

      first.volumeGate = Completer<void>();
      pageController.jumpToPage(1);
      await tester.pumpAndSettle();
      expect(pageController.page?.round(), 1);
      expect(first.volumeGate!.isCompleted, isFalse);

      pageController.jumpToPage(0);
      await tester.pumpAndSettle();
      expect(pageController.page?.round(), 0);
      expect(port.debugGeneration, greaterThan(genAtVideo));

      first.volumeGate!.complete();
      await tester.pump(const Duration(milliseconds: 150));
      await tester.pump();

      expect(port.activeSlot?.mediaIndex, 0);
      expect(port.activeSlot?.slideId, 'mix-screen');
      if (created >= 2) {
        expect(second.lastVolume, isNot(0));
      }
      expect(port.audiblePlayingCount, lessThanOrEqualTo(1));

      pageController.jumpToPage(1);
      await tester.pumpAndSettle();
      pageController.jumpToPage(0);
      await tester.pumpAndSettle();
      expect(port.activeSlot?.mediaIndex, 0);
    },
  );
}
