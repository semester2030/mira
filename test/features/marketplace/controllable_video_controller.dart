import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

/// Controllable [VideoPlayerController] for [AssetVideoPort] unit tests only.
class ControllableVideoController extends ValueNotifier<VideoPlayerValue>
    implements VideoPlayerController {
  ControllableVideoController(this.assetPath)
      : super(const VideoPlayerValue(duration: Duration(seconds: 2)));

  static final instances = <ControllableVideoController>{};

  final String assetPath;
  Duration initDelay = Duration.zero;
  bool failInit = false;
  bool failAfterReady = false;

  int initializeCalls = 0;
  int playCalls = 0;
  int pauseCalls = 0;
  int disposeCalls = 0;
  bool disposed = false;

  Completer<void>? initGate;
  Completer<void>? pauseGate;
  Completer<void>? disposeGate;
  Completer<void>? volumeGate;
  int setVolumeCalls = 0;
  double? lastVolume;

  @override
  int playerId = VideoPlayerController.kUninitializedPlayerId;

  @override
  String get dataSource => assetPath;

  @override
  Map<String, String> get httpHeaders => const {};

  @override
  DataSourceType get dataSourceType => DataSourceType.asset;

  @override
  String get package => '';

  @override
  Future<Duration> get position async => value.position;

  @override
  VideoViewType get viewType => VideoViewType.textureView;

  @override
  VideoFormat? get formatHint => null;

  @override
  VideoPlayerOptions? get videoPlayerOptions => null;

  @override
  Future<void> initialize() async {
    initializeCalls += 1;
    instances.add(this);
    if (failInit) {
      throw Exception('init failed');
    }
    if (initGate != null) {
      await initGate!.future;
    }
    if (initDelay > Duration.zero) {
      await Future<void>.delayed(initDelay);
    }
    if (disposed) return;
    value = value.copyWith(
      duration: const Duration(seconds: 2),
      isInitialized: true,
      size: const Size(640, 360),
    );
  }

  @override
  Future<void> play() async {
    playCalls += 1;
    if (disposed || value.hasError) return;
    value = value.copyWith(isPlaying: true);
    if (failAfterReady) {
      value = value.copyWith(
        errorDescription: 'runtime',
        isPlaying: false,
      );
    }
  }

  @override
  Future<List<VideoAudioTrack>> getAudioTracks() async => const [];

  @override
  bool isAudioTrackSupportAvailable() => false;

  @override
  Future<void> selectAudioTrack(String trackId) async {}

  @override
  Future<void> pause() async {
    pauseCalls += 1;
    if (pauseGate != null) {
      await pauseGate!.future;
    }
    if (disposed) return;
    value = value.copyWith(isPlaying: false);
  }

  @override
  Future<void> setLooping(bool looping) async {}

  @override
  Future<void> seekTo(Duration moment) async {
    if (disposed) return;
    value = value.copyWith(position: moment);
  }

  @override
  Future<void> setVolume(double volume) async {
    setVolumeCalls += 1;
    lastVolume = volume;
    if (volumeGate != null) await volumeGate!.future;
  }

  @override
  Future<void> setPlaybackSpeed(double speed) async {}

  @override
  Future<ClosedCaptionFile> get closedCaptionFile async => _EmptyCaptions();

  @override
  void setCaptionOffset(Duration delay) {}

  @override
  Future<void> setClosedCaptionFile(Future<ClosedCaptionFile>? closedCaptionFile) async {}

  @override
  Future<void> dispose() async {
    if (disposeGate != null) {
      await disposeGate!.future;
    }
    disposed = true;
    disposeCalls += 1;
    instances.remove(this);
    super.dispose();
  }

  void tickPosition(Duration delta) {
    if (disposed || !value.isInitialized) return;
    value = value.copyWith(position: value.position + delta);
  }
}

class _EmptyCaptions extends ClosedCaptionFile {
  @override
  List<Caption> get captions => const [];
}
