import 'dart:async';
import 'dart:collection';
import 'dart:io';
import 'dart:math' as math;

import 'package:path_provider/path_provider.dart';

/// Disk cache for Discover network videos.
///
/// Stable key = mediaId + contentLength (content version). A rotating signed URL
/// that still points at the same mediaId/length reuses the same file. A replaced
/// video (new length) invalidates the old entry via eviction.
///
/// Downloads are shared by mediaId: cancelling a warm *controller* never cancels
/// the HTTP fetch for that id.
///
/// Partial prefixes are playable via a loopback Range proxy: AVPlayer reads local
/// bytes first; missing tails are fetched with `Range: bytes=have-` on the same
/// download path and appended to `{mediaId}.part`.
class DiscoverVideoDiskCache {
  DiscoverVideoDiskCache({
    Directory? root,
    this.maxEntries = 28,
    this.maxBytes = 900 * 1024 * 1024,
    HttpClient? httpClient,
  })  : _rootOverride = root,
        _http = httpClient ?? HttpClient();

  static DiscoverVideoDiskCache instance = DiscoverVideoDiskCache();

  final Directory? _rootOverride;
  final int maxEntries;
  final int maxBytes;
  final HttpClient _http;

  Directory? _root;
  final Map<String, Future<DiscoverCachedVideo>> _inflight = {};
  final LinkedHashMap<String, _CacheMeta> _lru = LinkedHashMap();
  final List<DiscoverVideoDiag> diagnostics = <DiscoverVideoDiag>[];

  /// Origin URL registered per mediaId for the loopback proxy.
  final Map<String, String> _originByMediaId = {};
  final Map<String, int> _knownLength = {};
  HttpServer? _proxy;
  int? _proxyPort;

  /// Last Range-serve stats (for logic tests / diagnostics).
  DiscoverByteServeStats? lastServeStats;

  /// Media id currently on screen — fill jobs for this id start before others.
  String? _priorityMediaId;

  /// Serialize all origin writes per mediaId (proxy + prefetch share one GET).
  final Map<String, Future<void>> _writeLocks = {};

  static String? mediaIdFromUrl(String url) {
    final uri = Uri.tryParse(url);
    if (uri == null) return null;
    final parts = uri.pathSegments;
    final i = parts.lastIndexOf('media');
    if (i >= 0 && i + 1 < parts.length) {
      final id = parts[i + 1].trim();
      if (id.isNotEmpty) return id;
    }
    return null;
  }

  Future<Directory> _ensureRoot() async {
    if (_root != null) return _root!;
    if (_rootOverride != null) {
      _root = _rootOverride!;
    } else {
      final base = await getTemporaryDirectory();
      _root = Directory('${base.path}/mira_discover_video');
    }
    if (!await _root!.exists()) {
      await _root!.create(recursive: true);
    }
    return _root!;
  }

  void _diag(DiscoverVideoDiag row) {
    diagnostics.add(row);
    if (diagnostics.length > 80) {
      diagnostics.removeRange(0, diagnostics.length - 80);
    }
  }

  /// Prefer fill for the on-screen clip over background neighbors.
  void prioritize(String url) {
    _priorityMediaId = mediaIdFromUrl(url);
  }

  /// Fire-and-forget prefetch. Safe to call repeatedly — joins the same download.
  void prefetch(String url, {bool lowPriority = false}) {
    final id = mediaIdFromUrl(url);
    if (lowPriority &&
        _priorityMediaId != null &&
        id != null &&
        id != _priorityMediaId &&
        _inflight.containsKey(_priorityMediaId)) {
      // Defer neighbor fill until the visible clip's shared download settles.
      // ignore: discarded_futures
      _inflight[_priorityMediaId]!.whenComplete(() {
        // ignore: discarded_futures
        ensureLocal(url);
      });
      return;
    }
    // ignore: discarded_futures
    ensureLocal(url);
  }

  /// Returns a complete local file when possible. Joins any in-flight download
  /// for the same mediaId so swipe never restarts the HTTP request from zero.
  ///
  /// [stopAfterBytes] (tests): stop once the prefix reaches this size and keep
  /// the `.part` for resume.
  Future<DiscoverCachedVideo> ensureLocal(
    String url, {
    int? stopAfterBytes,
  }) async {
    final mediaId = mediaIdFromUrl(url);
    if (mediaId == null) {
      return DiscoverCachedVideo.network(url: url, reason: 'no_media_id');
    }
    _originByMediaId[mediaId] = url;

    // Single shared job per mediaId — proxy + prefetch never open a second GET.
    final pending = _inflight[mediaId];
    if (pending != null && stopAfterBytes == null) {
      return pending;
    }

    final gate = Completer<DiscoverCachedVideo>();
    if (stopAfterBytes == null) {
      final raced = _inflight.putIfAbsent(mediaId, () => gate.future);
      if (!identical(raced, gate.future)) {
        return raced;
      }
    }

    try {
      final result = await _withWriteLock(
        mediaId,
        () => _download(mediaId, url, stopAfterBytes: stopAfterBytes),
      );
      if (!gate.isCompleted) gate.complete(result);
      return result;
    } catch (e, st) {
      if (!gate.isCompleted) gate.completeError(e, st);
      rethrow;
    } finally {
      if (stopAfterBytes == null && identical(_inflight[mediaId], gate.future)) {
        _inflight.remove(mediaId);
      }
    }
  }

  Future<T> _withWriteLock<T>(String mediaId, Future<T> Function() fn) async {
    while (_writeLocks.containsKey(mediaId)) {
      try {
        await _writeLocks[mediaId];
      } catch (_) {}
    }
    final done = Completer<void>();
    _writeLocks[mediaId] = done.future;
    try {
      return await fn();
    } finally {
      if (identical(_writeLocks[mediaId], done.future)) {
        _writeLocks.remove(mediaId);
      }
      if (!done.isCompleted) done.complete();
    }
  }

  /// Non-blocking peek: complete file already on disk for this URL's media id.
  Future<File?> peekComplete(String url) async {
    final mediaId = mediaIdFromUrl(url);
    if (mediaId == null) return null;
    final root = await _ensureRoot();
    await _indexExisting(root);
    for (final e in _lru.entries) {
      if (e.value.mediaId == mediaId && e.value.complete) {
        final f = File(e.value.path);
        if (await f.exists()) {
          _touch(e.key);
          return f;
        }
      }
    }
    return null;
  }

  /// Bytes already on disk for [url] (complete file or `.part` prefix).
  Future<int> bytesOnDiskFor(String url) async {
    final mediaId = mediaIdFromUrl(url);
    if (mediaId == null) return 0;
    final root = await _ensureRoot();
    await _indexExisting(root);
    for (final e in _lru.entries) {
      if (e.value.mediaId == mediaId && e.value.complete) {
        final f = File(e.value.path);
        if (await f.exists()) return f.length();
      }
    }
    final part = File('${root.path}/$mediaId.part');
    if (await part.exists()) return part.length();
    return 0;
  }

  /// Playable source for AVPlayer: complete file, or loopback URL that serves
  /// the local prefix and resumes the shared download for missing bytes.
  Future<DiscoverPlaySource> resolvePlaySource(String url) async {
    final mediaId = mediaIdFromUrl(url);
    if (mediaId == null) {
      return DiscoverPlaySource.remote(url);
    }
    _originByMediaId[mediaId] = url;
    prioritize(url);

    final complete = await peekComplete(url);
    if (complete != null) {
      final len = await complete.length();
      lastServeStats = DiscoverByteServeStats(
        mediaId: mediaId,
        bytesFromDisk: len,
        bytesFromNetwork: 0,
        contentLength: len,
        source: 'file',
      );
      return DiscoverPlaySource.file(complete, mediaId: mediaId, bytesOnDisk: len);
    }

    // Proxy serves the local prefix immediately. Callers should [prefetch] for
    // background fill; the proxy also Range-resumes on demand for missing bytes.
    final have = await bytesOnDiskFor(url);
    final port = await _ensureProxy();
    final playUrl = Uri.parse('http://127.0.0.1:$port/play/$mediaId');
    return DiscoverPlaySource.proxy(
      playUrl,
      mediaId: mediaId,
      bytesOnDisk: have,
      originUrl: url,
    );
  }

  Future<int> _ensureProxy() async {
    if (_proxy != null && _proxyPort != null) return _proxyPort!;
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    _proxy = server;
    _proxyPort = server.port;
    server.listen(_handleProxyRequest);
    return server.port!;
  }

  Future<File> _openBodyFile(String mediaId) async {
    final root = await _ensureRoot();
    for (final e in _lru.entries) {
      if (e.value.mediaId == mediaId && e.value.complete) {
        final f = File(e.value.path);
        if (await f.exists()) return f;
      }
    }
    final part = File('${root.path}/$mediaId.part');
    if (!await part.exists()) {
      await part.create(recursive: true);
    }
    return part;
  }

  Future<void> _handleProxyRequest(HttpRequest req) async {
    try {
      final segments = req.uri.pathSegments;
      if (segments.length < 2 || segments[0] != 'play') {
        req.response.statusCode = HttpStatus.notFound;
        await req.response.close();
        return;
      }
      final mediaId = segments[1];
      final origin = _originByMediaId[mediaId];
      if (origin == null) {
        req.response.statusCode = HttpStatus.notFound;
        await req.response.close();
        return;
      }

      _priorityMediaId = mediaId;
      var total = _knownLength[mediaId];
      var file = await _openBodyFile(mediaId);
      var have = await file.length();

      if (total == null || total <= 0) {
        total = await _headLength(origin) ?? (have > 0 ? have : null);
        if (total != null && total > 0) _knownLength[mediaId] = total;
      }

      final range = req.headers.value(HttpHeaders.rangeHeader);
      var start = 0;
      var end = (total != null && total > 0 ? total : math.max(have, 1)) - 1;
      if (range != null && range.startsWith('bytes=')) {
        final spec = range.substring(6);
        final parts = spec.split('-');
        start = int.tryParse(parts[0]) ?? 0;
        if (parts.length > 1 && parts[1].isNotEmpty) {
          end = int.tryParse(parts[1]) ?? end;
        } else if (total != null && total > 0) {
          end = total - 1;
        }
      }
      if (total != null && total > 0) {
        end = math.min(end, total - 1);
      }
      if (start < 0) start = 0;
      if (end < start) {
        req.response.statusCode = HttpStatus.requestedRangeNotSatisfiable;
        await req.response.close();
        return;
      }

      // If we don't even have the first requested byte yet, kick the shared
      // download and wait only until that byte lands — never for the full end.
      if (have <= start) {
        prefetch(origin);
        final deadline = DateTime.now().toUtc().add(const Duration(seconds: 20));
        while (have <= start && DateTime.now().toUtc().isBefore(deadline)) {
          await Future<void>.delayed(const Duration(milliseconds: 20));
          file = await _openBodyFile(mediaId);
          have = await file.length();
          total = _knownLength[mediaId] ?? total;
          if (total != null && total > 0) end = math.min(end, total - 1);
        }
      }
      if (have <= start) {
        req.response.statusCode = HttpStatus.serviceUnavailable;
        await req.response.close();
        return;
      }

      final alreadyHad = have;
      final serveEnd = end;
      final bodyLen = serveEnd - start + 1;

      req.response.statusCode =
          (start == 0 && total != null && serveEnd == total - 1) ? HttpStatus.ok : HttpStatus.partialContent;
      req.response.headers.contentType = ContentType('video', 'mp4');
      req.response.headers.set(HttpHeaders.acceptRangesHeader, 'bytes');
      if (total != null && total > 0) {
        req.response.headers.set(HttpHeaders.contentRangeHeader, 'bytes $start-$serveEnd/$total');
      }
      req.response.headers.contentLength = bodyLen;
      // Buffering off so the first local chunk reaches AVPlayer immediately.
      req.response.bufferOutput = false;

      // Shared fill for the missing tail — same write lock as prefetch.
      if (total == null || have < serveEnd + 1) {
        prefetch(origin);
      }

      final started = DateTime.now().toUtc();
      int? firstByteMs;
      var bytesFromDisk = 0;
      var bytesFromNetwork = 0;
      void publishStats({int? completeMs}) {
        lastServeStats = DiscoverByteServeStats(
          mediaId: mediaId,
          bytesFromDisk: bytesFromDisk,
          bytesFromNetwork: bytesFromNetwork,
          contentLength: total,
          source: 'proxy_stream',
          requestStart: start,
          requestEnd: serveEnd,
          firstByteMs: firstByteMs,
          completeMs: completeMs,
        );
      }

      var pos = start;
      var openPath = file.path;
      var raf = await file.open();
      try {
        await raf.setPosition(start);
        final buf = List<int>.filled(64 * 1024, 0);
        while (pos <= serveEnd) {
          file = await _openBodyFile(mediaId);
          have = await file.length();
          if (have <= pos) {
            // Wait for the shared downloader to append — do not block the
            // already-sent local prefix on the full requested end.
            if (_inflight[mediaId] == null && (total == null || have < serveEnd + 1)) {
              prefetch(origin);
            }
            await Future<void>.delayed(const Duration(milliseconds: 20));
            continue;
          }
          // Re-open if the .part was renamed to a complete file.
          if (openPath != file.path) {
            await raf.close();
            raf = await file.open();
            await raf.setPosition(pos);
            openPath = file.path;
          }
          final canReadTo = math.min(serveEnd, have - 1);
          var left = canReadTo - pos + 1;
          while (left > 0) {
            final n = await raf.readInto(buf, 0, math.min(buf.length, left));
            if (n <= 0) break;
            req.response.add(buf.sublist(0, n));
            await req.response.flush();
            firstByteMs ??= DateTime.now().toUtc().difference(started).inMilliseconds;
            final diskEnd = math.min(pos + n, alreadyHad);
            if (diskEnd > pos) {
              bytesFromDisk += diskEnd - pos;
            }
            if (pos + n > alreadyHad) {
              bytesFromNetwork += pos + n - math.max(pos, alreadyHad);
            }
            pos += n;
            left -= n;
            // Publish on first byte so tests/clients never race the final close.
            publishStats();
          }
        }
      } finally {
        try {
          await raf.close();
        } catch (_) {}
      }
      publishStats(completeMs: DateTime.now().toUtc().difference(started).inMilliseconds);
      await req.response.close();
    } catch (_) {
      try {
        req.response.statusCode = HttpStatus.internalServerError;
        await req.response.close();
      } catch (_) {}
    }
  }

  Future<int?> _headLength(String url) async {
    try {
      final head = await _http.headUrl(Uri.parse(url));
      head.headers.set(HttpHeaders.acceptHeader, 'video/*,*/*');
      final headResp = await head.close().timeout(const Duration(seconds: 8));
      final len = headResp.contentLength >= 0 ? headResp.contentLength : null;
      await headResp.drain<void>();
      return len;
    } catch (_) {
      return null;
    }
  }

  /// Grow the local prefix to at least [needBytes] using Range resume.
  Future<_PrefixFill> _ensurePrefix({
    required String mediaId,
    required String origin,
    required int needBytes,
    int? knownTotal,
  }) async {
    final root = await _ensureRoot();
    // Prefer complete file.
    for (final e in _lru.entries) {
      if (e.value.mediaId == mediaId && e.value.complete) {
        final f = File(e.value.path);
        if (await f.exists()) {
          final len = await f.length();
          return _PrefixFill(
            file: f,
            bytesOnDiskBefore: len,
            bytesReused: len,
            bytesDownloaded: 0,
            contentLength: e.value.contentLength,
          );
        }
      }
    }

    final part = File('${root.path}/$mediaId.part');
    var have = 0;
    if (await part.exists()) {
      have = await part.length();
    }
    final before = have;
    if (have >= needBytes) {
      return _PrefixFill(
        file: part,
        bytesOnDiskBefore: before,
        bytesReused: have,
        bytesDownloaded: 0,
        contentLength: knownTotal ?? _knownLength[mediaId],
      );
    }

    // Join a full ensureLocal if already downloading the whole file.
    final pending = _inflight[mediaId];
    if (pending != null) {
      // Wait briefly for prefix growth.
      final deadline = DateTime.now().toUtc().add(const Duration(seconds: 12));
      while (DateTime.now().toUtc().isBefore(deadline)) {
        have = await part.exists() ? await part.length() : 0;
        if (have >= needBytes) {
          return _PrefixFill(
            file: part,
            bytesOnDiskBefore: before,
            bytesReused: before,
            bytesDownloaded: have - before,
            contentLength: knownTotal ?? _knownLength[mediaId],
          );
        }
        // Complete may have renamed part away.
        final done = await peekComplete(
          _originByMediaId[mediaId] ?? origin,
        );
        if (done != null) {
          final len = await done.length();
          return _PrefixFill(
            file: done,
            bytesOnDiskBefore: before,
            bytesReused: before,
            bytesDownloaded: math.max(0, len - before),
            contentLength: len,
          );
        }
        await Future<void>.delayed(const Duration(milliseconds: 40));
      }
    }

    var total = knownTotal ?? _knownLength[mediaId];
    var downloaded = 0;
    while (have < needBytes) {
      final req = await _http.getUrl(Uri.parse(origin));
      req.headers.set(HttpHeaders.acceptHeader, 'video/*,*/*');
      if (have > 0) {
        req.headers.set(HttpHeaders.rangeHeader, 'bytes=$have-');
      }
      final resp = await req.close().timeout(const Duration(seconds: 20));
      final status = resp.statusCode;
      if (status != 200 && status != 206) {
        await resp.drain<void>();
        break;
      }
      if (status == 200) {
        // Server ignored Range — rewrite from scratch.
        have = 0;
      }
      final declared = resp.contentLength >= 0
          ? (status == 206 ? have + resp.contentLength : resp.contentLength)
          : total;
      if (declared != null && declared > 0) {
        total = declared;
        _knownLength[mediaId] = declared;
      }
      final sink = part.openWrite(mode: have > 0 && status == 206 ? FileMode.append : FileMode.write);
      try {
        await for (final chunk in resp) {
          sink.add(chunk);
          downloaded += chunk.length;
          have += chunk.length;
          if (have >= needBytes) {
            // Drain remainder of this response into the file for continuity.
            // (Keep reading so TCP finishes cleanly, still counting.)
            continue;
          }
        }
        await sink.flush();
        await sink.close();
      } catch (_) {
        try {
          await sink.close();
        } catch (_) {}
        break;
      }
      have = await part.length();
      if (total != null && have >= total) break;
      if (status == 200 && have >= needBytes) break;
      // If server sent only a partial window and we still need more, loop.
      if (downloaded > 0 && have < needBytes && status == 206) {
        continue;
      }
      break;
    }

    have = await part.length();
    if (total != null && have >= total && total > 0) {
      final key = '${mediaId}_$total.mp4';
      final dest = File('${root.path}/$key');
      if (await dest.exists()) await dest.delete();
      await part.rename(dest.path);
      _lru.removeWhere((_, m) => m.mediaId == mediaId);
      _lru[key] = _CacheMeta(
        key: key,
        mediaId: mediaId,
        contentLength: total,
        path: dest.path,
        complete: true,
        bytesOnDisk: total,
      );
      await _evictIfNeeded();
      return _PrefixFill(
        file: dest,
        bytesOnDiskBefore: before,
        bytesReused: before,
        bytesDownloaded: downloaded,
        contentLength: total,
      );
    }

    _diag(DiscoverVideoDiag(
      mediaId: mediaId,
      source: before > 0 ? 'disk_resume' : 'network_to_disk',
      bytesReused: before,
      bytesDownloaded: downloaded,
      elapsedMs: 0,
    ));

    return _PrefixFill(
      file: part,
      bytesOnDiskBefore: before,
      bytesReused: before,
      bytesDownloaded: downloaded,
      contentLength: total,
    );
  }

  Future<void> _indexExisting(Directory root) async {
    if (_lru.isNotEmpty) return;
    await for (final entity in root.list()) {
      if (entity is! File) continue;
      final name = entity.uri.pathSegments.isEmpty ? entity.path.split('/').last : entity.uri.pathSegments.last;
      final m = RegExp(r'^([0-9a-fA-F-]{36})_(\d+)\.mp4$').firstMatch(name);
      if (m == null) continue;
      final len = int.tryParse(m.group(2)!) ?? 0;
      final size = await entity.length();
      if (len <= 0 || size != len) continue;
      final key = m.group(0)!;
      _lru[key] = _CacheMeta(
        key: key,
        mediaId: m.group(1)!,
        contentLength: len,
        path: entity.path,
        complete: true,
        bytesOnDisk: size,
      );
    }
  }

  void _touch(String key) {
    final meta = _lru.remove(key);
    if (meta != null) _lru[key] = meta;
  }

  Future<DiscoverCachedVideo> _download(
    String mediaId,
    String url, {
    int? stopAfterBytes,
  }) async {
    final root = await _ensureRoot();
    await _indexExisting(root);
    final started = DateTime.now().toUtc();
    _originByMediaId[mediaId] = url;

    int? contentLength = _knownLength[mediaId];
    contentLength ??= await _headLength(url);
    if (contentLength != null && contentLength > 0) {
      _knownLength[mediaId] = contentLength;
    }

    if (contentLength != null && contentLength > 0) {
      final key = '${mediaId}_$contentLength.mp4';
      final existing = _lru[key];
      if (existing != null && existing.complete) {
        final f = File(existing.path);
        if (await f.exists() && await f.length() == contentLength) {
          _touch(key);
          final row = DiscoverCachedVideo(
            url: url,
            mediaId: mediaId,
            file: f,
            complete: true,
            fromDisk: true,
            bytesOnDisk: contentLength,
            bytesDownloaded: 0,
            contentLength: contentLength,
          );
          _diag(DiscoverVideoDiag(
            mediaId: mediaId,
            source: 'disk',
            bytesReused: contentLength,
            bytesDownloaded: 0,
            elapsedMs: DateTime.now().toUtc().difference(started).inMilliseconds,
          ));
          return row;
        }
      }
    }

    final part = File('${root.path}/$mediaId.part');
    var have = 0;
    if (await part.exists()) {
      have = await part.length();
    }

    if (stopAfterBytes != null && have >= stopAfterBytes) {
      return DiscoverCachedVideo(
        url: url,
        mediaId: mediaId,
        file: part,
        complete: false,
        fromDisk: true,
        bytesOnDisk: have,
        bytesDownloaded: 0,
        contentLength: contentLength,
      );
    }

    final req = await _http.getUrl(Uri.parse(url));
    req.headers.set(HttpHeaders.acceptHeader, 'video/*,*/*');
    if (have > 0) {
      req.headers.set(HttpHeaders.rangeHeader, 'bytes=$have-');
    }
    final resp = await req.close().timeout(const Duration(seconds: 20));
    final status = resp.statusCode;
    if (status != 200 && status != 206) {
      await resp.drain<void>();
      _diag(DiscoverVideoDiag(
        mediaId: mediaId,
        source: 'network_error',
        bytesReused: have,
        bytesDownloaded: 0,
        elapsedMs: DateTime.now().toUtc().difference(started).inMilliseconds,
        error: 'http_$status',
      ));
      return DiscoverCachedVideo.network(url: url, mediaId: mediaId, reason: 'http_$status');
    }

    if (status == 200) {
      have = 0;
    }

    final total = resp.contentLength >= 0
        ? (status == 206 ? have + resp.contentLength : resp.contentLength)
        : contentLength;
    if (total != null && total > 0) _knownLength[mediaId] = total;

    final sink = part.openWrite(mode: have > 0 && status == 206 ? FileMode.append : FileMode.write);
    var downloaded = 0;
    final reused = have;
    var stoppedEarly = false;
    try {
      await for (final chunk in resp) {
        if (stopAfterBytes != null && have >= stopAfterBytes) {
          stoppedEarly = true;
          break;
        }
        var piece = chunk;
        if (stopAfterBytes != null && have + chunk.length > stopAfterBytes) {
          piece = chunk.sublist(0, stopAfterBytes - have);
          stoppedEarly = true;
        }
        if (piece.isEmpty) {
          stoppedEarly = true;
          break;
        }
        sink.add(piece);
        downloaded += piece.length;
        have += piece.length;
        if (stoppedEarly) break;
      }
      await sink.flush();
      await sink.close();
    } catch (e) {
      try {
        await sink.close();
      } catch (_) {}
      _diag(DiscoverVideoDiag(
        mediaId: mediaId,
        source: 'network_error',
        bytesReused: reused,
        bytesDownloaded: downloaded,
        elapsedMs: DateTime.now().toUtc().difference(started).inMilliseconds,
        error: '$e',
      ));
      return DiscoverCachedVideo.network(url: url, mediaId: mediaId, reason: 'download_error');
    }

    // If we stopped early, drain the rest of the response without writing so the
    // socket closes; bytes remain for Range resume on the next open.
    if (stoppedEarly) {
      try {
        await resp.drain<void>();
      } catch (_) {}
    }

    final finalLen = await part.length();
    final expected = total ?? contentLength;
    if (expected == null || finalLen <= 0) {
      return DiscoverCachedVideo.network(url: url, mediaId: mediaId, reason: 'unknown_length');
    }
    if (finalLen < expected) {
      _diag(DiscoverVideoDiag(
        mediaId: mediaId,
        source: 'partial',
        bytesReused: reused,
        bytesDownloaded: downloaded,
        elapsedMs: DateTime.now().toUtc().difference(started).inMilliseconds,
        error: 'incomplete_$finalLen/$expected',
      ));
      return DiscoverCachedVideo(
        url: url,
        mediaId: mediaId,
        file: part,
        complete: false,
        fromDisk: reused > 0 && downloaded == 0,
        bytesOnDisk: finalLen,
        bytesDownloaded: downloaded,
        contentLength: expected,
      );
    }

    final key = '${mediaId}_$expected.mp4';
    final dest = File('${root.path}/$key');
    if (await dest.exists()) {
      await dest.delete();
    }
    await part.rename(dest.path);
    _lru.removeWhere((_, m) => m.mediaId == mediaId);
    _lru[key] = _CacheMeta(
      key: key,
      mediaId: mediaId,
      contentLength: expected,
      path: dest.path,
      complete: true,
      bytesOnDisk: expected,
    );
    await _evictIfNeeded();
    _diag(DiscoverVideoDiag(
      mediaId: mediaId,
      source: reused > 0 ? 'disk_resume' : 'network_to_disk',
      bytesReused: reused,
      bytesDownloaded: downloaded,
      elapsedMs: DateTime.now().toUtc().difference(started).inMilliseconds,
    ));
    return DiscoverCachedVideo(
      url: url,
      mediaId: mediaId,
      file: dest,
      complete: true,
      fromDisk: reused > 0 && downloaded == 0,
      bytesOnDisk: expected,
      bytesDownloaded: downloaded,
      contentLength: expected,
    );
  }

  Future<void> _evictIfNeeded() async {
    var bytes = _lru.values.fold<int>(0, (a, b) => a + b.bytesOnDisk);
    while (_lru.length > maxEntries || bytes > maxBytes) {
      if (_lru.isEmpty) break;
      final oldest = _lru.keys.first;
      final meta = _lru.remove(oldest);
      if (meta == null) break;
      try {
        final f = File(meta.path);
        if (await f.exists()) await f.delete();
        final part = File('${_root!.path}/${meta.mediaId}.part');
        if (await part.exists()) await part.delete();
      } catch (_) {}
      bytes -= meta.bytesOnDisk;
    }
  }

  Future<void> disposeProxy() async {
    await _proxy?.close(force: true);
    _proxy = null;
    _proxyPort = null;
  }
}

class DiscoverPlaySource {
  const DiscoverPlaySource._({
    required this.kind,
    this.file,
    this.uri,
    this.mediaId,
    this.bytesOnDisk = 0,
    this.originUrl,
  });

  factory DiscoverPlaySource.file(File file, {String? mediaId, int bytesOnDisk = 0}) =>
      DiscoverPlaySource._(kind: 'file', file: file, mediaId: mediaId, bytesOnDisk: bytesOnDisk);

  factory DiscoverPlaySource.proxy(
    Uri uri, {
    String? mediaId,
    int bytesOnDisk = 0,
    String? originUrl,
  }) =>
      DiscoverPlaySource._(
        kind: 'proxy',
        uri: uri,
        mediaId: mediaId,
        bytesOnDisk: bytesOnDisk,
        originUrl: originUrl,
      );

  factory DiscoverPlaySource.remote(String url) =>
      DiscoverPlaySource._(kind: 'remote', uri: Uri.parse(url));

  final String kind;
  final File? file;
  final Uri? uri;
  final String? mediaId;
  final int bytesOnDisk;
  final String? originUrl;

  bool get isFile => kind == 'file' && file != null;
  bool get isProxy => kind == 'proxy' && uri != null;
}

class DiscoverByteServeStats {
  const DiscoverByteServeStats({
    required this.mediaId,
    required this.bytesFromDisk,
    required this.bytesFromNetwork,
    this.contentLength,
    required this.source,
    this.requestStart,
    this.requestEnd,
    this.firstByteMs,
    this.completeMs,
  });

  final String mediaId;
  final int bytesFromDisk;
  final int bytesFromNetwork;
  final int? contentLength;
  final String source;
  final int? requestStart;
  final int? requestEnd;
  final int? firstByteMs;
  final int? completeMs;

  Map<String, Object?> toJson() => {
        'mediaId': mediaId,
        'bytesFromDisk': bytesFromDisk,
        'bytesFromNetwork': bytesFromNetwork,
        'contentLength': contentLength,
        'source': source,
        'requestStart': requestStart,
        'requestEnd': requestEnd,
        'firstByteMs': firstByteMs,
        'completeMs': completeMs,
      };
}

class DiscoverCachedVideo {
  const DiscoverCachedVideo({
    required this.url,
    this.mediaId,
    this.file,
    required this.complete,
    required this.fromDisk,
    required this.bytesOnDisk,
    required this.bytesDownloaded,
    this.contentLength,
    this.reason,
  });

  factory DiscoverCachedVideo.network({
    required String url,
    String? mediaId,
    String? reason,
  }) =>
      DiscoverCachedVideo(
        url: url,
        mediaId: mediaId,
        complete: false,
        fromDisk: false,
        bytesOnDisk: 0,
        bytesDownloaded: 0,
        reason: reason,
      );

  final String url;
  final String? mediaId;
  final File? file;
  final bool complete;
  final bool fromDisk;
  final int bytesOnDisk;
  final int bytesDownloaded;
  final int? contentLength;
  final String? reason;

  bool get playableFromDisk => complete && file != null;
}

class DiscoverVideoDiag {
  const DiscoverVideoDiag({
    required this.mediaId,
    required this.source,
    required this.bytesReused,
    required this.bytesDownloaded,
    required this.elapsedMs,
    this.error,
  });

  final String mediaId;
  final String source;
  final int bytesReused;
  final int bytesDownloaded;
  final int elapsedMs;
  final String? error;

  Map<String, Object?> toJson() => {
        'mediaId': mediaId,
        'source': source,
        'bytesReused': bytesReused,
        'bytesDownloaded': bytesDownloaded,
        'elapsedMs': elapsedMs,
        'error': error,
      };
}

class _CacheMeta {
  _CacheMeta({
    required this.key,
    required this.mediaId,
    required this.contentLength,
    required this.path,
    required this.complete,
    required this.bytesOnDisk,
  });

  final String key;
  final String mediaId;
  final int contentLength;
  final String path;
  final bool complete;
  final int bytesOnDisk;
}

class _PrefixFill {
  const _PrefixFill({
    required this.file,
    required this.bytesOnDiskBefore,
    required this.bytesReused,
    required this.bytesDownloaded,
    this.contentLength,
  });

  final File? file;
  final int bytesOnDiskBefore;
  final int bytesReused;
  final int bytesDownloaded;
  final int? contentLength;
}
