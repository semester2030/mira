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

  @override
  Future<void> attach(PresentationSlot slot, String assetPath) async {
    if (_released) return;
    final token = ++_generation;
    final previous = _controller;
    _controller = null;
    activeSlot = slot;
    playback = PresentationPlayback.loading;
    errorText = null;
    _notify();
    if (previous != null) {
      await previous.pause();
      await previous.dispose();
    }
    if (token != _generation || _released) return;

    final uri = Uri.tryParse(assetPath);
    final controller = uri != null && (uri.isScheme('http') || uri.isScheme('https'))
        ? VideoPlayerController.networkUrl(uri)
        : _createController(assetPath);
    _controller = controller;
    controller.addListener(() => _onController(controller, token));
    try {
      await controller.initialize().timeout(const Duration(seconds: 12));
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
    if (_controller == controller) _controller = null;
    activeSlot = null;
    playback = PresentationPlayback.idle;
    errorText = null;
    _notify();
    if (controller != null) {
      await controller.pause();
      await controller.dispose();
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
    _controller = null;
    activeSlot = null;
    playback = PresentationPlayback.idle;
    if (controller != null) {
      await controller.pause();
      await controller.dispose();
    }
    if (token != _generation) return;
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
      fit: BoxFit.contain,
      child: SizedBox(
        width: size.width == 0 ? 16 : size.width,
        height: size.height == 0 ? 9 : size.height,
        child: VideoPlayer(controller),
      ),
    );
  }

  @override
  void dispose() {
    _released = true;
    _generation++;
    final controller = _controller;
    _controller = null;
    controller?.dispose();
    super.dispose();
  }
}
