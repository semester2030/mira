import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/data/ad_link_record.dart';
import 'package:mirra/features/marketplace/data/catalog_provenance.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_gateway.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_query.dart';
import 'package:mirra/features/marketplace/data/discover_published_ad.dart';
import 'package:mirra/features/marketplace/domain/entities/catalog_product.dart';
import 'package:mirra/features/marketplace/presentation/ad_link_open_outbox.dart';
import 'package:mirra/features/marketplace/presentation/presentation/presentation_models.dart';
import 'package:mirra/features/marketplace/presentation/presentation/presentation_video_port.dart';
import 'package:mirra/features/marketplace/presentation/screens/discover_presentation_screen.dart';

final _png = base64Decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  tearDown(AdLinkOpenOutbox.shared.reset);

  test('product description from the ad contract is what search matches', () {
    const description = 'هذا وصف طويل جدًا لكريم مرطب للبشرة الجافة ويظهر في البحث عند كلمة واحدة منه دون اختصار المعنى';
    final parsed = DiscoverPublishedAd.tryParse(_json(
      id: 'ad-cream',
      name: 'كريم',
      caption: 'حصري',
      description: description,
      city: 'الرياض',
      category: 'clothes',
    ))!;
    expect(parsed.product?.descriptionAr, description);
    expect(parsed.product?.descriptionAr, isNot('حصري'));
    final adOffer = parsed.toOffer()!;
    final original = DiscoverOffer.product(
      CatalogProduct(
        id: 'cream',
        partnerId: 'seller',
        partnerNameAr: 'الجهة',
        nameAr: 'كريم',
        nameEn: '',
        descriptionAr: description,
        priceHalalas: 1800,
        priceLabel: '١٨ ر.س',
        externalUrl: 'https://shop.example/item',
        matchScore: 0,
        category: 'clothes',
      ),
      city: 'الرياض',
    );
    expect(DiscoverCatalogQueryEngine.matches(original, const DiscoverCatalogQuery(text: 'مرطب')), isTrue);
    expect(DiscoverCatalogQueryEngine.matches(adOffer, const DiscoverCatalogQuery(text: 'مرطب')), isTrue);
    expect(DiscoverCatalogQueryEngine.matches(adOffer, const DiscoverCatalogQuery(text: 'غيرموجود')), isFalse);
    expect(DiscoverCatalogQueryEngine.matches(adOffer, const DiscoverCatalogQuery(text: 'حصري')), isFalse);
    expect(
      DiscoverCatalogQueryEngine.matches(adOffer, const DiscoverCatalogQuery(text: 'مرطب', city: 'جدة')),
      isFalse,
    );
    expect(
      DiscoverCatalogQueryEngine.matches(adOffer, const DiscoverCatalogQuery(text: 'مرطب', city: 'الرياض', categoryId: 'clothes', partnerType: 'brand')),
      isTrue,
    );

    final missing = DiscoverPublishedAd.tryParse(_json(id: 'ad-missing', name: 'كريم', caption: 'حصري'))!;
    expect(missing.product?.descriptionAr, isNull);
    expect(DiscoverCatalogQueryEngine.matches(missing.toOffer()!, const DiscoverCatalogQuery(text: 'حصري')), isFalse);
    final blank = DiscoverPublishedAd.tryParse(_json(id: 'ad-blank', name: 'كريم', description: ''))!;
    expect(blank.product?.descriptionAr, '');
    expect(DiscoverCatalogQueryEngine.matches(blank.toOffer()!, const DiscoverCatalogQuery(text: 'مرطب')), isFalse);
  });

  testWidgets('forward swipes visit every page and ad once, including a page that arrives on an ad', (tester) async {
    debugNetworkImageHttpClientProvider = _ImageClient.new;
    final gateway = _SeqGateway(
      pages: [
        [_offer('p1', 'عرض-1'), _offer('p2', 'عرض-2')],
        [_offer('p3', 'عرض-3')],
        [_offer('p4', 'عرض-4')],
      ],
      ads: [_ad(id: 'ad-1', caption: 'إعلان-1')],
    );
    await tester.pumpWidget(MaterialApp(home: DiscoverPresentationScreen(gateway: gateway, videoPort: _QuietVideo())));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    final titles = ['عرض-1', 'عرض-2', 'إعلان-1', 'عرض-3', 'عرض-4'];
    final seen = <String>[_visible(tester, titles)];
    while (seen.length < titles.length) {
      final before = seen.last;
      await _forward(tester);
      final current = _visible(tester, titles);
      expect(current, isNot(before));
      expect(seen, isNot(contains(current)));
      seen.add(current);
    }
    expect(seen, titles);
    await _forward(tester);
    expect(_visible(tester, titles), 'عرض-4');
    debugNetworkImageHttpClientProvider = null;
  });

  testWidgets('two ads for one original stay distinct and a failed page retries once', (tester) async {
    debugNetworkImageHttpClientProvider = _ImageClient.new;
    final first = _ad(id: 'ad-a', caption: 'الإعلان-أ', targetId: 'dress');
    final second = _ad(id: 'ad-b', caption: 'الإعلان-ب', targetId: 'dress');
    expect(first.link.targetId, second.link.targetId);
    expect(first.link.id, isNot(second.link.id));
    final gateway = _SeqGateway(
      pages: [
        [_offer('dress', 'الفستان')],
        [_offer('next', 'عرض-لاحق')],
      ],
      ads: [first, second],
    );
    gateway.failMore = true;
    await tester.pumpWidget(MaterialApp(home: DiscoverPresentationScreen(gateway: gateway, videoPort: _QuietVideo())));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    final titles = ['الفستان', 'الإعلان-أ', 'الإعلان-ب', 'عرض-لاحق'];
    expect(_visible(tester, titles), 'الفستان');
    await _forward(tester);
    expect(_visible(tester, titles), 'الإعلان-أ');
    await _forward(tester);
    expect(_visible(tester, titles), 'الإعلان-ب');
    expect(find.text('عرض-لاحق').hitTestable(), findsNothing);
    expect(find.text('تعذر تحميل المزيد. النتائج المحملة ما زالت ظاهرة.'), findsWidgets);
    await tester.tap(find.text('إعادة المحاولة'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    expect(_visible(tester, titles), 'الإعلان-ب');
    expect(find.text('عرض-لاحق').hitTestable(), findsNothing);
    await _forward(tester);
    expect(_visible(tester, titles), 'عرض-لاحق');
    await _forward(tester);
    expect(_visible(tester, titles), 'عرض-لاحق');
    debugNetworkImageHttpClientProvider = null;
  });

  testWidgets('a page that arrives after the query changed is not inserted into the new sequence', (tester) async {
    debugNetworkImageHttpClientProvider = _ImageClient.new;
    final gateway = _SeqGateway(
      pages: [
        [_offer('old', 'البداية')],
        [_offer('late', 'صفحة-متأخرة')],
      ],
      ads: [_ad(id: 'ad-old', caption: 'إعلان-قديم')],
      searchPage: [_offer('found', 'نتيجة-جديدة')],
    );
    gateway.holdMore = Completer<DiscoverBrowseResponse>();
    await tester.pumpWidget(MaterialApp(home: DiscoverPresentationScreen(gateway: gateway, videoPort: _QuietVideo())));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    await _forward(tester);
    expect(_visible(tester, ['البداية', 'إعلان-قديم', 'صفحة-متأخرة', 'نتيجة-جديدة']), 'إعلان-قديم');
    await tester.enterText(find.byType(TextField).first, 'جديدة');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    expect(_visible(tester, ['البداية', 'إعلان-قديم', 'صفحة-متأخرة', 'نتيجة-جديدة']), 'نتيجة-جديدة');
    gateway.holdMore!.complete(DiscoverBrowseResponse(
      failed: false,
      transport: CatalogTransport.server,
      contentMark: ContentMark.unmarked,
      items: [_offer('late', 'صفحة-متأخرة')],
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    expect(find.text('صفحة-متأخرة').hitTestable(), findsNothing);
    await _forward(tester);
    expect(_visible(tester, ['البداية', 'إعلان-قديم', 'صفحة-متأخرة', 'نتيجة-جديدة']), 'نتيجة-جديدة');
    debugNetworkImageHttpClientProvider = null;
  });

  testWidgets('the open button keeps opening while a failed record is resent with the same id', (tester) async {
    debugNetworkImageHttpClientProvider = _ImageClient.new;
    final opened = <String>[];
    final events = <String>[];
    var openResult = true;
    var recordResult = true;
    Object? openError;
    Object? recordError;
    await tester.pumpWidget(MaterialApp(home: DiscoverPresentationScreen(
      slides: [_slide(_ad(id: 'ad-a', caption: 'الإعلان-أ'))],
      videoPort: _QuietVideo(),
      confirmAdLink: ({required String adId, required String url}) async => true,
      recordAdLink: ({required String adId, required String eventId, AdLinkAttemptControl? attempt}) async {
        events.add('$adId:$eventId');
        if (recordError != null) throw recordError!;
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
    expect(events, isEmpty);

    openResult = false;
    await tester.tap(find.text('افتحي الرابط').hitTestable());
    await tester.pump();
    expect(opened, hasLength(1));
    expect(events, isEmpty);

    openResult = true;
    openError = StateError('browser');
    await tester.tap(find.text('افتحي الرابط').hitTestable());
    await tester.pump();
    expect(events, isEmpty);
    openError = null;

    recordResult = false;
    await tester.tap(find.text('افتحي الرابط').hitTestable());
    await tester.pump();
    expect(opened, hasLength(2));
    expect(events, hasLength(1));
    final firstId = events.single.split(':').last;
    await tester.pump(const Duration(seconds: 2));
    expect(opened, hasLength(2));
    expect(events, ['ad-a:$firstId', 'ad-a:$firstId']);

    await tester.tap(find.text('افتحي الرابط').hitTestable());
    await tester.pump();
    expect(opened, hasLength(3));
    expect(events, hasLength(3));
    final secondId = events[2].split(':').last;
    expect(secondId, isNot(firstId));
    await tester.pump(const Duration(seconds: 2));
    expect(opened, hasLength(3));
    expect(events.where((event) => event.endsWith(secondId)), hasLength(2));

    recordError = StateError('record');
    await tester.tap(find.text('افتحي الرابط').hitTestable());
    await tester.pump();
    expect(opened, hasLength(4));
    expect(tester.takeException(), isNull);
    recordError = null;
    recordResult = true;
    await tester.tap(find.text('افتحي الرابط').hitTestable());
    await tester.pump();
    expect(opened, hasLength(5));
    expect(events.last.split(':').last, isNot(firstId));
    expect(events.last.split(':').last, isNot(secondId));
    AdLinkOpenOutbox.shared.reset();
    debugNetworkImageHttpClientProvider = null;
  });

  testWidgets('a late record result is not announced on another ad', (tester) async {
    debugNetworkImageHttpClientProvider = _ImageClient.new;
    final opened = <String>[];
    final events = <String>[];
    final late = Completer<bool>();
    await tester.pumpWidget(MaterialApp(home: DiscoverPresentationScreen(
      slides: [
        _slide(_ad(id: 'ad-a', caption: 'الإعلان-أ')),
        _slide(_ad(id: 'ad-b', caption: 'الإعلان-ب')),
      ],
      videoPort: _QuietVideo(),
      confirmAdLink: ({required String adId, required String url}) async => true,
      recordAdLink: ({required String adId, required String eventId, AdLinkAttemptControl? attempt}) async {
        events.add('$adId:$eventId');
        if (adId == 'ad-a') return late.future.then((accepted) => accepted ? AdLinkRecordOutcome.recorded : AdLinkRecordOutcome.retryable);
        return AdLinkRecordOutcome.recorded;
      },
      openExternal: (uri) async {
        opened.add(uri.toString());
        return true;
      },
    )));
    await tester.pump();
    await tester.tap(find.text('افتحي الرابط').hitTestable());
    await tester.pump();
    expect(opened, hasLength(1));
    expect(events, hasLength(1));
    await _forward(tester);
    expect(_visible(tester, ['الإعلان-أ', 'الإعلان-ب']), 'الإعلان-ب');
    late.complete(true);
    await tester.pump();
    expect(find.text('فُتح رابط خارجي. هذا ليس شراءً مكتملًا'), findsNothing);
    await tester.tap(find.text('افتحي الرابط').hitTestable());
    await tester.pump();
    expect(opened, hasLength(2));
    expect(events.last.startsWith('ad-b:'), isTrue);
    expect(events.last.split(':').last, isNot(events.first.split(':').last));
    AdLinkOpenOutbox.shared.reset();
    debugNetworkImageHttpClientProvider = null;
  });
}

String _visible(WidgetTester tester, List<String> titles) {
  final hits = [
    for (final title in titles)
      if (find.text(title).hitTestable().evaluate().isNotEmpty) title,
  ];
  expect(hits, hasLength(1), reason: 'visible=$hits');
  return hits.single;
}

Future<void> _forward(WidgetTester tester) async {
  final page = find.byType(PageView).first;
  final height = tester.getSize(page).height;
  await tester.drag(page, Offset(0, -(height * 0.75)));
  await tester.pumpAndSettle();
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

DiscoverPublishedAd _ad({required String id, required String caption, String targetId = 'dress'}) {
  return DiscoverPublishedAd.tryParse(_json(id: id, name: 'فستان', caption: caption, targetId: targetId))!;
}

PresentationSlide _slide(DiscoverPublishedAd ad) {
  return presentationSlideFromAd(
    ad.link,
    product: ad.product,
    media: [
      for (final item in ad.media)
        PresentationMedia(kind: PresentationMediaKind.image, assetPath: item.url, network: true),
    ],
  );
}

Map<String, dynamic> _json({
  required String id,
  String name = 'الأصل',
  String caption = 'إعلان',
  String targetId = 'dress',
  String? description,
  String city = 'الرياض',
  String? category,
}) {
  return {
    'id': id,
    'disclosure': 'إعلان',
    'captionAr': caption,
    'targetKind': 'product',
    'targetId': targetId,
    'advertiser': {'id': 'celebrity', 'nameAr': 'المعلن'},
    'publisher': {'id': 'celebrity', 'nameAr': 'الناشر'},
    'seller': {'id': 'seller', 'nameAr': 'الجهة', 'type': 'brand', 'city': city},
    'target': {
      'kind': 'product',
      'id': targetId,
      'nameAr': name,
      'priceHalalas': 1800,
      'externalUrl': 'https://shop.example/item',
      'category': category,
      if (description != null) 'descriptionAr': description,
    },
    'media': [
      {'kind': 'image', 'url': 'https://images.example/one.png'},
    ],
    'actions': {
      'openLink': true,
      'purchaseCompleted': false,
      'appointmentOperational': false,
      'appointmentConfirmed': false,
    },
    'views': {'state': 'disabled', 'count': null},
  };
}

class _SeqGateway implements DiscoverCatalogGateway {
  _SeqGateway({required this.pages, this.ads = const [], this.searchPage = const []});

  final List<List<DiscoverOffer>> pages;
  final List<DiscoverPublishedAd> ads;
  final List<DiscoverOffer> searchPage;
  Completer<DiscoverBrowseResponse>? holdMore;
  bool failMore = false;

  @override
  bool get serverEnabled => true;

  @override
  Future<DiscoverBrowseResponse> browse(DiscoverCatalogQuery query, {String? cursor, int limit = 4}) async {
    if (query.text.trim().isNotEmpty) {
      return _ok([
        for (final offer in searchPage)
          if (DiscoverCatalogQueryEngine.matches(offer, query)) offer,
      ]);
    }
    final index = cursor == null ? 0 : int.parse(cursor);
    if (cursor != null && failMore) {
      failMore = false;
      throw StateError('more');
    }
    if (cursor != null && holdMore != null) {
      return holdMore!.future;
    }
    return _ok(pages[index], next: index + 1 < pages.length ? '${index + 1}' : null);
  }

  DiscoverBrowseResponse _ok(List<DiscoverOffer> items, {String? next}) {
    return DiscoverBrowseResponse(
      failed: false,
      transport: CatalogTransport.server,
      contentMark: ContentMark.unmarked,
      items: items,
      nextCursor: next,
    );
  }

  @override
  Future<DiscoverAdFeed> publishedAds() async => DiscoverAdFeed(failed: false, items: ads);

  @override
  Future<CatalogRecordResult> loadRecord({required String kind, required String id, required CatalogTransport? transport}) async {
    return const CatalogRecordResult(status: CatalogRecordStatus.missing);
  }
}

class _QuietVideo extends PresentationVideoPort {
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
