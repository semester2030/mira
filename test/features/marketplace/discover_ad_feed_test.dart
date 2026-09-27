import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/data/ad_link_record.dart';
import 'package:mirra/features/marketplace/data/catalog_provenance.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_gateway.dart';
import 'package:mirra/features/marketplace/data/discover_catalog_query.dart';
import 'package:mirra/features/marketplace/data/discover_published_ad.dart';
import 'package:mirra/features/marketplace/presentation/ad_link_open_outbox.dart';
import 'package:mirra/features/marketplace/presentation/presentation/presentation_video_port.dart';
import 'package:mirra/features/marketplace/presentation/screens/discover_presentation_screen.dart';
import 'package:mirra/shared/theme/theme.dart';

void main() {
  tearDown(AdLinkOpenOutbox.shared.reset);
  test('a payload that points at a different original is rejected', () {
    expect(DiscoverPublishedAd.tryParse(_adJson(id: 'ad-1', kind: 'product', targetId: 'dress', nestedId: 'other')), isNull);
    expect(DiscoverPublishedAd.tryParse(_adJson(id: 'ad-1', kind: 'product', targetId: 'dress', nestedKind: 'service')), isNull);
  });

  testWidgets('the catalog entry loads product and service ads and records the real link event', (tester) async {
    final gateway = _AdGateway();
    final events = <String>[];
    final opened = <String>[];
    await tester.pumpWidget(MaterialApp(
      theme: AppTheme.lightTheme,
      home: DiscoverPresentationScreen(
        gateway: gateway,
        videoPort: _QuietVideoPort(),
        confirmAdLink: ({required String adId, required String url}) async => true,
        recordAdLink: ({required String adId, required String eventId, AdLinkAttemptControl? attempt}) async {
          events.add('$adId:$eventId');
          return AdLinkRecordOutcome.recorded;
        },
        openExternal: (uri) async {
          opened.add(uri.toString());
          return true;
        },
      ),
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 20));
    expect(gateway.browseCalls, 1);
    expect(gateway.adCalls, 1);
    expect(find.text('إعلان المنتج'), findsOneWidget);
    expect(find.text('لا توجد وسائط منشورة لهذا العرض'), findsNothing);
    expect(find.textContaining('إعلان · المعلن:'), findsOneWidget);
    expect(events, isEmpty);

    await tester.tap(find.text('افتحي الرابط'));
    await tester.pump();
    expect(opened, ['https://example.com/dress']);
    expect(events, hasLength(1));
    expect(events.single.startsWith('ad-product:'), isTrue);
    await tester.tap(find.text('افتحي الرابط'));
    await tester.pump();
    expect(opened, ['https://example.com/dress', 'https://example.com/dress']);
    expect(events, hasLength(2));
    expect(events[0], isNot(events[1]));

    await tester.fling(find.byType(PageView).first, const Offset(0, -400), 800);
    await tester.pumpAndSettle();
    expect(find.text('إعلان الخدمة'), findsOneWidget);
    expect(find.text('لا توجد وسائط منشورة لهذا العرض'), findsOneWidget);
    expect(find.text('اطلبي موعدًا'), findsNothing);
    expect(events.where((event) => event.startsWith('ad-service:')), isEmpty);
  });

  testWidgets('a failed ad feed does not invent a local published ad', (tester) async {
    final gateway = _AdGateway()..adsFailed = true;
    await tester.pumpWidget(MaterialApp(
      theme: AppTheme.lightTheme,
      home: DiscoverPresentationScreen(gateway: gateway, videoPort: _QuietVideoPort()),
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 20));
    expect(find.text('تعذر تحميل الإعلانات. لم يُعرض إعلان بديل.'), findsOneWidget);
    expect(find.text('إعلان المنتج'), findsNothing);
    expect(find.textContaining('إعلان ·'), findsNothing);
  });
}

Map<String, dynamic> _adJson({
  required String id,
  required String kind,
  required String targetId,
  String? nestedId,
  String? nestedKind,
  String? url,
  List<Map<String, dynamic>> media = const [],
  String caption = 'إعلان',
}) {
  return {
    'id': id,
    'disclosure': 'إعلان',
    'captionAr': caption,
    'targetKind': kind,
    'targetId': targetId,
    'advertiser': {'id': 'celebrity', 'nameAr': 'المعلن'},
    'publisher': {'id': 'celebrity', 'nameAr': 'الناشر'},
    'seller': {
      'id': 'seller',
      'nameAr': 'الجهة',
      'type': kind == 'service' ? 'clinic' : 'brand',
      'city': 'الرياض',
    },
    'target': {
      'kind': nestedKind ?? kind,
      'id': nestedId ?? targetId,
      'nameAr': 'الأصل',
      'priceHalalas': 1800,
      'externalUrl': url,
      if (kind == 'service') 'durationMin': 40,
      if (kind == 'service') 'category': 'skin',
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

class _AdGateway implements DiscoverCatalogGateway {
  int browseCalls = 0;
  int adCalls = 0;
  bool adsFailed = false;

  @override
  bool get serverEnabled => true;

  @override
  Future<DiscoverBrowseResponse> browse(DiscoverCatalogQuery query, {String? cursor, int limit = 4}) async {
    browseCalls += 1;
    return const DiscoverBrowseResponse(
      failed: false,
      transport: CatalogTransport.server,
      contentMark: ContentMark.unmarked,
      items: [],
    );
  }

  @override
  Future<DiscoverAdFeed> publishedAds() async {
    adCalls += 1;
    if (adsFailed) return const DiscoverAdFeed(failed: true);
    return DiscoverAdFeed(failed: false, items: [
      DiscoverPublishedAd.tryParse(_adJson(
        id: 'ad-product',
        kind: 'product',
        targetId: 'dress',
        url: 'https://example.com/dress',
        caption: 'إعلان المنتج',
        media: const [{'kind': 'image', 'url': 'https://example.invalid/published-image'}],
      ))!,
      DiscoverPublishedAd.tryParse(_adJson(
        id: 'ad-service',
        kind: 'service',
        targetId: 'session',
        caption: 'إعلان الخدمة',
      ))!,
    ]);
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
