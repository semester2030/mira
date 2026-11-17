import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:video_player/video_player.dart';

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
  })  : _createController = createController,
        _diskCache = diskCache ??
            (createController == null ? DiscoverVideoDiskCache.instance : null);

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
  static const int _maxPrepared = 2;
  int _generation = 0;
  bool _released = false;
  String? _lastOfferId;
  String? _lastMediaUrl;
  DateTime? _lastProgressAt;
  DateTime? _settleStartedAt;
  Duration _progressFloor = Duration.zero;
  bool _firstFrameEmitted = false;
  bool _firstFrameTimedOut = false;
  bool _hasVisibleProgress = false;
  final List<DiscoverPlaybackEvent> playbackEvents = <DiscoverPlaybackEvent>[];

  /// Source URL bound to the controller (null when no video attached).
  String? get activeMediaUrl => _activePath;

  /// True after the active clip advanced past the post-play floor while playing.
  bool get hasVisibleProgress => _hasVisibleProgress;

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
    _muted = muted;
    final controller = _controller;
    if (controller != null) {
      await controller.setVolume(muted ? 0 : 1);
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
    if (token == _generation && !_released && _controller == controller) return;
    if (_controller != controller) return;
    _controller = null;
    await controller.pause();
    await controller.dispose();
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
    final source = await cache.resolvePlaySource(
      assetPath,
      claimPriority: claimPriority,
    );
    if (source.isFile && source.file != null) {
      phases?['cacheSource'] = 3;
      phases?['cacheBytes'] = source.bytesOnDisk;
      _recordDiag({
        'mediaId': source.mediaId,
        'source': 'disk',
        'bytesReused': source.bytesOnDisk,
        'bytesDownloaded': 0,
      });
      return VideoPlayerController.file(source.file!);
    }
    if (source.isProxy && source.uri != null) {
      // Active clip: full shared fill. Warm/neighbor: prefix only.
      cache.prefetch(assetPath, lowPriority: !fullFill);
      phases?['cacheSource'] = 4; // loopback proxy over partial/complete fill
      phases?['cacheBytes'] = source.bytesOnDisk;
      _recordDiag({
        'mediaId': source.mediaId,
        'source': 'proxy_partial',
        'bytesReused': source.bytesOnDisk,
        'bytesDownloaded': 0,
        'playUrl': source.uri.toString(),
        'fullFill': fullFill ? 1 : 0,
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

  Future<void> _silence(VideoPlayerController controller) async {
    try {
      // Volume first so a late play() tick cannot briefly leak audio.
      await controller.setVolume(0);
      await controller.pause();
    } catch (_) {}
  }

  /// Nomas-style hard cut: kill outgoing audio immediately on swipe settle,
  /// before any warm/init await. Fire-and-forget; [attach]/[detach] still park.
  void cutOutgoingAudio({String? nextMediaUrl}) {
    final prevPath = _activePath;
    final prevOffer = activeSlot?.slideId;
    final active = _controller;
    if (active != null) {
      // ignore: discarded_futures
      _silence(active);
    }
    final warm = _warm;
    if (warm != null && !_sameMedia(_warmPath, nextMediaUrl)) {
      // ignore: discarded_futures
      _silence(warm);
    }
    final parked = _parked;
    if (parked != null) {
      // ignore: discarded_futures
      _silence(parked);
    }
    for (final c in _preparedByMediaId.values) {
      // ignore: discarded_futures
      _silence(c);
    }
    _recordDiag({
      'event': 'audio_cut',
      'prevOffer': prevOffer,
      'prevMediaId': _mediaIdOf(prevPath),
      'nextMediaId': _mediaIdOf(nextMediaUrl),
      'audiblePlaying': audiblePlayingCount,
      'at': DateTime.now().toUtc().toIso8601String(),
    });
    debugPrint(
      'MIRA_DISCOVER_SWIPE audio_cut prev=${_mediaIdOf(prevPath)} '
      'next=${_mediaIdOf(nextMediaUrl)} audible=$audiblePlayingCount',
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
      final evictId = _preparedOrder.removeAt(0);
      final evict = _preparedByMediaId.remove(evictId);
      if (evict != null && evict != controller) {
        await evict.dispose();
      }
    }
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
    _progressFloor = Duration.zero;
    _firstFrameEmitted = false;
    _firstFrameTimedOut = false;
    _hasVisibleProgress = false;
    lastAttachPhases = <String, int?>{
      'warmClaimed': null,
      'initStart': null,
      'initDone': null,
      'firstByteProxy': null,
      'playStart': null,
      'firstFrame': null,
      'audioArmed': null,
      'source': null,
    };
    final token = ++_generation;
    final previous = _controller;
    final previousPath = _activePath;
    // Critical (Nomas parity): cut previous audio BEFORE awaiting warm init.
    // Old order waited on warm then silenced — dual audio + dark plate with sound.
    cutOutgoingAudio(nextMediaUrl: assetPath);
    if (previous != null) {
      await _silence(previous);
    }
    lastAttachPhases['audioCut'] = _msSince(settleStarted);
    // Active clip owns the full GET; neighbors stay prefix-only.
    prefetchDisk(assetPath);
    _diskCache?.prioritize(assetPath);
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
    lastAttachPhases['mediaIdHash'] = wantId?.hashCode;
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
        lastAttachPhases['warmRejected'] = _msSince(settleStarted);
        if (claimed != null) {
          try {
            await claimed.dispose();
          } catch (_) {}
        }
        claimed = null;
        claimedReady = false;
        claimSource = 'cold';
      } else {
        // Accept warm even at position 0 — attach's first-frame wait advances it.
        claimedReady = true;
        claimSource = 'warm';
        lastAttachPhases['warmClaimed'] = _msSince(settleStarted);
        lastAttachPhases['warmPosMs'] = claimed.value.position.inMilliseconds;
      }
    } else if (_sameMedia(_parkedPath, assetPath) && _parked != null) {
      claimed = _parked;
      _parked = null;
      _parkedPath = null;
      claimedReady = claimed?.value.isInitialized ?? false;
      claimSource = 'parked';
      lastAttachPhases['warmClaimed'] = _msSince(settleStarted);
    } else {
      final prepared = _takePrepared(assetPath);
      if (prepared != null) {
        claimed = prepared;
        claimedReady = prepared.value.isInitialized && !prepared.value.hasError;
        claimSource = claimedReady ? 'prepared' : 'cold';
        if (!claimedReady) {
          try {
            await prepared.dispose();
          } catch (_) {}
          claimed = null;
        } else {
          lastAttachPhases['warmClaimed'] = _msSince(settleStarted);
        }
      }
    }
    lastAttachPhases['source'] = switch (claimSource) {
      'warm' => 1,
      'parked' => 2,
      'prepared' => 3,
      _ => 0,
    };
    if (token != _generation || _released) {
      if (claimed != null && claimed != _controller && claimed != _warm && claimed != _parked) {
        await claimed.dispose();
      }
      if (previous != null && previous != _controller && previous != _warm && previous != _parked && previous != claimed) {
        await previous.dispose();
      }
      return;
    }
    if (previous != null && previous != claimed) {
      // Already silenced above — park/stash without blocking first-frame path.
      // ignore: discarded_futures
      _parkLeaving(previous, previousPath);
    }
    if (token != _generation || _released) return;

    // Keep an in-flight warm/parked controller — never dispose and re-open the same URL.
    // Previous bug: swipe during warm disposed the half-ready player → cold 1.5–3s path.
    late final VideoPlayerController controller;
    if (claimed != null) {
      controller = claimed;
      if (!claimedReady) {
        lastAttachPhases['initStart'] = lastAttachPhases['warmClaimed'] ?? _msSince(settleStarted);
      }
    } else {
      // Prefer complete disk file (rewind after many swipes) without blocking the
      // first-ever play on a full download — network plays while bytes land.
      lastAttachPhases['resolveStart'] = _msSince(settleStarted);
      controller = await _openResolved(
        assetPath,
        waitForDisk: false,
        phases: lastAttachPhases,
      );
      lastAttachPhases['resolveDone'] = _msSince(settleStarted);
    }
    _controller = controller;
    _activePath = assetPath;
    _recordDiag({
      'event': 'attach_open',
      'claimSource': claimSource,
      'mediaId': wantId,
      'cacheSource': lastAttachPhases['cacheSource'],
      'cacheBytes': lastAttachPhases['cacheBytes'],
      'resolveMs': lastAttachPhases['resolveDone'] == null ||
              lastAttachPhases['resolveStart'] == null
          ? null
          : (lastAttachPhases['resolveDone']! - lastAttachPhases['resolveStart']!),
      'ms': _msSince(settleStarted),
    });
    controller.addListener(() => _onController(controller, token));
    try {
      if (!controller.value.isInitialized) {
        lastAttachPhases['initStart'] ??= _msSince(settleStarted);
        try {
          await controller.initialize().timeout(const Duration(seconds: 6));
        } on TimeoutException {
          lastAttachPhases['initTimeoutMs'] = _msSince(settleStarted);
          // Slow network/decode — emit a countable timeout instead of hanging the swipe budget.
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
          return;
        }
        lastAttachPhases['initDone'] = _msSince(settleStarted);
        lastAttachPhases['firstByteProxy'] = lastAttachPhases['initDone'];
        // Still count as warm/parked/prepared source if we reused the controller.
        if (claimSource != 'cold') {
          lastAttachPhases['source'] = switch (claimSource) {
            'warm' => 1,
            'parked' => 2,
            'prepared' => 3,
            _ => 0,
          };
        }
      } else {
        // Already warm/parked — init was paid earlier; still stamp for comparison.
        lastAttachPhases['initStart'] = lastAttachPhases['warmClaimed'] ?? 0;
        lastAttachPhases['initDone'] = _msSince(settleStarted);
        lastAttachPhases['firstByteProxy'] = lastAttachPhases['initDone'];
      }
      if (token != _generation || _released || _controller != controller) {
        await _dropIfStale(controller, token);
        return;
      }
      await controller.setLooping(true);
      if (token != _generation || _released || _controller != controller) {
        await _dropIfStale(controller, token);
        return;
      }
      // Show the decoded surface (cover → video), then start play and wait for real progress.
      if (controller.value.hasError) {
        playback = PresentationPlayback.failed;
        errorText = 'تعذر تشغيل الفيديو';
        _notify();
        return;
      }
      playback = PresentationPlayback.ready;
      errorText = null;
      _notify();
      // Decode under mute until the first progressing frame — never arm speakers
      // while the Discover cover / dark plate is still on top.
      await controller.setVolume(0);
      if (!_canStart(controller, token)) {
        await _dropIfStale(controller, token);
        return;
      }
      // Capture floor before play so parked/rewind clips must advance again after activate.
      _progressFloor = controller.value.position;
      lastAttachPhases['playStart'] = _msSince(settleStarted);
      lastAttachPhases['posAtPlayMs'] = controller.value.position.inMilliseconds;
      await controller.play();
      if (token != _generation || _released || _controller != controller) {
        await _dropIfStale(controller, token);
        return;
      }
      if (controller.value.hasError) {
        playback = PresentationPlayback.failed;
        errorText = 'تعذر تشغيل الفيديو';
        _notify();
        return;
      }
      _emitPlayback(
        'started',
        positionMs: controller.value.position.inMilliseconds,
        offerId: slot.slideId,
        mediaUrl: assetPath,
      );
      await _awaitFirstVisibleProgress(controller, token, settleStarted, slot, assetPath);
      if (!_canStart(controller, token)) {
        await _dropIfStale(controller, token);
        return;
      }
      if (_hasVisibleProgress) {
        await controller.setVolume(_muted ? 0 : 1);
        lastAttachPhases['audioArmed'] = _msSince(settleStarted);
        lastAttachPhases['audiblePlaying'] = audiblePlayingCount;
        _recordDiag({
          'event': 'audio_armed',
          'offerId': slot.slideId,
          'mediaId': wantId,
          'firstFrameMs': lastAttachPhases['firstFrame'],
          'audioArmedMs': lastAttachPhases['audioArmed'],
          'audiblePlaying': audiblePlayingCount,
        });
        debugPrint(
          'MIRA_DISCOVER_SWIPE audio_armed mediaId=$wantId '
          'firstFrameMs=${lastAttachPhases['firstFrame']} '
          'audible=$audiblePlayingCount',
        );
      }
      _notify();
    } catch (error) {
      if (_controller == controller) _controller = null;
      await controller.dispose();
      if (token != _generation || _released) return;
      playback = PresentationPlayback.failed;
      errorText = 'تعذر تشغيل الفيديو';
      _notify();
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
      // Parked/warm/prepared reclaim only: a tiny seek past the floor unlocks a
      // decoded frame without tearing down the controller. Skip on cold opens so
      // a true stall still surfaces as first_frame_timeout.
      final reusedDecoder = (lastAttachPhases['source'] ?? 0) > 0;
      if (!seekNudged &&
          reusedDecoder &&
          sincePlay.inMilliseconds >= 120 &&
          v.position <= _progressFloor &&
          v.isInitialized &&
          v.size.width > 0) {
        seekNudged = true;
        lastAttachPhases['seekNudgeMs'] = _msSince(settleStarted);
        try {
          final nudge = _progressFloor + const Duration(milliseconds: 32);
          final dur = v.duration;
          final target = (dur > Duration.zero && nudge >= dur)
              ? Duration.zero
              : nudge;
          await controller.seekTo(target);
          if (token != _generation || _released || _controller != controller) return;
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
            lastAttachPhases['stallReopenMs'] = _msSince(settleStarted);
            final path = assetPath;
            final fresh = await _openResolved(path, waitForDisk: true, phases: lastAttachPhases);
            if (identical(fresh, controller)) {
              lastAttachPhases['stallReopenSkipped'] = 1;
              await controller.play();
            } else {
              if (_controller == controller) {
                _controller = null;
                _activePath = null;
              }
              await controller.pause();
              await controller.dispose();
              if (token != _generation || _released) {
                await fresh.dispose();
                return;
              }
              _controller = fresh;
              _activePath = path;
              _progressFloor = Duration.zero;
              fresh.addListener(() => _onController(fresh, token));
              await fresh.initialize().timeout(const Duration(seconds: 5));
              if (token != _generation || _released || _controller != fresh) {
                await fresh.dispose();
                return;
              }
              await fresh.setLooping(true);
              await fresh.setVolume(0);
              lastAttachPhases['initDone'] = _msSince(settleStarted);
              lastAttachPhases['playStart'] = _msSince(settleStarted);
              lastAttachPhases['reopened'] = 1;
              await fresh.play();
              _notify();
              _emitPlayback('started', positionMs: 0, offerId: slot.slideId, mediaUrl: path);
              // Short second chance only — do not nest another full deadline.
              final reopenDeadline = DateTime.now().toUtc().add(const Duration(seconds: 3));
              while (DateTime.now().toUtc().isBefore(reopenDeadline)) {
                if (token != _generation || _released || _controller != fresh) return;
                if (_markProgressIfVisible(fresh, token, settleStarted, slot, path)) {
                  if (_canStart(fresh, token) && _hasVisibleProgress) {
                    await fresh.setVolume(_muted ? 0 : 1);
                    lastAttachPhases['audioArmed'] = _msSince(settleStarted);
                  }
                  return;
                }
                await Future<void>.delayed(const Duration(milliseconds: 16));
              }
              if (!_firstFrameEmitted && !_firstFrameTimedOut && token == _generation && _controller == fresh) {
                final ms = _msSince(settleStarted);
                _firstFrameTimedOut = true;
                _emitPlayback('first_frame_timeout', positionMs: ms, offerId: slot.slideId, mediaUrl: path);
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
      debugPrint(
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
    // Position advance is the proof of a decoded frame. Do not require isPlaying —
    // iOS often reports !isPlaying while buffering even after play() succeeded.
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
        'audiblePlaying': audiblePlayingCount,
        'at': DateTime.now().toUtc().toIso8601String(),
      });
      debugPrint(
        'MIRA_DISCOVER_FF mediaId=${_mediaIdOf(assetPath)} '
        'offer=${slot.slideId} firstFrameMs=$ms '
        'source=${lastAttachPhases['source']} '
        'cacheSource=${lastAttachPhases['cacheSource']} '
        'cacheBytes=${lastAttachPhases['cacheBytes']} '
        'audioCutMs=${lastAttachPhases['audioCut']} '
        'audible=$audiblePlayingCount '
        'initStart=${lastAttachPhases['initStart']} '
        'initDone=${lastAttachPhases['initDone']} '
        'playStart=${lastAttachPhases['playStart']} '
        'resolveMs=${(lastAttachPhases['resolveDone'] ?? 0) - (lastAttachPhases['resolveStart'] ?? 0)} '
        'seekNudge=${lastAttachPhases['seekNudgeMs']}',
      );
      debugPrint(
        'MIRA_DISCOVER_SWIPE settle mediaId=${_mediaIdOf(assetPath)} '
        'offer=${slot.slideId} claim=${lastAttachPhases['source']} '
        'cache=${lastAttachPhases['cacheSource']} bytes=${lastAttachPhases['cacheBytes']} '
        'audioCutMs=${lastAttachPhases['audioCut']} firstFrameMs=$ms '
        'audible=$audiblePlayingCount',
      );
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
    final token = ++_generation;
    final controller = _controller;
    final path = _activePath;
    final pos = controller?.value.position.inMilliseconds;
    if (_controller == controller) {
      _controller = null;
      _activePath = null;
    }
    if (path != null && path.isNotEmpty) {
      _emitPlayback('stopped', positionMs: pos, offerId: slot.slideId, mediaUrl: path);
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
    if (token != _generation || _released) return;
  }

  @override
  Future<void> release() async {
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
    if (controller != null) {
      await controller.pause();
      await controller.dispose();
    }
    if (warm != null && warm != controller) await warm.dispose();
    if (parked != null && parked != controller && parked != warm) await parked.dispose();
    for (final c in prepared.values) {
      if (c != controller && c != warm && c != parked) {
        await c.dispose();
      }
    }
    if (token != _generation) return;
  }

  /// Path currently being warmed (null when idle).
  String? get warmingPath => _warmPath;

  /// Path of the active (on-screen) controller, if any.
  String? get activePath => _activePath;

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
        previousInit.completeError(StateError('warm superseded'));
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
        if (!initGate.isCompleted) {
          initGate.completeError(StateError('warm cancelled'));
        }
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
    } catch (_) {
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
