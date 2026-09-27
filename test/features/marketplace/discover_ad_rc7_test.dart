import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/data/ad_link_record.dart';
import 'package:mirra/features/marketplace/data/datasources/marketplace_api_data_source.dart';
import 'package:mirra/features/marketplace/data/discover_published_ad.dart';
import 'package:mirra/features/marketplace/presentation/ad_link_open_outbox.dart';
import 'package:mirra/features/marketplace/presentation/presentation/presentation_models.dart';
import 'package:mirra/features/marketplace/presentation/presentation/presentation_video_port.dart';
import 'package:mirra/features/marketplace/presentation/screens/discover_presentation_screen.dart';

final _png = base64Decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');

void main() {
  tearDown(AdLinkOpenOutbox.shared.reset);

  testWidgets('one event keeps a single active transport and a late success stays recorded', (tester) async {
    final outbox = AdLinkOpenOutbox(spacing: const Duration(seconds: 2), requestTimeout: const Duration(seconds: 8));
    var active = 0;
    var maxActive = 0;
    final calls = <String>[];
    outbox.enqueue(
      adId: 'ad-a',
      eventId: 'evt-1',
      send: ({required String adId, required String eventId, AdLinkAttemptControl? attempt}) {
        calls.add('$adId:$eventId');
        active += 1;
        if (active > maxActive) maxActive = active;
        final done = Completer<AdLinkRecordOutcome>();
        attempt?.onCancel(() {
          if (!done.isCompleted) done.complete(AdLinkRecordOutcome.retryable);
        });
        return done.future.whenComplete(() => active -= 1);
      },
    );
    await tester.pump();
    expect(outbox.activeTransportCount, 1);
    await tester.pump(const Duration(seconds: 2));
    expect(calls, ['ad-a:evt-1']);
    expect(maxActive, 1);
    await tester.pump(const Duration(seconds: 6));
    await tester.pump();
    expect(outbox.activeTransportCount, 0);
    expect(calls, ['ad-a:evt-1']);
    await tester.pump(const Duration(seconds: 2));
    expect(calls, ['ad-a:evt-1', 'ad-a:evt-1']);
    expect(maxActive, 1);
    expect(outbox.activeTransportCount, 1);
    outbox.reset();
  });

  testWidgets('a response that arrives as recorded is kept, and a thrown sender is retried', (tester) async {
    final outbox = AdLinkOpenOutbox(maxAttempts: 2, spacing: const Duration(seconds: 2), requestTimeout: const Duration(seconds: 8));
    final stored = <String>{};
    var calls = 0;
    outbox.enqueue(
      adId: 'ad-a',
      eventId: 'evt-lost',
      send: ({required String adId, required String eventId, AdLinkAttemptControl? attempt}) async {
        calls += 1;
        if (stored.add(eventId) && calls == 1) throw StateError('response lost');
        return AdLinkRecordOutcome.recorded;
      },
    );
    await tester.pump();
    expect(tester.takeException(), isNull);
    expect(outbox.statusOf('evt-lost'), AdLinkQueueStatus.pending);
    await tester.pump(const Duration(seconds: 2));
    expect(stored, {'evt-lost'});
    expect(calls, 2);
    expect(outbox.statusOf('evt-lost'), AdLinkQueueStatus.recorded);

    final late = AdLinkOpenOutbox(requestTimeout: const Duration(seconds: 8), spacing: const Duration(seconds: 2));
    var lateCalls = 0;
    late.enqueue(
      adId: 'ad-a',
      eventId: 'evt-late',
      send: ({required String adId, required String eventId, AdLinkAttemptControl? attempt}) {
        lateCalls += 1;
        final done = Completer<AdLinkRecordOutcome>();
        attempt?.onCancel(() {
          if (!done.isCompleted) done.complete(AdLinkRecordOutcome.recorded);
        });
        return done.future;
      },
    );
    await tester.pump(const Duration(seconds: 8));
    expect(late.statusOf('evt-late'), AdLinkQueueStatus.recorded);
    await tester.pump(const Duration(seconds: 4));
    expect(lateCalls, 1);
    expect(late.pendingCount, 0);
    late.reset();
  });

  testWidgets('finished statuses stay inside the cap and do not disturb a pending event', (tester) async {
    var ticks = DateTime.utc(2026, 9, 27);
    final outbox = AdLinkOpenOutbox(
      maxTerminal: 2,
      terminalRetention: const Duration(seconds: 5),
      requestTimeout: const Duration(hours: 1),
      now: () => ticks,
    );
    for (var index = 0; index < 4; index += 1) {
      outbox.enqueue(
        adId: 'ad-a',
        eventId: 'done-$index',
        send: ({required String adId, required String eventId, AdLinkAttemptControl? attempt}) async => AdLinkRecordOutcome.recorded,
      );
      await tester.pump();
    }
    expect(outbox.terminalCount, 2);
    expect(outbox.statusOf('done-0'), isNull);
    expect(outbox.statusOf('done-3'), AdLinkQueueStatus.recorded);
    final held = Completer<AdLinkRecordOutcome>();
    outbox.enqueue(
      adId: 'ad-a',
      eventId: 'pending',
      send: ({required String adId, required String eventId, AdLinkAttemptControl? attempt}) => held.future,
    );
    await tester.pump();
    ticks = ticks.add(const Duration(seconds: 6));
    outbox.enqueue(
      adId: 'ad-a',
      eventId: 'after',
      send: ({required String adId, required String eventId, AdLinkAttemptControl? attempt}) async => AdLinkRecordOutcome.rejected,
    );
    await tester.pump();
    expect(outbox.statusOf('pending'), AdLinkQueueStatus.pending);
    expect(outbox.statusOf('done-3'), isNull);
    expect(outbox.statusOf('after'), AdLinkQueueStatus.rejected);
    expect(outbox.terminalCount <= 2, isTrue);
    held.complete(AdLinkRecordOutcome.retryable);
    await tester.pump();
    outbox.reset();
  });

  testWidgets('dio cancel ends the hanging request before the replacement starts', (tester) async {
    final transport = _HoldingTransport();
    final api = MarketplaceApiDataSource(dio: Dio()..httpClientAdapter = transport);
    final outbox = AdLinkOpenOutbox(requestTimeout: const Duration(seconds: 8), spacing: const Duration(seconds: 2), maxAttempts: 3);
    outbox.enqueue(adId: 'ad-a', eventId: 'evt-http', send: api.recordAdLinkOpen);
    for (var step = 0; step < 8 && transport.fetches == 0; step += 1) {
      await tester.pump(Duration.zero);
    }
    expect(transport.fetches, 1, reason: 'outbox=${outbox.activeTransportCount} status=${outbox.statusOf('evt-http')}');
    expect(outbox.activeTransportCount, 1);
    expect(transport.active, 1);
    await tester.pump(const Duration(seconds: 6));
    expect(transport.maxActive, 1);
    await tester.pump(const Duration(seconds: 2));
    await tester.pump();
    expect(transport.active, 0);
    expect(outbox.activeTransportCount, 0);
    await tester.pump(const Duration(seconds: 2));
    for (var step = 0; step < 8 && transport.fetches < 2; step += 1) {
      await tester.pump(Duration.zero);
    }
    expect(transport.maxActive, 1);
    expect(transport.active, 1);
    expect(outbox.activeTransportCount, 1);
    outbox.reset();
    transport.close();
  });

  testWidgets('resend does not open the browser again', (tester) async {
    debugNetworkImageHttpClientProvider = _ImageClient.new;
    final opened = <String>[];
    final events = <String>[];
    var fails = 0;
    await tester.pumpWidget(MaterialApp(home: DiscoverPresentationScreen(
      slides: [_slide()],
      videoPort: _QuietVideo(),
      linkOutbox: AdLinkOpenOutbox(),
      confirmAdLink: ({required String adId, required String url}) async => true,
      recordAdLink: ({required String adId, required String eventId, AdLinkAttemptControl? attempt}) async {
        events.add('$adId:$eventId');
        fails += 1;
        if (fails == 1) throw StateError('record');
        return AdLinkRecordOutcome.recorded;
      },
      openExternal: (uri) async {
        opened.add(uri.toString());
        return true;
      },
    )));
    await tester.pump();
    await tester.tap(find.text('افتحي الرابط'));
    await tester.pump();
    expect(tester.takeException(), isNull);
    await tester.pump(const Duration(seconds: 2));
    expect(opened, hasLength(1));
    expect(events, hasLength(2));
    expect(events.first, events.last);
    AdLinkOpenOutbox.shared.reset();
    debugNetworkImageHttpClientProvider = null;
  });
}

PresentationSlide _slide() {
  final ad = DiscoverPublishedAd.tryParse({
    'id': 'ad-a',
    'disclosure': 'إعلان',
    'captionAr': 'إعلان',
    'targetKind': 'product',
    'targetId': 'dress',
    'advertiser': {'id': 'celebrity', 'nameAr': 'المعلن'},
    'publisher': {'id': 'celebrity', 'nameAr': 'الناشر'},
    'seller': {'id': 'seller', 'nameAr': 'الجهة', 'type': 'brand', 'city': 'الرياض'},
    'target': {'kind': 'product', 'id': 'dress', 'nameAr': 'فستان', 'priceHalalas': 1800, 'externalUrl': 'https://shop.example/item'},
    'media': [
      {'kind': 'image', 'url': 'https://images.example/one.png'},
    ],
    'actions': {'openLink': true, 'purchaseCompleted': false, 'appointmentOperational': false, 'appointmentConfirmed': false},
    'views': {'state': 'disabled', 'count': null},
  })!;
  return presentationSlideFromAd(ad.link, product: ad.product, media: [
    for (final item in ad.media) PresentationMedia(kind: PresentationMediaKind.image, assetPath: item.url, network: true),
  ]);
}

class _HoldingTransport implements HttpClientAdapter {
  int active = 0;
  int maxActive = 0;
  int fetches = 0;

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) {
    fetches += 1;
    active += 1;
    if (active > maxActive) maxActive = active;
    final done = Completer<ResponseBody>();
    cancelFuture?.whenComplete(() {
      if (active > 0) active -= 1;
      if (!done.isCompleted) {
        done.completeError(DioException(requestOptions: options, type: DioExceptionType.cancel));
      }
    });
    return done.future;
  }
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
