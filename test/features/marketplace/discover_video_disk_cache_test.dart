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

    final stats = cache.lastServeStats!;
    expect(stats.bytesFromDisk, prefix);
    expect(stats.bytesFromNetwork, 0);
    // Must not re-GET the already-local prefix from origin.
    expect(rangeStarts.where((s) => s < prefix), isEmpty);
    expect(fullGets, beforeFull);

    // Now ask past the prefix — only the missing tail may be fetched.
    final needEnd = prefix + 4095;
    final playReq2 = await client.getUrl(source.uri!);
    playReq2.headers.set(HttpHeaders.rangeHeader, 'bytes=0-$needEnd');
    final playResp2 = await playReq2.close();
    final played2 = await playResp2.fold<List<int>>(<int>[], (a, b) {
      a.addAll(b);
      return a;
    });
    expect(played2.length, needEnd + 1);
    expect(played2, bytes.sublist(0, needEnd + 1));

    final stats2 = cache.lastServeStats!;
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

    final stats = cache.lastServeStats!;
    expect(stats.bytesFromDisk, greaterThanOrEqualTo(prefix));
    expect(stats.bytesFromNetwork, 0);

    final getsAfter = originGets[firstId] ?? const <int>[];
    final newStarts = getsAfter.skip(getsBefore.length).toList();
    // Background fill may Range-resume the tail, but must never re-request the
    // already-local prefix (no start < prefix, and no full GET rewriting 0..).
    expect(newStarts.where((s) => s >= 0 && s < prefix), isEmpty);

    // Extend past prefix — only tail from network.
    final mid = getsAfter.length;
    final req2 = await client.getUrl(source.uri!);
    req2.headers.set(HttpHeaders.rangeHeader, 'bytes=0-${prefix + 2047}');
    final resp2 = await req2.close();
    await resp2.drain<void>();
    final stats2 = cache.lastServeStats!;
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
}
