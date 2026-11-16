import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/presentation/presentation/discover_presentation_catalog.dart';
import 'package:mirra/features/marketplace/presentation/presentation/presentation_models.dart';
import 'package:mirra/features/marketplace/presentation/presentation/presentation_video_port.dart';

import 'controllable_video_controller.dart';

const _clip = PresentationSamples.clip;
const _slotA = PresentationSlot('slide-a', 0);
const _slotB = PresentationSlot('slide-b', 0);

AssetVideoPort _port() {
  return AssetVideoPort(
    createController: (path) => ControllableVideoController(path),
  );
}

ControllableVideoController _controllerFor(AssetVideoPort port) {
  final view = port.buildView();
  expect(view, isNotNull);
  // AssetVideoPort keeps the live controller internally; tests reach it via factory instances.
  final live = ControllableVideoController.instances
      .where((c) => !c.disposed && c.value.isInitialized)
      .toList();
  expect(live.length, 1);
  return live.single;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    ControllableVideoController.instances.clear();
  });

  test('late A then B: finishing A does not play A or change B', () async {
    final port = _port();
    final a = ControllableVideoController(_clip)..initDelay = const Duration(milliseconds: 400);
    final b = ControllableVideoController(_clip);
    var created = 0;
    final port2 = AssetVideoPort(
      createController: (path) {
        created += 1;
        return created == 1 ? a : b;
      },
    );
    final first = port2.attach(_slotA, _clip);
    await Future<void>.delayed(const Duration(milliseconds: 50));
    await port2.attach(_slotB, _clip);
    await first;
    await Future<void>.delayed(const Duration(milliseconds: 500));
    expect(port2.activeSlot, _slotB);
    expect(b.playCalls, greaterThan(0));
    expect(a.playCalls, 0);
    expect(a.disposed || !a.value.isPlaying, isTrue);
    await port2.release();
  });

  test('video then image detaches the player', () async {
    final port = _port();
    await port.attach(_slotA, _clip);
    await Future<void>.delayed(const Duration(milliseconds: 20));
    final controller = _controllerFor(port);
    await port.detach(_slotA);
    expect(controller.pauseCalls, greaterThan(0));
    // Park keeps the initialized controller for a fast swipe-back.
    expect(controller.disposed, isFalse);
    expect(port.playback, PresentationPlayback.idle);
    await port.release();
    expect(controller.disposed, isTrue);
  });

  test('same file on two slides keeps the latest slot', () async {
    final port = _port();
    await port.attach(_slotA, _clip);
    await Future<void>.delayed(const Duration(milliseconds: 20));
    final first = ControllableVideoController.instances.single;
    await port.attach(_slotB, _clip);
    await Future<void>.delayed(const Duration(milliseconds: 20));
    expect(port.activeSlot, _slotB);
    // Previous clip is parked (muted), not disposed.
    expect(first.disposed, isFalse);
    expect(first.lastVolume, 0);
    expect(ControllableVideoController.instances.where((c) => !c.disposed).length, lessThanOrEqualTo(2));
    await port.release();
  });

  test('detach of A may finish pause after B attach without harming B', () async {
    final a = ControllableVideoController(_clip);
    final b = ControllableVideoController(_clip);
    a.pauseGate = Completer<void>();
    var created = 0;
    final port = AssetVideoPort(
      createController: (_) {
        created += 1;
        return created == 1 ? a : b;
      },
    );
    await port.attach(_slotA, _clip);
    expect(a.playCalls, greaterThan(0));
    final detachA = port.detach(_slotA);
    await Future<void>.delayed(const Duration(milliseconds: 5));
    await port.attach(_slotB, _clip);
    a.pauseGate!.complete();
    await detachA;
    expect(port.activeSlot, _slotB);
    expect(b.disposed, isFalse);
    expect(b.playCalls, greaterThan(0));
    expect(a.pauseCalls, greaterThan(0));
    await port.release();
  });

  test('stale attach completion after newer slot does not play A', () async {
    final first = ControllableVideoController(_clip)..initDelay = const Duration(milliseconds: 300);
    final second = ControllableVideoController(_clip);
    var n = 0;
    final port = AssetVideoPort(
      createController: (_) {
        n += 1;
        return n == 1 ? first : second;
      },
    );
    final attachA = port.attach(_slotA, _clip);
    await Future<void>.delayed(const Duration(milliseconds: 30));
    await port.attach(_slotB, _clip);
    await attachA;
    await Future<void>.delayed(const Duration(milliseconds: 400));
    expect(port.activeSlot, _slotB);
    expect(second.disposeCalls, 0);
    expect(second.playCalls, greaterThan(0));
    await port.release();
  });

  test('release during init prevents play', () async {
    final port = _port();
    final controller = ControllableVideoController(_clip)
      ..initGate = Completer<void>();
    final port2 = AssetVideoPort(createController: (_) => controller);
    final pending = port2.attach(_slotA, _clip);
    await Future<void>.delayed(const Duration(milliseconds: 30));
    await port2.release();
    controller.initGate!.complete();
    await pending;
    expect(controller.playCalls, 0);
    expect(port2.playback, PresentationPlayback.idle);
  });

  test('pause during init leaves player stopped', () async {
    final controller = ControllableVideoController(_clip)
      ..initGate = Completer<void>();
    final port = AssetVideoPort(createController: (_) => controller);
    final pending = port.attach(_slotA, _clip);
    await port.pause();
    controller.initGate!.complete();
    await pending;
    expect(controller.playCalls, 0);
    await port.release();
  });

  test('init failure then retry succeeds', () async {
    var attempt = 0;
    final port = AssetVideoPort(
      createController: (_) {
        attempt += 1;
        return ControllableVideoController(_clip)..failInit = attempt == 1;
      },
    );
    await port.attach(_slotA, _clip);
    expect(port.playback, PresentationPlayback.failed);
    await port.retry(_slotA, _clip);
    await Future<void>.delayed(const Duration(milliseconds: 20));
    expect(port.playback, PresentationPlayback.ready);
    await port.release();
  });

  test('repeated init failure stays failed', () async {
    final port = AssetVideoPort(
      createController: (_) => ControllableVideoController(_clip)..failInit = true,
    );
    await port.attach(_slotA, _clip);
    await port.retry(_slotA, _clip);
    expect(port.playback, PresentationPlayback.failed);
    await port.release();
  });

  test('runtime error after ready marks failed', () async {
    final port = AssetVideoPort(
      createController: (_) => ControllableVideoController(_clip)..failAfterReady = true,
    );
    await port.attach(_slotA, _clip);
    await Future<void>.delayed(const Duration(milliseconds: 50));
    expect(port.playback, PresentationPlayback.failed);
    await port.release();
  });

  test('only one active player and dispose on release', () async {
    final port = _port();
    await port.attach(_slotA, _clip);
    await Future<void>.delayed(const Duration(milliseconds: 20));
    expect(ControllableVideoController.instances.where((c) => !c.disposed).length, 1);
    await port.attach(_slotB, _clip);
    await Future<void>.delayed(const Duration(milliseconds: 20));
    // Active + parked previous clip (muted) may both exist; release clears both.
    expect(ControllableVideoController.instances.where((c) => !c.disposed).length, lessThanOrEqualTo(2));
    expect(port.activeSlot, _slotB);
    await port.release();
    expect(ControllableVideoController.instances.where((c) => !c.disposed), isEmpty);
  });

  test('setVolume that finishes after pause does not play', () async {
    final controller = ControllableVideoController(_clip)..volumeGate = Completer<void>();
    final port = AssetVideoPort(createController: (_) => controller);
    final pending = port.attach(_slotA, _clip);
    await Future<void>.delayed(Duration.zero);
    expect(controller.setVolumeCalls, 1);
    await port.pause();
    controller.volumeGate!.complete();
    await pending;
    expect(controller.playCalls, 0);
    expect(port.isPlaying, isFalse);
  });

  test('mute survives the next attach and is applied before play', () async {
    final port = _port();
    await port.setMuted(true);
    await port.attach(_slotA, _clip);
    final first = ControllableVideoController.instances.where((item) => !item.disposed).single;
    expect(first.lastVolume, 0);
    expect(first.playCalls, 1);
    await port.attach(_slotB, _clip);
    final live = ControllableVideoController.instances.where((item) => !item.disposed).last;
    expect(port.isMuted, isTrue);
    expect(live.lastVolume, 0);
    await port.release();
  });

  test('ready exposes the view as soon as initialize finishes', () async {
    final controller = ControllableVideoController(_clip);
    final port = AssetVideoPort(createController: (_) => controller);
    await port.attach(_slotA, _clip);
    expect(port.playback, PresentationPlayback.ready);
    expect(port.buildView(), isNotNull);
    expect(controller.playCalls, greaterThan(0));
    final firstFrame = port.playbackEvents.where((e) => e.type == 'first_frame');
    expect(firstFrame, isNotEmpty);
    expect(port.hasVisibleProgress, isTrue);
    await port.release();
  });

  test('first_frame waits for progressing position after play, not initialize alone', () async {
    final controller = ControllableVideoController(_clip);
    final port = AssetVideoPort(createController: (_) => controller);
    await port.attach(_slotA, _clip);
    final first = port.playbackEvents.where((e) => e.type == 'first_frame').single;
    expect(controller.playCalls, greaterThan(0));
    expect(controller.value.position > Duration.zero, isTrue);
    expect(first.positionMs, isNotNull);
    expect(port.hasVisibleProgress, isTrue);
    await port.release();
  });

  test('settle timer includes warm wait (starts before pending warm completes)', () async {
    final warmCtrl = ControllableVideoController(_clip)..initDelay = const Duration(milliseconds: 120);
    final playCtrl = ControllableVideoController(_clip);
    var n = 0;
    final port = AssetVideoPort(
      createController: (_) {
        n += 1;
        return n == 1 ? warmCtrl : playCtrl;
      },
    );
    // Start warm with a slow initialize, then attach same path (claims warm).
    unawaited(port.warm(_clip));
    await Future<void>.delayed(const Duration(milliseconds: 20));
    final started = DateTime.now().toUtc();
    await port.attach(_slotA, _clip);
    final first = port.playbackEvents.where((e) => e.type == 'first_frame').single;
    final wall = DateTime.now().toUtc().difference(started).inMilliseconds;
    // first_frame ms must reflect settle→progress including remaining warm wait.
    expect(first.positionMs, greaterThanOrEqualTo(80));
    expect(first.positionMs, lessThanOrEqualTo(wall + 50));
    await port.release();
  });

  test('stalled play emits first_frame_timeout not first_frame', () async {
    final controller = ControllableVideoController(_clip)..advanceOnPlay = false;
    final port = AssetVideoPort(createController: (_) => controller);
    await port.attach(_slotA, _clip);
    expect(port.playbackEvents.where((e) => e.type == 'first_frame'), isEmpty);
    expect(port.playbackEvents.where((e) => e.type == 'first_frame_timeout'), isNotEmpty);
    expect(port.hasVisibleProgress, isFalse);
    expect(port.firstFrameTimedOut, isTrue);
    await port.release();
  });

  test('park survives while next is warming (swipe-back reuses decoder)', () async {
    final a = ControllableVideoController('$_clip-a');
    final b = ControllableVideoController('$_clip-b');
    final c = ControllableVideoController('$_clip-c');
    var n = 0;
    final port = AssetVideoPort(
      createController: (_) {
        n += 1;
        return n == 1 ? a : (n == 2 ? b : c);
      },
    );
    await port.attach(_slotA, '$_clip-a');
    await port.attach(_slotB, '$_clip-b');
    expect(a.disposed, isFalse, reason: 'A must be parked after leaving for B');
    // Warm next while A is parked — must NOT dispose A.
    unawaited(port.warm('$_clip-c'));
    await Future<void>.delayed(const Duration(milliseconds: 30));
    expect(a.disposed, isFalse, reason: 'warming C must keep parked A');
    final createdBeforeBack = n;
    await port.attach(_slotA, '$_clip-a');
    expect(n, createdBeforeBack, reason: 'swipe-back must claim parked A, not open cold');
    expect(a.disposed, isFalse);
    expect(port.lastAttachPhases['source'], 2);
    await port.release();
  });

  test('reactivating a parked clip requires new progress past prior position', () async {
    final controller = ControllableVideoController(_clip);
    final port = AssetVideoPort(createController: (_) => controller);
    await port.attach(_slotA, _clip);
    expect(port.hasVisibleProgress, isTrue);
    final firstPos = controller.value.position;
    await port.detach(_slotA);
    // Parked controller keeps prior position; next attach must advance beyond it.
    controller.advanceOnPlay = false;
    final pending = port.attach(_slotA, _clip);
    await Future<void>.delayed(const Duration(milliseconds: 40));
    expect(port.playbackEvents.where((e) => e.type == 'first_frame').length, 1);
    // Advance past the floor after reactivation.
    controller.value = controller.value.copyWith(
      isPlaying: true,
      position: firstPos + const Duration(milliseconds: 32),
    );
    await pending;
    expect(port.playbackEvents.where((e) => e.type == 'first_frame').length, 2);
    expect(port.hasVisibleProgress, isTrue);
    await port.release();
  });

  test('attach reuses in-flight warm controller instead of disposing it', () async {
    final warmCtrl = ControllableVideoController(_clip)
      ..initGate = Completer<void>()
      ..initDelay = Duration.zero;
    var created = 0;
    final port = AssetVideoPort(
      createController: (_) {
        created += 1;
        return created == 1 ? warmCtrl : ControllableVideoController('$_clip-cold');
      },
    );
    final warming = port.warm(_clip);
    await Future<void>.delayed(const Duration(milliseconds: 20));
    expect(port.warmingPath, _clip);
    expect(created, 1);
    // Swipe while warm is still initializing — must keep the same controller.
    final attaching = port.attach(_slotA, _clip);
    await Future<void>.delayed(const Duration(milliseconds: 20));
    warmCtrl.initGate!.complete();
    await warming;
    await attaching;
    expect(created, 1, reason: 'must not open a second cold controller');
    expect(port.lastAttachPhases['source'], 1);
    expect(warmCtrl.playCalls, greaterThan(0));
    expect(warmCtrl.disposed, isFalse);
    await port.release();
  });

  test('buildView stays opaque under cover; progress clears cover gate', () async {
    final controller = ControllableVideoController(_clip)..advanceOnPlay = false;
    final port = AssetVideoPort(createController: (_) => controller);
    final pending = port.attach(_slotA, _clip);
    await Future<void>.delayed(const Duration(milliseconds: 30));
    expect(port.playback, PresentationPlayback.ready);
    final before = port.buildView();
    expect(before, isNotNull, reason: 'opaque surface so iOS decoder can advance');
    expect(before, isNot(isA<Opacity>()));
    expect(port.hasVisibleProgress, isFalse, reason: 'cover stays until position advances');
    controller.value = controller.value.copyWith(
      isPlaying: true,
      position: const Duration(milliseconds: 16),
    );
    await pending;
    expect(port.hasVisibleProgress, isTrue);
    expect(port.buildView(), isNotNull);
    await port.release();
  });
}
