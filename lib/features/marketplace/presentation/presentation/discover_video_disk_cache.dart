import 'dart:async';
import 'dart:collection';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

/// Disk cache for Discover network videos.
///
/// Stable key = mediaId + contentLength (content version). A rotating signed URL
/// that still points at the same mediaId/length reuses the same file. A replaced
/// video (new length) invalidates the old entry via eviction.
///
/// Downloads are shared by mediaId: cancelling a warm *controller* never cancels
/// the HTTP fetch for that id.
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

  static String? mediaIdFromUrl(String url) {
    final uri = Uri.tryParse(url);
    if (uri == null) return null;
    final parts = uri.pathSegments;
    // .../marketplace/media/<uuid>
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

  /// Fire-and-forget prefetch. Safe to call repeatedly — joins the same download.
  void prefetch(String url) {
    // ignore: discarded_futures
    ensureLocal(url);
  }

  /// Returns a complete local file when possible. Joins any in-flight download
  /// for the same mediaId so swipe never restarts the HTTP request from zero.
  Future<DiscoverCachedVideo> ensureLocal(String url) async {
    final mediaId = mediaIdFromUrl(url);
    if (mediaId == null) {
      return DiscoverCachedVideo.network(url: url, reason: 'no_media_id');
    }

    final pending = _inflight[mediaId];
    if (pending != null) {
      return pending;
    }

    final future = _download(mediaId, url);
    _inflight[mediaId] = future;
    try {
      return await future;
    } finally {
      if (identical(_inflight[mediaId], future)) {
        _inflight.remove(mediaId);
      }
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

  Future<void> _indexExisting(Directory root) async {
    if (_lru.isNotEmpty) return;
    await for (final entity in root.list()) {
      if (entity is! File) continue;
      final name = entity.uri.pathSegments.isEmpty ? entity.path.split('/').last : entity.uri.pathSegments.last;
      // {mediaId}_{length}.mp4
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

  Future<DiscoverCachedVideo> _download(String mediaId, String url) async {
    final root = await _ensureRoot();
    await _indexExisting(root);
    final started = DateTime.now().toUtc();

    // Reuse complete file if we already know length via HEAD-less match:
    // try HEAD for authoritative length, then look up.
    int? contentLength;
    try {
      final head = await _http.headUrl(Uri.parse(url));
      head.headers.set(HttpHeaders.acceptHeader, 'video/*,*/*');
      final headResp = await head.close().timeout(const Duration(seconds: 8));
      contentLength = headResp.contentLength >= 0 ? headResp.contentLength : null;
      await headResp.drain<void>();
    } catch (_) {}

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

    // Resume partial .part if present.
    final part = File('${root.path}/$mediaId.part');
    var have = 0;
    if (await part.exists()) {
      have = await part.length();
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

    final total = resp.contentLength >= 0
        ? (status == 206 ? have + resp.contentLength : resp.contentLength)
        : contentLength;
    final sink = part.openWrite(mode: have > 0 && status == 206 ? FileMode.append : FileMode.write);
    var downloaded = 0;
    try {
      await for (final chunk in resp) {
        sink.add(chunk);
        downloaded += chunk.length;
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
        bytesReused: have,
        bytesDownloaded: downloaded,
        elapsedMs: DateTime.now().toUtc().difference(started).inMilliseconds,
        error: '$e',
      ));
      return DiscoverCachedVideo.network(url: url, mediaId: mediaId, reason: 'download_error');
    }

    final finalLen = await part.length();
    final expected = total ?? contentLength;
    if (expected == null || finalLen <= 0) {
      return DiscoverCachedVideo.network(url: url, mediaId: mediaId, reason: 'unknown_length');
    }
    if (finalLen < expected) {
      // Partial kept for resume — not safe as sole AVPlayer source on iOS.
      _diag(DiscoverVideoDiag(
        mediaId: mediaId,
        source: 'partial',
        bytesReused: have,
        bytesDownloaded: downloaded,
        elapsedMs: DateTime.now().toUtc().difference(started).inMilliseconds,
        error: 'incomplete_$finalLen/$expected',
      ));
      return DiscoverCachedVideo(
        url: url,
        mediaId: mediaId,
        file: part,
        complete: false,
        fromDisk: false,
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
      source: have > 0 ? 'disk_resume' : 'network_to_disk',
      bytesReused: have,
      bytesDownloaded: downloaded,
      elapsedMs: DateTime.now().toUtc().difference(started).inMilliseconds,
    ));
    return DiscoverCachedVideo(
      url: url,
      mediaId: mediaId,
      file: dest,
      complete: true,
      fromDisk: have > 0 && downloaded == 0,
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
      } catch (_) {}
      bytes -= meta.bytesOnDisk;
    }
  }
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
