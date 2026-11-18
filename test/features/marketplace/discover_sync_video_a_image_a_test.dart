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

/// Real [DiscoverPresentationScreen] horizontal A→image→A (drives the screen's
/// PageController / onPageChanged → _syncVideo — not copied guards).
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(ControllableVideoController.instances.clear);

  testWidgets(
    'DiscoverPresentationScreen video→image→video keeps new attach after delayed cut',
    (tester) async {
      tester.view.physicalSize = const Size(400, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);

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

      final slide = PresentationSlide(
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

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          navigatorObservers: [miraRouteObserver],
          home: DiscoverPresentationScreen(slides: [slide], videoPort: port),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 80));

      expect(port.activeSlot?.slideId, 'mix-screen');
      expect(port.activeSlot?.mediaIndex, 0);
      expect(first.lastVolume, 1);
      final genAtVideo = port.debugGeneration;

      first.volumeGate = Completer<void>();

      final horizontalFinder = find.byType(PageView).last;
      final pageController = tester.widget<PageView>(horizontalFinder).controller;
      expect(pageController, isNotNull);

      var usedControllerFallback = false;
      await tester.fling(horizontalFinder, const Offset(-320, 0), 800);
      await tester.pumpAndSettle();
      if (pageController!.page?.round() != 1) {
        usedControllerFallback = true;
        pageController.jumpToPage(1);
        await tester.pumpAndSettle();
      }
      expect(pageController.page?.round(), 1, reason: 'horizontal page is image');

      // _syncVideo starts cut async and keeps _held until cut finishes — so
      // activeSlot may still be video while the page shows the image.
      expect(first.volumeGate!.isCompleted, isFalse);

      await tester.fling(horizontalFinder, const Offset(320, 0), 800);
      await tester.pumpAndSettle();
      if (pageController.page?.round() != 0) {
        usedControllerFallback = true;
        pageController.jumpToPage(0);
        await tester.pumpAndSettle();
      }
      expect(pageController.page?.round(), 0, reason: 'return to video page');
      expect(port.debugGeneration, greaterThan(genAtVideo));

      first.volumeGate!.complete();
      await tester.pump(const Duration(milliseconds: 150));
      await tester.pump();

      expect(port.activeSlot?.mediaIndex, 0);
      expect(port.activeSlot?.slideId, 'mix-screen');
      if (created >= 2) {
        expect(second.lastVolume, isNot(0), reason: 'new player stays audible');
      }
      expect(port.audiblePlayingCount, lessThanOrEqualTo(1));

      pageController.jumpToPage(1);
      await tester.pumpAndSettle();
      pageController.jumpToPage(0);
      await tester.pumpAndSettle();
      expect(port.activeSlot?.mediaIndex, 0);

      debugPrint(
        'MIRA_TEST_SCREEN_SWIPE fallbackToController=$usedControllerFallback',
      );
    },
  );
}
