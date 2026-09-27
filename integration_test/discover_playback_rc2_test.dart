import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mirra/core/navigation/mira_route_observer.dart';
import 'package:mirra/features/marketplace/presentation/marketplace_routes.dart';
import 'package:mirra/features/marketplace/presentation/presentation/discover_presentation_catalog.dart';
import 'package:mirra/features/marketplace/presentation/presentation/presentation_models.dart';
import 'package:mirra/features/marketplace/presentation/presentation/presentation_video_progress.dart';
import 'package:mirra/features/marketplace/presentation/screens/discover_presentation_screen.dart';
import 'package:video_player/video_player.dart';

/// Real [video_player] on device. Arabic + explicit RTL.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('presentation plays the sample clip and stops when covered', (tester) async {
    await tester.pumpWidget(_presentationApp());
    await tester.pump();
    await tester.pump(const Duration(seconds: 2));

    expect(find.text('سيروم فيتامين C'), findsOneWidget);
    expect(find.textContaining('عينة وسائط معزولة'), findsNothing);
    expect(find.textContaining('التفاف النص العربي'), findsNothing);
    final direction = tester.widget<Directionality>(find.byType(Directionality).first);
    expect(direction.textDirection, TextDirection.rtl);
    // ignore: avoid_print
    print('RC4_MARK rtl=${direction.textDirection} locale=ar');

    expect(find.byKey(const ValueKey('${PresentationSamples.portrait}-0')), findsOneWidget);
    // ignore: avoid_print
    print('RC4_MARK portrait-start verified=${PresentationSamples.portrait}');
    await _advanceToMedia(tester, PresentationSamples.square, label: 'square');
    await _advanceToMedia(tester, PresentationSamples.landscape, label: 'landscape');
    await _advanceToMedia(tester, PresentationSamples.clip, label: 'video-slide');

    final productPlayer = await _waitForActivePlayer(tester, timeoutSeconds: 45);
    final productController = productPlayer.controller;
    await _expectPlaybackProgress(tester, productController);
    // ignore: avoid_print
    print(
      'RC4_MARK product-video initialized=${productController.value.isInitialized} '
      'playing=${productController.value.isPlaying} position=${productController.value.position}',
    );

    // (أ) تفاصيل المنتج ثم الرجوع
    await tester.tap(find.text('التفاصيل'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 800));
    expect(productController.value.isPlaying, isFalse);
    expect(find.textContaining('ليس شراءً مؤكدًا'), findsOneWidget);

    tester.state<NavigatorState>(find.byType(Navigator)).pop();
    await tester.pump();
    final resumedProduct = await _waitForActivePlayer(tester);
    final resumedProductController = resumedProduct.controller;
    expect(identical(productController, resumedProductController), isFalse);
    expect(resumedProductController.value.isPlaying, isTrue);
    await _expectPlaybackProgress(tester, resumedProductController);
    // ignore: avoid_print
    print('RC4_MARK product-return newController playing');

    // (ب) خلفية محاكاة على شاشة العرض — RC4_LIFECYCLE_SIMULATED
    // ignore: avoid_print
    print('RC4_LIFECYCLE_SIMULATED background on visible presentation');
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pump(const Duration(milliseconds: 400));
    expect(resumedProductController.value.isPlaying, isFalse);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump(const Duration(seconds: 1));
    final afterBg = await _waitForActivePlayer(tester);
    expect(afterBg.controller.value.isPlaying, isTrue);
    await _expectPlaybackProgress(tester, afterBg.controller);

    await _verticalToService(tester);
    final servicePlayer = await _waitForActivePlayer(tester);
    final serviceController = servicePlayer.controller;
    await _expectPlaybackProgress(tester, serviceController);
    // ignore: avoid_print
    print('RC4_MARK service-video playing');

    await tester.tap(find.text('التفاصيل'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 800));
    expect(serviceController.value.isPlaying, isFalse);
    expect(find.text('الحجز قريباً'), findsOneWidget);

    // (ج) عودة للمقدمة والتفاصيل ما زالت فوق العرض
    // ignore: avoid_print
    print('RC4_LIFECYCLE_SIMULATED resume while service details cover presentation');
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pump(const Duration(milliseconds: 200));
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.text('الحجز قريباً'), findsOneWidget);
    expect(serviceController.value.isPlaying, isFalse);
    _expectNoPlayingVideo(tester);

    tester.state<NavigatorState>(find.byType(Navigator)).pop();
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    final afterServicePop = await _waitForActivePlayer(tester);
    expect(afterServicePop.controller.value.isPlaying, isTrue);
    await _expectPlaybackProgress(tester, afterServicePop.controller);
    // ignore: avoid_print
    print('RC4_MARK service-return resume');
  });
}

Widget _presentationApp() {
  return MaterialApp(
    locale: const Locale('ar'),
    supportedLocales: const [Locale('ar'), Locale('en')],
    localizationsDelegates: const [
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    builder: (context, child) {
      return Directionality(
        textDirection: TextDirection.rtl,
        child: child ?? const SizedBox.shrink(),
      );
    },
    navigatorObservers: [miraRouteObserver],
    onGenerateRoute: MarketplaceRoutes.onGenerate,
    home: DiscoverPresentationScreen(slides: DiscoverPresentationCatalog.slides()),
  );
}

Future<void> _advanceToMedia(WidgetTester tester, String assetPath, {required String label}) async {
  final reached = await _seekMedia(tester, assetPath, maxSteps: 8);
  expect(reached, isTrue, reason: 'could not reach $assetPath');
  // ignore: avoid_print
  print('RC4_MARK $label verified=$assetPath');
}

Future<bool> _seekMedia(WidgetTester tester, String assetPath, {required int maxSteps}) async {
  for (var step = 0; step < maxSteps; step++) {
    if (assetPath == PresentationSamples.clip) {
      if (find.byType(VideoPlayer).evaluate().isNotEmpty ||
          find.text('جاري تجهيز الفيديو').evaluate().isNotEmpty) {
        return true;
      }
    } else if (find.byKey(ValueKey('$assetPath-0')).evaluate().isNotEmpty) {
      return true;
    }
    await _dragNextMedia(tester, rtlPrimary: step.isEven);
  }
  if (assetPath == PresentationSamples.clip) {
    return find.byType(VideoPlayer).evaluate().isNotEmpty ||
        find.text('جاري تجهيز الفيديو').evaluate().isNotEmpty;
  }
  return find.byKey(ValueKey('$assetPath-0')).evaluate().isNotEmpty;
}

Future<void> _dragNextMedia(WidgetTester tester, {required bool rtlPrimary}) async {
  final views = find.byType(PageView);
  expect(views, findsWidgets);
  final delta = rtlPrimary ? -220.0 : 220.0;
  await tester.drag(views.last, Offset(delta, 0));
  await tester.pump(const Duration(milliseconds: 500));
  await tester.pump(const Duration(milliseconds: 700));
}

Future<void> _verticalToService(WidgetTester tester) async {
  await tester.fling(find.byType(PageView).first, const Offset(0, -420), 1200);
  await tester.pump(const Duration(milliseconds: 700));
  await tester.fling(find.byType(PageView).first, const Offset(0, -420), 1200);
  await tester.pump(const Duration(milliseconds: 700));
  expect(find.text('استشارة جلدية'), findsOneWidget);
  // ignore: avoid_print
  print('RC4_MARK vertical-service');
}

Future<VideoPlayer> _waitForActivePlayer(WidgetTester tester, {int timeoutSeconds = 30}) async {
  final attempts = timeoutSeconds * 2;
  for (var i = 0; i < attempts; i++) {
    await tester.pump(const Duration(milliseconds: 500));
    final players = tester.widgetList<VideoPlayer>(find.byType(VideoPlayer)).toList();
    for (final player in players) {
      if (player.controller.value.isInitialized && player.controller.value.isPlaying) {
        return player;
      }
    }
    for (final player in players) {
      if (player.controller.value.isInitialized) {
        return player;
      }
    }
    if (find.text('تعذر تشغيل الفيديو').evaluate().isNotEmpty) {
      fail('video player reported failure before it became ready');
    }
  }
  fail('video player did not become ready');
}

Future<void> _expectPlaybackProgress(WidgetTester tester, VideoPlayerController controller) async {
  expect(controller.value.isInitialized, isTrue);
  expect(controller.value.hasError, isFalse);
  final samples = <Duration>[controller.value.position];
  for (var i = 0; i < 16; i++) {
    await tester.pump(const Duration(milliseconds: 250));
    samples.add(controller.value.position);
  }
  expect(
    videoPositionShowsProgress(samples),
    isTrue,
    reason: 'position must change within bounded window; isPlaying alone is insufficient',
  );
}

void _expectNoPlayingVideo(WidgetTester tester) {
  for (final player in tester.widgetList<VideoPlayer>(find.byType(VideoPlayer))) {
    expect(player.controller.value.isPlaying, isFalse);
  }
}
