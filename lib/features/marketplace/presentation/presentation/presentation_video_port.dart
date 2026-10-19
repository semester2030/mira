import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:video_player/video_player.dart';

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
  AssetVideoPort({AssetVideoControllerFactory? createController})
      : _createController = createController ?? VideoPlayerController.asset;

  final AssetVideoControllerFactory _createController;

  VideoPlayerController? _controller;
  String? _activePath;
  VideoPlayerController? _warm;
  String? _warmPath;
  Future<void>? _warmFuture;
  VideoPlayerController? _parked;
  String? _parkedPath;
  int _generation = 0;
  bool _released = false;

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

  VideoPlayerController _open(String assetPath) {
    final uri = Uri.tryParse(assetPath);
    if (uri != null && (uri.isScheme('http') || uri.isScheme('https'))) {
      return VideoPlayerController.networkUrl(uri);
    }
    return _createController(assetPath);
  }

  Future<void> _silence(VideoPlayerController controller) async {
    try {
      await controller.pause();
      await controller.setVolume(0);
    } catch (_) {}
  }

  /// Keeps the clip just left so a swipe back does not initialize it again.
  Future<void> _parkLeaving(VideoPlayerController leaving, String? path) async {
    if (path == null || path.isEmpty || !leaving.value.isInitialized) {
      await _silence(leaving);
      await leaving.dispose();
      return;
    }
    await _silence(leaving);
    final old = _parked;
    _parked = leaving;
    _parkedPath = path;
    if (old != null && old != leaving) {
      await old.dispose();
    }
  }

  @override
  Future<void> attach(PresentationSlot slot, String assetPath) async {
    if (_released) return;
    final token = ++_generation;
    final previous = _controller;
    final previousPath = _activePath;
    _controller = null;
    _activePath = null;
    activeSlot = slot;
    playback = PresentationPlayback.loading;
    errorText = null;
    _notify();

    VideoPlayerController? claimed;
    var claimedReady = false;
    if (_warmPath == assetPath && _warm != null) {
      claimed = _warm;
      final pending = _warmFuture;
      _warm = null;
      _warmPath = null;
      _warmFuture = null;
      if (pending != null) {
        try {
          await pending;
        } catch (_) {}
      }
      claimedReady = claimed?.value.isInitialized ?? false;
    } else if (_parkedPath == assetPath && _parked != null) {
      claimed = _parked;
      _parked = null;
      _parkedPath = null;
      claimedReady = claimed?.value.isInitialized ?? false;
    }
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
      await _parkLeaving(previous, previousPath);
    }
    if (token != _generation || _released) return;

    late final VideoPlayerController controller;
    if (claimed != null && claimedReady) {
      controller = claimed;
    } else {
      if (claimed != null) await claimed.dispose();
      controller = _open(assetPath);
    }
    _controller = controller;
    _activePath = assetPath;
    controller.addListener(() => _onController(controller, token));
    try {
      if (!controller.value.isInitialized) {
        await controller.initialize().timeout(const Duration(seconds: 12));
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
      await controller.setVolume(_muted ? 0 : 1);
      if (!_canStart(controller, token)) {
        await _dropIfStale(controller, token);
        return;
      }
      await controller.setVolume(_muted ? 0 : 1);
      if (!_canStart(controller, token)) {
        await _dropIfStale(controller, token);
        return;
      }
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
      playback = PresentationPlayback.ready;
      errorText = null;
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

  void _onController(VideoPlayerController controller, int token) {
    if (token != _generation || _controller != controller || _released) return;
    if (controller.value.hasError && playback != PresentationPlayback.failed) {
      playback = PresentationPlayback.failed;
      errorText = 'تعذر تشغيل الفيديو';
      controller.pause();
      _notify();
    }
  }

  @override
  Future<void> detach(PresentationSlot slot) async {
    if (activeSlot == null || !activeSlot!.same(slot)) return;
    final token = ++_generation;
    final controller = _controller;
    final path = _activePath;
    if (_controller == controller) {
      _controller = null;
      _activePath = null;
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
    if (controller != null) {
      await controller.pause();
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
    _controller = null;
    _activePath = null;
    _warm = null;
    _warmPath = null;
    _warmFuture = null;
    _parked = null;
    _parkedPath = null;
    activeSlot = null;
    playback = PresentationPlayback.idle;
    if (controller != null) {
      await controller.pause();
      await controller.dispose();
    }
    if (warm != null && warm != controller) await warm.dispose();
    if (parked != null && parked != controller && parked != warm) await parked.dispose();
    if (token != _generation) return;
  }

  /// Initializes the next clip without playing it or playing its audio.
  Future<void> warm(String assetPath) async {
    if (_released || assetPath.isEmpty || _warmPath == assetPath || _activePath == assetPath || _parkedPath == assetPath) return;
    final previous = _warm;
    _warm = null;
    _warmPath = null;
    _warmFuture = null;
    if (previous != null && previous != _controller && previous != _parked) {
      await previous.dispose();
    }
    if (_released) return;
    final uri = Uri.tryParse(assetPath);
    if (uri == null || !(uri.isScheme('http') || uri.isScheme('https'))) return;
    final controller = _open(assetPath);
    _warm = controller;
    _warmPath = assetPath;
    final future = () async {
      await controller.initialize();
      await controller.setVolume(0);
      await controller.pause();
    }();
    _warmFuture = future;
    try {
      await future;
    } catch (_) {
      if (_warm == controller) {
        _warm = null;
        _warmPath = null;
        _warmFuture = null;
        await controller.dispose();
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
    if (controller == null || playback != PresentationPlayback.ready || !controller.value.isInitialized) {
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
    _parked = null;
    _parkedPath = null;
    controller?.dispose();
    if (warm != null && warm != controller) warm.dispose();
    if (parked != null && parked != controller && parked != warm) parked.dispose();
    super.dispose();
  }
}
