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
  HttpClient _http;

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

  /// Last [ensurePlayablePrefix] outcome (bytes on disk vs network read).
  DiscoverPrefixFillStats? lastPrefixStats;

  /// Media id currently on screen — fill jobs for this id start before others.
  /// Only [prioritize] / [resolvePlaySource](claimPriority: true) may set this.
  String? _priorityMediaId;

  /// Authoritative object sizes (Content-Range TOTAL or full-GET Content-Length).
  /// Never populated from a prefix window / `.part` length alone.
  final Map<String, int> _trustedLength = {};

  /// Serialize all origin writes per mediaId (proxy + prefetch share one GET).
  final Map<String, Future<void>> _writeLocks = {};
  /// Re-entrancy depth while the current async stack holds the write lock.
  final Map<String, int> _writeLockDepth = {};

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

  /// Trusted object size from `Content-Range: bytes start-end/TOTAL`.
  /// Returns null for missing header, malformed values, or `TOTAL=*`.
  static int? contentRangeTotal(String? header) {
    if (header == null || header.isEmpty) return null;
    final m = RegExp(r'bytes\s+\d+-\d+/(\d+|\*)', caseSensitive: false).firstMatch(header.trim());
    if (m == null) return null;
    final raw = m.group(1);
    if (raw == null || raw == '*') return null;
    final n = int.tryParse(raw);
    if (n == null || n <= 0) return null;
    return n;
  }

  /// Stop reading an HTTP body without writing more bytes. Prefer tearing the
  /// socket down so a 200-to-Range-ignore cannot keep competing for bandwidth.
  static Future<void> abortHttpBody(HttpClientResponse resp) async {
    try {
      final socket = await resp.detachSocket();
      socket.destroy();
    } catch (_) {
      try {
        await resp.drain<void>().timeout(const Duration(milliseconds: 80));
      } catch (_) {}
    }
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

  /// Full GET only for the priority (on-screen) mediaId; others grow a prefix.
  void _kickFill(String origin, String mediaId) {
    if (_priorityMediaId != null && mediaId != _priorityMediaId) {
      // ignore: discarded_futures
      ensurePlayablePrefix(origin, needBytes: 1024 * 1024).catchError((_) {});
      return;
    }
    // ignore: discarded_futures
    ensureLocal(origin).catchError((_) {});
  }

  /// Fire-and-forget prefetch. Safe to call repeatedly — joins the same download.
  ///
  /// [lowPriority] neighbors only grow a playable prefix (~1 MiB). They must NOT
  /// start or queue a full multi‑10 MB GET — concurrent full downloads starved
  /// the on-screen clip (wedding dress 9cbed24c: 51 MB cold GET under dark cover).
  ///
  /// Non-lowPriority full fill never steals [_priorityMediaId]; only [prioritize]
  /// / claimPriority attach may designate the on-screen owner.
  void prefetch(String url, {bool lowPriority = false}) {
    final id = mediaIdFromUrl(url);
    if (lowPriority) {
      // Always prefix-only for neighbors. Full ensureLocal runs when that clip
      // becomes active (attach → prioritize + prefetch without lowPriority).
      // ignore: discarded_futures
      ensurePlayablePrefix(url, needBytes: 1024 * 1024);
      return;
    }
    if (id != null && _priorityMediaId != null && id != _priorityMediaId) {
      // Visible clip owns full GET — neighbors stay prefix-only.
      // ignore: discarded_futures
      ensurePlayablePrefix(url, needBytes: 1024 * 1024);
      return;
    }
    // ignore: discarded_futures
    ensureLocal(url).catchError((_) => DiscoverCachedVideo.network(url: url, reason: 'prefetch_error'));
  }

  /// Ensure at least [needBytes] are on disk (complete file or .part) without
  /// waiting for the full object — used to arm the next swipe under priority.
  Future<int> ensurePlayablePrefix(String url, {int needBytes = 512 * 1024}) async {
    final mediaId = mediaIdFromUrl(url);
    if (mediaId == null) return 0;
    _originByMediaId[mediaId] = url;
    final complete = await peekComplete(url);
    if (complete != null) return complete.length();
    var have = await bytesOnDiskFor(url);
    if (have >= needBytes) return have;

    // If a writer already holds the lock / full GET is in flight, wait for the
    // `.part` to grow without taking the write lock (would block behind the
    // full download and can deadlock via peek→finalize).
    if (_inflight.containsKey(mediaId) || _writeLocks.containsKey(mediaId)) {
      final root = await _ensureRoot();
      final part = File('${root.path}/$mediaId.part');
      final deadline = DateTime.now().toUtc().add(const Duration(seconds: 12));
      while (DateTime.now().toUtc().isBefore(deadline)) {
        have = await part.exists() ? await part.length() : 0;
        if (have >= needBytes) return have;
        final done = await _findCompleteOnDiskUnlocked(mediaId);
        if (done != null) return done.length();
        await Future<void>.delayed(const Duration(milliseconds: 40));
      }
      return have;
    }

    try {
      final fill = await _withWriteLock(
        mediaId,
        () => _ensurePrefix(
          mediaId: mediaId,
          origin: url,
          needBytes: needBytes,
          knownTotal: _trustedLength[mediaId] ?? _knownLength[mediaId],
        ),
      );
      return await fill.file?.length() ?? 0;
    } catch (_) {
      return have;
    }
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
    // Re-enter if this mediaId's lock is already held on the current stack
    // (e.g. finalize called from inside _ensurePrefix). External waiters still
    // queue on [_writeLocks] and never busy-spin forever.
    final held = _writeLockDepth[mediaId] ?? 0;
    if (held > 0) {
      _writeLockDepth[mediaId] = held + 1;
      try {
        return await fn();
      } finally {
        final next = (_writeLockDepth[mediaId] ?? 1) - 1;
        if (next <= 0) {
          _writeLockDepth.remove(mediaId);
        } else {
          _writeLockDepth[mediaId] = next;
        }
      }
    }
    while (_writeLocks.containsKey(mediaId)) {
      try {
        await _writeLocks[mediaId];
      } catch (_) {}
    }
    final done = Completer<void>();
    _writeLocks[mediaId] = done.future;
    _writeLockDepth[mediaId] = 1;
    try {
      return await fn();
    } finally {
      _writeLockDepth.remove(mediaId);
      if (identical(_writeLocks[mediaId], done.future)) {
        _writeLocks.remove(mediaId);
      }
      if (!done.isCompleted) done.complete();
    }
  }

  /// True when [total] was recorded from an authoritative HTTP source for [mediaId].
  bool _isTrustedTotal(String mediaId, int total) {
    if (total <= 0) return false;
    return _trustedLength[mediaId] == total;
  }

  void _recordTrustedLength(String mediaId, int total) {
    if (total <= 0) return;
    _trustedLength[mediaId] = total;
    _knownLength[mediaId] = total;
  }

  /// If `{mediaId}.part` already holds the full object, promote it to a
  /// complete `mediaId_TOTAL.mp4`. Safe under the per-media write lock and
  /// idempotent when several callers race the same promote.
  Future<File?> finalizePartIfComplete(String url) async {
    final mediaId = mediaIdFromUrl(url);
    if (mediaId == null) return null;
    return _withWriteLock(
      mediaId,
      () => _finalizePartIfCompleteUnlocked(mediaId: mediaId, url: url),
    );
  }

  /// Caller must already hold the write lock for [mediaId].
  Future<File?> _finalizePartIfCompleteUnlocked({
    required String mediaId,
    String? url,
    int? knownTotal,
  }) async {
    final root = await _ensureRoot();
    // Fast path: complete object already on disk — never HEAD / never wait network.
    final existing = await _findCompleteOnDiskUnlocked(mediaId);
    if (existing != null) return existing;

    final part = File('${root.path}/$mediaId.part');
    if (!await part.exists()) return null;

    // Promote only with a trusted total (caller-known or HEAD). Never use .part
    // length alone as the object size.
    var total = knownTotal;
    if (total != null && total > 0) {
      _recordTrustedLength(mediaId, total);
    } else {
      total = _trustedLength[mediaId];
    }
    if ((total == null || total <= 0) && url != null && url.isNotEmpty) {
      final headed = await _headLength(url);
      if (headed != null && headed > 0) {
        _recordTrustedLength(mediaId, headed);
        total = headed;
      }
    }
    if (total == null || total <= 0) return null;
    if (!_isTrustedTotal(mediaId, total)) return null;

    final key = '${mediaId}_$total.mp4';
    final dest = File('${root.path}/$key');
    if (await dest.exists()) {
      final destLen = await dest.length();
      if (destLen == total) {
        _rememberComplete(mediaId: mediaId, key: key, dest: dest, total: total);
        return dest;
      }
    }
    final have = await part.length();
    if (have < total) return null;
    // Sniff HTML / error pages written into .part (Render 502, etc.).
    if (!await _looksLikeMp4(part)) {
      try {
        await part.delete();
      } catch (_) {}
      _diag(DiscoverVideoDiag(
        mediaId: mediaId,
        source: 'finalize_rejected',
        bytesReused: have,
        bytesDownloaded: 0,
        elapsedMs: 0,
        error: 'non_mp4_part',
      ));
      return null;
    }
    try {
      if (await dest.exists()) await dest.delete();
      await part.rename(dest.path);
    } on PathNotFoundException {
      if (await dest.exists() && await dest.length() == total) {
        _rememberComplete(mediaId: mediaId, key: key, dest: dest, total: total);
        return dest;
      }
      return null;
    } catch (e) {
      if (await dest.exists() && await dest.length() == total) {
        _rememberComplete(mediaId: mediaId, key: key, dest: dest, total: total);
        return dest;
      }
      _diag(DiscoverVideoDiag(
        mediaId: mediaId,
        source: 'finalize_error',
        bytesReused: have,
        bytesDownloaded: 0,
        elapsedMs: 0,
        error: '$e',
      ));
      return null;
    }
    _rememberComplete(mediaId: mediaId, key: key, dest: dest, total: total);
    _diag(DiscoverVideoDiag(
      mediaId: mediaId,
      source: 'finalize_part',
      bytesReused: have,
      bytesDownloaded: 0,
      elapsedMs: 0,
    ));
    return dest;
  }

  void _rememberComplete({
    required String mediaId,
    required String key,
    required File dest,
    required int total,
  }) {
    _recordTrustedLength(mediaId, total);
    final drop = <String>[];
    for (final e in _lru.entries) {
      if (e.value.mediaId == mediaId) drop.add(e.key);
    }
    for (final k in drop) {
      _lru.remove(k);
    }
    _lru[key] = _CacheMeta(
      key: key,
      mediaId: mediaId,
      contentLength: total,
      path: dest.path,
      complete: true,
      bytesOnDisk: total,
    );
    _touch(key);
  }

  /// Reject HTML/JSON error bodies that were persisted as `.part`.
  static Future<bool> _looksLikeMp4(File file) async {
    try {
      final raf = await file.open();
      try {
        final n = await raf.length();
        if (n < 12) return false;
        final buf = await raf.read(16);
        // HTML / XML error pages
        if (buf.isNotEmpty && (buf[0] == 0x3c /* < */ || buf[0] == 0x7b /* { */)) {
          return false;
        }
        // ftyp box at 4..8
        if (buf.length >= 8) {
          final typ = String.fromCharCodes(buf.sublist(4, 8));
          if (typ == 'ftyp') return true;
        }
        return true; // unknown but not HTML
      } finally {
        await raf.close();
      }
    } catch (_) {
      return false;
    }
  }

  /// Complete `{mediaId}_TOTAL.mp4` on disk without network / without write lock.
  Future<File?> _findCompleteOnDiskUnlocked(String mediaId) async {
    final root = await _ensureRoot();
    await _indexExisting(root);
    for (final e in List<MapEntry<String, _CacheMeta>>.from(_lru.entries)) {
      if (e.value.mediaId == mediaId && e.value.complete) {
        final f = File(e.value.path);
        if (!await f.exists()) continue;
        final len = e.value.contentLength;
        final size = await f.length();
        if (size != len || len <= 0) continue;
        if (_isTrustedTotal(mediaId, len)) {
          _touch(e.key);
          return f;
        }
        // Untrusted LRU entry (e.g. legacy *_1048576.mp4): require real MP4.
        if (!await _sniffMp4Complete(f)) continue;
        _recordTrustedLength(mediaId, len);
        _touch(e.key);
        return f;
      }
    }
    await for (final entity in root.list()) {
      if (entity is! File) continue;
      final name = entity.uri.pathSegments.isEmpty
          ? entity.path.split('/').last
          : entity.uri.pathSegments.last;
      final m = RegExp('^${RegExp.escape(mediaId)}_(\\d+)\\.mp4\$').firstMatch(name);
      if (m == null) continue;
      final len = int.tryParse(m.group(1)!) ?? 0;
      if (len <= 0) continue;
      final size = await entity.length();
      if (size != len) continue;
      if (_isTrustedTotal(mediaId, len)) {
        final key = name;
        _rememberComplete(mediaId: mediaId, key: key, dest: entity, total: len);
        return entity;
      }
      // Untrusted legacy name: require ftyp+moov so a truncated prefix is rejected.
      if (!await _sniffMp4Complete(entity)) continue;
      final key = name;
      _rememberComplete(mediaId: mediaId, key: key, dest: entity, total: len);
      return entity;
    }
    return null;
  }

  /// Minimal ftyp + moov presence check for legacy complete files.
  static Future<bool> _sniffMp4Complete(File file) async {
    try {
      final len = await file.length();
      if (len < 32) return false;
      final raf = await file.open();
      try {
        final head = await raf.read(64);
        if (head.length < 8) return false;
        final box = String.fromCharCodes(head.sublist(4, 8));
        if (box != 'ftyp') return false;
        // Scan a bounded window for moov (same idea as server sniffMedia).
        final window = math.min(len, 512 * 1024);
        await raf.setPosition(0);
        final buf = await raf.read(window);
        final needle = 'moov'.codeUnits;
        for (var i = 0; i <= buf.length - 4; i++) {
          if (buf[i] == needle[0] &&
              buf[i + 1] == needle[1] &&
              buf[i + 2] == needle[2] &&
              buf[i + 3] == needle[3]) {
            return true;
          }
        }
        return false;
      } finally {
        await raf.close();
      }
    } catch (_) {
      return false;
    }
  }

  /// Non-blocking peek: complete file already on disk. Never waits on the write
  /// lock and never promotes `.part` (that would serialize behind ensureLocal).
  Future<File?> peekComplete(String url) async {
    final mediaId = mediaIdFromUrl(url);
    if (mediaId == null) return null;
    return _findCompleteOnDiskUnlocked(mediaId);
  }

  /// Bytes already on disk for [url] (complete file or `.part` prefix).
  Future<int> bytesOnDiskFor(String url) async {
    final mediaId = mediaIdFromUrl(url);
    if (mediaId == null) return 0;
    final root = await _ensureRoot();
    await _indexExisting(root);
    for (final e in List<MapEntry<String, _CacheMeta>>.from(_lru.entries)) {
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
  ///
  /// [claimPriority] must be true only for the on-screen clip. Warm/neighbor
  /// opens pass false so they cannot steal the active full-GET slot.
  Future<DiscoverPlaySource> resolvePlaySource(
    String url, {
    bool claimPriority = true,
  }) async {
    final mediaId = mediaIdFromUrl(url);
    if (mediaId == null) {
      return DiscoverPlaySource.remote(url);
    }
    _originByMediaId[mediaId] = url;
    if (claimPriority) prioritize(url);

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
    for (final e in List<MapEntry<String, _CacheMeta>>.from(_lru.entries)) {
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

      // Never steal on-screen priority from a warm/neighbor proxy open.
      // Only [prioritize] / claimPriority attach designates the owner.
      var total = _trustedLength[mediaId] ?? _knownLength[mediaId];
      var file = await _openBodyFile(mediaId);
      var have = await file.length();

      if (total == null || total <= 0) {
        final headed = await _headLength(origin);
        if (headed != null && headed > 0) {
          _recordTrustedLength(mediaId, headed);
          total = headed;
        }
        // Do NOT fall back to `have` — a .part length is not the object size.
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

      // If we don't even have the first requested byte yet, kick a fill and wait
      // only until that byte lands — never for the full end.
      if (have <= start) {
        _kickFill(origin, mediaId);
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

      // Shared fill for the missing tail — full GET only for the priority clip.
      if (total == null || have < serveEnd + 1) {
        _kickFill(origin, mediaId);
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

  /// Opens a GET while isolating HttpClient's internal zone errors (aborted
  /// Range/stopAfterBytes can otherwise fail the surrounding test/zone).
  Future<HttpClientRequest> _openGet(Uri uri) {
    final done = Completer<HttpClientRequest>();
    runZonedGuarded(() async {
      try {
        done.complete(await _http.getUrl(uri));
        return;
      } catch (_) {
        try {
          _http.close(force: true);
        } catch (_) {}
        _http = HttpClient();
        try {
          done.complete(await _http.getUrl(uri));
        } catch (e, st) {
          if (!done.isCompleted) done.completeError(e, st);
        }
      }
    }, (e, st) {
      if (!done.isCompleted) {
        try {
          _http.close(force: true);
        } catch (_) {}
        _http = HttpClient();
        _http.getUrl(uri).then(done.complete, onError: done.completeError);
      }
    });
    return done.future;
  }

  Future<int?> _headLength(String url) async {
    try {
      final uri = Uri.tryParse(url);
      if (uri == null || !uri.hasScheme || uri.host.isEmpty) return null;
      late final HttpClientRequest head;
      try {
        head = await _http.headUrl(uri);
      } catch (_) {
        try {
          _http.close(force: true);
        } catch (_) {}
        _http = HttpClient();
        head = await _http.headUrl(uri);
      }
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
    for (final e in List<MapEntry<String, _CacheMeta>>.from(_lru.entries)) {
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
        // Complete may have renamed part away — disk read only (no lock wait).
        final done = await _findCompleteOnDiskUnlocked(mediaId);
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
    var networkBytesRead = 0;
    while (have < needBytes) {
      final uri = Uri.tryParse(origin);
      if (uri == null || !uri.hasScheme || uri.host.isEmpty) break;
      final HttpClientResponse resp;
      try {
        final req = await _openGet(uri);
        req.headers.set(HttpHeaders.acceptHeader, 'video/*,*/*');
        // Always Range with an explicit end so a prefix fill cannot become a
        // multi‑10 MB full GET (previous bug: bytes=0- / no Range drained the
        // whole object into the .part after needBytes).
        final wantEnd = needBytes - 1;
        req.headers.set(HttpHeaders.rangeHeader, 'bytes=$have-$wantEnd');
        resp = await req.close().timeout(const Duration(seconds: 20));
      } catch (_) {
        break;
      }
      final status = resp.statusCode;
      if (status != 200 && status != 206) {
        await abortHttpBody(resp);
        break;
      }
      if (status == 200) {
        // Server ignored Range — rewrite from byte 0, keep only the prefix.
        have = 0;
        // Full-object Content-Length is trusted only when clearly larger than
        // this prefix window (never record needBytes as the whole object).
        if (resp.contentLength > needBytes) {
          total = resp.contentLength;
          _recordTrustedLength(mediaId, resp.contentLength);
        }
      } else {
        // 206: ONLY Content-Range TOTAL is authoritative. Never use
        // have+contentLength (that records the window end as the whole file).
        final fromRange = contentRangeTotal(
          resp.headers.value(HttpHeaders.contentRangeHeader),
        );
        if (fromRange != null && fromRange > 0) {
          total = fromRange;
          _recordTrustedLength(mediaId, fromRange);
        }
        // else: total stays knownTotal/_knownLength or null (unknown).
      }
      final ctype = resp.headers.contentType?.mimeType ?? '';
      if (ctype.contains('html') || ctype.contains('json') || ctype.contains('text/')) {
        await abortHttpBody(resp);
        _diag(DiscoverVideoDiag(
          mediaId: mediaId,
          source: 'network_error',
          bytesReused: have,
          bytesDownloaded: 0,
          elapsedMs: 0,
          error: 'bad_content_type_$ctype',
        ));
        break;
      }
      final sink = part.openWrite(mode: have > 0 && status == 206 ? FileMode.append : FileMode.write);
      var reachedNeed = false;
      var abortedEarly = false;
      var sniffed = have > 0;
      try {
        await for (final chunk in resp) {
          networkBytesRead += chunk.length;
          if (reachedNeed) {
            // Should not happen — we abort as soon as needBytes lands.
            continue;
          }
          if (!sniffed && chunk.isNotEmpty) {
            sniffed = true;
            final b0 = chunk[0];
            if (b0 == 0x3c /* < */ || b0 == 0x7b /* { */) {
              await abortHttpBody(resp);
              try {
                await sink.close();
              } catch (_) {}
              try {
                await part.delete();
              } catch (_) {}
              _diag(DiscoverVideoDiag(
                mediaId: mediaId,
                source: 'network_error',
                bytesReused: 0,
                bytesDownloaded: 0,
                elapsedMs: 0,
                error: 'non_video_body',
              ));
              return _PrefixFill(
                file: part,
                bytesOnDiskBefore: before,
                bytesReused: before,
                bytesDownloaded: 0,
                contentLength: total,
              );
            }
          }
          var piece = chunk;
          if (have + chunk.length > needBytes) {
            piece = chunk.sublist(0, needBytes - have);
          }
          if (piece.isNotEmpty) {
            sink.add(piece);
            downloaded += piece.length;
            have += piece.length;
          }
          if (have >= needBytes) {
            reachedNeed = true;
            await sink.flush();
            await sink.close();
            // 200 ignore-Range: tear down so the rest of the object is not
            // pulled across the wire (gold-set stall: neighbor 25MB GET 200).
            await abortHttpBody(resp);
            abortedEarly = true;
            break;
          }
        }
        if (!abortedEarly) {
          await sink.flush();
          await sink.close();
        }
      } catch (_) {
        try {
          await sink.close();
        } catch (_) {}
        break;
      }
      have = await part.length();
      // Complete only when we truly have the whole object — never promote a
      // truncated prefix just because total was mis-recorded as the window size.
      if (total != null && total > 0 && have >= total) break;
      if (have >= needBytes) break;
      // If server sent only a partial window and we still need more, loop.
      if (downloaded > 0 && have < needBytes && status == 206) {
        continue;
      }
      break;
    }

    have = await part.length();
    lastPrefixStats = DiscoverPrefixFillStats(
      mediaId: mediaId,
      bytesOnDisk: have,
      bytesDownloaded: downloaded,
      networkBytesRead: networkBytesRead,
      contentLength: total,
      complete: total != null && total > 0 && have >= total,
    );
    if (total != null && total > 0 && have >= total && _isTrustedTotal(mediaId, total)) {
      final dest = await _finalizePartIfCompleteUnlocked(
        mediaId: mediaId,
        url: origin,
        knownTotal: total,
      );
      if (dest != null) {
        await _evictIfNeeded();
        return _PrefixFill(
          file: dest,
          bytesOnDiskBefore: before,
          bytesReused: before,
          bytesDownloaded: downloaded,
          contentLength: total,
        );
      }
    }

    _diag(DiscoverVideoDiag(
      mediaId: mediaId,
      source: before > 0 ? 'disk_resume' : 'network_to_disk',
      bytesReused: before,
      bytesDownloaded: downloaded,
      elapsedMs: 0,
      error: total == null ? 'total_unknown' : null,
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
    // Always merge disk files into the LRU — a non-empty map must not hide
    // complete clips written in a prior session (or by another isolate path).
    await for (final entity in root.list()) {
      if (entity is! File) continue;
      final name = entity.uri.pathSegments.isEmpty ? entity.path.split('/').last : entity.uri.pathSegments.last;
      final m = RegExp(r'^([0-9a-fA-F-]{36})_(\d+)\.mp4$').firstMatch(name);
      if (m == null) continue;
      final len = int.tryParse(m.group(2)!) ?? 0;
      final size = await entity.length();
      if (len <= 0 || size != len) continue;
      final key = m.group(0)!;
      if (_lru.containsKey(key)) continue;
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

    int? contentLength = _trustedLength[mediaId] ?? _knownLength[mediaId];
    contentLength ??= await _headLength(url);
    if (contentLength != null && contentLength > 0) {
      _recordTrustedLength(mediaId, contentLength);
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

    final uri = Uri.tryParse(url);
    if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
      return DiscoverCachedVideo.network(url: url, mediaId: mediaId, reason: 'bad_url');
    }
    final HttpClientRequest req;
    final HttpClientResponse resp;
    try {
      req = await _openGet(uri);
      req.headers.set(HttpHeaders.acceptHeader, 'video/*,*/*');
      if (have > 0) {
        req.headers.set(HttpHeaders.rangeHeader, 'bytes=$have-');
      }
      resp = await req.close().timeout(const Duration(seconds: 20));
    } on Object catch (e) {
      _diag(DiscoverVideoDiag(
        mediaId: mediaId,
        source: 'network_error',
        bytesReused: have,
        bytesDownloaded: 0,
        elapsedMs: DateTime.now().toUtc().difference(started).inMilliseconds,
        error: 'get_url_$e',
      ));
      return DiscoverCachedVideo.network(url: url, mediaId: mediaId, reason: 'get_url_error');
    }
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

    // 206: Content-Range TOTAL only. Never have+Content-Length (prefix windows
    // became *_1048576.mp4 and raced finalize — 6e153366 @ 13:34:31).
    int? total = contentLength;
    if (status == 206) {
      final fromRange = contentRangeTotal(
        resp.headers.value(HttpHeaders.contentRangeHeader),
      );
      if (fromRange != null && fromRange > 0) {
        total = fromRange;
        _recordTrustedLength(mediaId, fromRange);
      }
    } else if (resp.contentLength > 0 &&
        (stopAfterBytes == null || resp.contentLength > stopAfterBytes)) {
      total = resp.contentLength;
      _recordTrustedLength(mediaId, resp.contentLength);
    }

    final ctype = resp.headers.contentType?.mimeType ?? '';
    if (ctype.contains('html') || ctype.contains('json') || ctype.contains('text/')) {
      await abortHttpBody(resp);
      _diag(DiscoverVideoDiag(
        mediaId: mediaId,
        source: 'network_error',
        bytesReused: have,
        bytesDownloaded: 0,
        elapsedMs: DateTime.now().toUtc().difference(started).inMilliseconds,
        error: 'bad_content_type_$ctype',
      ));
      return DiscoverCachedVideo.network(
        url: url,
        mediaId: mediaId,
        reason: 'bad_content_type',
      );
    }

    final sink = part.openWrite(mode: have > 0 && status == 206 ? FileMode.append : FileMode.write);
    var downloaded = 0;
    final reused = have;
    var stoppedEarly = false;
    var sniffed = have > 0;
    try {
      await for (final chunk in resp) {
        if (!sniffed && chunk.isNotEmpty) {
          sniffed = true;
          final b0 = chunk[0];
          if (b0 == 0x3c /* < */ || b0 == 0x7b /* { */) {
            await abortHttpBody(resp);
            try {
              await sink.close();
            } catch (_) {}
            try {
              await part.delete();
            } catch (_) {}
            _diag(DiscoverVideoDiag(
              mediaId: mediaId,
              source: 'network_error',
              bytesReused: reused,
              bytesDownloaded: 0,
              elapsedMs: DateTime.now().toUtc().difference(started).inMilliseconds,
              error: 'non_video_body',
            ));
            return DiscoverCachedVideo.network(
              url: url,
              mediaId: mediaId,
              reason: 'non_video_body',
            );
          }
        }
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
    var expected = total ?? contentLength;
    if (expected != null && !_isTrustedTotal(mediaId, expected)) {
      expected = null;
    }
    if (expected == null || finalLen <= 0) {
      // Partial prefix is still useful for the proxy; do not claim complete.
      if (finalLen > 0) {
        return DiscoverCachedVideo(
          url: url,
          mediaId: mediaId,
          file: part,
          complete: false,
          fromDisk: reused > 0 && downloaded == 0,
          bytesOnDisk: finalLen,
          bytesDownloaded: downloaded,
          contentLength: total ?? contentLength,
        );
      }
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

    final dest = await _finalizePartIfCompleteUnlocked(
      mediaId: mediaId,
      url: url,
      knownTotal: expected,
    );
    if (dest == null) {
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

class DiscoverPrefixFillStats {
  const DiscoverPrefixFillStats({
    required this.mediaId,
    required this.bytesOnDisk,
    required this.bytesDownloaded,
    required this.networkBytesRead,
    this.contentLength,
    required this.complete,
  });

  final String mediaId;
  final int bytesOnDisk;
  final int bytesDownloaded;
  /// Bytes actually read from the HTTP body (should stay near [bytesDownloaded]
  /// when a 200 ignore-Range is aborted early).
  final int networkBytesRead;
  final int? contentLength;
  final bool complete;

  Map<String, Object?> toJson() => {
        'mediaId': mediaId,
        'bytesOnDisk': bytesOnDisk,
        'bytesDownloaded': bytesDownloaded,
        'networkBytesRead': networkBytesRead,
        'contentLength': contentLength,
        'complete': complete,
      };
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
