import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/constants/marketplace_copy.dart';
import 'package:mirra/core/navigation/mira_route_observer.dart';
import 'package:mirra/features/marketplace/data/catalog_provenance.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_gateway.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_query.dart';
import 'package:mirra/features/marketplace/data/datasources/marketplace_api_data_source.dart';
import 'package:mirra/features/marketplace/data/marketplace_local_catalog.dart';
import 'package:mirra/features/marketplace/data/repositories/marketplace_repository_impl.dart';
import 'package:mirra/features/marketplace/domain/entities/catalog_product.dart';
import 'package:mirra/features/marketplace/domain/entities/catalog_service.dart';
import 'package:mirra/features/marketplace/presentation/presentation/discover_presentation_catalog.dart';
import 'package:mirra/features/marketplace/presentation/presentation/presentation_models.dart';
import 'package:mirra/features/marketplace/presentation/presentation/presentation_video_port.dart';
import 'package:mirra/features/marketplace/presentation/screens/discover_presentation_screen.dart';
import 'package:mirra/features/marketplace/presentation/widgets/marketplace_data_banner.dart';
import 'package:mirra/shared/theme/theme.dart';

class DelayedVideoPort extends PresentationVideoPort {
  DelayedVideoPort({this.failInit = false, this.failAfterReady = false});

  bool failInit;
  bool failAfterReady;
  int _generation = 0;
  bool _released = false;
  final events = <String>[];
  final _pending = <Completer<void>>[];

  @override
  PresentationSlot? activeSlot;

  @override
  PresentationPlayback playback = PresentationPlayback.idle;

  @override
  String? errorText;

  @override
  bool isPlaying = false;

  String? assetPath;
  int playStarts = 0;

  Future<void> _wait() {
    final gate = Completer<void>();
    _pending.add(gate);
    return gate.future;
  }

  void flush() {
    while (_pending.isNotEmpty) {
      final batch = List<Completer<void>>.of(_pending);
      _pending.clear();
      for (final gate in batch) {
        if (!gate.isCompleted) gate.complete();
      }
    }
  }

  @override
  Future<void> attach(PresentationSlot slot, String assetPath) async {
    if (_released) return;
    final token = ++_generation;
    events.add('attach:${slot.slideId}:${slot.mediaIndex}:$assetPath');
    isPlaying = false;
    activeSlot = slot;
    this.assetPath = assetPath;
    playback = PresentationPlayback.loading;
    errorText = null;
    notifyPlayback();
    await _wait();
    if (token != _generation || _released) {
      events.add('stale:${slot.slideId}:${slot.mediaIndex}');
      return;
    }
    if (failInit) {
      playback = PresentationPlayback.failed;
      errorText = 'تعذر تشغيل الفيديو';
      isPlaying = false;
      notifyPlayback();
      return;
    }
    playback = PresentationPlayback.ready;
    isPlaying = true;
    playStarts += 1;
    events.add('play:${slot.slideId}:${slot.mediaIndex}');
    notifyPlayback();
    if (failAfterReady) {
      playback = PresentationPlayback.failed;
      errorText = 'تعذر تشغيل الفيديو';
      isPlaying = false;
      events.add('runtime-error:${slot.slideId}');
      notifyPlayback();
    }
  }

  @override
  Future<void> detach(PresentationSlot slot) async {
    if (activeSlot == null || !activeSlot!.same(slot)) return;
    final token = ++_generation;
    events.add('detach:${slot.slideId}:${slot.mediaIndex}');
    isPlaying = false;
    activeSlot = null;
    playback = PresentationPlayback.idle;
    await _wait();
    if (token != _generation) {
      events.add('detach-stale:${slot.slideId}');
      return;
    }
    notifyPlayback();
  }

  @override
  Future<void> pause() async {
    final token = ++_generation;
    events.add('pause');
    isPlaying = false;
    await _wait();
    if (token != _generation || _released) return;
    notifyPlayback();
  }

  @override
  Future<void> release() async {
    _released = true;
    _generation++;
    events.add('release');
    isPlaying = false;
    activeSlot = null;
    playback = PresentationPlayback.idle;
  }

  @override
  Future<void> retry(PresentationSlot slot, String assetPath) => attach(slot, assetPath);

  @override
  Widget? buildView() => isPlaying ? Text('video:${activeSlot?.slideId}:${assetPath ?? ''}') : null;
}

PresentationSlide _productSlide({
  required String id,
  required List<PresentationMedia> media,
  String title = 'منتج اختبار بعنوان عربي طويل للتحقق من الالتفاف',
}) {
  return PresentationSlide(
    entityId: id,
    partnerId: 'local-loreal',
    title: title,
    partnerName: 'جهة اختبار',
    kindLabel: 'منتج',
    priceLabel: '10 ر.س',
    sampleMedia: true,
    layoutNote: PresentationSamples.layoutNote,
    product: CatalogProduct(
      id: id,
      partnerId: 'local-loreal',
      partnerNameAr: 'جهة اختبار',
      nameAr: title,
      nameEn: 'Sample',
      priceHalalas: 1000,
      priceLabel: '10 ر.س',
      externalUrl: 'https://example.invalid/product',
      matchScore: 0,
    ),
    media: media,
  );
}

PresentationSlide _serviceVideo(String id) {
  return PresentationSlide(
    entityId: id,
    partnerId: 'local-noor-clinic',
    title: 'استشارة جلدية',
    partnerName: 'عيادة اختبار',
    kindLabel: 'خدمة',
    priceLabel: '250 ر.س',
    sampleMedia: true,
    service: CatalogService(
      id: id,
      partnerId: 'local-noor-clinic',
      partnerNameAr: 'عيادة اختبار',
      partnerType: 'clinic',
      city: 'الرياض',
      nameAr: 'استشارة جلدية',
      nameEn: 'Consult',
      durationMin: 30,
      priceHalalas: 25000,
      priceLabel: '250 ر.س',
      matchScore: 0,
      bookingEnabled: false,
    ),
    media: const [
      PresentationMedia(kind: PresentationMediaKind.video, assetPath: PresentationSamples.clip),
    ],
  );
}

Future<void> _pump(WidgetTester tester, DelayedVideoPort port, List<PresentationSlide> slides) {
  return tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.lightTheme,
      navigatorObservers: [miraRouteObserver],
      onGenerateRoute: (settings) {
        return MaterialPageRoute<void>(
          settings: settings,
          builder: (_) => Text('opened:${settings.arguments.runtimeType}:${settings.arguments}'),
        );
      },
      home: DiscoverPresentationScreen(slides: slides, videoPort: port),
    ),
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('slides keep ids and do not fail a real service on purpose', () {
    final slides = DiscoverPresentationCatalog.slides();
    expect(slides.map((slide) => slide.entityId), [
      'p-loreal-vitc',
      'p-neutro-wash',
      's-noor-consult',
      's-rose-facial',
    ]);
    expect(slides.first.media.map((item) => item.assetPath), [
      PresentationSamples.portrait,
      PresentationSamples.square,
      PresentationSamples.landscape,
      PresentationSamples.clip,
    ]);
    final clinic = slides.firstWhere((slide) => slide.entityId == 's-noor-consult');
    expect(clinic.media.single.kind, PresentationMediaKind.video);
    expect(clinic.media.single.assetPath, slides.first.media.last.assetPath);
    expect(slides.last.service?.partnerType, 'salon');
  });

  test('local detail stays local after a later server list', () async {
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final path = options.uri.path;
          if (path.endsWith('/local-loreal')) {
            handler.reject(DioException(requestOptions: options, type: DioExceptionType.badResponse));
            return;
          }
          handler.resolve(
            Response<List<dynamic>>(
              requestOptions: options,
              data: const [
                {
                  'id': 'server-independent',
                  'type': 'brand',
                  'nameAr': 'لوريال باريس',
                  'nameEn': 'Named only',
                  'city': 'الرياض',
                  'rating': 4,
                },
              ],
            ),
          );
        },
      ),
    );
    final repo = MarketplaceRepositoryImpl(api: MarketplaceApiDataSource(dio: dio));
    expect(repo.partnerDetailLoad('local-loreal'), throwsA(isA<CatalogSourceException>()));
    final listed = await repo.listPartnersLoad();
    expect(listed.transport, CatalogTransport.server);
    expect(listed.contentMark, ContentMark.unmarked);
    expect(MarketplaceDataBanner.labelFor(listed.transport, listed.contentMark), MarketplaceCopy.serverUnmarkedBanner);
    final local = await MarketplaceRepositoryImpl(useServer: false).partnerDetailLoad('local-loreal');
    expect(local!.transport, CatalogTransport.localCatalog);
    expect(MarketplaceDataBanner.labelFor(local.transport, local.contentMark), MarketplaceCopy.localDemoBanner);
  });

  test('an explicit server flag is demo and a name is not', () async {
    final dio = Dio();
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          handler.resolve(
            Response<List<dynamic>>(
              requestOptions: options,
              data: const [
                {
                  'id': 'server-demo',
                  'type': 'brand',
                  'nameAr': 'جهة بلا اسم تجريبي',
                  'nameEn': 'Flagged',
                  'city': 'الرياض',
                  'rating': 4,
                  'demoContent': true,
                },
              ],
            ),
          );
        },
      ),
    );
    final repo = MarketplaceRepositoryImpl(api: MarketplaceApiDataSource(dio: dio));
    expect((await repo.listPartnersLoad()).contentMark, ContentMark.explicitDemo);
    expect(MarketplaceLocalCatalog.contentMark, ContentMark.explicitDemo);
  });

  testWidgets('opening details stops playback and return resumes only the active slot', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    final priorError = FlutterError.onError;
    FlutterError.onError = (details) {
      if (details.exceptionAsString().contains('RenderFlex overflowed')) return;
      priorError?.call(details);
    };
    addTearDown(() => FlutterError.onError = priorError);
    final port = DelayedVideoPort();
    final slides = [
      _productSlide(
        id: 'p-loreal-vitc',
        media: const [PresentationMedia(kind: PresentationMediaKind.video, assetPath: PresentationSamples.clip)],
      ),
      _serviceVideo('s-noor-consult'),
    ];
    await _pump(tester, port, slides);
    await tester.pump();
    port.flush();
    await tester.pump();
    expect(port.isPlaying, isTrue);

    await tester.tap(find.text('التفاصيل'));
    await tester.pump();
    port.flush();
    for (var i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 100));
      if (find.text('تفاصيل المنتج').evaluate().isNotEmpty) break;
    }
    expect(find.text('تفاصيل المنتج'), findsOneWidget);
    expect(port.isPlaying, isFalse);
    expect(port.events, contains('pause'));

    Navigator.of(tester.element(find.text('تفاصيل المنتج'))).pop();
    await tester.pump();
    port.flush();
    await tester.pump();
    expect(port.isPlaying, isTrue);
    expect(port.activeSlot, const PresentationSlot('p-loreal-vitc', 0));

  });

  testWidgets('opening a service from its video stops that player', (tester) async {
    tester.view.physicalSize = const Size(400, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    final port = DelayedVideoPort();
    await _pump(tester, port, [_serviceVideo('s-noor-consult')]);
    await tester.pump();
    port.flush();
    await tester.pump();
    expect(port.isPlaying, isTrue);
    await tester.tap(find.text('التفاصيل'));
    await tester.pump();
    port.flush();
    for (var i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 100));
      if (find.text('تفاصيل الخدمة').evaluate().isNotEmpty) break;
    }
    expect(find.text('تفاصيل الخدمة'), findsOneWidget);
    expect(port.isPlaying, isFalse);
  });

  testWidgets('horizontal swipe moves to the next media of the same presentation', (tester) async {
    tester.view.physicalSize = const Size(400, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    final port = DelayedVideoPort();
    await _pump(tester, port, [
      _productSlide(
        id: 'swipe',
        media: const [
          PresentationMedia(kind: PresentationMediaKind.image, assetPath: PresentationSamples.portrait),
          PresentationMedia(kind: PresentationMediaKind.video, assetPath: PresentationSamples.clip),
        ],
      ),
    ]);
    await tester.pump();
    expect(port.isPlaying, isFalse);
    await tester.fling(find.byType(PageView).last, const Offset(-320, 0), 800);
    await tester.pumpAndSettle();
    port.flush();
    await tester.pump();
    expect(port.activeSlot, const PresentationSlot('swipe', 1));
    expect(port.isPlaying, isTrue);
  });

  testWidgets('video init failure retries the same slot and can fail again', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    final priorError = FlutterError.onError;
    FlutterError.onError = (details) {
      if (details.exceptionAsString().contains('RenderFlex overflowed')) return;
      priorError?.call(details);
    };
    addTearDown(() => FlutterError.onError = priorError);
    final port = DelayedVideoPort(failInit: true);
    await _pump(tester, port, [
      _productSlide(
        id: 'video-fail',
        media: const [PresentationMedia(kind: PresentationMediaKind.video, assetPath: PresentationSamples.clip)],
      ),
    ]);
    await tester.pump();
    port.flush();
    await tester.pump();
    await tester.pump();
    expect(find.text('تعذر تشغيل الفيديو'), findsOneWidget);
    expect(port.isPlaying, isFalse);

    port.failInit = false;
    await tester.tap(find.text('إعادة المحاولة'));
    await tester.pump();
    port.flush();
    await tester.pump();
    expect(port.isPlaying, isTrue);
    expect(find.textContaining('video:video-fail'), findsOneWidget);
  });

  testWidgets('a runtime error after ready is a video failure, separate from a missing image', (tester) async {
    tester.view.physicalSize = const Size(400, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    final port = DelayedVideoPort(failAfterReady: true);
    await _pump(tester, port, [
      _productSlide(
        id: 'runtime',
        media: const [
          PresentationMedia(kind: PresentationMediaKind.image, assetPath: 'assets/marketplace/samples/missing.png'),
          PresentationMedia(kind: PresentationMediaKind.video, assetPath: PresentationSamples.clip),
        ],
      ),
    ]);
    await tester.pump();
    await tester.pump();
    expect(find.text('تعذر تحميل الصورة'), findsOneWidget);
    expect(find.text('تعذر تشغيل الفيديو'), findsNothing);

    await tester.fling(find.byType(PageView).last, const Offset(-300, 0), 800);
    await tester.pumpAndSettle();
    port.flush();
    await tester.pump();
    await tester.pump();
    expect(port.events.where((event) => event.startsWith('runtime-error')), isNotEmpty);
    expect(find.text('تعذر تشغيل الفيديو'), findsOneWidget);
    expect(find.text('تعذر تحميل الصورة').hitTestable(), findsNothing);
  });

  testWidgets('a late attach cannot play after a newer slot or after release', (tester) async {
    final port = DelayedVideoPort();
    final first = _productSlide(
      id: 'slide-a',
      media: const [PresentationMedia(kind: PresentationMediaKind.video, assetPath: PresentationSamples.clip)],
    );
    final second = _productSlide(
      id: 'slide-b',
      media: const [PresentationMedia(kind: PresentationMediaKind.video, assetPath: PresentationSamples.clip)],
    );
    final image = _productSlide(
      id: 'slide-c',
      media: const [PresentationMedia(kind: PresentationMediaKind.image, assetPath: PresentationSamples.square)],
    );
    final vertical = PageController();
    await tester.pumpWidget(
      MaterialApp(
        navigatorObservers: [miraRouteObserver],
        home: DiscoverPresentationScreen(slides: [first, second, image], videoPort: port, verticalController: vertical),
      ),
    );
    await tester.pump();
    vertical.jumpToPage(1);
    await tester.pump();
    port.flush();
    await tester.pump();
    expect(port.isPlaying, isTrue);
    expect(port.activeSlot?.slideId, 'slide-b');
    expect(port.events.where((event) => event.startsWith('play:slide-a')), isEmpty);

    vertical.jumpToPage(2);
    await tester.pump();
    port.flush();
    await tester.pump();
    expect(port.isPlaying, isFalse);
    expect(port.events.where((event) => event.startsWith('play:slide-b')), isNotEmpty);

  });

  test('release during init never starts playback', () async {
    final port = DelayedVideoPort();
    final pending = port.attach(const PresentationSlot('leaving', 0), PresentationSamples.clip);
    await port.release();
    port.flush();
    await pending;
    expect(port.events, contains('release'));
    expect(port.events.where((event) => event.startsWith('play:')), isEmpty);
    expect(port.isPlaying, isFalse);
  });

  test('an old detach does not stop a newer slot that shares the file', () async {
    final port = DelayedVideoPort();
    final first = port.attach(const PresentationSlot('a', 0), PresentationSamples.clip);
    final detach = port.detach(const PresentationSlot('a', 0));
    final second = port.attach(const PresentationSlot('b', 0), PresentationSamples.clip);
    port.flush();
    await Future.wait<void>([first, detach, second]);
    expect(port.activeSlot, const PresentationSlot('b', 0));
    expect(port.isPlaying, isTrue);
    expect(port.events.where((event) => event.startsWith('play:a')), isEmpty);
  });

  testWidgets('background during init does not leave the player running', (tester) async {
    final port = DelayedVideoPort();
    await _pump(tester, port, [
      _productSlide(
        id: 'bg',
        media: const [PresentationMedia(kind: PresentationMediaKind.video, assetPath: PresentationSamples.clip)],
      ),
    ]);
    await tester.pump();
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    port.flush();
    await tester.pump();
    expect(port.isPlaying, isFalse);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump();
    port.flush();
    await tester.pump();
    expect(port.events.join(','), contains('play:bg:0'));
    expect(port.isPlaying, isTrue);
    expect(port.activeSlot, const PresentationSlot('bg', 0));
  });

  testWidgets('product chrome shows buy and store without fake success', (tester) async {
    final port = DelayedVideoPort();
    await _pump(tester, port, [
      _productSlide(
        id: 'vis-p',
        media: const [PresentationMedia(kind: PresentationMediaKind.image, assetPath: PresentationSamples.portrait)],
      ),
    ]);
    expect(find.text('اشتري الآن'), findsOneWidget);
    expect(find.text('المتجر'), findsOneWidget);
    expect(find.bySemanticsLabel('ميرَا'), findsOneWidget);
    expect(find.textContaining('العد غير مفعّل'), findsNothing);
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('plugins.flutter.io/url_launcher'),
      (call) async => true,
    );
    addTearDown(() {
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        const MethodChannel('plugins.flutter.io/url_launcher'),
        null,
      );
    });
    await tester.tap(find.text('اشتري الآن'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.textContaining('ليس شراءً مكتملًا'), findsOneWidget);
    expect(find.textContaining('تم الشراء'), findsNothing);
  });

  testWidgets('preview buy does not open a transaction', (tester) async {
    final port = DelayedVideoPort();
    await _pump(tester, port, DiscoverPresentationCatalog.previewSlides().take(1).toList());
    await tester.tap(find.text('اشتري الآن'));
    await tester.pump();
    expect(find.textContaining('هذه معاينة ولا تنفّذ شراءً'), findsOneWidget);
  });

  testWidgets('the ordinary route stays on catalog slides', (tester) async {
    final port = DelayedVideoPort();
    await tester.pumpWidget(
      MaterialApp(
        home: DiscoverPresentationScreen(
          videoPort: port,
          gateway: MarketplaceRepositoryImpl(useServer: false),
        ),
      ),
    );
    await tester.pumpAndSettle();
    final first = DiscoverCatalogQueryEngine.page(DiscoverCatalogQueryEngine.localOffers(), limit: 4).items.first;
    expect(find.text(first.nameAr), findsOneWidget);
    expect(find.text('عرض معاينة'), findsNothing);
    expect(find.text('سيروم عناية'), findsNothing);
  });

  testWidgets('an explicit preview uses the same screen and generated media', (tester) async {
    final port = DelayedVideoPort();
    final preview = DiscoverPresentationCatalog.previewSlides().first;
    await _pump(tester, port, [preview]);
    expect(find.text('سيروم عناية'), findsOneWidget);
    expect(find.text('عرض معاينة'), findsWidgets);
    expect(
      find.byWidgetPredicate((widget) {
        final provider = widget is Image ? widget.image : null;
        return provider is AssetImage && provider.assetName == preview.media.first.assetPath;
      }),
      findsAtLeastNWidgets(1),
    );
  });

  testWidgets('mute icon follows the shared player after a vertical move', (tester) async {
    tester.view.physicalSize = const Size(400, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    final port = DelayedVideoPort();
    await _pump(tester, port, [
      _productSlide(
        id: 'mute-a',
        media: const [PresentationMedia(kind: PresentationMediaKind.video, assetPath: PresentationSamples.clip)],
      ),
      _serviceVideo('mute-b'),
    ]);
    await tester.pump();
    port.flush();
    await tester.pump();
    await tester.tap(find.byIcon(Icons.volume_up_outlined));
    await tester.pump();
    expect(port.isMuted, isTrue);
    await tester.fling(find.byType(PageView).first, const Offset(0, -500), 1200);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    port.flush();
    await tester.pump();
    expect(find.byIcon(Icons.volume_off_outlined), findsWidgets);
    expect(find.byIcon(Icons.volume_up_outlined), findsNothing);
  });

  testWidgets('clinic chrome shows appointment row', (tester) async {
    final port = DelayedVideoPort();
    await _pump(tester, port, [_serviceVideo('s-vis')]);
    expect(find.text('اطلبي موعدًا'), findsOneWidget);
    expect(find.text('الموقع'), findsOneWidget);
    expect(find.text('البشرة'), findsOneWidget);
  });

  testWidgets('empty presentation has an exit', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        navigatorObservers: [miraRouteObserver],
        routes: {
          '/': (_) => const DiscoverPresentationScreen(slides: []),
          '/discover': (_) => const Scaffold(body: Text('discover-hub')),
        },
        initialRoute: '/',
      ),
    );
    expect(find.text('لا توجد عروض'), findsOneWidget);
    await tester.tap(find.byIcon(Icons.close));
    await tester.pumpAndSettle();
    expect(find.text('discover-hub'), findsOneWidget);
    expect(find.text('لا توجد عروض'), findsNothing);
  });
}
