import 'dart:async';
import 'dart:collection';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:video_player/video_player.dart';

import 'discover_device_file_log.dart';
import 'discover_video_disk_cache.dart';

/// Identity of one slide and one media item. The asset path is not enough:
/// two presentations may use the same file.
class PresentationSlot {
  const PresentationSlot(this.slideId, this.mediaIndex);

  final String slideId;
  final int mediaIndex;

  bool same(PresentationSlot other) => slideId == other.slideId && mediaIndex == other.mediaIndex;

  @override
  bool operator ==(Object other) => other is PresentationSlot && same(other);

  @override
  int get hashCode => Object.hash(slideId, mediaIndex);
}

enum PresentationPlayback { idle, loading, ready, failed }

/// Real player evidence: source-bound offer + media, not the visible card alone.
class DiscoverPlaybackEvent {
  const DiscoverPlaybackEvent({
    required this.type,
    required this.offerId,
    required this.mediaUrl,
    this.positionMs,
    required this.at,
  });

  /// `started` | `first_frame` | `first_frame_timeout` | `progressed` | `stopped`
  /// `first_frame`: swipe-settle → first visible progressing frame (ms).
  /// `first_frame_timeout`: settle→deadline with no progress (stall — not success).
  final String type;
  final String offerId;
  final String mediaUrl;
  final int? positionMs;
  final DateTime at;

  Map<String, Object?> toJson() => {
        'type': type,
        'offerId': offerId,
        'mediaUrl': mediaUrl,
        'positionMs': positionMs,
        'at': at.toUtc().toIso8601String(),
      };
}

abstract class PresentationVideoPort extends ChangeNotifier {
  void notifyPlayback() {
    if (!hasListeners) return;
    scheduleMicrotask(() {
      if (hasListeners) notifyListeners();
    });
  }

  PresentationSlot? get activeSlot;
  PresentationPlayback get playback;
  String? get errorText;
  bool get isPlaying;

  bool _muted = false;

  bool get isMuted => _muted;

  Future<void> setMuted(bool muted) async {
    _muted = muted;
    notifyPlayback();
  }

  Future<void> attach(PresentationSlot slot, String assetPath);

  /// Stops this slot only. A newer slot is left alone.
  Future<void> detach(PresentationSlot slot);

  /// Stops playback without dropping a newer request.
  Future<void> pause();

  /// Invalidates every in-flight request and releases the player.
  Future<void> release();

  Future<void> retry(PresentationSlot slot, String assetPath);

  Widget? buildView();
}

typedef AssetVideoControllerFactory = VideoPlayerController Function(String assetPath);

class AssetVideoPort extends PresentationVideoPort {
  AssetVideoPort({
    AssetVideoControllerFactory? createController,
    DiscoverVideoDiskCache? diskCache,
    String? sessionId,
  })  : sessionId = sessionId ??
            's${DateTime.now().toUtc().microsecondsSinceEpoch.toRadixString(36)}',
        _createController = createController,
        _diskCache = diskCache ??
            (createController == null ? DiscoverVideoDiskCache.instance : null);

  /// Correlates all swipe/cache/player logs for one Discover video session.
  final String sessionId;

  /// App build stamp for device log ↔ source matching (override via --dart-define=MIRA_BUILD=).
  static const String buildStamp = String.fromEnvironment(
    'MIRA_BUILD',
    defaultValue: '202611211600',
  );

  /// Test hook: shorten initialize timeout to hit the real TimeoutException branch.
  @visibleForTesting
  static Duration? debugInitializeTimeout;

  /// Test hook: await before creating/opening a cold controller (gates resolve).
  @visibleForTesting
  static Future<void> Function(String assetPath)? debugBeforeControllerOpen;

  /// When non-null (unit tests), paths are passed straight to this factory and
  /// disk cache is skipped.
  final AssetVideoControllerFactory? _createController;
  final DiscoverVideoDiskCache? _diskCache;

  static VideoPlayerController _defaultOpen(String assetPath) {
    final uri = Uri.tryParse(assetPath);
    if (uri != null && (uri.isScheme('http') || uri.isScheme('https'))) {
      return VideoPlayerController.networkUrl(uri);
    }
    if (assetPath.startsWith('/') || assetPath.startsWith('file:')) {
      final path = assetPath.startsWith('file:') ? Uri.parse(assetPath).toFilePath() : assetPath;
      return VideoPlayerController.file(File(path));
    }
    return VideoPlayerController.asset(assetPath);
  }

  /// Lightweight diagnostics for post-session review (not shown in customer UI).
  final List<Map<String, Object?>> playbackDiagnostics = <Map<String, Object?>>[];

  void _recordDiag(Map<String, Object?> row) {
    row.putIfAbsent('sessionId', () => sessionId);
    row.putIfAbsent('transitionId', () => _generation);
    row.putIfAbsent('build', () => buildStamp);
    row.putIfAbsent('playerId', () => _playerId(_controller));
    playbackDiagnostics.add(row);
    if (playbackDiagnostics.length > 60) {
      playbackDiagnostics.removeRange(0, playbackDiagnostics.length - 60);
    }
  }

  VideoPlayerController? _controller;
  String? _activePath;
  VideoPlayerController? _warm;
  String? _warmPath;
  Future<void>? _warmFuture;
  /// Completes when the warm controller is initialized (before mute-prime).
  /// Attach waits on this — never on the full mute-prime — so a slow prime
  /// cannot hold the dark cover for multi-second claim rejection cycles.
  Completer<void>? _warmInitialized;
  VideoPlayerController? _parked;
  String? _parkedPath;
  /// Extra initialized decoders for recently left clips (by mediaId), max 2.
  /// Survives beyond the single [_parked] slot so return-after-N is still local.
  final Map<String, VideoPlayerController> _preparedByMediaId = {};
  final List<String> _preparedOrder = [];
  /// Keep enough decoders for return-after-N and cross-lane revisits.
  static const int _maxPrepared = 12;
  /// MediaIds that reached a visible frame — evicted last from the prepared pool.
  final LinkedHashSet<String> _stickyMediaIds = LinkedHashSet<String>();
  int _generation = 0;
  bool _released = false;
  String? _lastOfferId;
  String? _lastMediaUrl;
  DateTime? _lastProgressAt;
  DateTime? _settleStartedAt;
  /// Position floor for progress accounting — scoped to [ _progressAttemptId ] +
  /// [ _progressPlayerId ]. Seek landing alone must not clear the cover gate.
  Duration _progressFloor = Duration.zero;
  int? _progressAttemptId;
  int? _progressPlayerId;
  bool _seekInFlight = false;
  /// Attempt that currently owns [_seekInFlight] — stale finally must not clear a newer seek.
  int? _seekOwnerAttemptId;
  bool _firstFrameEmitted = false;
  bool _firstFrameTimedOut = false;
  bool _hasVisibleProgress = false;
  /// Single shared unmute Future per attempt — prevents double unmute_req.
  Future<void>? _audioArmInFlight;
  int? _audioArmAttemptId;
  /// Attempt currently being attached (for accounting across detach/supersede).
  int? _activeAttemptId;
  /// Outcomes keyed by attemptId — never rewritten by a later attach's phases map.
  final Map<int, String> _attemptOutcomes = <int, String>{};
  final Set<int> _attemptStarts = <int>{};
  @visibleForTesting
  static int debugAttemptStartCount = 0;
  @visibleForTesting
  static int debugAttemptEndCount = 0;
  @visibleForTesting
  static void debugResetAttemptCounters() {
    debugAttemptStartCount = 0;
    debugAttemptEndCount = 0;
  }
  final List<DiscoverPlaybackEvent> playbackEvents = <DiscoverPlaybackEvent>[];

  /// Source URL bound to the controller (null when no video attached).
  String? get activeMediaUrl => _activePath;

  /// True after position advanced past the attempt-scoped floor (not a drawn frame).
  /// Device screen recording is required to prove pixels; this is position proof only.
  bool get hasVisibleProgress => _hasVisibleProgress;

  String get _appLifecycleLabel {
    final state = WidgetsBinding.instance.lifecycleState;
    return switch (state) {
      AppLifecycleState.resumed => 'fg',
      AppLifecycleState.inactive => 'inactive',
      AppLifecycleState.hidden => 'hidden',
      AppLifecycleState.paused => 'bg',
      AppLifecycleState.detached => 'detached',
      null => 'unknown',
    };
  }

  String _sourceKindLabel() {
    final claim = lastAttachPhases['source'] ?? 0;
    final cache = lastAttachPhases['cacheSource'];
    if (claim == 1) return 'warm';
    if (claim == 2) return 'parked';
    if (claim == 3) return 'prepared';
    if (cache == 3) return 'complete_file';
    if (cache == 4) return 'partial_proxy';
    return 'cold_new';
  }

  void _bindProgressGuard({
    required int attemptId,
    required int playerId,
    required Duration floor,
  }) {
    _progressAttemptId = attemptId;
    _progressPlayerId = playerId;
    _progressFloor = floor;
    _seekInFlight = false;
  }

  bool _progressGuardMatches(VideoPlayerController controller, int? attemptId) {
    if (attemptId == null || _progressAttemptId == null) return false;
    if (attemptId != _progressAttemptId) return false;
    if (_progressPlayerId != _playerId(controller)) return false;
    return true;
  }

  /// True when settle→deadline elapsed with no progressing frame.
  bool get firstFrameTimedOut => _firstFrameTimedOut;

  /// Phase timings (ms from swipe settle) for the latest [attach].
  /// Keys: warmClaimed | initStart | initDone | playStart | firstFrame | firstByteProxy
  /// `firstByteProxy` = initDone (player reports initialized; no raw HTTP byte hook).
  Map<String, int?> lastAttachPhases = <String, int?>{};

  int _msSince(DateTime settle) => DateTime.now().toUtc().difference(settle).inMilliseconds;

  void _emitPlayback(String type, {int? positionMs, String? offerId, String? mediaUrl}) {
    final oid = offerId ?? activeSlot?.slideId ?? _lastOfferId ?? '';
    final url = mediaUrl ?? _activePath ?? _lastMediaUrl ?? '';
    if (oid.isNotEmpty) _lastOfferId = oid;
    if (url.isNotEmpty) _lastMediaUrl = url;
    playbackEvents.add(
      DiscoverPlaybackEvent(
        type: type,
        offerId: oid,
        mediaUrl: url,
        positionMs: positionMs,
        at: DateTime.now().toUtc(),
      ),
    );
  }

  @override
  Future<void> setMuted(bool muted) async {
    final gen = _generation;
    final controller = _controller;
    final attemptId = _activeAttemptId ?? lastAttachPhases['attemptId'];
    _muted = muted;
    if (controller != null) {
      await controller.setVolume(muted ? 0 : 1);
      if (gen != _generation || !identical(_controller, controller)) {
        _notify();
        return;
      }
      if (!muted &&
          attemptId != null &&
          lastAttachPhases['attemptId'] == attemptId &&
          _hasVisibleProgress) {
        lastAttachPhases['audioArmed'] ??=
            _settleStartedAt == null ? 0 : _msSince(_settleStartedAt!);
      }
    }
    _notify();
  }

  bool _canStart(VideoPlayerController controller, int token) {
    return token == _generation && !_released && _controller == controller;
  }

  @override
  PresentationSlot? activeSlot;

  @override
  PresentationPlayback playback = PresentationPlayback.idle;

  @override
  String? errorText;

  @override
  bool get isPlaying => _controller?.value.isPlaying ?? false;

  Future<void> _dropIfStale(VideoPlayerController controller, int token) async {
    // Still the live attempt for this controller — keep it.
    if (token == _generation && !_released && identical(_controller, controller)) {
      return;
    }
    // A newer attempt (or park/warm/prepared) still holds this object — never
    // clear slots or dispose. Video→image→video often reuses the same instance;
    // identity alone must not look like "safe to tear down".
    if (identical(_controller, controller) ||
        identical(_warm, controller) ||
        identical(_parked, controller) ||
        _preparedByMediaId.containsValue(controller)) {
      return;
    }
    try {
      await controller.pause();
    } catch (_) {}
    try {
      await controller.dispose();
    } catch (_) {}
  }

  bool _isLiveAttempt(int token, int attemptId) =>
      !_released &&
      token == _generation &&
      lastAttachPhases['attemptId'] == attemptId;

  Duration get _initializeTimeout =>
      debugInitializeTimeout ?? const Duration(seconds: 6);

  /// Dispose a controller this attempt opened only if nothing live still holds it.
  Future<void> _disposeOwnedIfUnused(VideoPlayerController? controller) async {
    if (controller == null) return;
    if (identical(_controller, controller) ||
        identical(_warm, controller) ||
        identical(_parked, controller) ||
        _preparedByMediaId.containsValue(controller)) {
      return;
    }
    try {
      await controller.pause();
    } catch (_) {}
    try {
      await controller.dispose();
    } catch (_) {}
  }

  void _notify() => notifyPlayback();

  VideoPlayerController _openRaw(String assetPath) {
    final factory = _createController;
    if (factory != null) return factory(assetPath);
    return _defaultOpen(assetPath);
  }

  /// Resolves HTTP media through the disk cache.
  ///
  /// Complete files open via [VideoPlayerController.file]. Partial prefixes open
  /// via the cache loopback Range proxy so AVPlayer reads local bytes first and
  /// the same download path appends only the missing tail — never a cold origin
  /// GET from byte 0 in parallel with the cache.
  Future<VideoPlayerController> _openResolved(
    String assetPath, {
    required bool waitForDisk,
    bool claimPriority = true,
    bool fullFill = true,
    Map<String, int?>? phases,
  }) async {
    final cache = _diskCache;
    final uri = Uri.tryParse(assetPath);
    final isHttp = uri != null && (uri.isScheme('http') || uri.isScheme('https'));
    if (cache == null || !isHttp || _createController != null) {
      phases?['cacheSource'] = 0;
      return _openRaw(assetPath);
    }

    // waitForDisk kept for call-site compatibility; partials are playable via
    // proxy immediately, so we no longer block up to 2200ms on a full GET.
    phases?['waitForDisk'] = waitForDisk ? 1 : 0;
    final resolveSw = Stopwatch()..start();
    final source = await cache.resolvePlaySource(
      assetPath,
      claimPriority: claimPriority,
    );
    phases?['peekResolveMs'] = resolveSw.elapsedMilliseconds;
    if (source.isFile && source.file != null) {
      phases?['cacheSource'] = 3;
      phases?['cacheBytes'] = source.bytesOnDisk;
      phases?['cacheBytesAtOpen'] = source.bytesOnDisk;
      _recordDiag({
        'mediaId': source.mediaId,
        'source': 'disk',
        'bytesReused': source.bytesOnDisk,
        'bytesDownloaded': 0,
      });
      return VideoPlayerController.file(source.file!);
    }
    if (source.isProxy && source.uri != null) {
      // Device T41 (1713): active ensureLocal under the write lock overlapped
      // AVPlayer.initialize (~3s). Kick prefix-only while the player opens;
      // full object fill runs after first visible progress (prefetchDisk).
      cache.prefetch(assetPath, lowPriority: true);
      if (fullFill) {
        phases?['fullFillDeferred'] = 1;
      }
      phases?['cacheSource'] = 4; // loopback proxy over partial/complete fill
      phases?['cacheBytesAtOpen'] = source.bytesOnDisk;
      // Keep cacheBytes as the open-time snapshot — never rewrite after the fact.
      phases?['cacheBytes'] ??= source.bytesOnDisk;
      _recordDiag({
        'mediaId': source.mediaId,
        'source': 'proxy_partial',
        'bytesReused': source.bytesOnDisk,
        'bytesDownloaded': 0,
        'playUrl': source.uri.toString(),
        'fullFill': fullFill ? 1 : 0,
        'fullFillDeferred': fullFill ? 1 : 0,
      });
      return VideoPlayerController.networkUrl(source.uri!);
    }

    phases?['cacheSource'] = 0;
    _recordDiag({
      'mediaId': DiscoverVideoDiskCache.mediaIdFromUrl(assetPath),
      'source': 'network',
      'bytesReused': 0,
      'bytesDownloaded': 0,
      'error': 'no_play_source',
    });
    return _openRaw(assetPath);
  }

  /// Prefetch bytes to disk without creating a decoder (shared by mediaId).
  void prefetchDisk(String assetPath, {bool lowPriority = false}) {
    _diskCache?.prefetch(assetPath, lowPriority: lowPriority);
  }

  int _playerId(VideoPlayerController? c) =>
      c == null ? 0 : identityHashCode(c);

  Future<void> _silence(
    VideoPlayerController controller, {
    String role = 'unknown',
  }) async {
    final id = _playerId(controller);
    final t0 = DateTime.now().toUtc();
    try {
      // Volume first so a late play() tick cannot briefly leak audio.
      miraDiscoverLog(
        'MIRA_DISCOVER_AUDIO mute_req playerId=$id role=$role '
        'at=${t0.toIso8601String()}',
      );
      await controller.setVolume(0);
      final tVol = DateTime.now().toUtc();
      miraDiscoverLog(
        'MIRA_DISCOVER_AUDIO mute_done playerId=$id role=$role '
        'ms=${tVol.difference(t0).inMilliseconds}',
      );
      await controller.pause();
      final tPause = DateTime.now().toUtc();
      miraDiscoverLog(
        'MIRA_DISCOVER_AUDIO pause_done playerId=$id role=$role '
        'ms=${tPause.difference(t0).inMilliseconds}',
      );
      _recordDiag({
        'event': 'audio_silence',
        'playerId': id,
        'role': role,
        'muteMs': tVol.difference(t0).inMilliseconds,
        'pauseMs': tPause.difference(t0).inMilliseconds,
        'at': t0.toIso8601String(),
      });
    } catch (e) {
      miraDiscoverLog('MIRA_DISCOVER_AUDIO silence_err playerId=$id role=$role err=$e');
    }
  }

  /// Nomas-style hard cut: kill outgoing audio immediately on swipe settle,
  /// before any warm/init await. Awaits mute+pause so overlap can be proven.
  ///
  /// [ownerSlot]: when set, refuse to cut unless [activeSlot] still matches —
  /// adjacent/inactive pages must not mute the visible clip's player.
  /// [generation]: when set, abort if a newer attach already advanced [_generation].
  Future<void> cutOutgoingAudio({
    String? nextMediaUrl,
    PresentationSlot? ownerSlot,
    int? generation,
  }) async {
    if (ownerSlot != null) {
      final active = activeSlot;
      if (active == null || !active.same(ownerSlot)) {
        miraDiscoverLog(
          'MIRA_DISCOVER_AUDIO cut_skipped reason=not_owner '
          'owner=${ownerSlot.slideId}/${ownerSlot.mediaIndex} '
          'active=${active?.slideId}/${active?.mediaIndex}',
        );
        return;
      }
    }
    if (generation != null && generation != _generation) {
      miraDiscoverLog(
        'MIRA_DISCOVER_AUDIO cut_skipped reason=stale_generation '
        'cutGen=$generation live=$_generation',
      );
      return;
    }
    final prevPath = _activePath;
    final prevOffer = activeSlot?.slideId;
    final futures = <Future<void>>[];
    final active = _controller;
    if (active != null) {
      futures.add(_silence(active, role: 'active'));
    }
    final warm = _warm;
    if (warm != null && !_sameMedia(_warmPath, nextMediaUrl)) {
      futures.add(_silence(warm, role: 'warm'));
    }
    final parked = _parked;
    if (parked != null) {
      futures.add(_silence(parked, role: 'parked'));
    }
    for (final c in _preparedByMediaId.values) {
      futures.add(_silence(c, role: 'prepared'));
    }
    if (futures.isNotEmpty) {
      try {
        await Future.wait(futures);
      } catch (e) {
        miraDiscoverLog('MIRA_DISCOVER_AUDIO cut_wait_err err=$e');
        _recordDiag({
          'event': 'audio_cut_error',
          'error': '$e',
          'at': DateTime.now().toUtc().toIso8601String(),
        });
      }
    }
    // Ownership may have moved to a newer attach during the mute await.
    if (generation != null && generation != _generation) {
      miraDiscoverLog(
        'MIRA_DISCOVER_AUDIO cut_stale_after_wait '
        'cutGen=$generation live=$_generation',
      );
      return;
    }
    if (ownerSlot != null) {
      final activeNow = activeSlot;
      if (activeNow == null || !activeNow.same(ownerSlot)) {
        miraDiscoverLog(
          'MIRA_DISCOVER_AUDIO cut_stale_owner_after_wait '
          'owner=${ownerSlot.slideId}/${ownerSlot.mediaIndex}',
        );
        return;
      }
    }
    final audibleAfter = audiblePlayingCount;
    _recordDiag({
      'event': 'audio_cut',
      'prevOffer': prevOffer,
      'prevMediaId': _mediaIdOf(prevPath),
      'nextMediaId': _mediaIdOf(nextMediaUrl),
      'audiblePlaying': audibleAfter,
      'activePlayerId': _playerId(active),
      'ownerOk': ownerSlot == null ? 1 : (activeSlot?.same(ownerSlot) == true ? 1 : 0),
      'at': DateTime.now().toUtc().toIso8601String(),
    });
    miraDiscoverLog(
      'MIRA_DISCOVER_SWIPE audio_cut prev=${_mediaIdOf(prevPath)} '
      'next=${_mediaIdOf(nextMediaUrl)} audible=$audibleAfter '
      'activePlayerId=${_playerId(active)}',
    );
  }

  /// Controllers that are both playing and not fully muted (leak detector).
  int get audiblePlayingCount {
    var n = 0;
    void check(VideoPlayerController? c) {
      if (c == null) return;
      try {
        final v = c.value;
        if (v.isPlaying && v.volume > 0.01) n += 1;
      } catch (_) {}
    }
    check(_controller);
    check(_warm);
    check(_parked);
    for (final c in _preparedByMediaId.values) {
      check(c);
    }
    return n;
  }

  String? _mediaIdOf(String? path) {
    if (path == null || path.isEmpty) return null;
    return DiscoverVideoDiskCache.mediaIdFromUrl(path);
  }

  bool _sameMedia(String? a, String? b) {
    if (a == null || b == null || a.isEmpty || b.isEmpty) return false;
    if (a == b) return true;
    final idA = _mediaIdOf(a);
    final idB = _mediaIdOf(b);
    return idA != null && idA == idB;
  }

  Future<void> _stashPrepared(String? path, VideoPlayerController controller) async {
    final id = _mediaIdOf(path);
    if (id == null || !controller.value.isInitialized || controller.value.hasError) {
      await _silence(controller);
      await controller.dispose();
      return;
    }
    await _silence(controller);
    final existing = _preparedByMediaId[id];
    if (existing != null && existing != controller) {
      await existing.dispose();
    }
    _preparedByMediaId[id] = controller;
    _preparedOrder.remove(id);
    _preparedOrder.add(id);
    while (_preparedOrder.length > _maxPrepared) {
      // Evict non-sticky first so return-to-watched keeps its decoder.
      String? evictId;
      for (final candidate in _preparedOrder) {
        if (!_stickyMediaIds.contains(candidate)) {
          evictId = candidate;
          break;
        }
      }
      evictId ??= _preparedOrder.isEmpty ? null : _preparedOrder.first;
      if (evictId == null) break;
      _preparedOrder.remove(evictId);
      final evict = _preparedByMediaId.remove(evictId);
      if (evict != null && evict != controller) {
        await evict.dispose();
      }
    }
  }

  /// Called when the Discover section route is popped. Parks the active clip,
  /// pins its disk bytes, and keeps the prepared pool — do NOT [release].
  Future<void> leaveSection() async {
    if (_released) return;
    final active = _controller;
    final path = _activePath;
    final slot = activeSlot;
    final hadFrame = _hasVisibleProgress;
    final settle = _settleStartedAt;
    await cutOutgoingAudio();
    if (active != null) {
      final ms = settle == null
          ? null
          : DateTime.now().toUtc().difference(settle).inMilliseconds;
      if (!hadFrame && path != null && path.isNotEmpty) {
        _emitPlayback('left_dark', positionMs: ms, offerId: slot?.slideId, mediaUrl: path);
        _recordDiag({
          'event': 'left_dark',
          'offerId': slot?.slideId,
          'mediaId': _mediaIdOf(path),
          'dwellMs': ms,
          'claimSource': lastAttachPhases['source'],
          'cacheSource': lastAttachPhases['cacheSource'],
          'cacheBytes': lastAttachPhases['cacheBytes'],
          'audiblePlaying': audiblePlayingCount,
          'at': DateTime.now().toUtc().toIso8601String(),
        });
        miraDiscoverLog(
          'MIRA_DISCOVER_SWIPE left_dark mediaId=${_mediaIdOf(path)} '
          'offer=${slot?.slideId} dwellMs=$ms '
          'claim=${lastAttachPhases['source']} cache=${lastAttachPhases['cacheSource']} '
          'bytes=${lastAttachPhases['cacheBytes']} audible=$audiblePlayingCount',
        );
      }
      if (path != null && path.isNotEmpty) {
        // Ensure full object lands so the next section visit opens a file, not .part.
        prefetchDisk(path);
        // ignore: discarded_futures
        _diskCache?.finalizePartIfComplete(path);
      }
      _controller = null;
      _activePath = null;
      activeSlot = null;
      playback = PresentationPlayback.idle;
      _hasVisibleProgress = false;
      _notify();
      await _parkLeaving(active, path);
    }
    if (_parkedPath != null && _parkedPath!.isNotEmpty) {
      prefetchDisk(_parkedPath!);
      // ignore: discarded_futures
      _diskCache?.finalizePartIfComplete(_parkedPath!);
    }
    for (final id in List<String>.from(_preparedByMediaId.keys)) {
      final c = _preparedByMediaId[id];
      if (c == null) continue;
      try {
        prefetchDisk(c.dataSource);
        // ignore: discarded_futures
        _diskCache?.finalizePartIfComplete(c.dataSource);
      } catch (_) {}
    }
    miraDiscoverLog(
      'MIRA_DISCOVER_SWIPE leave_section parked=${_mediaIdOf(_parkedPath)} '
      'prepared=${_preparedOrder.length} sticky=${_stickyMediaIds.length}',
    );
  }

  VideoPlayerController? _takePrepared(String assetPath) {
    final id = _mediaIdOf(assetPath);
    if (id == null) return null;
    final c = _preparedByMediaId.remove(id);
    _preparedOrder.remove(id);
    return c;
  }

  /// Parks the clip just left for a fast swipe-back.
  ///
  /// Always keep one parked decoder for the previous mediaId — even while a
  /// warm next exists. Disposing on warm (old behaviour) forced a cold
  /// initialize (~2–3s) on immediate swipe-back despite bytes already on disk.
  /// Prior parked moves into a small prepared pool (max 2) instead of dispose.
  Future<void> _parkLeaving(VideoPlayerController leaving, String? path) async {
    if (path == null || path.isEmpty || !leaving.value.isInitialized) {
      await _silence(leaving);
      await leaving.dispose();
      return;
    }
    await _silence(leaving);
    final old = _parked;
    final oldPath = _parkedPath;
    _parked = leaving;
    _parkedPath = path;
    if (old != null && old != leaving) {
      await _stashPrepared(oldPath, old);
    }
  }

  @override
  Future<void> attach(PresentationSlot slot, String assetPath) async {
    if (_released) return;
    // Clock starts at swipe settle — before waiting on warm/park/previous dispose.
    final settleStarted = DateTime.now().toUtc();
    _settleStartedAt = settleStarted;
    final leavingAttempt = _activeAttemptId;
    if (leavingAttempt != null && !_attemptOutcomes.containsKey(leavingAttempt)) {
      _endAttempt(leavingAttempt, outcome: 'superseded', mediaId: _mediaIdOf(_activePath ?? ''));
    }
    _progressFloor = Duration.zero;
    _progressAttemptId = null;
    _progressPlayerId = null;
    // Do not clear _seekInFlight here if a stale seek's finally must no-op via owner id.
    _seekOwnerAttemptId = null;
    _seekInFlight = false;
    _audioArmInFlight = null;
    _audioArmAttemptId = null;
    _firstFrameEmitted = false;
    _firstFrameTimedOut = false;
    _hasVisibleProgress = false;
    // Per-attempt phase map — stale completions write here only, never into B's map.
    final phases = <String, int?>{
      'warmClaimed': null,
      'initStart': null,
      'initDone': null,
      'firstByteProxy': null,
      'playStart': null,
      'firstFrame': null,
      'audioArmed': null,
      'source': null,
    };
    lastAttachPhases = phases;
    final token = ++_generation;
    final previous = _controller;
    final previousPath = _activePath;
    final attemptId = DateTime.now().toUtc().microsecondsSinceEpoch;
    phases['attemptId'] = attemptId;
    _beginAttempt(
      attemptId,
      mediaId: _mediaIdOf(assetPath),
      offerId: slot.slideId,
      gen: token,
    );
    // Critical (Nomas parity): cut previous audio BEFORE awaiting warm init.
    // Pass generation so a delayed cut cannot keep mutating after a newer attach.
    await cutOutgoingAudio(nextMediaUrl: assetPath, generation: token);
    if (!_isLiveAttempt(token, attemptId)) {
      _endAttempt(attemptId, outcome: 'superseded', mediaId: _mediaIdOf(assetPath));
      return;
    }
    phases['audioCut'] = _msSince(settleStarted);
    phases['prevPlayerId'] = _playerId(previous);
    // Prioritize BEFORE any kick so this media is not treated as a neighbor.
    // Prefix-only during open — full ensureLocal under the write lock raced
    // AVPlayer.initialize on device T41 (~3s init / firstFrameMs=4009).
    _diskCache?.prioritize(assetPath);
    prefetchDisk(assetPath, lowPriority: true);
    // Promote a finished .part only when we do not already have a trusted complete
    // — otherwise finalize holds the write lock (~350ms) while cold open peeks.
    // ignore: discarded_futures
    () async {
      final existing = await _diskCache?.peekComplete(assetPath);
      if (existing != null) return;
      await _diskCache?.finalizePartIfComplete(assetPath);
    }();
    _controller = null;
    _activePath = null;
    activeSlot = slot;
    playback = PresentationPlayback.loading;
    errorText = null;
    _notify();

    VideoPlayerController? claimed;
    var claimedReady = false;
    var claimSource = 'cold';
    final wantId = _mediaIdOf(assetPath);
    phases['mediaIdHash'] = wantId?.hashCode;
    if (_sameMedia(_warmPath, assetPath)) {
      // Prefer an already-open warm surface immediately — do NOT await mute-prime.
      // Awaiting warmFuture used to burn 2.5s then dispose on "never advanced",
      // forcing a cold reopen under the dark cover (10s wedding-dress stall).
      if (_warm == null || !_warm!.value.isInitialized) {
        final initWait = _warmInitialized?.future;
        if (initWait != null) {
          try {
            await initWait.timeout(const Duration(milliseconds: 900));
          } catch (_) {}
        } else {
          final pending = _warmFuture;
          if (pending != null) {
            try {
              await pending.timeout(const Duration(milliseconds: 900));
            } catch (_) {}
          }
        }
      }
      // Re-check before claiming _warm — a newer attach may have taken it.
      if (!_isLiveAttempt(token, attemptId)) {
        _endAttempt(attemptId, outcome: 'superseded', mediaId: wantId);
        return;
      }
      if (!_sameMedia(_warmPath, assetPath)) {
        // Warm slot moved to another URL while we waited — fall through to cold.
        claimed = null;
        claimedReady = false;
        claimSource = 'cold';
      } else {
        claimed = _warm;
        _warm = null;
        _warmPath = null;
        // Leave _warmFuture running so mute-prime can finish/silence itself; clear
        // the initialized gate so a later warm() for another URL starts clean.
        _warmInitialized = null;
        _warmFuture = null;
        if (claimed == null ||
            !claimed.value.isInitialized ||
            claimed.value.hasError) {
          phases['warmRejected'] = _msSince(settleStarted);
          if (claimed != null) {
            await _disposeOwnedIfUnused(claimed);
          }
          claimed = null;
          claimedReady = false;
          claimSource = 'cold';
        } else {
          // Accept warm even at position 0 — attach's first-frame wait advances it.
          claimedReady = true;
          claimSource = 'warm';
          phases['warmClaimed'] = _msSince(settleStarted);
          phases['warmPosMs'] = claimed.value.position.inMilliseconds;
        }
      }
    } else if (_sameMedia(_parkedPath, assetPath) && _parked != null) {
      if (!_isLiveAttempt(token, attemptId)) {
        _endAttempt(attemptId, outcome: 'superseded', mediaId: wantId);
        return;
      }
      claimed = _parked;
      _parked = null;
      _parkedPath = null;
      claimedReady = claimed?.value.isInitialized ?? false;
      claimSource = 'parked';
      phases['warmClaimed'] = _msSince(settleStarted);
    } else {
      final prepared = _takePrepared(assetPath);
      if (prepared != null) {
        if (!_isLiveAttempt(token, attemptId)) {
          await _disposeOwnedIfUnused(prepared);
          _endAttempt(attemptId, outcome: 'superseded', mediaId: wantId);
          return;
        }
        claimed = prepared;
        claimedReady = prepared.value.isInitialized && !prepared.value.hasError;
        claimSource = claimedReady ? 'prepared' : 'cold';
        if (!claimedReady) {
          await _disposeOwnedIfUnused(prepared);
          claimed = null;
        } else {
          phases['warmClaimed'] = _msSince(settleStarted);
        }
      }
    }
    phases['source'] = switch (claimSource) {
      'warm' => 1,
      'parked' => 2,
      'prepared' => 3,
      _ => 0,
    };
    if (!_isLiveAttempt(token, attemptId)) {
      await _disposeOwnedIfUnused(claimed);
      _endAttempt(attemptId, outcome: 'superseded', mediaId: wantId);
      return;
    }
    if (previous != null && previous != claimed) {
      // Already silenced above — park/stash without blocking first-frame path.
      // ignore: discarded_futures
      _parkLeaving(previous, previousPath);
    }
    if (!_isLiveAttempt(token, attemptId)) {
      await _disposeOwnedIfUnused(claimed);
      _endAttempt(attemptId, outcome: 'superseded', mediaId: wantId);
      return;
    }

    // Keep an in-flight warm/parked controller — never dispose and re-open the same URL.
    // Previous bug: swipe during warm disposed the half-ready player → cold 1.5–3s path.
    late final VideoPlayerController controller;
    if (claimed != null) {
      controller = claimed;
      if (!claimedReady) {
        phases['initStart'] = phases['warmClaimed'] ?? _msSince(settleStarted);
      }
    } else {
      // Prefer complete disk file (rewind after many swipes) without blocking the
      // first-ever play on a full download — network plays while bytes land.
      phases['resolveStart'] = _msSince(settleStarted);
      final beforeOpen = debugBeforeControllerOpen;
      if (beforeOpen != null) {
        await beforeOpen(assetPath);
      }
      if (!_isLiveAttempt(token, attemptId)) {
        _endAttempt(attemptId, outcome: 'superseded', mediaId: wantId);
        return;
      }
      controller = await _openResolved(
        assetPath,
        waitForDisk: false,
        phases: phases,
      );
      if (!_isLiveAttempt(token, attemptId)) {
        await _disposeOwnedIfUnused(controller);
        _endAttempt(attemptId, outcome: 'superseded', mediaId: wantId);
        return;
      }
      phases['resolveDone'] = _msSince(settleStarted);
    }
    _controller = controller;
    _activePath = assetPath;
    _recordDiag({
      'event': 'attach_open',
      'claimSource': claimSource,
      'mediaId': wantId,
      'cacheSource': phases['cacheSource'],
      'cacheBytes': phases['cacheBytes'],
      'resolveMs': phases['resolveDone'] == null || phases['resolveStart'] == null
          ? null
          : (phases['resolveDone']! - phases['resolveStart']!),
      'ms': _msSince(settleStarted),
    });
    controller.addListener(() => _onController(controller, token));
    try {
      if (!controller.value.isInitialized) {
        phases['initStart'] ??= _msSince(settleStarted);
        try {
          await controller.initialize().timeout(_initializeTimeout);
        } on TimeoutException {
          phases['initTimeoutMs'] = _msSince(settleStarted);
          _endAttempt(attemptId, outcome: 'timeout', mediaId: wantId);
          // Only fail shared playback state if this attempt is still live.
          if (_isLiveAttempt(token, attemptId) && identical(_controller, controller)) {
            _firstFrameTimedOut = true;
            _emitPlayback(
              'first_frame_timeout',
              positionMs: _msSince(settleStarted),
              offerId: slot.slideId,
              mediaUrl: assetPath,
            );
            playback = PresentationPlayback.failed;
            errorText = 'تعذر تشغيل الفيديو';
            _notify();
          } else {
            await _disposeOwnedIfUnused(controller);
          }
          return;
        }
        if (!_isLiveAttempt(token, attemptId)) {
          await _disposeOwnedIfUnused(controller);
          _endAttempt(attemptId, outcome: 'superseded', mediaId: wantId);
          return;
        }
        // First successful init only — reopen must not rewrite these fields.
        phases['initDone'] ??= _msSince(settleStarted);
        phases['firstByteProxy'] ??= phases['initDone'];
        // Still count as warm/parked/prepared source if we reused the controller.
        if (claimSource != 'cold') {
          phases['source'] = switch (claimSource) {
            'warm' => 1,
            'parked' => 2,
            'prepared' => 3,
            _ => 0,
          };
        }
      } else {
        // Already warm/parked — init was paid earlier; stamp once for comparison.
        phases['initStart'] ??= phases['warmClaimed'] ?? 0;
        phases['initDone'] ??= _msSince(settleStarted);
        phases['firstByteProxy'] ??= phases['initDone'];
      }
      if (!_isLiveAttempt(token, attemptId) || _controller != controller) {
        await _dropIfStale(controller, token);
        _endAttempt(attemptId, outcome: 'superseded', mediaId: wantId);
        return;
      }
      await controller.setLooping(true);
      if (!_isLiveAttempt(token, attemptId) || _controller != controller) {
        await _dropIfStale(controller, token);
        _endAttempt(attemptId, outcome: 'superseded', mediaId: wantId);
        return;
      }
      // Show the decoded surface (cover → video), then start play and wait for real progress.
      if (controller.value.hasError) {
        if (_isLiveAttempt(token, attemptId)) {
          playback = PresentationPlayback.failed;
          errorText = 'تعذر تشغيل الفيديو';
          _notify();
        }
        _endAttempt(attemptId, outcome: 'error', mediaId: wantId);
        return;
      }
      playback = PresentationPlayback.ready;
      errorText = null;
      _notify();
      // Decode under mute until the first progressing frame — never arm speakers
      // while the Discover cover / dark plate is still on top.
      await controller.setVolume(0);
      if (!_canStart(controller, token) || !_isLiveAttempt(token, attemptId)) {
        await _dropIfStale(controller, token);
        _endAttempt(attemptId, outcome: 'superseded', mediaId: wantId);
        return;
      }
      // Capture floor before play so parked/rewind clips must advance again after activate.
      _bindProgressGuard(
        attemptId: attemptId,
        playerId: _playerId(controller),
        floor: controller.value.position,
      );
      phases['playStart'] ??= _msSince(settleStarted);
      phases['posAtPlayMs'] = controller.value.position.inMilliseconds;
      phases['sourceKind'] = _sourceKindLabel().hashCode;
      miraDiscoverLog(
        'MIRA_DISCOVER_ATTEMPT attempt=$attemptId phase=play '
        'mediaId=$wantId kind=${_sourceKindLabel()} '
        'app=$_appLifecycleLabel playerId=${_playerId(controller)}',
      );
      await controller.play();
      if (!_isLiveAttempt(token, attemptId) || _controller != controller) {
        _endAttempt(attemptId, outcome: 'superseded', mediaId: wantId);
        await _dropIfStale(controller, token);
        return;
      }
      if (controller.value.hasError) {
        if (_isLiveAttempt(token, attemptId)) {
          playback = PresentationPlayback.failed;
          errorText = 'تعذر تشغيل الفيديو';
          _notify();
        }
        _endAttempt(attemptId, outcome: 'error', mediaId: wantId);
        return;
      }
      _emitPlayback(
        'started',
        positionMs: controller.value.position.inMilliseconds,
        offerId: slot.slideId,
        mediaUrl: assetPath,
      );
      await _awaitFirstVisibleProgress(controller, token, settleStarted, slot, assetPath);
      if (_hasVisibleProgress) {
        if (!_canStart(controller, token) || !_isLiveAttempt(token, attemptId)) {
          miraDiscoverLog(
            'MIRA_DISCOVER_AUDIO unmute_skipped playerId=${_playerId(controller)} '
            'reason=not_active gen=$token live=$_generation '
            'ctrlMatch=${identical(_controller, controller)} '
            'firstFrameMs=${phases['firstFrame']} '
            'attempt=$attemptId',
          );
          _endAttempt(attemptId, outcome: 'progress_stale', mediaId: wantId);
          await _dropIfStale(controller, token);
          return;
        }
        await _armAudioOnce(
          controller: controller,
          token: token,
          settleStarted: settleStarted,
          assetPath: assetPath,
          attemptId: attemptId,
        );
        _endAttempt(attemptId, outcome: 'position_progress', mediaId: wantId);
      } else if (_firstFrameTimedOut && _isLiveAttempt(token, attemptId)) {
        _endAttempt(attemptId, outcome: 'timeout', mediaId: wantId);
      } else if (!_canStart(controller, token) || !_isLiveAttempt(token, attemptId)) {
        _endAttempt(attemptId, outcome: 'superseded', mediaId: wantId);
        await _dropIfStale(controller, token);
        return;
      }
      _notify();
    } catch (error) {
      // Only clear the active pointer when THIS attempt still owns it. A newer
      // attempt may already have reattached the same controller instance.
      final stillLiveOwner =
          !_released && token == _generation && identical(_controller, controller);
      if (stillLiveOwner) {
        _controller = null;
        _activePath = null;
      }
      await _disposeOwnedIfUnused(controller);
      _endAttempt(attemptId, outcome: 'error', mediaId: wantId);
      if (!_isLiveAttempt(token, attemptId)) return;
      playback = PresentationPlayback.failed;
      errorText = 'تعذر تشغيل الفيديو';
      _notify();
    }
  }

  void _beginAttempt(int attemptId, {String? mediaId, String? offerId, required int gen}) {
    _attemptStarts.add(attemptId);
    _activeAttemptId = attemptId;
    debugAttemptStartCount += 1;
    miraDiscoverLog(
      'MIRA_DISCOVER_ATTEMPT attempt=$attemptId phase=start '
      'mediaId=$mediaId offer=$offerId '
      'app=$_appLifecycleLabel gen=$gen build=$buildStamp',
    );
  }

  void _endAttempt(int? attemptId, {required String outcome, String? mediaId}) {
    if (attemptId == null) return;
    if (_attemptOutcomes.containsKey(attemptId)) return;
    if (!_attemptStarts.contains(attemptId)) return;
    _attemptOutcomes[attemptId] = outcome;
    debugAttemptEndCount += 1;
    if (_activeAttemptId == attemptId) {
      _activeAttemptId = null;
    }
    // Snapshot phases only when this attempt still owns lastAttachPhases.
    final posMs = lastAttachPhases['attemptId'] == attemptId
        ? lastAttachPhases['firstFrame']
        : null;
    miraDiscoverLog(
      'MIRA_DISCOVER_ATTEMPT attempt=$attemptId phase=end outcome=$outcome '
      'mediaId=$mediaId kind=${_sourceKindLabel()} app=$_appLifecycleLabel '
      'posProgressMs=$posMs metric=position_not_pixels',
    );
  }

  /// One unmute per attempt — shared by first-progress path and post-await fill.
  Future<void> _armAudioOnce({
    required VideoPlayerController controller,
    required int token,
    required DateTime settleStarted,
    required String assetPath,
    required int attemptId,
  }) async {
    if (_muted) return;
    if (_attemptOutcomes.containsKey(attemptId)) return;
    if (_audioArmAttemptId == attemptId && _audioArmInFlight != null) {
      await _audioArmInFlight;
      return;
    }
    final gate = Completer<void>();
    _audioArmAttemptId = attemptId;
    _audioArmInFlight = gate.future;
    final armedPlayerId = _playerId(controller);
    try {
      if (!_canStart(controller, token) || _muted) return;
      if (lastAttachPhases['attemptId'] != attemptId) return;
      if (lastAttachPhases['audioArmed'] != null &&
          lastAttachPhases['attemptId'] == attemptId) {
        return;
      }
      miraDiscoverLog(
        'MIRA_DISCOVER_AUDIO unmute_req playerId=$armedPlayerId '
        'attempt=$attemptId '
        'at=${DateTime.now().toUtc().toIso8601String()}',
      );
      await controller.setVolume(1);
      // After the await, this attempt may be stale (detach / A→image→A reuse).
      // Never mute the live controller — a newer attempt may own the same
      // instance and has already (or will) set the correct volume.
      final stillLive = _isLiveAttempt(token, attemptId) &&
          identical(_controller, controller);
      if (!stillLive) {
        if (!identical(_controller, controller)) {
          try {
            await controller.setVolume(0);
          } catch (_) {}
        }
        return;
      }
      if (_muted) {
        try {
          await controller.setVolume(0);
        } catch (_) {}
        return;
      }
      lastAttachPhases['audioArmed'] = _msSince(settleStarted);
      lastAttachPhases['audiblePlaying'] = audiblePlayingCount;
      lastAttachPhases['nextPlayerId'] = armedPlayerId;
      miraDiscoverLog(
        'MIRA_DISCOVER_SWIPE audio_armed mediaId=${_mediaIdOf(assetPath)} '
        'playerId=$armedPlayerId firstFrameMs=${lastAttachPhases['firstFrame']} '
        'audible=$audiblePlayingCount attempt=$attemptId',
      );
    } catch (e) {
      miraDiscoverLog(
        'MIRA_DISCOVER_AUDIO unmute_err playerId=$armedPlayerId err=$e',
      );
    } finally {
      if (!gate.isCompleted) gate.complete();
      if (identical(_audioArmInFlight, gate.future) &&
          _audioArmAttemptId == attemptId) {
        _audioArmInFlight = null;
      }
    }
  }

  /// Ends latency when position advances past the post-play floor (not cover/ready alone).
  Future<void> _awaitFirstVisibleProgress(
    VideoPlayerController controller,
    int token,
    DateTime settleStarted,
    PresentationSlot slot,
    String assetPath,
  ) async {
    if (_firstFrameEmitted || _firstFrameTimedOut) return;
    // Keep cover up until progress. Kick a stalled decoder once (~350ms after play) —
    // warm/play can return before AVPlayer advances position on iOS.
    final playStartedAt = DateTime.now().toUtc();
    final deadline = playStartedAt.add(const Duration(seconds: 5));
    var seekNudged = false;
    var kicked = false;
    var sampleN = 0;
    while (DateTime.now().toUtc().isBefore(deadline)) {
      if (token != _generation || _released || _controller != controller) return;
      if (_markProgressIfVisible(controller, token, settleStarted, slot, assetPath)) return;
      final v = controller.value;
      if (sampleN < 3 || sampleN % 30 == 0) {
        lastAttachPhases['posSampleMs'] = v.position.inMilliseconds;
        lastAttachPhases['isPlaying'] = v.isPlaying ? 1 : 0;
        lastAttachPhases['isBuffering'] = v.isBuffering ? 1 : 0;
        lastAttachPhases['hasError'] = v.hasError ? 1 : 0;
        lastAttachPhases['sizeW'] = v.size.width.round();
      }
      sampleN += 1;
      final sincePlay = DateTime.now().toUtc().difference(playStartedAt);
      // Reused decoder OR cold open of a complete local file (device T35:
      // playStart=145 → firstFrame=607 with cacheSource=3). A tiny seek unlocks
      // the first decoded frame on iOS without keeping extra players in memory.
      final reusedDecoder = (lastAttachPhases['source'] ?? 0) > 0;
      final completeDiskCold = (lastAttachPhases['source'] ?? 0) == 0 &&
          (lastAttachPhases['cacheSource'] ?? 0) == 3;
      if (!seekNudged &&
          (reusedDecoder || completeDiskCold) &&
          sincePlay.inMilliseconds >= 120 &&
          v.position <= _progressFloor &&
          v.isInitialized &&
          v.size.width > 0) {
        seekNudged = true;
        lastAttachPhases['seekNudgeMs'] = _msSince(settleStarted);
        lastAttachPhases['seekNudgeKind'] = completeDiskCold ? 2 : 1;
        final attemptId = lastAttachPhases['attemptId'];
        final seekPlayerId = _playerId(controller);
        final seekGen = token;
        try {
          final nudge = _progressFloor + const Duration(milliseconds: 32);
          final dur = v.duration;
          final target = (dur > Duration.zero && nudge >= dur)
              ? Duration.zero
              : nudge;
          // Raise floor + seek-in-flight BEFORE await seekTo so listener ticks
          // during seek cannot count the landing as position_progress (1715 race).
          if (attemptId != null) {
            _bindProgressGuard(
              attemptId: attemptId,
              playerId: seekPlayerId,
              floor: target,
            );
            _seekOwnerAttemptId = attemptId;
          } else {
            _progressFloor = target;
          }
          _seekInFlight = true;
          miraDiscoverLog(
            'MIRA_DISCOVER_PHASE mediaId=${_mediaIdOf(assetPath)} '
            'phase=seek_nudge_req attempt=$attemptId '
            'targetMs=${target.inMilliseconds} kind=${lastAttachPhases['seekNudgeKind']} '
            'floorMs=${_progressFloor.inMilliseconds}',
          );
          await controller.seekTo(target);
          // Stale seek must not mutate a newer attempt's floor / phases / seek flag.
          final stillOwner = attemptId != null &&
              attemptId == _seekOwnerAttemptId &&
              attemptId == _progressAttemptId &&
              seekGen == _generation &&
              seekPlayerId == _progressPlayerId &&
              identical(_controller, controller) &&
              lastAttachPhases['attemptId'] == attemptId;
          if (!stillOwner) {
            return;
          }
          final afterSeek = controller.value.position;
          if (afterSeek > _progressFloor) {
            _progressFloor = afterSeek;
          }
          lastAttachPhases['seekDoneMs'] = _msSince(settleStarted);
          lastAttachPhases['posAfterSeekMs'] = afterSeek.inMilliseconds;
          miraDiscoverLog(
            'MIRA_DISCOVER_PHASE mediaId=${_mediaIdOf(assetPath)} '
            'phase=seek_nudge_done attempt=$attemptId '
            'posMs=${afterSeek.inMilliseconds} floorMs=${_progressFloor.inMilliseconds}',
          );
        } catch (_) {
        } finally {
          if (attemptId != null && _seekOwnerAttemptId == attemptId) {
            _seekInFlight = false;
            _seekOwnerAttemptId = null;
          }
        }
        if (token != _generation || _released || _controller != controller) return;
        try {
          await controller.play();
          if (token != _generation || _released || _controller != controller) return;
          await Future<void>.delayed(const Duration(milliseconds: 80));
          if (token != _generation || _released || _controller != controller) return;
          if (_markProgressIfVisible(controller, token, settleStarted, slot, assetPath)) {
            return;
          }
        } catch (_) {}
      }
      if (!kicked && sincePlay.inMilliseconds >= 350 && v.position <= _progressFloor) {
        kicked = true;
        lastAttachPhases['stallKickMs'] = _msSince(settleStarted);
        try {
          // Nudge only — avoid seek-to-zero which flushes the warm buffer on iOS.
          await controller.play();
          if (token != _generation || _released || _controller != controller) return;
          await Future<void>.delayed(const Duration(milliseconds: 280));
          if (token != _generation || _released || _controller != controller) return;
          if (_markProgressIfVisible(controller, token, settleStarted, slot, assetPath)) return;
          if (controller.value.position <= _progressFloor && !controller.value.hasError) {
            // Capture attempt-local identity BEFORE any await — lastAttachPhases
            // is shared and may already belong to a newer attach when we resume.
            final path = assetPath;
            final reopenAttemptId = lastAttachPhases['attemptId'];
            final reopenPhases = lastAttachPhases;
            reopenPhases['stallReopenMs'] = _msSince(settleStarted);
            final fresh = await _openResolved(
              path,
              waitForDisk: true,
              phases: reopenPhases,
            );
            bool stillReopenOwner() =>
                !_released &&
                token == _generation &&
                identical(_controller, controller) &&
                (reopenAttemptId == null ||
                    lastAttachPhases['attemptId'] == reopenAttemptId);

            if (!stillReopenOwner()) {
              // Newer attempt owns the port (possibly the same controller object).
              // Never pause/dispose that live instance — only drop unused fresh.
              await _disposeOwnedIfUnused(fresh);
              return;
            }
            if (identical(fresh, controller)) {
              if (identical(lastAttachPhases, reopenPhases)) {
                reopenPhases['stallReopenSkipped'] = 1;
              }
              await controller.play();
              if (!stillReopenOwner()) return;
            } else {
              // Install fresh only while we still own the stalled controller.
              // Swap first, then dispose the old one if nothing else retained it —
              // never clear/dispose before the ownership re-check (A→image→A race).
              if (token != _generation ||
                  _released ||
                  lastAttachPhases['attemptId'] != reopenAttemptId ||
                  !identical(_controller, controller)) {
                await _disposeOwnedIfUnused(fresh);
                return;
              }
              _controller = fresh;
              _activePath = path;
              await _disposeOwnedIfUnused(controller);
              // pause/dispose of the stalled controller can await; a newer
              // attach may have claimed the port meanwhile. Re-check BEFORE
              // rewriting progress ownership or touching fresh further.
              if (_released ||
                  token != _generation ||
                  lastAttachPhases['attemptId'] != reopenAttemptId ||
                  !identical(_controller, fresh)) {
                await _disposeOwnedIfUnused(fresh);
                return;
              }
              final reopenAttempt = reopenAttemptId ?? 0;
              _bindProgressGuard(
                attemptId: reopenAttempt,
                playerId: _playerId(fresh),
                floor: Duration.zero,
              );
              fresh.addListener(() => _onController(fresh, token));
              await fresh.initialize().timeout(const Duration(seconds: 5));
              if (token != _generation ||
                  _released ||
                  !identical(_controller, fresh) ||
                  lastAttachPhases['attemptId'] != reopenAttemptId) {
                await _disposeOwnedIfUnused(fresh);
                return;
              }
              await fresh.setLooping(true);
              if (token != _generation ||
                  _released ||
                  !identical(_controller, fresh) ||
                  lastAttachPhases['attemptId'] != reopenAttemptId) {
                await _disposeOwnedIfUnused(fresh);
                return;
              }
              await fresh.setVolume(0);
              if (token != _generation ||
                  _released ||
                  !identical(_controller, fresh) ||
                  lastAttachPhases['attemptId'] != reopenAttemptId) {
                await _disposeOwnedIfUnused(fresh);
                return;
              }
              // Write reopen stamps only into this attempt's phase map.
              if (identical(lastAttachPhases, reopenPhases)) {
                reopenPhases['reopenInitDone'] = _msSince(settleStarted);
                reopenPhases['reopenPlayStart'] = _msSince(settleStarted);
                reopenPhases['reopened'] = 1;
                reopenPhases['reopenPlayerId'] = _playerId(fresh);
              }
              miraDiscoverLog(
                'MIRA_DISCOVER_PHASE mediaId=${_mediaIdOf(path)} '
                'phase=stall_reopen attempt=$reopenAttemptId '
                'playerId=${_playerId(fresh)}',
              );
              await fresh.play();
              if (token != _generation ||
                  _released ||
                  !identical(_controller, fresh) ||
                  lastAttachPhases['attemptId'] != reopenAttemptId) {
                return;
              }
              _notify();
              _emitPlayback('started', positionMs: 0, offerId: slot.slideId, mediaUrl: path);
              // Short second chance only — do not nest another full deadline.
              final reopenDeadline =
                  DateTime.now().toUtc().add(const Duration(seconds: 3));
              while (DateTime.now().toUtc().isBefore(reopenDeadline)) {
                if (token != _generation ||
                    _released ||
                    !identical(_controller, fresh) ||
                    lastAttachPhases['attemptId'] != reopenAttemptId) {
                  return;
                }
                if (_markProgressIfVisible(
                    fresh, token, settleStarted, slot, path)) {
                  return;
                }
                await Future<void>.delayed(const Duration(milliseconds: 16));
              }
              if (!_firstFrameEmitted &&
                  !_firstFrameTimedOut &&
                  token == _generation &&
                  identical(_controller, fresh) &&
                  lastAttachPhases['attemptId'] == reopenAttemptId) {
                final ms = _msSince(settleStarted);
                _firstFrameTimedOut = true;
                _emitPlayback(
                  'first_frame_timeout',
                  positionMs: ms,
                  offerId: slot.slideId,
                  mediaUrl: path,
                );
              }
              return;
            }
          }
        } catch (_) {}
      }
      await Future<void>.delayed(const Duration(milliseconds: 16));
    }
    if (!_firstFrameEmitted && !_firstFrameTimedOut && token == _generation && _controller == controller) {
      final ms = DateTime.now().toUtc().difference(settleStarted).inMilliseconds;
      final v = controller.value;
      lastAttachPhases['posAtTimeoutMs'] = v.position.inMilliseconds;
      lastAttachPhases['isPlaying'] = v.isPlaying ? 1 : 0;
      lastAttachPhases['isBuffering'] = v.isBuffering ? 1 : 0;
      lastAttachPhases['hasError'] = v.hasError ? 1 : 0;
      lastAttachPhases['audiblePlaying'] = audiblePlayingCount;
      _firstFrameTimedOut = true;
      _emitPlayback('first_frame_timeout', positionMs: ms, offerId: slot.slideId, mediaUrl: assetPath);
      _recordDiag({
        'event': 'swipe_settle_timeout',
        'offerId': slot.slideId,
        'mediaId': _mediaIdOf(assetPath),
        'claimSource': lastAttachPhases['source'],
        'cacheSource': lastAttachPhases['cacheSource'],
        'cacheBytes': lastAttachPhases['cacheBytes'],
        'audioCutMs': lastAttachPhases['audioCut'],
        'firstFrameMs': null,
        'timeoutMs': ms,
        'audiblePlaying': audiblePlayingCount,
        'at': DateTime.now().toUtc().toIso8601String(),
      });
      miraDiscoverLog(
        'MIRA_DISCOVER_SWIPE settle_timeout mediaId=${_mediaIdOf(assetPath)} '
        'offer=${slot.slideId} claim=${lastAttachPhases['source']} '
        'cache=${lastAttachPhases['cacheSource']} bytes=${lastAttachPhases['cacheBytes']} '
        'audioCutMs=${lastAttachPhases['audioCut']} timeoutMs=$ms '
        'audible=$audiblePlayingCount',
      );
    }
  }

  bool _markProgressIfVisible(
    VideoPlayerController controller,
    int token,
    DateTime settleStarted,
    PresentationSlot slot,
    String assetPath,
  ) {
    if (token != _generation || _controller != controller || _released) return false;
    if (!controller.value.isInitialized || controller.value.hasError) return false;
    final attemptId = lastAttachPhases['attemptId'];
    if (!_progressGuardMatches(controller, attemptId)) return false;
    // Seek landing must not count as progress — floor already raised to target.
    if (_seekInFlight) return false;
    // Position advance past the attempt-scoped floor (NOT proof of drawn pixels).
    if (controller.value.position <= _progressFloor) return false;
    _hasVisibleProgress = true;
    _firstFrameTimedOut = false;
    if (!_firstFrameEmitted) {
      _firstFrameEmitted = true;
      final ms = DateTime.now().toUtc().difference(settleStarted).inMilliseconds;
      lastAttachPhases['firstFrame'] = ms;
      lastAttachPhases['posAtFirstMs'] = controller.value.position.inMilliseconds;
      lastAttachPhases['isPlaying'] = controller.value.isPlaying ? 1 : 0;
      lastAttachPhases['isBuffering'] = controller.value.isBuffering ? 1 : 0;
      lastAttachPhases['metric'] = 'position'.hashCode;
      final stickyId = _mediaIdOf(assetPath);
      if (stickyId != null) {
        _stickyMediaIds.remove(stickyId);
        _stickyMediaIds.add(stickyId);
        while (_stickyMediaIds.length > _maxPrepared) {
          _stickyMediaIds.remove(_stickyMediaIds.first);
        }
      }
      // Finish disk object in background so section return is a file open.
      prefetchDisk(assetPath);
      // ignore: discarded_futures
      _diskCache?.finalizePartIfComplete(assetPath);
      _emitPlayback('first_frame', positionMs: ms, offerId: slot.slideId, mediaUrl: assetPath);
      lastAttachPhases['audiblePlaying'] = audiblePlayingCount;
      _recordDiag({
        'event': 'swipe_settle',
        'offerId': slot.slideId,
        'mediaId': _mediaIdOf(assetPath),
        'claimSource': lastAttachPhases['source'],
        'cacheSource': lastAttachPhases['cacheSource'],
        'cacheBytes': lastAttachPhases['cacheBytes'],
        'audioCutMs': lastAttachPhases['audioCut'],
        'firstFrameMs': ms,
        'metric': 'position_not_pixels',
        'audiblePlaying': audiblePlayingCount,
        'at': DateTime.now().toUtc().toIso8601String(),
      });
      miraDiscoverLog(
        'MIRA_DISCOVER_FF session=$sessionId transition=$_generation '
        'attempt=$attemptId build=$buildStamp '
        'mediaId=${_mediaIdOf(assetPath)} '
        'offer=${slot.slideId} playerId=${_playerId(controller)} '
        'firstFrameMs=$ms positionProgressMs=$ms metric=position_not_pixels '
        'source=${lastAttachPhases['source']} '
        'cacheSource=${lastAttachPhases['cacheSource']} '
        'cacheBytes=${lastAttachPhases['cacheBytes']} '
        'cacheBytesAtOpen=${lastAttachPhases['cacheBytesAtOpen']} '
        'audioCutMs=${lastAttachPhases['audioCut']} '
        'audible=$audiblePlayingCount '
        'initStart=${lastAttachPhases['initStart']} '
        'initDone=${lastAttachPhases['initDone']} '
        'playStart=${lastAttachPhases['playStart']} '
        'resolveMs=${(lastAttachPhases['resolveDone'] ?? 0) - (lastAttachPhases['resolveStart'] ?? 0)} '
        'seekNudge=${lastAttachPhases['seekNudgeMs']} '
        'seekDone=${lastAttachPhases['seekDoneMs']} '
        'posAfterSeek=${lastAttachPhases['posAfterSeekMs']} '
        'reopened=${lastAttachPhases['reopened']} '
        'kind=${_sourceKindLabel()} app=$_appLifecycleLabel',
      );
      miraDiscoverLog(
        'MIRA_DISCOVER_SWIPE settle session=$sessionId transition=$_generation '
        'attempt=$attemptId build=$buildStamp '
        'mediaId=${_mediaIdOf(assetPath)} '
        'offer=${slot.slideId} claim=${lastAttachPhases['source']} '
        'cache=${lastAttachPhases['cacheSource']} bytes=${lastAttachPhases['cacheBytes']} '
        'audioCutMs=${lastAttachPhases['audioCut']} firstFrameMs=$ms '
        'positionProgressMs=$ms metric=position_not_pixels audible=$audiblePlayingCount',
      );
      if (_canStart(controller, token) && attemptId != null) {
        // ignore: discarded_futures
        _armAudioOnce(
          controller: controller,
          token: token,
          settleStarted: settleStarted,
          assetPath: assetPath,
          attemptId: attemptId,
        );
      }
    }
    return true;
  }

  void _onController(VideoPlayerController controller, int token) {
    if (token != _generation || _controller != controller || _released) return;
    if (controller.value.hasError && playback != PresentationPlayback.failed) {
      playback = PresentationPlayback.failed;
      errorText = 'تعذر تشغيل الفيديو';
      controller.pause();
      _notify();
      return;
    }
    if (playback != PresentationPlayback.ready) return;
    final settle = _settleStartedAt;
    if (settle != null && activeSlot != null && _activePath != null) {
      _markProgressIfVisible(controller, token, settle, activeSlot!, _activePath!);
    }
    if (_seekInFlight) return;
    if (!_progressGuardMatches(controller, lastAttachPhases['attemptId'])) return;
    if (controller.value.position <= _progressFloor) return;
    _hasVisibleProgress = true;
    final now = DateTime.now().toUtc();
    final last = _lastProgressAt;
    if (last != null && now.difference(last) < const Duration(milliseconds: 400)) return;
    _lastProgressAt = now;
    _emitPlayback('progressed', positionMs: controller.value.position.inMilliseconds);
    _notify();
  }

  @override
  Future<void> detach(PresentationSlot slot) async {
    if (activeSlot == null || !activeSlot!.same(slot)) return;
    final attemptId = _activeAttemptId ?? lastAttachPhases['attemptId'];
    final token = ++_generation;
    final controller = _controller;
    final path = _activePath;
    final pos = controller?.value.position.inMilliseconds;
    final hadFrame = _hasVisibleProgress;
    final settle = _settleStartedAt;
    if (_controller == controller) {
      _controller = null;
      _activePath = null;
    }
    if (path != null && path.isNotEmpty) {
      _emitPlayback('stopped', positionMs: pos, offerId: slot.slideId, mediaUrl: path);
      if (!hadFrame) {
        final ms = settle == null
            ? null
            : DateTime.now().toUtc().difference(settle).inMilliseconds;
        _emitPlayback('left_dark', positionMs: ms, offerId: slot.slideId, mediaUrl: path);
        _endAttempt(
          attemptId,
          outcome: 'left_dark',
          mediaId: _mediaIdOf(path),
        );
        _recordDiag({
          'event': 'left_dark',
          'offerId': slot.slideId,
          'mediaId': _mediaIdOf(path),
          'attemptId': lastAttachPhases['attemptId'],
          'dwellMs': ms,
          'claimSource': lastAttachPhases['source'],
          'cacheSource': lastAttachPhases['cacheSource'],
          'cacheBytes': lastAttachPhases['cacheBytes'],
          'audiblePlaying': audiblePlayingCount,
          'app': _appLifecycleLabel,
          'at': DateTime.now().toUtc().toIso8601String(),
        });
        miraDiscoverLog(
          'MIRA_DISCOVER_SWIPE left_dark mediaId=${_mediaIdOf(path)} '
          'offer=${slot.slideId} attempt=${lastAttachPhases['attemptId']} dwellMs=$ms '
          'claim=${lastAttachPhases['source']} cache=${lastAttachPhases['cacheSource']} '
          'bytes=${lastAttachPhases['cacheBytes']} audible=$audiblePlayingCount '
          'app=$_appLifecycleLabel kind=${_sourceKindLabel()}',
        );
      } else {
        _endAttempt(
          attemptId,
          outcome: 'position_progress',
          mediaId: _mediaIdOf(path),
        );
        // Pin watched clip bytes so cross-lane return opens a complete file.
        prefetchDisk(path);
        // ignore: discarded_futures
        _diskCache?.finalizePartIfComplete(path);
      }
    }
    activeSlot = null;
    playback = PresentationPlayback.idle;
    errorText = null;
    _notify();
    if (controller != null) {
      await _parkLeaving(controller, path);
    }
    if (token != _generation) return;
  }

  @override
  Future<void> pause() async {
    final attemptId = _activeAttemptId ?? lastAttachPhases['attemptId'];
    final token = ++_generation;
    final controller = _controller;
    final path = _activePath;
    final pos = controller?.value.position.inMilliseconds;
    if (controller != null) {
      await controller.pause();
    }
    if (path != null && path.isNotEmpty) {
      _emitPlayback('stopped', positionMs: pos, mediaUrl: path);
    }
    _endAttempt(
      attemptId,
      outcome: _hasVisibleProgress ? 'position_progress' : 'cancelled',
      mediaId: _mediaIdOf(path ?? ''),
    );
    if (token != _generation || _released) return;
  }

  @override
  Future<void> release() async {
    final attemptId = _activeAttemptId ?? lastAttachPhases['attemptId'];
    _released = true;
    final token = ++_generation;
    final controller = _controller;
    final warm = _warm;
    final parked = _parked;
    final path = _activePath;
    final pos = controller?.value.position.inMilliseconds;
    if (path != null && path.isNotEmpty) {
      _emitPlayback('stopped', positionMs: pos, mediaUrl: path);
    }
    _endAttempt(
      attemptId,
      outcome: _hasVisibleProgress ? 'position_progress' : 'cancelled',
      mediaId: _mediaIdOf(path ?? ''),
    );
    _controller = null;
    _activePath = null;
    _warm = null;
    _warmPath = null;
    _warmFuture = null;
    final warmInit = _warmInitialized;
    _warmInitialized = null;
    if (warmInit != null && !warmInit.isCompleted) {
      warmInit.completeError(StateError('released'));
    }
    _parked = null;
    _parkedPath = null;
    final prepared = Map<String, VideoPlayerController>.from(_preparedByMediaId);
    _preparedByMediaId.clear();
    _preparedOrder.clear();
    activeSlot = null;
    playback = PresentationPlayback.idle;
    Future<void> disposeQuiet(VideoPlayerController? c) async {
      if (c == null) return;
      try {
        await c.pause();
      } catch (_) {}
      try {
        await c.dispose();
      } catch (_) {}
    }

    await disposeQuiet(controller);
    if (warm != null && warm != controller) await disposeQuiet(warm);
    if (parked != null && parked != controller && parked != warm) {
      await disposeQuiet(parked);
    }
    for (final c in prepared.values) {
      if (c != controller && c != warm && c != parked) {
        await disposeQuiet(c);
      }
    }
    if (token != _generation) return;
  }

  /// Path currently being warmed (null when idle).
  String? get warmingPath => _warmPath;

  /// Path of the active (on-screen) controller, if any.
  String? get activePath => _activePath;

  /// Attach/detach generation — used by owners to ignore stale audio cuts.
  int get debugGeneration => _generation;

  /// True when a warm controller exists for [warmingPath] (ready or still initializing).
  bool get hasWarmSlot => _warm != null && (_warmPath?.isNotEmpty ?? false);

  /// Initializes the next clip without playing it or playing its audio.
  /// Safe to call repeatedly for the same URL — keeps the in-flight future.
  ///
  /// Disk download for [assetPath] is shared by mediaId and is NOT cancelled when
  /// this warm controller is disposed for another URL.
  Future<void> warm(String assetPath) async {
    if (_released || assetPath.isEmpty) return;
    if (_sameMedia(_activePath, assetPath) || _sameMedia(_parkedPath, assetPath)) {
      return;
    }
    // Neighbor warm: prefix only — never start a competing full multi‑10 MB GET.
    prefetchDisk(assetPath, lowPriority: true);
    // Join while download OR mute-prime is still in flight (_warm may still be null).
    if (_sameMedia(_warmPath, assetPath)) {
      final pending = _warmFuture;
      if (pending != null) {
        try {
          await pending;
        } catch (_) {}
      }
      return;
    }
    final previous = _warm;
    final previousPath = _warmPath;
    final previousFuture = _warmFuture;
    final previousInit = _warmInitialized;
    _warm = null;
    _warmPath = null;
    _warmFuture = null;
    _warmInitialized = null;
    // Dispose previous decoder only — disk download for previousPath continues.
    if (previous != null && previous != _controller && previous != _parked) {
      if (previousFuture != null) {
        // ignore: unawaited_futures
        previousFuture.catchError((_) {});
      }
      if (previousInit != null && !previousInit.isCompleted) {
        // Completing normally avoids unhandled "warm superseded" exceptions in logs.
        previousInit.complete();
      }
      // Mute-prime may still be playing — silence before dispose (audio leak).
      // ignore: discarded_futures
      _silence(previous).whenComplete(() {
        // ignore: discarded_futures
        previous.dispose();
      });
      if (previousPath != null && previousPath.isNotEmpty) {
        prefetchDisk(previousPath, lowPriority: true);
        _emitPlayback('warm_cancelled', mediaUrl: previousPath);
      }
    }
    if (_released) return;

    // Reserve the warm path immediately so duplicate warm() calls join this future
    // while the shared disk download is still running.
    _warmPath = assetPath;
    final initGate = Completer<void>();
    _warmInitialized = initGate;
    VideoPlayerController? controller;
    final future = () async {
      // Open via proxy/partial — do not steal active priority or start a full GET.
      final opened = await _openResolved(
        assetPath,
        waitForDisk: false,
        claimPriority: false,
        fullFill: false,
      );
      controller = opened;
      if (_released || !_sameMedia(_warmPath, assetPath)) {
        await opened.dispose();
        // Expected cancel on swipe away — complete normally (no unhandled error).
        if (!initGate.isCompleted) initGate.complete();
        return;
      }
      _warm = opened;
      _emitPlayback('warm_started', mediaUrl: assetPath);
      await opened.initialize();
      if (opened.value.hasError) {
        if (!initGate.isCompleted) {
          initGate.completeError(StateError('warm init error'));
        }
        throw StateError('warm init error');
      }
      if (!initGate.isCompleted) initGate.complete();
      await opened.setVolume(0);
      // Best-effort mute-prime. Failure must KEEP the initialized controller so
      // attach can claim it without a cold reopen under the dark cover.
      try {
        await opened.play();
        final deadline = DateTime.now().toUtc().add(const Duration(milliseconds: 1800));
        while (DateTime.now().toUtc().isBefore(deadline)) {
          // Attach may claim mid-prime (_warmPath cleared, _controller == opened).
          // Never silence/pause a controller the active slot already owns.
          if (!identical(_warm, opened) || _released) {
            return;
          }
          if (!_sameMedia(_warmPath, assetPath)) {
            return;
          }
          if (opened.value.hasError) break;
          if (opened.value.position > Duration.zero) break;
          await Future<void>.delayed(const Duration(milliseconds: 40));
        }
      } catch (_) {}
      // Only park volume if we still own the warm slot.
      if (identical(_warm, opened) && _sameMedia(_warmPath, assetPath)) {
        await opened.setVolume(0);
        try {
          await opened.pause();
        } catch (_) {}
      }
    }();
    _warmFuture = future;
    try {
      await future;
      if (_warm == controller) {
        final primed = (controller?.value.position ?? Duration.zero) > Duration.zero;
        _emitPlayback(
          primed ? 'warm_ready' : 'warm_ready_unprimed',
          mediaUrl: assetPath,
        );
      }
    } catch (e) {
      final msg = '$e';
      final expected = msg.contains('warm cancelled') ||
          msg.contains('warm superseded') ||
          msg.contains('warm cancelled');
      if (expected) {
        // Expected on fast swipe / reverse — never surface as unhandled.
        miraDiscoverLog('MIRA_DISCOVER_WARM expected_cancel mediaId=${_mediaIdOf(assetPath)}');
        if (!initGate.isCompleted) initGate.complete();
        return;
      }
      // Only dispose when initialize itself failed — keep unprimed controllers.
      if (!initGate.isCompleted ||
          controller == null ||
          !controller!.value.isInitialized ||
          controller!.value.hasError) {
        if (_warm == controller || (_warmPath == assetPath && controller != null)) {
          _warm = null;
          _warmPath = null;
          _warmFuture = null;
          _warmInitialized = null;
          try {
            await controller?.dispose();
          } catch (_) {}
          _emitPlayback('warm_failed', mediaUrl: assetPath);
          miraDiscoverLog(
            'MIRA_DISCOVER_WARM failed mediaId=${_mediaIdOf(assetPath)} err=$e',
          );
        }
        if (!initGate.isCompleted) {
          initGate.completeError(StateError('warm failed'));
        }
      }
    }
  }

  @override
  Future<void> retry(PresentationSlot slot, String assetPath) {
    return attach(slot, assetPath);
  }

  @override
  Widget? buildView() {
    final controller = _controller;
    // Always paint an opaque VideoPlayer once ready. Discover stacks the cover
    // *above* this surface until hasVisibleProgress — opacity-0 starved the iOS
    // decoder and caused play→8s timeout with position stuck at the floor.
    if (controller == null ||
        playback != PresentationPlayback.ready ||
        !controller.value.isInitialized) {
      return null;
    }
    final size = controller.value.size;
    return FittedBox(
      fit: BoxFit.cover,
      clipBehavior: Clip.hardEdge,
      child: SizedBox(
        width: size.width == 0 ? 9 : size.width,
        height: size.height == 0 ? 16 : size.height,
        child: VideoPlayer(controller),
      ),
    );
  }

  @override
  void dispose() {
    _released = true;
    _generation++;
    final controller = _controller;
    final warm = _warm;
    final parked = _parked;
    _controller = null;
    _activePath = null;
    _warm = null;
    _warmPath = null;
    _warmFuture = null;
    final warmInit = _warmInitialized;
    _warmInitialized = null;
    if (warmInit != null && !warmInit.isCompleted) {
      warmInit.completeError(StateError('disposed'));
    }
    _parked = null;
    _parkedPath = null;
    final prepared = List<VideoPlayerController>.from(_preparedByMediaId.values);
    _preparedByMediaId.clear();
    _preparedOrder.clear();
    controller?.dispose();
    if (warm != null && warm != controller) warm.dispose();
    if (parked != null && parked != controller && parked != warm) parked.dispose();
    for (final c in prepared) {
      if (c != controller && c != warm && c != parked) c.dispose();
    }
    super.dispose();
  }
}
