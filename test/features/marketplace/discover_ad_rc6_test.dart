import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/data/ad_link_record.dart';
import 'package:mirra/features/marketplace/data/discover_published_ad.dart';
import 'package:mirra/features/marketplace/presentation/ad_link_open_outbox.dart';
import 'package:mirra/features/marketplace/presentation/presentation/presentation_models.dart';
import 'package:mirra/features/marketplace/presentation/presentation/presentation_video_port.dart';
import 'package:mirra/features/marketplace/presentation/screens/discover_presentation_screen.dart';

final _png = base64Decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');

void main() {
  tearDown(AdLinkOpenOutbox.shared.reset);

  testWidgets('exhausted attempts and retention abandon the event, and a full queue drops the new one', (tester) async {
    var ticks = DateTime.utc(2026, 9, 27);
    final outbox = AdLinkOpenOutbox(
      maxAttempts: 2,
      spacing: const Duration(seconds: 2),
      retention: const Duration(minutes: 10),
      now: () => ticks,
    );
    final calls = <String>[];
    outbox.enqueue(
      adId: 'ad-a',
      eventId: 'evt-1',
      send: ({required String adId, required String eventId, AdLinkAttemptControl? attempt}) async {
        calls.add('$adId:$eventId');
        return AdLinkRecordOutcome.retryable;
      },
    );
    await tester.pump();
    expect(calls, ['ad-a:evt-1']);
    ticks = ticks.add(const Duration(seconds: 2));
    await tester.pump(const Duration(seconds: 2));
    expect(calls, ['ad-a:evt-1', 'ad-a:evt-1']);
    expect(outbox.statusOf('evt-1'), AdLinkQueueStatus.abandoned);
    expect(outbox.pendingCount, 0);

    final aged = AdLinkOpenOutbox(
      spacing: const Duration(seconds: 2),
      retention: const Duration(seconds: 1),
      now: () => ticks,
    );
    aged.enqueue(
      adId: 'ad-a',
      eventId: 'evt-old',
      send: ({required String adId, required String eventId, AdLinkAttemptControl? attempt}) async {
        calls.add('$adId:$eventId');
        return AdLinkRecordOutcome.retryable;
      },
    );
    await tester.pump();
    ticks = ticks.add(const Duration(seconds: 3));
    await tester.pump(const Duration(seconds: 2));
    expect(calls.where((call) => call.endsWith('evt-old')), hasLength(1));
    expect(aged.statusOf('evt-old'), AdLinkQueueStatus.abandoned);

    final held = AdLinkOpenOutbox(maxPending: 1, spacing: const Duration(hours: 1), now: () => ticks);
    final blocked = Completer<AdLinkRecordOutcome>();
    held.enqueue(adId: 'ad-a', eventId: 'busy', send: ({required String adId, required String eventId, AdLinkAttemptControl? attempt}) => blocked.future);
    held.enqueue(
      adId: 'ad-b',
      eventId: 'dropped',
      send: ({required String adId, required String eventId, AdLinkAttemptControl? attempt}) async => AdLinkRecordOutcome.recorded,
    );
    expect(held.statusOf('dropped'), AdLinkQueueStatus.abandoned);
    expect(held.statusOf('busy'), AdLinkQueueStatus.pending);
    blocked.complete(AdLinkRecordOutcome.rejected);
    await tester.pump();
    expect(held.statusOf('busy'), AdLinkQueueStatus.rejected);
    expect(held.statusOf('dropped'), isNot(AdLinkQueueStatus.recorded));
  });

  testWidgets('two instances and a recreated screen get different ids, and a resend keeps its id', (tester) async {
    debugNetworkImageHttpClientProvider = _ImageClient.new;
    final opened = <String>[];
    final events = <String>[];
    var outcome = AdLinkRecordOutcome.retryable;
    Future<AdLinkRecordOutcome> record({required String adId, required String eventId, AdLinkAttemptControl? attempt}) async {
      events.add('$adId:$eventId');
      return outcome;
    }

    Future<void> open(AdLinkOpenOutbox outbox) async {
      await tester.pumpWidget(MaterialApp(home: DiscoverPresentationScreen(
        slides: [_slide(_ad('ad-a'))],
        videoPort: _QuietVideo(),
        linkOutbox: outbox,
        confirmAdLink: ({required String adId, required String url}) async => true,
        recordAdLink: record,
        openExternal: (uri) async {
          opened.add(uri.toString());
          return true;
        },
      )));
      await tester.pump();
      await tester.tap(find.text('افتحي الرابط'));
      await tester.pump();
    }

    final first = AdLinkOpenOutbox();
    final second = AdLinkOpenOutbox();
    await open(first);
    await open(second);
    expect(opened, hasLength(2));
    expect(events, hasLength(2));
    expect(events[0].split(':').last, isNot(events[1].split(':').last));
    final kept = events[0];
    await tester.pump(const Duration(seconds: 2));
    expect(opened, hasLength(2));
    expect(events.where((event) => event == kept), hasLength(2));

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
    outcome = AdLinkRecordOutcome.recorded;
    final third = AdLinkOpenOutbox();
    await open(third);
    expect(events.last.split(':').last, isNot(kept.split(':').last));
    expect(opened, hasLength(3));
    first.reset();
    second.reset();
    third.reset();
    debugNetworkImageHttpClientProvider = null;
  });

  testWidgets('two record failures then a success reuse the event and do not open again', (tester) async {
    debugNetworkImageHttpClientProvider = _ImageClient.new;
    final opened = <String>[];
    final events = <String>[];
    var fails = 0;
    final outbox = AdLinkOpenOutbox();
    await tester.pumpWidget(_app(
      outbox: outbox,
      opened: opened,
      record: ({required String adId, required String eventId, AdLinkAttemptControl? attempt}) async {
        events.add('$adId:$eventId');
        fails += 1;
        return fails < 3 ? AdLinkRecordOutcome.retryable : AdLinkRecordOutcome.recorded;
      },
    ));
    await tester.pump();
    await tester.tap(find.text('افتحي الرابط'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 2));
    await tester.pump(const Duration(seconds: 2));
    expect(opened, hasLength(1));
    expect(events, hasLength(3));
    expect(events.toSet(), hasLength(1));
    expect(outbox.statusOf(events.first.split(':').last), AdLinkQueueStatus.recorded);
    expect(outbox.pendingCount, 0);
    debugNetworkImageHttpClientProvider = null;
  });

  testWidgets('a waiting record does not block the next open, and a busy open ignores a second tap', (tester) async {
    debugNetworkImageHttpClientProvider = _ImageClient.new;
    final opened = <String>[];
    final events = <String>[];
    final firstRecord = Completer<AdLinkRecordOutcome>();
    final opener = Completer<bool>();
    var openCalls = 0;
    await tester.pumpWidget(_app(
      opened: opened,
      openExternal: (uri) {
        openCalls += 1;
        opened.add(uri.toString());
        return openCalls == 1 ? opener.future : Future<bool>.value(true);
      },
      record: ({required String adId, required String eventId, AdLinkAttemptControl? attempt}) {
        events.add('$adId:$eventId');
        return events.length == 1 ? firstRecord.future : Future<AdLinkRecordOutcome>.value(AdLinkRecordOutcome.recorded);
      },
    ));
    await tester.pump();
    await tester.tap(find.text('افتحي الرابط'));
    await tester.pump();
    await tester.tap(find.text('افتحي الرابط'));
    await tester.pump();
    expect(openCalls, 1);
    opener.complete(true);
    await tester.pump();
    expect(events, hasLength(1));
    await tester.tap(find.text('افتحي الرابط'));
    await tester.pump();
    expect(opened, hasLength(2));
    expect(events, hasLength(2));
    expect(events[0], isNot(events[1]));
    expect(firstRecord.isCompleted, isFalse);
    firstRecord.complete(AdLinkRecordOutcome.retryable);
    await tester.pump();
    AdLinkOpenOutbox.shared.reset();
    debugNetworkImageHttpClientProvider = null;
  });

  testWidgets('a false or thrown opener records nothing, and a thrown recorder is retried', (tester) async {
    debugNetworkImageHttpClientProvider = _ImageClient.new;
    final opened = <String>[];
    final events = <String>[];
    var openResult = false;
    Object? openError;
    var recordThrows = false;
    final outbox = AdLinkOpenOutbox();
    await tester.pumpWidget(_app(
      outbox: outbox,
      opened: opened,
      openExternal: (uri) async {
        if (openError != null) throw openError!;
        opened.add(uri.toString());
        return openResult;
      },
      record: ({required String adId, required String eventId, AdLinkAttemptControl? attempt}) async {
        events.add('$adId:$eventId');
        if (recordThrows) throw StateError('record');
        return AdLinkRecordOutcome.recorded;
      },
    ));
    await tester.pump();
    await tester.tap(find.text('افتحي الرابط'));
    await tester.pump();
    expect(opened, hasLength(1));
    expect(events, isEmpty);
    openError = StateError('browser');
    await tester.tap(find.text('افتحي الرابط'));
    await tester.pump();
    expect(events, isEmpty);
    expect(tester.takeException(), isNull);
    openError = null;
    openResult = true;
    recordThrows = true;
    await tester.tap(find.text('افتحي الرابط'));
    await tester.pump();
    expect(opened, hasLength(2));
    expect(events, hasLength(1));
    expect(tester.takeException(), isNull);
    await tester.pump(const Duration(seconds: 2));
    expect(opened, hasLength(2));
    expect(events, [events.first, events.first]);
    expect(outbox.statusOf(events.first.split(':').last), AdLinkQueueStatus.pending);
    outbox.reset();
    debugNetworkImageHttpClientProvider = null;
  });

  testWidgets('leaving the slide keeps the event on its ad and a late eligibility check does not open', (tester) async {
    debugNetworkImageHttpClientProvider = _ImageClient.new;
    final opened = <String>[];
    final events = <String>[];
    final recordGate = Completer<AdLinkRecordOutcome>();
    final outbox = AdLinkOpenOutbox();
    await tester.pumpWidget(MaterialApp(home: DiscoverPresentationScreen(
      slides: [_slide(_ad('ad-a', caption: 'الإعلان-أ')), _slide(_ad('ad-b', caption: 'الإعلان-ب', targetId: 'dress'))],
      videoPort: _QuietVideo(),
      linkOutbox: outbox,
      confirmAdLink: ({required String adId, required String url}) async => true,
      recordAdLink: ({required String adId, required String eventId, AdLinkAttemptControl? attempt}) {
        events.add('$adId:$eventId');
        return adId == 'ad-a' && events.where((event) => event.startsWith('ad-a:')).length == 1
            ? recordGate.future
            : Future<AdLinkRecordOutcome>.value(AdLinkRecordOutcome.retryable);
      },
      openExternal: (uri) async {
        opened.add('$uri');
        return true;
      },
    )));
    await tester.pump();
    await tester.tap(find.text('افتحي الرابط').hitTestable());
    await tester.pump();
    expect(events, hasLength(1));
    expect(events.single.startsWith('ad-a:'), isTrue);
    await tester.drag(find.byType(PageView).first, const Offset(0, -500));
    await tester.pumpAndSettle();
    expect(find.text('الإعلان-ب').hitTestable(), findsWidgets);
    final before = find.text('فُتح رابط خارجي. هذا ليس شراءً مكتملًا').evaluate().length;
    recordGate.complete(AdLinkRecordOutcome.retryable);
    await tester.pump();
    expect(find.text('فُتح رابط خارجي. هذا ليس شراءً مكتملًا').evaluate().length, before);
    expect(events.where((event) => event.startsWith('ad-b:')), isEmpty);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(seconds: 2));
    expect(events.where((event) => event == events.first), hasLength(2));

    final lateConfirm = Completer<bool>();
    final lateBox = AdLinkOpenOutbox();
    await tester.pumpWidget(MaterialApp(home: DiscoverPresentationScreen(
      slides: [_slide(_ad('ad-a', caption: 'الإعلان-أ')), _slide(_ad('ad-b', caption: 'الإعلان-ب'))],
      videoPort: _QuietVideo(),
      linkOutbox: lateBox,
      confirmAdLink: ({required String adId, required String url}) => lateConfirm.future,
      recordAdLink: ({required String adId, required String eventId, AdLinkAttemptControl? attempt}) async => AdLinkRecordOutcome.recorded,
      openExternal: (uri) async {
        opened.add('late');
        return true;
      },
    )));
    await tester.pump();
    final beforeLate = opened.length;
    await tester.tap(find.text('افتحي الرابط').hitTestable());
    await tester.pump();
    await tester.drag(find.byType(PageView).first, const Offset(0, -500));
    await tester.pumpAndSettle();
    lateConfirm.complete(true);
    await tester.pump();
    expect(opened.length, beforeLate);
    outbox.reset();
    lateBox.reset();
    debugNetworkImageHttpClientProvider = null;
  });

  testWidgets('preload, details, and media changes do not record a link open', (tester) async {
    debugNetworkImageHttpClientProvider = _ImageClient.new;
    final events = <String>[];
    await tester.pumpWidget(_app(
      record: ({required String adId, required String eventId, AdLinkAttemptControl? attempt}) async {
        events.add(eventId);
        return AdLinkRecordOutcome.recorded;
      },
    ));
    await tester.pump();
    expect(events, isEmpty);
    await tester.fling(find.byType(PageView).last, const Offset(-240, 0), 800);
    await tester.pump();
    await tester.tap(find.text('التفاصيل').hitTestable().first);
    await tester.pump();
    expect(events, isEmpty);
    AdLinkOpenOutbox.shared.reset();
    debugNetworkImageHttpClientProvider = null;
  });
}

Widget _app({
  AdLinkOpenOutbox? outbox,
  List<String>? opened,
  required Future<AdLinkRecordOutcome> Function({required String adId, required String eventId, AdLinkAttemptControl? attempt}) record,
  Future<bool> Function(Uri uri)? openExternal,
}) {
  return MaterialApp(home: DiscoverPresentationScreen(
    slides: [_slide(_ad('ad-a'))],
    videoPort: _QuietVideo(),
    linkOutbox: outbox,
    confirmAdLink: ({required String adId, required String url}) async => true,
    recordAdLink: record,
    openExternal: openExternal ?? (uri) async {
      opened?.add(uri.toString());
      return true;
    },
  ));
}

DiscoverPublishedAd _ad(String id, {String caption = 'إعلان', String targetId = 'dress'}) {
  return DiscoverPublishedAd.tryParse({
    'id': id,
    'disclosure': 'إعلان',
    'captionAr': caption,
    'targetKind': 'product',
    'targetId': targetId,
    'advertiser': {'id': 'celebrity', 'nameAr': 'المعلن'},
    'publisher': {'id': 'celebrity', 'nameAr': 'الناشر'},
    'seller': {'id': 'seller', 'nameAr': 'الجهة', 'type': 'brand', 'city': 'الرياض'},
    'target': {
      'kind': 'product',
      'id': targetId,
      'nameAr': 'فستان',
      'priceHalalas': 1800,
      'externalUrl': 'https://shop.example/item',
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
  })!;
}

PresentationSlide _slide(DiscoverPublishedAd ad) {
  return presentationSlideFromAd(ad.link, product: ad.product, media: [
    for (final item in ad.media)
      PresentationMedia(kind: PresentationMediaKind.image, assetPath: item.url, network: true),
  ]);
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
