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
        req.response.headers.contentType = ContentType('video', 'mp4');
        req.response.contentLength = bytes.length;
        await req.response.close();
        return;
      }
      getCount += 1;
      await Future<void>.delayed(const Duration(milliseconds: 80));
      req.response.headers.contentType = ContentType('video', 'mp4');
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
        req.response.headers.contentType = ContentType('video', 'mp4');
        req.response.contentLength = bytes.length;
        await req.response.close();
        return;
      }
      req.response.headers.contentType = ContentType('video', 'mp4');
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
        req.response.headers.contentType = ContentType('video', 'mp4');
        req.response.contentLength = bytes.length;
        await req.response.close();
        return;
      }
      req.response.headers.contentType = ContentType('video', 'mp4');
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

  test('finalizePartIfComplete promotes full .part to complete file', () async {
    final root = Directory.systemTemp.createTempSync('mira_vid_cache_fin_');
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
    server.listen((req) async {
      if (req.method == 'HEAD') {
        req.response.headers.contentType = ContentType('video', 'mp4');
        req.response.contentLength = bytes.length;
        await req.response.close();
        return;
      }
      req.response.statusCode = HttpStatus.ok;
      req.response.contentLength = bytes.length;
      req.response.add(bytes);
      await req.response.close();
    });
    const mediaId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
    final base =
        'http://${server.address.host}:${server.port}/api/v1/marketplace/media/$mediaId';
    final part = File('${root.path}/$mediaId.part');
    await part.writeAsBytes(bytes);
    final cache = DiscoverVideoDiskCache(root: root, httpClient: HttpClient());
    final promoted = await cache.finalizePartIfComplete(base);
    expect(promoted, isNotNull);
    expect(await promoted!.exists(), isTrue);
    expect(await part.exists(), isFalse);
    expect(await cache.peekComplete(base), isNotNull);
  });

  test('contentRangeTotal reads TOTAL and rejects star/malformed', () {
    expect(
      DiscoverVideoDiskCache.contentRangeTotal('bytes 0-1048575/14537110'),
      14537110,
    );
    expect(DiscoverVideoDiskCache.contentRangeTotal('bytes 100-200/*'), isNull);
    expect(DiscoverVideoDiskCache.contentRangeTotal('bytes 0-10/0'), isNull);
    expect(DiscoverVideoDiskCache.contentRangeTotal(null), isNull);
  });

  test('206 prefix fill records Content-Range total and stays incomplete', () async {
    final root = Directory.systemTemp.createTempSync('mira_vid_cache_206_');
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
    final bytes = List<int>.generate(4 * 1024 * 1024, (i) => i % 256);
    server.listen((req) async {
      if (req.method == 'HEAD') {
        req.response.headers.contentType = ContentType('video', 'mp4');
        req.response.contentLength = bytes.length;
        await req.response.close();
        return;
      }
      final range = req.headers.value(HttpHeaders.rangeHeader)!;
      final start = int.parse(range.substring(6).split('-').first);
      final end = int.parse(range.substring(6).split('-').last);
      req.response.statusCode = HttpStatus.partialContent;
      req.response.headers.contentType = ContentType('video', 'mp4');
      req.response.headers.set(
        HttpHeaders.contentRangeHeader,
        'bytes $start-$end/${bytes.length}',
      );
      req.response.add(bytes.sublist(start, end + 1));
      await req.response.close();
    });
    final base =
        'http://${server.address.host}:${server.port}/api/v1/marketplace/media/cccccccc-cccc-cccc-cccc-cccccccccccc';
    final cache = DiscoverVideoDiskCache(root: root, httpClient: HttpClient());
    final have = await cache.ensurePlayablePrefix(base, needBytes: 1024 * 1024);
    expect(have, 1024 * 1024);
    expect(cache.lastPrefixStats?.contentLength, bytes.length);
    expect(cache.lastPrefixStats?.complete, isFalse);
    expect(await cache.peekComplete(base), isNull);
  });

  test('200 ignore-Range aborts body after prefix (networkBytesRead near need)', () async {
    final root = Directory.systemTemp.createTempSync('mira_vid_cache_200_');
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
    final bytes = List<int>.generate(8 * 1024 * 1024, (i) => i % 256);
    var serverBytesSent = 0;
    server.listen((req) async {
      if (req.method == 'HEAD') {
        req.response.headers.contentType = ContentType('video', 'mp4');
        req.response.contentLength = bytes.length;
        await req.response.close();
        return;
      }
      // Ignore Range — always 200 full body (chunked-ish writes).
      req.response.statusCode = HttpStatus.ok;
      req.response.headers.contentType = ContentType('video', 'mp4');
      req.response.contentLength = bytes.length;
      const chunk = 64 * 1024;
      for (var i = 0; i < bytes.length; i += chunk) {
        final end = (i + chunk).clamp(0, bytes.length);
        final piece = bytes.sublist(i, end);
        try {
          req.response.add(piece);
          serverBytesSent += piece.length;
          await req.response.flush();
        } catch (_) {
          break;
        }
        await Future<void>.delayed(const Duration(milliseconds: 1));
      }
      try {
        await req.response.close();
      } catch (_) {}
    });
    final base =
        'http://${server.address.host}:${server.port}/api/v1/marketplace/media/dddddddd-dddd-dddd-dddd-dddddddddddd';
    final cache = DiscoverVideoDiskCache(root: root, httpClient: HttpClient());
    const need = 1024 * 1024;
    final have = await cache.ensurePlayablePrefix(base, needBytes: need);
    expect(have, need);
    expect(cache.lastPrefixStats?.bytesOnDisk, need);
    expect(cache.lastPrefixStats?.complete, isFalse);
    expect(cache.lastPrefixStats?.contentLength, bytes.length);
    // Client must not keep reading the remaining ~7MiB.
    expect(cache.lastPrefixStats!.networkBytesRead, lessThan(need + 256 * 1024));
    expect(serverBytesSent, lessThan(bytes.length));
    expect(await cache.peekComplete(base), isNull);
  });

  test('lowPriority prefetch grows prefix only — never a full GET', () async {
    final root = Directory.systemTemp.createTempSync('mira_vid_cache_lp_');
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
    final bytes = List<int>.generate(4 * 1024 * 1024, (i) => i % 256);
    var fullGets = 0;
    var rangeGets = 0;
    server.listen((req) async {
      if (req.method == 'HEAD') {
        req.response.headers.contentType = ContentType('video', 'mp4');
        req.response.contentLength = bytes.length;
        await req.response.close();
        return;
      }
      final range = req.headers.value(HttpHeaders.rangeHeader);
      req.response.headers.contentType = ContentType('video', 'mp4');
      if (range != null && range.startsWith('bytes=')) {
        rangeGets += 1;
        final start = int.parse(range.substring(6).split('-').first);
        final end = (start + (768 * 1024) - 1).clamp(0, bytes.length - 1);
        req.response.statusCode = HttpStatus.partialContent;
        req.response.headers.set(
          HttpHeaders.contentRangeHeader,
          'bytes $start-$end/${bytes.length}',
        );
        req.response.add(bytes.sublist(start, end + 1));
      } else {
        fullGets += 1;
        req.response.contentLength = bytes.length;
        req.response.add(bytes);
      }
      await req.response.close();
    });

    final base =
        'http://${server.address.host}:${server.port}/api/v1/marketplace/media/bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee';
    final cache = DiscoverVideoDiskCache(root: root, httpClient: HttpClient());
    cache.prioritize(
      'http://${server.address.host}:${server.port}/api/v1/marketplace/media/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    );
    cache.prefetch(base, lowPriority: true);
    // Prefix fill is async — wait until some bytes land.
    final deadline = DateTime.now().add(const Duration(seconds: 5));
    var have = 0;
    while (DateTime.now().isBefore(deadline)) {
      have = await cache.bytesOnDiskFor(base);
      if (have >= 512 * 1024) break;
      await Future<void>.delayed(const Duration(milliseconds: 20));
    }
    expect(have, greaterThanOrEqualTo(512 * 1024));
    expect(have, lessThan(bytes.length), reason: 'must not download the full 4MiB');
    expect(fullGets, 0, reason: 'neighbor must not open a full GET');
    expect(rangeGets, greaterThan(0));
    final complete = await cache.peekComplete(base);
    expect(complete, isNull);
  });

  test('resolvePlaySource returns while full download holds write lock (no deadlock)', () async {
    final root = Directory.systemTemp.createTempSync('mira_vid_lock_play_');
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
    final bytes = List<int>.generate(256 * 1024, (i) => i % 256);
    final releaseBody = Completer<void>();
    server.listen((req) async {
      if (req.method == 'HEAD') {
        req.response.headers.contentType = ContentType('video', 'mp4');
        req.response.contentLength = bytes.length;
        await req.response.close();
        return;
      }
      req.response.headers.contentType = ContentType('video', 'mp4');
      req.response.contentLength = bytes.length;
      req.response.add(bytes.sublist(0, 32 * 1024));
      await req.response.flush();
      await releaseBody.future;
      req.response.add(bytes.sublist(32 * 1024));
      await req.response.close();
    });

    const mediaId = 'f1111111-1111-1111-1111-111111111111';
    final url =
        'http://${server.address.host}:${server.port}/api/v1/marketplace/media/$mediaId';
    final cache = DiscoverVideoDiskCache(root: root, httpClient: HttpClient());
    addTearDown(() async {
      await cache.disposeProxy();
    });

    // Seed a playable prefix on disk first.
    final part = File('${root.path}/$mediaId.part');
    await part.writeAsBytes(bytes.sublist(0, 48 * 1024));

    // Start a full download that stalls mid-body while holding the write lock.
    final download = cache.ensureLocal(url);
    await Future<void>.delayed(const Duration(milliseconds: 80));

    final sw = Stopwatch()..start();
    final source = await cache.resolvePlaySource(url).timeout(const Duration(seconds: 2));
    expect(sw.elapsedMilliseconds, lessThan(1500), reason: 'must not wait for full download');
    expect(source.isProxy || source.isFile, isTrue);
    expect(await cache.bytesOnDiskFor(url), greaterThanOrEqualTo(32 * 1024));

    releaseBody.complete();
    await download;
  });

  test('ensurePlayablePrefix during inflight download does not deadlock', () async {
    final root = Directory.systemTemp.createTempSync('mira_vid_lock_prefix_');
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
    final bytes = List<int>.generate(128 * 1024, (i) => (i * 7) % 256);
    final releaseBody = Completer<void>();
    server.listen((req) async {
      if (req.method == 'HEAD') {
        req.response.headers.contentType = ContentType('video', 'mp4');
        req.response.contentLength = bytes.length;
        await req.response.close();
        return;
      }
      final range = req.headers.value(HttpHeaders.rangeHeader);
      req.response.headers.contentType = ContentType('video', 'mp4');
      if (range != null) {
        // Prefix fill path — serve quickly.
        final start = int.parse(range.substring(6).split('-').first);
        req.response.statusCode = HttpStatus.partialContent;
        req.response.headers.set(
          HttpHeaders.contentRangeHeader,
          'bytes $start-${bytes.length - 1}/${bytes.length}',
        );
        req.response.add(bytes.sublist(start));
        await req.response.close();
        return;
      }
      req.response.contentLength = bytes.length;
      req.response.add(bytes.sublist(0, 16 * 1024));
      await req.response.flush();
      await releaseBody.future;
      req.response.add(bytes.sublist(16 * 1024));
      await req.response.close();
    });

    const mediaId = 'f2222222-2222-2222-2222-222222222222';
    final url =
        'http://${server.address.host}:${server.port}/api/v1/marketplace/media/$mediaId';
    final cache = DiscoverVideoDiskCache(root: root, httpClient: HttpClient());
    // Seed a flushed prefix so readers see bytes while the full GET is stalled.
    final part = File('${root.path}/$mediaId.part');
    await part.writeAsBytes(bytes.sublist(0, 24 * 1024));

    final download = cache.ensureLocal(url);
    await Future<void>.delayed(const Duration(milliseconds: 50));
    final have = await cache
        .ensurePlayablePrefix(url, needBytes: 8 * 1024)
        .timeout(const Duration(seconds: 3));
    expect(have, greaterThanOrEqualTo(8 * 1024));

    releaseBody.complete();
    await download;
  });

  test('complete files of 256KiB/512KiB/1MiB are trusted and reused without new GET', () async {
    for (final size in [256 * 1024, 512 * 1024, 1024 * 1024]) {
      final root = Directory.systemTemp.createTempSync('mira_vid_small_$size');
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
      // Minimal ftyp+moov so legacy sniff would also pass.
      final bytes = List<int>.filled(size, 0);
      bytes.setRange(4, 8, 'ftyp'.codeUnits);
      bytes.setRange(24, 28, 'moov'.codeUnits);
      for (var i = 32; i < size; i++) {
        bytes[i] = i % 256;
      }
      var getCount = 0;
      server.listen((req) async {
        if (req.method == 'HEAD') {
          req.response.headers.contentType = ContentType('video', 'mp4');
          req.response.contentLength = bytes.length;
          await req.response.close();
          return;
        }
        getCount += 1;
        req.response.headers.contentType = ContentType('video', 'mp4');
        req.response.contentLength = bytes.length;
        req.response.add(bytes);
        await req.response.close();
      });
      final id =
          'f3333333-3333-3333-3333-${size.toRadixString(16).padLeft(12, '0')}';
      final url =
          'http://${server.address.host}:${server.port}/api/v1/marketplace/media/$id';
      final cache = DiscoverVideoDiskCache(root: root, httpClient: HttpClient());
      final first = await cache.ensureLocal(url);
      expect(first.complete, isTrue, reason: 'size=$size');
      expect(first.bytesOnDisk, size);
      expect(await cache.peekComplete(url), isNotNull);

      final before = getCount;
      final second = await cache.ensureLocal('$url?sig=rot');
      expect(second.fromDisk, isTrue);
      expect(second.bytesDownloaded, 0);
      expect(getCount, before);

      final source = await cache.resolvePlaySource(url);
      expect(source.isFile, isTrue);
      expect(source.bytesOnDisk, size);
    }
  });

  test('truncated prefix named as complete is rejected without trusted total', () async {
    final root = Directory.systemTemp.createTempSync('mira_vid_fake_complete_');
    addTearDown(() {
      try {
        root.deleteSync(recursive: true);
      } catch (_) {}
    });
    const mediaId = 'f4444444-4444-4444-4444-444444444444';
    // Fake "complete" at classic prefix ceiling — random bytes, no moov.
    final fake = File('${root.path}/${mediaId}_1048576.mp4');
    await fake.writeAsBytes(List<int>.filled(1024 * 1024, 9));
    final cache = DiscoverVideoDiskCache(root: root, httpClient: HttpClient());
    final url = 'http://127.0.0.1/api/v1/marketplace/media/$mediaId';
    expect(await cache.peekComplete(url), isNull);
  });

  test('truncated MP4 with early ftyp+moov is not treated as complete', () async {
    final root = Directory.systemTemp.createTempSync('mira_vid_cut_mp4_');
    addTearDown(() {
      try {
        root.deleteSync(recursive: true);
      } catch (_) {}
    });
    const mediaId = 'f5555555-5555-5555-5555-555555555555';
    // Real-shaped prefix: ftyp + moov early (fast-start), but file is cut short of
    // the name's claimed total — sniff alone must not promote to complete.
    final claimed = 2 * 1024 * 1024;
    final cut = List<int>.filled(96 * 1024, 0);
    cut.setRange(4, 8, 'ftyp'.codeUnits);
    cut.setRange(24, 28, 'moov'.codeUnits);
    for (var i = 32; i < cut.length; i++) {
      cut[i] = i % 256;
    }
    // Name claims full size; body is truncated (size != claimed → rejected).
    final mismatched = File('${root.path}/${mediaId}_$claimed.mp4');
    await mismatched.writeAsBytes(cut);
    final cache = DiscoverVideoDiskCache(root: root, httpClient: HttpClient());
    final url = 'http://127.0.0.1/api/v1/marketplace/media/$mediaId';
    expect(await cache.peekComplete(url), isNull);

    // Same bytes named with matching length still untrusted without HEAD/GET total.
    final matchingName = File('${root.path}/${mediaId}_${cut.length}.mp4');
    await matchingName.writeAsBytes(cut);
    try {
      await mismatched.delete();
    } catch (_) {}
    expect(await cache.peekComplete(url), isNull);
  });

  test('write lock serializes writers; peekComplete reads without waiting', () async {
    final root = Directory.systemTemp.createTempSync('mira_vid_lock_');
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
    final releaseBody = Completer<void>();
    final bytes = List<int>.generate(128 * 1024, (i) => i % 256);
    var concurrentWriters = 0;
    var maxConcurrent = 0;
    server.listen((req) async {
      if (req.method == 'HEAD') {
        req.response.headers.contentType = ContentType('video', 'mp4');
        req.response.contentLength = bytes.length;
        await req.response.close();
        return;
      }
      concurrentWriters += 1;
      if (concurrentWriters > maxConcurrent) maxConcurrent = concurrentWriters;
      req.response.headers.contentType = ContentType('video', 'mp4');
      req.response.contentLength = bytes.length;
      req.response.add(bytes.sublist(0, 16 * 1024));
      await req.response.flush();
      await releaseBody.future;
      concurrentWriters -= 1;
      req.response.add(bytes.sublist(16 * 1024));
      await req.response.close();
    });

    const mediaId = 'f6666666-6666-6666-6666-666666666666';
    final url =
        'http://${server.address.host}:${server.port}/api/v1/marketplace/media/$mediaId';
    final cache = DiscoverVideoDiskCache(root: root, httpClient: HttpClient());
    addTearDown(() async {
      await cache.disposeProxy();
    });

    final first = cache.ensureLocal(url);
    await Future<void>.delayed(const Duration(milliseconds: 40));
    expect(cache.debugHasWriteLock(mediaId), isTrue);

    // Peek must not block on the writer.
    final peek = await cache
        .peekComplete(url)
        .timeout(const Duration(milliseconds: 200));
    expect(peek, isNull);

    // Second writer queues; origin must not see overlapping bodies for same id.
    final second = cache.ensureLocal(url);
    await Future<void>.delayed(const Duration(milliseconds: 40));
    expect(maxConcurrent, 1);

    final have = await cache.bytesOnDiskFor(url);
    expect(have, greaterThan(0));

    releaseBody.complete();
    await Future.wait([first, second]);
    expect(maxConcurrent, 1);
    expect(await cache.peekComplete(url), isNotNull);
  });

  test('one failed origin GET does not close shared client for other media', () async {
    final root = Directory.systemTemp.createTempSync('mira_vid_http_iso_');
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
    final okBytes = List<int>.generate(48 * 1024, (i) => i % 256);
    server.listen((req) async {
      final id = req.uri.pathSegments.isNotEmpty ? req.uri.pathSegments.last : '';
      if (id.startsWith('dead')) {
        await req.response.detachSocket().then((s) => s.destroy());
        return;
      }
      if (req.method == 'HEAD') {
        req.response.headers.contentType = ContentType('video', 'mp4');
        req.response.contentLength = okBytes.length;
        await req.response.close();
        return;
      }
      req.response.headers.contentType = ContentType('video', 'mp4');
      req.response.contentLength = okBytes.length;
      req.response.add(okBytes);
      await req.response.close();
    });

    const badId = 'deaddead-dead-dead-dead-deaddeaddead';
    const goodId = 'f7777777-7777-7777-7777-777777777777';
    String urlFor(String id) =>
        'http://${server!.address.host}:${server.port}/api/v1/marketplace/media/$id';
    final cache = DiscoverVideoDiskCache(root: root, httpClient: HttpClient());
    addTearDown(() async {
      await cache.disposeProxy();
    });

    try {
      await cache.ensureLocal(urlFor(badId));
    } catch (_) {}

    final good = await cache.ensureLocal(urlFor(goodId));
    expect(good.complete, isTrue);
    expect(good.bytesOnDisk, okBytes.length);
  });

  test('neighbor proxy open does not steal priority from visible clip', () async {
    final root = Directory.systemTemp.createTempSync('mira_vid_prio_');
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
    final bodies = <String, List<int>>{};
    final fullGets = <String, int>{};
    server.listen((req) async {
      final id = req.uri.pathSegments.isNotEmpty ? req.uri.pathSegments.last : '';
      bodies.putIfAbsent(id, () => List<int>.generate(2 * 1024 * 1024, (i) => (i + id.hashCode) % 256));
      final bytes = bodies[id]!;
      if (req.method == 'HEAD') {
        req.response.headers.contentType = ContentType('video', 'mp4');
        req.response.contentLength = bytes.length;
        await req.response.close();
        return;
      }
      req.response.headers.contentType = ContentType('video', 'mp4');
      final range = req.headers.value(HttpHeaders.rangeHeader);
      if (range == null) {
        fullGets[id] = (fullGets[id] ?? 0) + 1;
        req.response.contentLength = bytes.length;
        req.response.add(bytes);
      } else {
        final start = int.parse(range.substring(6).split('-').first);
        final end = (start + 256 * 1024 - 1).clamp(0, bytes.length - 1);
        req.response.statusCode = HttpStatus.partialContent;
        req.response.headers.set(
          HttpHeaders.contentRangeHeader,
          'bytes $start-$end/${bytes.length}',
        );
        req.response.add(bytes.sublist(start, end + 1));
      }
      await req.response.close();
    });

    String urlFor(String id) =>
        'http://${server!.address.host}:${server.port}/api/v1/marketplace/media/$id';
    const visible = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const neighbor = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    final cache = DiscoverVideoDiskCache(root: root, httpClient: HttpClient());
    addTearDown(() async {
      await cache.disposeProxy();
    });

    cache.prioritize(urlFor(visible));
    // Neighbor resolve without claimPriority — must stay prefix-only.
    final neighborSource = await cache.resolvePlaySource(urlFor(neighbor), claimPriority: false);
    expect(neighborSource.isProxy, isTrue);
    cache.prefetch(urlFor(neighbor), lowPriority: true);

    final deadline = DateTime.now().add(const Duration(seconds: 4));
    while (DateTime.now().isBefore(deadline)) {
      if ((await cache.bytesOnDiskFor(urlFor(neighbor))) >= 200 * 1024) break;
      await Future<void>.delayed(const Duration(milliseconds: 20));
    }
    expect(fullGets[neighbor] ?? 0, 0, reason: 'neighbor must not full-GET');
    expect(await cache.bytesOnDiskFor(urlFor(neighbor)), lessThan(2 * 1024 * 1024));

    // Visible may full-fill.
    cache.prefetch(urlFor(visible));
    final visDeadline = DateTime.now().add(const Duration(seconds: 5));
    while (DateTime.now().isBefore(visDeadline)) {
      if (await cache.peekComplete(urlFor(visible)) != null) break;
      await Future<void>.delayed(const Duration(milliseconds: 30));
    }
    expect(await cache.peekComplete(urlFor(visible)), isNotNull);
    expect(fullGets[visible] ?? 0, greaterThan(0));
  });

  test('proxy serves claimed priority bytes; neighbor stays prefix-only under load', () async {
    final root = Directory.systemTemp.createTempSync('mira_vid_proxy_bytes_');
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
    final bodies = <String, List<int>>{};
    final fullGets = <String, int>{};
    server.listen((req) async {
      final id = req.uri.pathSegments.isNotEmpty ? req.uri.pathSegments.last : '';
      bodies.putIfAbsent(
        id,
        () => List<int>.generate(512 * 1024, (i) => (i + id.hashCode) % 256),
      );
      final bytes = bodies[id]!;
      if (req.method == 'HEAD') {
        req.response.headers.contentType = ContentType('video', 'mp4');
        req.response.contentLength = bytes.length;
        await req.response.close();
        return;
      }
      req.response.headers.contentType = ContentType('video', 'mp4');
      final range = req.headers.value(HttpHeaders.rangeHeader);
      if (range == null) {
        fullGets[id] = (fullGets[id] ?? 0) + 1;
        req.response.contentLength = bytes.length;
        req.response.add(bytes);
      } else {
        final start = int.parse(range.substring(6).split('-').first);
        final end = (start + 64 * 1024 - 1).clamp(0, bytes.length - 1);
        req.response.statusCode = HttpStatus.partialContent;
        req.response.headers.set(
          HttpHeaders.contentRangeHeader,
          'bytes $start-$end/${bytes.length}',
        );
        req.response.add(bytes.sublist(start, end + 1));
      }
      await req.response.close();
    });

    String urlFor(String id) =>
        'http://${server!.address.host}:${server.port}/api/v1/marketplace/media/$id';
    const visible = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    const neighbor = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
    final cache = DiscoverVideoDiskCache(root: root, httpClient: HttpClient());
    addTearDown(() async {
      await cache.disposeProxy();
    });

    cache.prioritize(urlFor(visible));
    final visibleSource =
        await cache.resolvePlaySource(urlFor(visible), claimPriority: true);
    expect(visibleSource.isProxy, isTrue);
    expect(visibleSource.uri, isNotNull);

    final neighborSource =
        await cache.resolvePlaySource(urlFor(neighbor), claimPriority: false);
    expect(neighborSource.isProxy, isTrue);

    final client = HttpClient();
    addTearDown(() => client.close(force: true));

    // Real proxy GET for the visible clip — bytes must match origin body.
    const want = 48 * 1024;
    final vReq = await client.getUrl(visibleSource.uri!);
    vReq.headers.set(HttpHeaders.rangeHeader, 'bytes=0-${want - 1}');
    final vResp = await vReq.close();
    final vBytes = await vResp.fold<List<int>>(<int>[], (a, b) {
      a.addAll(b);
      return a;
    });
    expect(vResp.statusCode, anyOf(HttpStatus.ok, HttpStatus.partialContent));
    expect(vBytes.length, want);
    expect(vBytes, bodies[visible]!.sublist(0, want));

    // Neighbor proxy may serve a small prefix only — must not full-GET.
    cache.prefetch(urlFor(neighbor), lowPriority: true);
    final nReq = await client.getUrl(neighborSource.uri!);
    nReq.headers.set(HttpHeaders.rangeHeader, 'bytes=0-${16 * 1024 - 1}');
    final nResp = await nReq.close();
    final nBytes = await nResp.fold<List<int>>(<int>[], (a, b) {
      a.addAll(b);
      return a;
    });
    expect(nBytes.length, 16 * 1024);
    expect(nBytes, bodies[neighbor]!.sublist(0, 16 * 1024));
    expect(fullGets[neighbor] ?? 0, 0, reason: 'neighbor must not full-GET');
  });

  test('trusted complete reopens from disk after new cache instance with origin down', () async {
    final root = Directory.systemTemp.createTempSync('mira_vid_persist_');
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
    final bytes = List<int>.generate(96 * 1024, (i) => i % 256);
    var gets = 0;
    server.listen((req) async {
      if (req.method == 'HEAD') {
        req.response.headers.contentType = ContentType('video', 'mp4');
        req.response.contentLength = bytes.length;
        await req.response.close();
        return;
      }
      gets += 1;
      req.response.headers.contentType = ContentType('video', 'mp4');
      req.response.contentLength = bytes.length;
      req.response.add(bytes);
      await req.response.close();
    });

    const mediaId = 'f8888888-8888-8888-8888-888888888888';
    final url =
        'http://${server.address.host}:${server.port}/api/v1/marketplace/media/$mediaId';
    final cache1 = DiscoverVideoDiskCache(root: root, httpClient: HttpClient());
    final first = await cache1.ensureLocal(url);
    expect(first.complete, isTrue);
    expect(await cache1.peekComplete(url), isNotNull);
    expect(File('${root.path}/${mediaId}_${bytes.length}.mp4.mira_complete').existsSync(), isTrue);
    await cache1.disposeProxy();

    await server.close(force: true);
    server = null;

    final dead = HttpClient();
    addTearDown(() => dead.close(force: true));
    final cache2 = DiscoverVideoDiskCache(root: root, httpClient: dead);
    addTearDown(() async {
      await cache2.disposeProxy();
    });
    final beforeGets = gets;
    final peek = await cache2.peekComplete(url);
    expect(peek, isNotNull);
    expect(await peek!.length(), bytes.length);

    final again = await cache2.ensureLocal(url);
    expect(again.complete, isTrue);
    expect(again.fromDisk, isTrue);
    expect(again.bytesDownloaded, 0);
    expect(gets, beforeGets, reason: 'no network after restart');

    final source = await cache2.resolvePlaySource(url);
    expect(source.isFile, isTrue);
  });

  test('HEAD 404/HTML length is not recorded as video total', () async {
    final root = Directory.systemTemp.createTempSync('mira_vid_head_bad_');
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
    final ok = List<int>.generate(40 * 1024, (i) => i % 256);
    server.listen((req) async {
      if (req.method == 'HEAD') {
        req.response.statusCode = HttpStatus.notFound;
        req.response.headers.contentType = ContentType.html;
        const err = '<html>missing</html>';
        req.response.contentLength = err.length;
        await req.response.close();
        return;
      }
      // GET succeeds with Content-Range total — fallback path.
      req.response.statusCode = HttpStatus.partialContent;
      req.response.headers.contentType = ContentType('video', 'mp4');
      req.response.headers.set(
        HttpHeaders.contentRangeHeader,
        'bytes 0-${ok.length - 1}/${ok.length}',
      );
      req.response.add(ok);
      await req.response.close();
    });

    const mediaId = 'f9999999-9999-9999-9999-999999999999';
    final url =
        'http://${server.address.host}:${server.port}/api/v1/marketplace/media/$mediaId';
    final cache = DiscoverVideoDiskCache(root: root, httpClient: HttpClient());
    addTearDown(() async {
      await cache.disposeProxy();
    });
    final row = await cache.ensureLocal(url);
    expect(row.complete, isTrue);
    expect(row.contentLength, ok.length);
    expect(row.contentLength, isNot(11), reason: 'must not trust HTML HEAD length');
  });

  test('untrusted named complete is never used by peek/prefix/proxy paths', () async {
    final root = Directory.systemTemp.createTempSync('mira_vid_unify_');
    addTearDown(() {
      try {
        root.deleteSync(recursive: true);
      } catch (_) {}
    });
    const mediaId = 'faaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
    final claimed = 64 * 1024;
    final fake = File('${root.path}/${mediaId}_$claimed.mp4');
    await fake.writeAsBytes(List<int>.generate(claimed, (i) => 7));
    // No .mira_complete marker.
    final cache = DiscoverVideoDiskCache(root: root, httpClient: HttpClient());
    addTearDown(() async {
      await cache.disposeProxy();
    });
    final url = 'http://127.0.0.1/api/v1/marketplace/media/$mediaId';
    expect(await cache.peekComplete(url), isNull);

    // Prefix path must not treat fake as complete (would skip .part growth).
    HttpServer? server;
    addTearDown(() async {
      await server?.close(force: true);
    });
    server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final real = List<int>.generate(claimed, (i) => i % 256);
    server.listen((req) async {
      if (req.method == 'HEAD') {
        req.response.headers.contentType = ContentType('video', 'mp4');
        req.response.contentLength = real.length;
        await req.response.close();
        return;
      }
      req.response.headers.contentType = ContentType('video', 'mp4');
      req.response.contentLength = real.length;
      req.response.add(real);
      await req.response.close();
    });
    final live =
        'http://${server.address.host}:${server.port}/api/v1/marketplace/media/$mediaId';
    final got = await cache.ensureLocal(live);
    expect(got.complete, isTrue);
    expect(await File('${root.path}/${mediaId}_$claimed.mp4.mira_complete').exists(), isTrue);
  });

  test('two stopAfterBytes ensureLocal calls serialize writers (not just inflight)', () async {
    final root = Directory.systemTemp.createTempSync('mira_vid_two_writers_');
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
    final release = Completer<void>();
    final bytes = List<int>.generate(256 * 1024, (i) => i % 256);
    var concurrent = 0;
    var maxConcurrent = 0;
    server.listen((req) async {
      if (req.method == 'HEAD') {
        req.response.headers.contentType = ContentType('video', 'mp4');
        req.response.contentLength = bytes.length;
        await req.response.close();
        return;
      }
      concurrent += 1;
      if (concurrent > maxConcurrent) maxConcurrent = concurrent;
      req.response.headers.contentType = ContentType('video', 'mp4');
      req.response.contentLength = bytes.length;
      req.response.add(bytes.sublist(0, 16 * 1024));
      await req.response.flush();
      await release.future;
      concurrent -= 1;
      try {
        req.response.add(bytes.sublist(16 * 1024));
        await req.response.close();
      } catch (_) {}
    });

    const mediaId = 'fbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    final url =
        'http://${server.address.host}:${server.port}/api/v1/marketplace/media/$mediaId';
    final cache = DiscoverVideoDiskCache(root: root, httpClient: HttpClient());
    addTearDown(() async {
      await cache.disposeProxy();
    });

    // stopAfterBytes bypasses _inflight join — both enter _withWriteLock.
    final a = cache.ensureLocal(url, stopAfterBytes: 16 * 1024);
    final b = cache.ensureLocal(url, stopAfterBytes: 16 * 1024);
    await Future<void>.delayed(const Duration(milliseconds: 60));
    expect(cache.debugHasWriteLock(mediaId), isTrue);
    expect(maxConcurrent, 1, reason: 'write lock must serialize independent writers');
    release.complete();
    await Future.wait([a, b]);
    expect(maxConcurrent, 1);
  });

  test('prefix holding lock + ensureLocal inflight: join-under-lock stalls ~12s (bug repro)', () async {
    final root = Directory.systemTemp.createTempSync('mira_vid_deadlock_repro_');
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
    final bytes = List<int>.generate(128 * 1024, (i) => i % 256);
    final events = <String>[];
    server.listen((req) async {
      if (req.method == 'HEAD') {
        req.response.headers.contentType = ContentType('video', 'mp4');
        req.response.contentLength = bytes.length;
        await req.response.close();
        return;
      }
      events.add('GET ${req.headers.value(HttpHeaders.rangeHeader)}');
      req.response.headers.contentType = ContentType('video', 'mp4');
      final range = req.headers.value(HttpHeaders.rangeHeader);
      if (range != null && range.startsWith('bytes=')) {
        final spec = range.substring(6);
        final parts = spec.split('-');
        final start = int.tryParse(parts[0]) ?? 0;
        final end = (parts.length > 1 && parts[1].isNotEmpty)
            ? (int.tryParse(parts[1]) ?? (bytes.length - 1))
            : (bytes.length - 1);
        final lo = start.clamp(0, bytes.length - 1);
        final hi = end.clamp(lo, bytes.length - 1);
        req.response.statusCode = HttpStatus.partialContent;
        req.response.headers.set(
          HttpHeaders.contentRangeHeader,
          'bytes $lo-$hi/${bytes.length}',
        );
        req.response.add(bytes.sublist(lo, hi + 1));
      } else {
        req.response.contentLength = bytes.length;
        req.response.add(bytes);
      }
      await req.response.close();
    });

    const id = 'fdead10c-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    final url =
        'http://${server.address.host}:${server.port}/api/v1/marketplace/media/$id';
    final cache = DiscoverVideoDiskCache(root: root, httpClient: HttpClient());
    addTearDown(() async {
      await cache.disposeProxy();
    });

    // Restore the buggy join path for this repro only.
    cache.debugJoinInflightUnderLock = true;
    final prefixInLock = Completer<void>();
    final allowPrefixPastJoin = Completer<void>();
    cache.debugYieldBeforeInflightJoin = () async {
      events.add('prefix_under_lock');
      if (!prefixInLock.isCompleted) prefixInLock.complete();
      await allowPrefixPastJoin.future;
      events.add('prefix_past_yield inflight=${cache.debugHasInflight(id)}');
    };

    final sw = Stopwatch()..start();
    final prefixJob = cache.ensurePlayablePrefix(url, needBytes: 8 * 1024);
    await prefixInLock.future.timeout(const Duration(seconds: 3));
    expect(cache.debugHasWriteLock(id), isTrue);

    final localJob = cache.ensureLocal(url);
    // ensureLocal registers _inflight then waits on the write lock.
    final registered = DateTime.now().add(const Duration(seconds: 2));
    while (DateTime.now().isBefore(registered)) {
      if (cache.debugHasInflight(id)) break;
      await Future<void>.delayed(const Duration(milliseconds: 5));
    }
    expect(cache.debugHasInflight(id), isTrue, reason: 'ensureLocal must register before join');
    events.add('ensureLocal_inflight_waiting_lock');

    allowPrefixPastJoin.complete();
    final prefixBytes = await prefixJob.timeout(
      const Duration(seconds: 15),
      onTimeout: () => -1,
    );
    sw.stop();
    events.add('prefix_done bytes=$prefixBytes ms=${sw.elapsedMilliseconds}');

    // Bug: prefix waits on inflight that cannot run → ~12s stall.
    expect(
      sw.elapsedMilliseconds,
      greaterThan(10000),
      reason: 'bug repro must stall near the 12s join deadline; events=$events',
    );
    await localJob.timeout(const Duration(seconds: 5));
  });

  test('prefix holding lock + ensureLocal inflight: Range fill without join (fixed)', () async {
    final root = Directory.systemTemp.createTempSync('mira_vid_deadlock_fix_');
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
    final bytes = List<int>.generate(128 * 1024, (i) => i % 256);
    final events = <String>[];
    var rangeGets = 0;
    var fullGets = 0;
    server.listen((req) async {
      if (req.method == 'HEAD') {
        req.response.headers.contentType = ContentType('video', 'mp4');
        req.response.contentLength = bytes.length;
        await req.response.close();
        return;
      }
      final range = req.headers.value(HttpHeaders.rangeHeader);
      if (range != null && range.startsWith('bytes=')) {
        rangeGets += 1;
        events.add('RANGE $range');
        final spec = range.substring(6);
        final parts = spec.split('-');
        final start = int.tryParse(parts[0]) ?? 0;
        final end = (parts.length > 1 && parts[1].isNotEmpty)
            ? (int.tryParse(parts[1]) ?? (bytes.length - 1))
            : (bytes.length - 1);
        final lo = start.clamp(0, bytes.length - 1);
        final hi = end.clamp(lo, bytes.length - 1);
        req.response.statusCode = HttpStatus.partialContent;
        req.response.headers.contentType = ContentType('video', 'mp4');
        req.response.headers.set(
          HttpHeaders.contentRangeHeader,
          'bytes $lo-$hi/${bytes.length}',
        );
        req.response.add(bytes.sublist(lo, hi + 1));
      } else {
        fullGets += 1;
        events.add('FULL');
        req.response.headers.contentType = ContentType('video', 'mp4');
        req.response.contentLength = bytes.length;
        req.response.add(bytes);
      }
      await req.response.close();
    });

    const id = 'ffixed10c-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    final url =
        'http://${server.address.host}:${server.port}/api/v1/marketplace/media/$id';
    final cache = DiscoverVideoDiskCache(root: root, httpClient: HttpClient());
    addTearDown(() async {
      await cache.disposeProxy();
    });
    cache.debugJoinInflightUnderLock = false; // fixed path

    final prefixInLock = Completer<void>();
    final allowPrefixContinue = Completer<void>();
    cache.debugYieldBeforeInflightJoin = () async {
      events.add('prefix_under_lock');
      if (!prefixInLock.isCompleted) prefixInLock.complete();
      await allowPrefixContinue.future;
      events.add('prefix_past_yield inflight=${cache.debugHasInflight(id)}');
    };

    final sw = Stopwatch()..start();
    final prefixJob = cache.ensurePlayablePrefix(url, needBytes: 8 * 1024);
    await prefixInLock.future.timeout(const Duration(seconds: 3));

    final localJob = cache.ensureLocal(url);
    final registered = DateTime.now().add(const Duration(seconds: 2));
    while (DateTime.now().isBefore(registered)) {
      if (cache.debugHasInflight(id)) break;
      await Future<void>.delayed(const Duration(milliseconds: 5));
    }
    expect(cache.debugHasInflight(id), isTrue);
    events.add('ensureLocal_inflight_waiting_lock');
    allowPrefixContinue.complete();

    final prefixBytes = await prefixJob.timeout(const Duration(seconds: 3));
    sw.stop();
    expect(prefixBytes, greaterThanOrEqualTo(8 * 1024));
    expect(
      sw.elapsedMilliseconds,
      lessThan(3000),
      reason: 'must not hit 12s join; events=$events ms=${sw.elapsedMilliseconds}',
    );
    expect(rangeGets, greaterThan(0), reason: 'prefix grows via Range under lock');

    final local = await localJob.timeout(const Duration(seconds: 5));
    expect(local.complete, isTrue);
    expect(fullGets + rangeGets, greaterThan(0));
    events.add('done prefixMs=${sw.elapsedMilliseconds}');
  });

  test('ensureLocal first then ensurePlayablePrefix waits outside lock (reverse order)', () async {
    final root = Directory.systemTemp.createTempSync('mira_vid_rev_order_');
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
    final releaseBody = Completer<void>();
    final bytes = List<int>.generate(96 * 1024, (i) => i % 256);
    server.listen((req) async {
      if (req.method == 'HEAD') {
        req.response.headers.contentType = ContentType('video', 'mp4');
        req.response.contentLength = bytes.length;
        await req.response.close();
        return;
      }
      req.response.headers.contentType = ContentType('video', 'mp4');
      req.response.contentLength = bytes.length;
      req.response.add(bytes.sublist(0, 24 * 1024));
      await req.response.flush();
      await releaseBody.future;
      req.response.add(bytes.sublist(24 * 1024));
      await req.response.close();
    });

    const id = 'freverse1-cccc-cccc-cccc-cccccccccccc';
    final url =
        'http://${server.address.host}:${server.port}/api/v1/marketplace/media/$id';
    final cache = DiscoverVideoDiskCache(root: root, httpClient: HttpClient());
    addTearDown(() async {
      await cache.disposeProxy();
    });

    final full = cache.ensureLocal(url);
    await Future<void>.delayed(const Duration(milliseconds: 40));
    expect(cache.debugHasWriteLock(id), isTrue);

    final sw = Stopwatch()..start();
    final prefix = cache.ensurePlayablePrefix(url, needBytes: 8 * 1024);
    // Outside-lock waiter should see growing .part without taking the lock.
    final have = await prefix.timeout(const Duration(seconds: 3));
    sw.stop();
    expect(have, greaterThanOrEqualTo(8 * 1024));
    expect(sw.elapsedMilliseconds, lessThan(3000));
    releaseBody.complete();
    await full;
  });

  test('failed neighbor download does not abort a concurrent visible download', () async {
    final root = Directory.systemTemp.createTempSync('mira_vid_fail_peer_');
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
    final releaseOk = Completer<void>();
    final okBytes = List<int>.generate(64 * 1024, (i) => i % 256);
    server.listen((req) async {
      final id = req.uri.pathSegments.isNotEmpty ? req.uri.pathSegments.last : '';
      if (id.startsWith('dead')) {
        await req.response.detachSocket().then((s) => s.destroy());
        return;
      }
      if (req.method == 'HEAD') {
        req.response.headers.contentType = ContentType('video', 'mp4');
        req.response.contentLength = okBytes.length;
        await req.response.close();
        return;
      }
      req.response.headers.contentType = ContentType('video', 'mp4');
      req.response.contentLength = okBytes.length;
      req.response.add(okBytes.sublist(0, 8 * 1024));
      await req.response.flush();
      await releaseOk.future;
      req.response.add(okBytes.sublist(8 * 1024));
      await req.response.close();
    });

    const badId = 'deadbeef-dead-dead-dead-deaddeadbeef';
    const good = 'fccccccc-cccc-cccc-cccc-cccccccccccc';
    String urlFor(String id) =>
        'http://${server!.address.host}:${server.port}/api/v1/marketplace/media/$id';
    final cache = DiscoverVideoDiskCache(root: root, httpClient: HttpClient());
    addTearDown(() async {
      await cache.disposeProxy();
    });

    final goodJob = cache.ensureLocal(urlFor(good));
    await Future<void>.delayed(const Duration(milliseconds: 30));
    try {
      await cache.ensureLocal(urlFor(badId));
    } catch (_) {}
    releaseOk.complete();
    final goodRow = await goodJob;
    expect(goodRow.complete, isTrue);
    expect(goodRow.bytesOnDisk, okBytes.length);
  });
}
