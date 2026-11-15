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
        req.response.headers.set(HttpHeaders.contentRangeHeader, 'bytes $start-${bytes.length - 1}/${bytes.length}');
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
    expect(getCount, 1); // no second full GET
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
}
