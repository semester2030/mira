import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/data/ad_link_record.dart';
import 'package:mirra/features/marketplace/data/catalog_provenance.dart';
import 'package:mirra/features/marketplace/presentation/ad_link_open_outbox.dart';
import 'package:mirra/features/marketplace/data/datasources/marketplace_api_data_source.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_gateway.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_query.dart';
import 'package:mirra/features/marketplace/data/discover_published_ad.dart';
import 'package:mirra/features/marketplace/domain/entities/catalog_product.dart';
import 'package:mirra/features/marketplace/presentation/presentation/presentation_video_port.dart';
import 'package:mirra/features/marketplace/presentation/discover_feed_controller.dart';
import 'package:mirra/features/marketplace/presentation/presentation/presentation_models.dart';
import 'package:mirra/features/marketplace/presentation/screens/discover_presentation_screen.dart';

final _png = base64Decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');

void main() {
  tearDown(AdLinkOpenOutbox.shared.reset);
  test('relative ad media resolves on the API origin without duplicating the prefix', () {
    final source = MarketplaceApiDataSource(dio: Dio(BaseOptions(baseUrl: 'http://127.0.0.1:4010/api/v1')));
    final feed = source.parsePublishedAds({
      'items': [
        _json(
          id: 'ad-media',
          kind: 'product',
          targetId: 'dress',
          url: 'https://shop.example/dress',
          media: const [
            {'kind': 'image', 'url': '/api/v1/marketplace/media/img-1'},
            {'kind': 'video', 'url': '/api/v1/marketplace/media/vid-1'},
            {'kind': 'image', 'url': 'https://cdn.example/absolute.png'},
          ],
        ),
      ],
    });
    expect(
      feed.items.single.media.map((item) => item.url).toList(),
      [
        'http://127.0.0.1:4010/api/v1/marketplace/media/img-1',
        'http://127.0.0.1:4010/api/v1/marketplace/media/vid-1',
        'https://cdn.example/absolute.png',
      ],
    );
    expect(feed.items.single.media.map((item) => item.url).join(), isNot(contains('/api/v1/api/v1/')));
  });

  test('a service ad keeps the source party and drops a missing duration', () {
    final salon = DiscoverPublishedAd.tryParse(_json(
      id: 'ad-salon',
      kind: 'service',
      targetId: 'color',
      name: 'صبغة',
      partnerType: 'salon',
      city: 'جدة',
      category: 'makeup',
      durationMin: 50,
      price: 9000,
    ));
    expect(salon?.service?.partnerType, 'salon');
    expect(salon?.service?.city, 'جدة');
    expect(salon?.service?.category, 'makeup');
    expect(salon?.service?.durationMin, 50);
    expect(salon?.service?.priceHalalas, 9000);
    expect(salon?.service?.bookingEnabled, isFalse);
    expect(salon?.link.appointmentOperational, isFalse);
    expect(
      DiscoverPublishedAd.tryParse(_json(id: 'ad-blank', kind: 'service', targetId: 'x')),
      isNull,
    );
    expect(
      DiscoverPublishedAd.tryParse(_json(id: 'ad-zero', kind: 'service', targetId: 'x', partnerType: 'salon', city: 'جدة', durationMin: 0)),
      isNull,
    );
  });

  test('search and filters use the original and stay stable across pages', () async {
    final dress = _ad(id: 'ad-dress', name: 'فستان سهرة', kind: 'product', category: 'clothes', city: 'الرياض');
    final clinic = _ad(id: 'ad-clinic', name: 'جلسة بشرة', kind: 'service', partnerType: 'clinic', category: 'skin', city: 'الرياض');
    final salon = _ad(id: 'ad-salon', name: 'مكياج', kind: 'service', partnerType: 'salon', category: 'makeup', city: 'جدة');
    final gateway = _Gateway(
      first: [_offer('dress-a', 'فستان أول')],
      more: [_offer('dress-b', 'فستان ثان')],
      ads: [dress, clinic, salon, _ad(id: 'ad-dress-2', name: 'فستان سهرة', kind: 'product', targetId: 'dress', category: 'clothes')],
    );
    final feed = DiscoverFeedController(gateway: gateway);

    await feed.load(const DiscoverCatalogQuery(text: 'لا توجد نتيجة'));
    expect(feed.state.phase, DiscoverFeedPhase.empty);
    expect(feed.state.ads, isEmpty);

    await feed.load(const DiscoverCatalogQuery(text: 'سهرة'));
    expect(feed.state.ads.map((item) => item.link.id), ['ad-dress', 'ad-dress-2']);

    await feed.load(const DiscoverCatalogQuery(partnerType: 'brand', categoryId: 'clothes', city: 'الرياض'));
    expect(feed.state.ads.map((item) => item.link.id), ['ad-dress', 'ad-dress-2']);

    await feed.load(const DiscoverCatalogQuery(partnerType: 'salon', categoryId: 'makeup', city: 'جدة'));
    expect(feed.state.ads.map((item) => item.link.id), ['ad-salon']);

    await feed.load(const DiscoverCatalogQuery(partnerType: 'clinic', categoryId: 'skin'));
    expect(feed.state.ads.map((item) => item.link.id), ['ad-clinic']);

    await feed.load(const DiscoverCatalogQuery());
    expect(feed.state.ads, hasLength(4));
    gateway.failMore = true;
    await feed.loadMore();
    expect(feed.state.loadMoreError, isNotNull);
    expect(feed.state.ads, hasLength(4));
    expect(feed.state.offers, hasLength(1));
    gateway.failMore = false;
    await feed.retryMore();
    expect(feed.state.loadMoreError, isNull);
    expect(feed.state.offers, hasLength(2));
    expect(feed.state.ads, hasLength(4));
  });

  test('a late ad response cannot restore the previous query', () async {
    final gateway = _Gateway(ads: [_ad(id: 'ad-second', name: 'الثاني')]);
    final stale = Completer<DiscoverAdFeed>();
    gateway.hold = stale;
    final feed = DiscoverFeedController(gateway: gateway);
    final first = feed.load(const DiscoverCatalogQuery(text: 'الأول'));
    await Future<void>.delayed(Duration.zero);
    gateway.hold = null;
    final second = feed.load(const DiscoverCatalogQuery(text: 'الثاني'));
    await second;
    stale.complete(DiscoverAdFeed(failed: false, items: [_ad(id: 'ad-first', name: 'الأول')]));
    await first;
    expect(feed.state.ads.map((item) => item.link.id), ['ad-second']);
  });

  testWidgets('the resolved image bytes load and salon and clinic keep their own categories', (tester) async {
    debugNetworkImageHttpClientProvider = _ImageClient.new;
    final source = MarketplaceApiDataSource(dio: Dio(BaseOptions(baseUrl: 'http://127.0.0.1:4010/api/v1')));
    final parsed = source.parsePublishedAds({
      'items': [
        _json(
          id: 'ad-salon',
          kind: 'service',
          targetId: 'color',
          name: 'مكياج سهرة',
          partnerType: 'salon',
          city: 'جدة',
          category: 'makeup',
          durationMin: 50,
          media: const [
            {'kind': 'image', 'url': '/api/v1/marketplace/media/img-1'},
            {'kind': 'video', 'url': '/api/v1/marketplace/media/vid-1'},
          ],
        ),
      ],
    });
    final salon = parsed.items.single;
    expect(salon.media.map((item) => item.url).toList(), [
      'http://127.0.0.1:4010/api/v1/marketplace/media/img-1',
      'http://127.0.0.1:4010/api/v1/marketplace/media/vid-1',
    ]);
    await tester.pumpWidget(MaterialApp(home: DiscoverPresentationScreen(
      slides: [_slideOf(salon)],
      videoPort: _QuietVideoPort(),
    )));
    await tester.pump();
    expect(find.text('المكياج'), findsOneWidget);
    expect(find.text('الليزر'), findsNothing);
    RawImage? loaded;
    for (var attempt = 0; attempt < 20 && loaded?.image == null; attempt++) {
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 50)));
      await tester.pump();
      final raw = find.byType(RawImage);
      if (raw.evaluate().isNotEmpty) loaded = tester.widget<RawImage>(raw.first);
    }
    expect(loaded?.image, isNotNull, reason: 'تعذر=${find.text('تعذر تحميل الصورة').evaluate().length} جاري=${find.text('جاري تحميل الصورة').evaluate().length}');
    expect(loaded!.image!.width, 1);
    expect(find.text('تعذر تحميل الصورة'), findsNothing);
    debugNetworkImageHttpClientProvider = null;
  });

  testWidgets('clinic ad uses clinic categories', (tester) async {
    debugNetworkImageHttpClientProvider = _ImageClient.new;
    final clinic = _ad(id: 'ad-clinic', name: 'ليزر', kind: 'service', partnerType: 'clinic', category: 'laser', city: 'الرياض');
    await tester.pumpWidget(MaterialApp(home: DiscoverPresentationScreen(
      slides: [_slideOf(clinic)],
      videoPort: _QuietVideoPort(),
    )));
    await tester.pump();
    expect(find.text('الليزر'), findsOneWidget);
    expect(find.text('المكياج'), findsNothing);
    debugNetworkImageHttpClientProvider = null;
  });

  testWidgets('opening details or changing media does not record a link, and failures do not claim success', (tester) async {
    debugNetworkImageHttpClientProvider = _ImageClient.new;
    final opened = <String>[];
    final events = <String>[];
    var openResult = false;
    var recordResult = true;
    Object? openError;
    Future<bool> confirm({required String adId, required String url}) async => true;
    await tester.pumpWidget(MaterialApp(home: DiscoverPresentationScreen(
      slides: [_slideOf(_ad(id: 'ad-link', name: 'فستان'))],
      videoPort: _QuietVideoPort(),
      confirmAdLink: confirm,
      recordAdLink: ({required String adId, required String eventId, AdLinkAttemptControl? attempt}) async {
        events.add(eventId);
        return recordResult ? AdLinkRecordOutcome.recorded : AdLinkRecordOutcome.retryable;
      },
      openExternal: (uri) async {
        if (openError != null) throw openError!;
        opened.add(uri.toString());
        return openResult;
      },
    )));
    await tester.pump();
    expect(events, isEmpty);
    await tester.fling(find.byType(PageView).last, const Offset(-240, 0), 800);
    await tester.pump();
    await tester.tap(find.text('التفاصيل').hitTestable().first);
    await tester.pumpAndSettle();
    expect(events, isEmpty);
    expect(opened, isEmpty);
    while (find.text('افتحي الرابط').hitTestable().evaluate().isEmpty) {
      await tester.pageBack();
      await tester.pumpAndSettle();
    }
    await tester.tap(find.text('افتحي الرابط').hitTestable());
    await tester.pump();
    expect(opened, hasLength(1));
    expect(events, isEmpty);

    openError = StateError('browser');
    await tester.tap(find.text('افتحي الرابط'));
    await tester.pump();
    expect(events, isEmpty);

    openError = null;
    openResult = true;
    recordResult = false;
    await tester.tap(find.text('افتحي الرابط'));
    await tester.pump();
    expect(opened, hasLength(2));
    expect(events, hasLength(1));
    await tester.pump(const Duration(seconds: 2));
    expect(opened, hasLength(2));
    expect(events, [events.first, events.first]);

    recordResult = true;
    await tester.tap(find.text('افتحي الرابط'));
    await tester.pump();
    expect(opened, hasLength(3));
    expect(events, hasLength(3));
    expect(events[2], isNot(events.first));

    await tester.tap(find.text('افتحي الرابط'));
    await tester.pump();
    await tester.tap(find.text('افتحي الرابط'));
    await tester.pump();
    expect(opened, hasLength(5));
    expect(events, hasLength(5));
    expect(events[3], isNot(events[4]));
    expect(events[3], isNot(events.first));
    expect(events[4], isNot(events.first));
    AdLinkOpenOutbox.shared.reset();
    debugNetworkImageHttpClientProvider = null;
  });

  testWidgets('two ads for one original keep separate slots and the current ad survives the next page', (tester) async {
    debugNetworkImageHttpClientProvider = _ImageClient.new;
    final first = _ad(id: 'ad-a', name: 'فستان', caption: 'الإعلان الأول');
    final second = _ad(id: 'ad-b', name: 'فستان', caption: 'الإعلان الثاني', targetId: 'dress');
    expect(_slideOf(first).slotId, isNot(_slideOf(second).slotId));
    final gateway = _Gateway(
      first: [_offer('dress-page', 'عرض الصفحة')],
      more: [_offer('dress-next', 'عرض لاحق')],
      ads: [first],
    );
    await tester.pumpWidget(MaterialApp(home: DiscoverPresentationScreen(gateway: gateway, videoPort: _QuietVideoPort())));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    await tester.fling(find.byType(PageView).first, const Offset(0, -500), 1200);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('الإعلان الأول'), findsWidgets);
    expect(gateway.browseCalls, greaterThan(1));
    debugNetworkImageHttpClientProvider = null;
  });
}

DiscoverPublishedAd _ad({
  required String id,
  required String name,
  String caption = 'إعلان',
  String kind = 'product',
  String targetId = 'dress',
  String partnerType = 'brand',
  String city = 'الرياض',
  String category = 'dresses',
  int price = 1800,
}) {
  return DiscoverPublishedAd.tryParse(_json(
    id: id,
    kind: kind,
    targetId: targetId,
    name: name,
    caption: caption,
    url: 'https://shop.example/item',
    partnerType: partnerType,
    city: city,
    category: category,
    durationMin: kind == 'service' ? 40 : null,
    price: price,
    media: const [
      {'kind': 'image', 'url': 'https://images.example/one.png'},
      {'kind': 'image', 'url': 'https://images.example/two.png'},
    ],
  ))!;
}

PresentationSlide _slideOf(DiscoverPublishedAd ad) {
  return presentationSlideFromAd(
    ad.link,
    product: ad.product,
    service: ad.service,
    media: [
      for (final item in ad.media)
        PresentationMedia(
          kind: item.kind == 'video' ? PresentationMediaKind.video : PresentationMediaKind.image,
          assetPath: item.url,
          network: true,
        ),
    ],
  );
}

Map<String, dynamic> _json({
  required String id,
  required String kind,
  required String targetId,
  String name = 'الأصل',
  String caption = 'إعلان',
  String? url,
  String partnerType = 'brand',
  String? city,
  String? category,
  int? durationMin,
  int price = 1800,
  List<Map<String, dynamic>> media = const [],
}) {
  return {
    'id': id,
    'disclosure': 'إعلان',
    'captionAr': caption,
    'targetKind': kind,
    'targetId': targetId,
    'advertiser': {'id': 'celebrity', 'nameAr': 'المعلن'},
    'publisher': {'id': 'celebrity', 'nameAr': 'الناشر'},
    'seller': {'id': 'seller', 'nameAr': 'الجهة', 'type': partnerType, 'city': city},
    'target': {
      'kind': kind,
      'id': targetId,
      'nameAr': name,
      'priceHalalas': price,
      'externalUrl': url,
      'category': category,
      'durationMin': durationMin,
    },
    'media': media,
    'actions': {
      'openLink': url != null,
      'purchaseCompleted': false,
      'appointmentOperational': false,
      'appointmentConfirmed': false,
    },
    'views': {'state': 'disabled', 'count': null},
  };
}

DiscoverOffer _offer(String id, String name) {
  return DiscoverOffer.product(
    CatalogProduct(
      id: id,
      partnerId: 'seller',
      partnerNameAr: 'الجهة',
      nameAr: name,
      nameEn: '',
      priceHalalas: 1800,
      priceLabel: '١٨ ر.س',
      externalUrl: 'https://shop.example/item',
      matchScore: 0,
    ),
    city: 'الرياض',
  );
}

class _Gateway implements DiscoverCatalogGateway {
  _Gateway({this.first = const [], this.more = const [], this.ads = const []});
  final List<DiscoverOffer> first;
  final List<DiscoverOffer> more;
  final List<DiscoverPublishedAd> ads;
  Completer<DiscoverAdFeed>? hold;
  bool failMore = false;
  int browseCalls = 0;

  @override
  bool get serverEnabled => true;

  @override
  Future<DiscoverBrowseResponse> browse(DiscoverCatalogQuery query, {String? cursor, int limit = 4}) async {
    browseCalls += 1;
    final source = cursor == null ? first : more;
    if (cursor != null && failMore) throw StateError('more');
    final items = [for (final offer in source) if (DiscoverCatalogQueryEngine.matches(offer, query)) offer];
    return DiscoverBrowseResponse(
      failed: false,
      transport: CatalogTransport.server,
      contentMark: ContentMark.unmarked,
      items: items,
      nextCursor: cursor == null && more.isNotEmpty ? 'product:next' : null,
    );
  }

  @override
  Future<DiscoverAdFeed> publishedAds() {
    final pending = hold;
    if (pending != null) return pending.future;
    return Future.value(DiscoverAdFeed(failed: false, items: ads));
  }

  @override
  Future<CatalogRecordResult> loadRecord({required String kind, required String id, required CatalogTransport? transport}) async {
    return const CatalogRecordResult(status: CatalogRecordStatus.missing);
  }
}

class _QuietVideoPort extends PresentationVideoPort {
  @override
  PresentationSlot? activeSlot;
  @override
  PresentationPlayback playback = PresentationPlayback.idle;
  @override
  String? errorText;
  @override
  bool isPlaying = false;
  @override
  Future<void> attach(PresentationSlot slot, String assetPath) async {}
  @override
  Future<void> detach(PresentationSlot slot) async {}
  @override
  Future<void> pause() async {}
  @override
  Future<void> release() async {}
  @override
  Future<void> retry(PresentationSlot slot, String assetPath) async {}
  @override
  Widget? buildView() => null;
}

class _ImageClient extends Fake implements HttpClient {
  @override
  Future<HttpClientRequest> getUrl(Uri url) async => _ImageRequest();
  @override
  set autoUncompress(bool value) {}
}

class _ImageRequest extends Fake implements HttpClientRequest {
  @override
  Future<HttpClientResponse> close() async => _ImageResponse();
}

class _ImageResponse extends Fake implements HttpClientResponse {
  @override
  int get statusCode => HttpStatus.ok;
  @override
  int get contentLength => _png.length;
  @override
  HttpClientResponseCompressionState get compressionState => HttpClientResponseCompressionState.notCompressed;
  @override
  StreamSubscription<List<int>> listen(void Function(List<int> event)? onData, {Function? onError, void Function()? onDone, bool? cancelOnError}) {
    return Stream<List<int>>.fromIterable([_png]).listen(onData, onError: onError, onDone: onDone, cancelOnError: cancelOnError);
  }
}
