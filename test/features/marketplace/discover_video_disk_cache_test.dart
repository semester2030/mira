import 'dart:async';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/presentation/presentation/discover_video_disk_cache.dart';

void main() {
  test('mediaIdFromUrl extracts marketplace media uuid', () {
    const url =
        'https://mira-api-n4p3.onrender.com/api/v1/marketplace/media/f8c0535f-f87f-4ef7-86df-7a93d373ead5?token=abc';
    expect(
      DiscoverVideoDiskCache.mediaIdFromUrl(url),
      'f8c0535f-f87f-4ef7-86df-7a93d373ead5',
    );
    expect(DiscoverVideoDiskCache.mediaIdFromUrl('assets/x.mp4'), isNull);
  });

  test('ensureLocal downloads once and reuses complete file by mediaId+length', () async {
    final root = Directory.systemTemp.createTempSync('mira_vid_cache_');
    addTearDown(() {
      try {
        root.deleteSync(recursive: true);
      } catch (_) {}
    });

    HttpServer? server;
    addTearDown(() async {
      await server?.close(force: true);
    });
    server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final bytes = List<int>.generate(64 * 1024, (i) => i % 256);
    var getCount = 0;
    server.listen((req) async {
      if (req.method == 'HEAD') {
        req.response.headers.contentType = ContentType('video', 'mp4');
        req.response.contentLength = bytes.length;
        await req.response.close();
        return;
      }
      getCount += 1;
      final range = req.headers.value(HttpHeaders.rangeHeader);
      req.response.headers.contentType = ContentType('video', 'mp4');
      if (range != null && range.startsWith('bytes=')) {
        final start = int.parse(range.substring(6).split('-').first);
        req.response.statusCode = HttpStatus.partialContent;
        req.response.headers.set(
          HttpHeaders.contentRangeHeader,
          'bytes $start-${bytes.length - 1}/${bytes.length}',
        );
        req.response.add(bytes.sublist(start));
      } else {
        req.response.contentLength = bytes.length;
        req.response.add(bytes);
      }
      await req.response.close();
    });

    final base =
        'http://${server.address.host}:${server.port}/api/v1/marketplace/media/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    final cache = DiscoverVideoDiskCache(root: root, httpClient: HttpClient());

    final first = await cache.ensureLocal(base);
    expect(first.playableFromDisk, isTrue);
    expect(first.bytesOnDisk, bytes.length);
    expect(getCount, 1);

    final second = await cache.ensureLocal('$base?sig=rotated');
    expect(second.playableFromDisk, isTrue);
    expect(second.fromDisk, isTrue);
    expect(second.bytesDownloaded, 0);
    expect(getCount, 1);
    expect(await second.file!.readAsBytes(), bytes);
  });

  test('parallel ensureLocal shares one download', () async {
    final root = Directory.systemTemp.createTempSync('mira_vid_cache_share_');
    addTearDown(() {
      try {
        root.deleteSync(recursive: true);
      } catch (_) {}
    });
    HttpServer? server;
    addTearDown(() async {
      await server?.close(force: true);
    });
    server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final bytes = List<int>.filled(32 * 1024, 7);
    var getCount = 0;
    server.listen((req) async {
      if (req.method == 'HEAD') {
        req.response.contentLength = bytes.length;
        await req.response.close();
        return;
      }
      getCount += 1;
      await Future<void>.delayed(const Duration(milliseconds: 80));
      req.response.contentLength = bytes.length;
      req.response.add(bytes);
      await req.response.close();
    });
    final url =
        'http://${server.address.host}:${server.port}/api/v1/marketplace/media/11111111-2222-3333-4444-555555555555';
    final cache = DiscoverVideoDiskCache(root: root, httpClient: HttpClient());
    final results = await Future.wait([
      cache.ensureLocal(url),
      cache.ensureLocal(url),
      cache.ensureLocal(url),
    ]);
    expect(results.every((r) => r.playableFromDisk), isTrue);
    expect(getCount, 1);
  });

  test('reopen after partial prefix: serves local start, Range-fetches only the tail', () async {
    final root = Directory.systemTemp.createTempSync('mira_vid_partial_');
    addTearDown(() {
      try {
        root.deleteSync(recursive: true);
      } catch (_) {}
    });

    HttpServer? origin;
    addTearDown(() async {
      await origin?.close(force: true);
    });
    origin = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final bytes = List<int>.generate(48 * 1024, (i) => (i * 3) % 256);
    final rangeStarts = <int>[];
    var fullGets = 0;
    origin.listen((req) async {
      if (req.method == 'HEAD') {
        req.response.contentLength = bytes.length;
        req.response.headers.set(HttpHeaders.acceptRangesHeader, 'bytes');
        await req.response.close();
        return;
      }
      final range = req.headers.value(HttpHeaders.rangeHeader);
      req.response.headers.contentType = ContentType('video', 'mp4');
      if (range != null && range.startsWith('bytes=')) {
        final start = int.parse(range.substring(6).split('-').first);
        rangeStarts.add(start);
        req.response.statusCode = HttpStatus.partialContent;
        req.response.headers.set(
          HttpHeaders.contentRangeHeader,
          'bytes $start-${bytes.length - 1}/${bytes.length}',
        );
        req.response.add(bytes.sublist(start));
      } else {
        fullGets += 1;
        req.response.contentLength = bytes.length;
        req.response.add(bytes);
      }
      await req.response.close();
    });

    final mediaId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    final url = 'http://${origin.address.host}:${origin.port}/api/v1/marketplace/media/$mediaId';
    final cache = DiscoverVideoDiskCache(root: root, httpClient: HttpClient());
    addTearDown(() async {
      await cache.disposeProxy();
    });

    const prefix = 10 * 1024;
    final seeded = await cache.ensureLocal(url, stopAfterBytes: prefix);
    expect(seeded.complete, isFalse);
    expect(seeded.bytesOnDisk, greaterThanOrEqualTo(prefix));
    final localAfterSeed = await cache.bytesOnDiskFor(url);
    expect(localAfterSeed, greaterThanOrEqualTo(prefix));

    // Player path: resolve to proxy (not origin), then request the saved start.
    final source = await cache.resolvePlaySource(url);
    expect(source.isProxy, isTrue);
    expect(source.bytesOnDisk, greaterThanOrEqualTo(prefix));

    final beforeRanges = List<int>.from(rangeStarts);
    final beforeFull = fullGets;

    final client = HttpClient();
    final playReq = await client.getUrl(source.uri!);
    playReq.headers.set(HttpHeaders.rangeHeader, 'bytes=0-${prefix - 1}');
    final playResp = await playReq.close();
    final played = await playResp.fold<List<int>>(<int>[], (a, b) {
      a.addAll(b);
      return a;
    });
    expect(playResp.statusCode, anyOf(HttpStatus.ok, HttpStatus.partialContent));
    expect(played.length, prefix);
    expect(played, bytes.sublist(0, prefix));

    Future<DiscoverByteServeStats> waitStats() async {
      for (var i = 0; i < 100; i++) {
        final s = cache.lastServeStats;
        if (s != null) return s;
        await Future<void>.delayed(const Duration(milliseconds: 10));
      }
      fail('lastServeStats stayed null');
      throw StateError('unreachable');
    }

    final stats = await waitStats();
    expect(stats.bytesFromDisk, prefix);
    expect(stats.bytesFromNetwork, 0);
    // Must not re-GET the already-local prefix from origin.
    expect(rangeStarts.where((s) => s < prefix), isEmpty);
    expect(fullGets, beforeFull);

    // Now ask past the prefix — only the missing tail may be fetched.
    final needEnd = prefix + 4095;
    cache.lastServeStats = null;
    final playReq2 = await client.getUrl(source.uri!);
    playReq2.headers.set(HttpHeaders.rangeHeader, 'bytes=0-$needEnd');
    final playResp2 = await playReq2.close();
    final played2 = await playResp2.fold<List<int>>(<int>[], (a, b) {
      a.addAll(b);
      return a;
    });
    expect(played2.length, needEnd + 1);
    expect(played2, bytes.sublist(0, needEnd + 1));

    final stats2 = await waitStats();
    expect(stats2.bytesFromDisk, greaterThanOrEqualTo(prefix));
    expect(stats2.bytesFromNetwork, greaterThan(0));
    expect(stats2.bytesFromNetwork, lessThanOrEqualTo(needEnd + 1 - prefix + 1024));
    // Origin Range must start at/after the saved prefix — never byte 0 again.
    final newRanges = rangeStarts.skip(beforeRanges.length).toList();
    expect(newRanges, isNotEmpty);
    expect(newRanges.every((s) => s >= prefix), isTrue);
    expect(fullGets, beforeFull);

    client.close(force: true);
  });

  test('after 20 other media ids, first partial still resumes without re-fetching prefix', () async {
    final root = Directory.systemTemp.createTempSync('mira_vid_lru20_');
    addTearDown(() {
      try {
        root.deleteSync(recursive: true);
      } catch (_) {}
    });

    HttpServer? origin;
    addTearDown(() async {
      await origin?.close(force: true);
    });
    origin = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    const bodySize = 24 * 1024;
    final bodies = <String, List<int>>{};
    final originGets = <String, List<int>>{}; // mediaId -> range starts ( -1 = full )
    origin.listen((req) async {
      final id = req.uri.pathSegments.isNotEmpty ? req.uri.pathSegments.last : '';
      bodies.putIfAbsent(id, () => List<int>.generate(bodySize, (i) => (i + id.hashCode) % 256));
      final bytes = bodies[id]!;
      if (req.method == 'HEAD') {
        req.response.contentLength = bytes.length;
        await req.response.close();
        return;
      }
      final range = req.headers.value(HttpHeaders.rangeHeader);
      originGets.putIfAbsent(id, () => <int>[]);
      if (range != null && range.startsWith('bytes=')) {
        final start = int.parse(range.substring(6).split('-').first);
        originGets[id]!.add(start);
        req.response.statusCode = HttpStatus.partialContent;
        req.response.headers.set(
          HttpHeaders.contentRangeHeader,
          'bytes $start-${bytes.length - 1}/${bytes.length}',
        );
        req.response.add(bytes.sublist(start));
      } else {
        originGets[id]!.add(-1);
        req.response.contentLength = bytes.length;
        req.response.add(bytes);
      }
      await req.response.close();
    });

    // maxEntries=28 so 21 partials (1 + 20) all fit — models rewind after ~20 clips.
    final cache = DiscoverVideoDiskCache(
      root: root,
      httpClient: HttpClient(),
      maxEntries: 28,
      maxBytes: 900 * 1024 * 1024,
    );
    addTearDown(() async {
      await cache.disposeProxy();
    });

    String urlFor(int i) {
      final hex = i.toRadixString(16).padLeft(12, '0');
      final id = 'bbbbbbbb-bbbb-bbbb-bbbb-$hex';
      return 'http://${origin!.address.host}:${origin.port}/api/v1/marketplace/media/$id';
    }

    const prefix = 8 * 1024;
    final firstUrl = urlFor(0);
    final firstId = DiscoverVideoDiskCache.mediaIdFromUrl(firstUrl)!;
    final seeded = await cache.ensureLocal(firstUrl, stopAfterBytes: prefix);
    expect(seeded.bytesOnDisk, greaterThanOrEqualTo(prefix));
    final localBefore = await cache.bytesOnDiskFor(firstUrl);

    final othersLocal = <String, int>{};
    for (var i = 1; i <= 20; i++) {
      final u = urlFor(i);
      final r = await cache.ensureLocal(u, stopAfterBytes: prefix);
      othersLocal[DiscoverVideoDiskCache.mediaIdFromUrl(u)!] = r.bytesOnDisk;
    }
    expect(othersLocal.length, 20);

    final localAfter20 = await cache.bytesOnDiskFor(firstUrl);
    expect(localAfter20, localBefore);

    final getsBefore = List<int>.from(originGets[firstId] ?? const []);
    final source = await cache.resolvePlaySource(firstUrl);
    expect(source.isProxy, isTrue);

    final client = HttpClient();
    final req = await client.getUrl(source.uri!);
    req.headers.set(HttpHeaders.rangeHeader, 'bytes=0-${prefix - 1}');
    final resp = await req.close();
    final body = await resp.fold<List<int>>(<int>[], (a, b) {
      a.addAll(b);
      return a;
    });
    expect(body.length, greaterThanOrEqualTo(prefix));
    expect(body.sublist(0, prefix), bodies[firstId]!.sublist(0, prefix));

    Future<DiscoverByteServeStats> waitStats() async {
      for (var i = 0; i < 100; i++) {
        final s = cache.lastServeStats;
        if (s != null) return s;
        await Future<void>.delayed(const Duration(milliseconds: 10));
      }
      fail('lastServeStats stayed null');
      throw StateError('unreachable');
    }

    final stats = await waitStats();
    expect(stats.bytesFromDisk, greaterThanOrEqualTo(prefix));
    expect(stats.bytesFromNetwork, 0);

    final getsAfter = originGets[firstId] ?? const <int>[];
    final newStarts = getsAfter.skip(getsBefore.length).toList();
    // Background fill may Range-resume the tail, but must never re-request the
    // already-local prefix (no start < prefix, and no full GET rewriting 0..).
    expect(newStarts.where((s) => s >= 0 && s < prefix), isEmpty);

    // Extend past prefix — only tail from network.
    final mid = getsAfter.length;
    cache.lastServeStats = null;
    final req2 = await client.getUrl(source.uri!);
    req2.headers.set(HttpHeaders.rangeHeader, 'bytes=0-${prefix + 2047}');
    final resp2 = await req2.close();
    await resp2.drain<void>();
    final stats2 = await waitStats();
    expect(stats2.bytesFromDisk, greaterThanOrEqualTo(prefix));
    expect(stats2.bytesFromNetwork, greaterThan(0));
    final tailStarts = (originGets[firstId] ?? []).skip(mid).toList();
    expect(tailStarts.where((s) => s >= 0), isNotEmpty);
    expect(tailStarts.where((s) => s >= 0).every((s) => s >= prefix), isTrue);

    client.close(force: true);

    // Evidence totals for the package.
    // ignore: avoid_print
    print('LOGICAL_20_IDS localFirst=$localAfter20 others=${othersLocal.values.fold<int>(0, (a, b) => a + b)} '
        'prefix=$prefix bodySize=$bodySize');
  });

  test('stream local prefix before origin releases the held tail (bytes=0-)', () async {
    final root = Directory.systemTemp.createTempSync('mira_vid_firstbyte_');
    addTearDown(() {
      try {
        root.deleteSync(recursive: true);
      } catch (_) {}
    });

    HttpServer? origin;
    addTearDown(() async {
      await origin?.close(force: true);
    });
    origin = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final bytes = List<int>.generate(32 * 1024, (i) => (i * 7) % 256);
    const prefix = 8 * 1024;
    final tailGate = Completer<void>();
    final rangeStarts = <int>[];
    var fullGets = 0;
    origin.listen((req) async {
      if (req.method == 'HEAD') {
        req.response.contentLength = bytes.length;
        req.response.headers.set(HttpHeaders.acceptRangesHeader, 'bytes');
        await req.response.close();
        return;
      }
      final range = req.headers.value(HttpHeaders.rangeHeader);
      req.response.headers.contentType = ContentType('video', 'mp4');
      if (range != null && range.startsWith('bytes=')) {
        final start = int.parse(range.substring(6).split('-').first);
        rangeStarts.add(start);
        if (start >= prefix) {
          // Hold the missing tail until the client has already received local bytes.
          await tailGate.future;
        }
        req.response.statusCode = HttpStatus.partialContent;
        req.response.headers.set(
          HttpHeaders.contentRangeHeader,
          'bytes $start-${bytes.length - 1}/${bytes.length}',
        );
        req.response.add(bytes.sublist(start));
      } else {
        fullGets += 1;
        req.response.contentLength = bytes.length;
        req.response.add(bytes);
      }
      await req.response.close();
    });

    final mediaId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    final url = 'http://${origin.address.host}:${origin.port}/api/v1/marketplace/media/$mediaId';
    final cache = DiscoverVideoDiskCache(root: root, httpClient: HttpClient());
    addTearDown(() async {
      await cache.disposeProxy();
    });

    final seeded = await cache.ensureLocal(url, stopAfterBytes: prefix);
    expect(seeded.bytesOnDisk, greaterThanOrEqualTo(prefix));
    expect(seeded.complete, isFalse);

    final source = await cache.resolvePlaySource(url);
    expect(source.isProxy, isTrue);

    final client = HttpClient();
    final sw = Stopwatch()..start();
    final req = await client.getUrl(source.uri!);
    req.headers.set(HttpHeaders.rangeHeader, 'bytes=0-');
    final resp = await req.close();

    final firstByte = Completer<int>();
    final chunks = <int>[];
    var sawPrefix = false;
    final sub = resp.listen((chunk) {
      if (chunk.isEmpty) return;
      chunks.addAll(chunk);
      if (!firstByte.isCompleted) {
        firstByte.complete(sw.elapsedMilliseconds);
      }
      if (!sawPrefix && chunks.length >= prefix) {
        sawPrefix = true;
        // Decisive: saved prefix arrived while origin tail is still gated.
        expect(tailGate.isCompleted, isFalse);
        // ignore: avoid_print
        print('FIRST_BYTE_MS=${firstByte.isCompleted ? 'pending' : ''}');
      }
    });

    final firstByteMs = await firstByte.future.timeout(const Duration(seconds: 5));
    expect(firstByteMs, greaterThanOrEqualTo(0));
    expect(tailGate.isCompleted, isFalse);
    // Wait until at least the local prefix has been delivered.
    final prefixDeadline = DateTime.now().add(const Duration(seconds: 5));
    while (chunks.length < prefix && DateTime.now().isBefore(prefixDeadline)) {
      await Future<void>.delayed(const Duration(milliseconds: 10));
    }
    expect(chunks.length, greaterThanOrEqualTo(prefix));
    expect(chunks.sublist(0, prefix), bytes.sublist(0, prefix));
    expect(tailGate.isCompleted, isFalse);
    // ignore: avoid_print
    print('FIRST_BYTE_MS=$firstByteMs PREFIX_ARRIVED_BEFORE_TAIL_RELEASE=true');

    // Now release the origin tail and finish.
    tailGate.complete();
    await sub.asFuture<void>();
    final completeMs = sw.elapsedMilliseconds;
    expect(chunks, bytes);
    expect(rangeStarts.where((s) => s > 0 && s < prefix), isEmpty);
    // Resume must start at/after the saved prefix — never re-GET byte 0 as a full body for the tail.
    expect(rangeStarts.where((s) => s >= prefix), isNotEmpty);
    final stats = cache.lastServeStats!;
    expect(stats.bytesFromDisk, greaterThanOrEqualTo(prefix));
    expect(stats.firstByteMs, isNotNull);
    // ignore: avoid_print
    print('COMPLETE_MS=$completeMs STATS=${stats.toJson()} FULL_GETS=$fullGets RANGE_STARTS=$rangeStarts');

    client.close(force: true);
  });

  test('after 20 ids, open-ended Range still streams saved prefix before held tail', () async {
    final root = Directory.systemTemp.createTempSync('mira_vid_firstbyte20_');
    addTearDown(() {
      try {
        root.deleteSync(recursive: true);
      } catch (_) {}
    });
    HttpServer? origin;
    addTearDown(() async {
      await origin?.close(force: true);
    });
    origin = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    const bodySize = 24 * 1024;
    const prefix = 8 * 1024;
    final bodies = <String, List<int>>{};
    final originGets = <String, List<int>>{};
    final gates = <String, Completer<void>>{};
    origin.listen((req) async {
      final id = req.uri.pathSegments.isNotEmpty ? req.uri.pathSegments.last : '';
      bodies.putIfAbsent(id, () => List<int>.generate(bodySize, (i) => (i + id.hashCode) % 256));
      final bytes = bodies[id]!;
      if (req.method == 'HEAD') {
        req.response.contentLength = bytes.length;
        await req.response.close();
        return;
      }
      final range = req.headers.value(HttpHeaders.rangeHeader);
      originGets.putIfAbsent(id, () => <int>[]);
      if (range != null && range.startsWith('bytes=')) {
        final start = int.parse(range.substring(6).split('-').first);
        originGets[id]!.add(start);
        if (start >= prefix) {
          final g = gates.putIfAbsent(id, Completer<void>.new);
          await g.future;
        }
        req.response.statusCode = HttpStatus.partialContent;
        req.response.headers.set(
          HttpHeaders.contentRangeHeader,
          'bytes $start-${bytes.length - 1}/${bytes.length}',
        );
        req.response.add(bytes.sublist(start));
      } else {
        originGets[id]!.add(-1);
        req.response.contentLength = bytes.length;
        req.response.add(bytes);
      }
      await req.response.close();
    });

    final cache = DiscoverVideoDiskCache(root: root, httpClient: HttpClient(), maxEntries: 28);
    addTearDown(() async {
      await cache.disposeProxy();
    });

    String urlFor(int i) {
      final hex = i.toRadixString(16).padLeft(12, '0');
      return 'http://${origin!.address.host}:${origin.port}/api/v1/marketplace/media/dddddddd-dddd-dddd-dddd-$hex';
    }

    final firstUrl = urlFor(0);
    final firstId = DiscoverVideoDiskCache.mediaIdFromUrl(firstUrl)!;
    await cache.ensureLocal(firstUrl, stopAfterBytes: prefix);
    for (var i = 1; i <= 20; i++) {
      await cache.ensureLocal(urlFor(i), stopAfterBytes: prefix);
    }

    gates.putIfAbsent(firstId, Completer<void>.new);
    final source = await cache.resolvePlaySource(firstUrl);
    final client = HttpClient();
    final sw = Stopwatch()..start();
    final req = await client.getUrl(source.uri!);
    req.headers.set(HttpHeaders.rangeHeader, 'bytes=0-');
    final resp = await req.close();
    final chunks = <int>[];
    var firstByteMs = -1;
    final done = Completer<void>();
    resp.listen((c) {
      if (c.isEmpty) return;
      if (firstByteMs < 0) firstByteMs = sw.elapsedMilliseconds;
      chunks.addAll(c);
      if (chunks.length >= prefix && !gates[firstId]!.isCompleted) {
        // Prefix delivered while tail still held.
        expect(gates[firstId]!.isCompleted, isFalse);
      }
    }, onDone: done.complete, onError: done.completeError);

    final prefixDeadline = DateTime.now().add(const Duration(seconds: 5));
    while (chunks.length < prefix && DateTime.now().isBefore(prefixDeadline)) {
      await Future<void>.delayed(const Duration(milliseconds: 10));
    }
    expect(chunks.length, greaterThanOrEqualTo(prefix));
    expect(gates[firstId]!.isCompleted, isFalse);
    expect(firstByteMs, greaterThanOrEqualTo(0));
    // ignore: avoid_print
    print('AFTER20_FIRST_BYTE_MS=$firstByteMs');

    gates[firstId]!.complete();
    await done.future;
    final completeMs = sw.elapsedMilliseconds;
    expect(chunks, bodies[firstId]);
    final starts = originGets[firstId] ?? const <int>[];
    expect(starts.where((s) => s >= 0 && s < prefix), isEmpty);
    expect(starts.where((s) => s >= prefix), isNotEmpty);
    // ignore: avoid_print
    print('AFTER20_COMPLETE_MS=$completeMs RANGE_STARTS=$starts '
        'localFirst=${await cache.bytesOnDiskFor(firstUrl)}');

    client.close(force: true);
  });
}
