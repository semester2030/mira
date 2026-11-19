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
    AssetVideoPort.debugResetAttemptCounters();
    AssetVideoPort.debugInitializeTimeout = null;
    AssetVideoPort.debugBeforeControllerOpen = null;
  });

  tearDown(() {
    AssetVideoPort.debugInitializeTimeout = null;
    AssetVideoPort.debugBeforeControllerOpen = null;
    expect(
      AssetVideoPort.debugAttemptEndCount,
      AssetVideoPort.debugAttemptStartCount,
      reason: 'every attempt start must have exactly one end',
    );
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
    expect(controller.setVolumeCalls, greaterThanOrEqualTo(1));
    await port.pause();
    controller.volumeGate!.complete();
    await pending;
    expect(controller.playCalls, 0);
    expect(port.isPlaying, isFalse);
  });

  test('mute survives the next attach and stays muted after first frame', () async {
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

  test('outgoing audio is cut before warm wait; speakers arm only after first frame', () async {
    final leaving = ControllableVideoController('$_clip-leave')
      ..advanceOnPlay = true;
    final warmCtrl = ControllableVideoController(_clip)..initDelay = const Duration(milliseconds: 80);
    var n = 0;
    final port = AssetVideoPort(
      createController: (_) {
        n += 1;
        return n == 1 ? leaving : warmCtrl;
      },
    );
    await port.attach(_slotA, '$_clip-leave');
    expect(leaving.lastVolume, 1);
    unawaited(port.warm(_clip));
    await Future<void>.delayed(const Duration(milliseconds: 10));
    final pending = port.attach(_slotB, _clip);
    // cutOutgoingAudio + silence previous must run before warm init finishes.
    await Future<void>.delayed(Duration.zero);
    expect(leaving.lastVolume, 0);
    expect(leaving.value.isPlaying, isFalse);
    await pending;
    expect(port.hasVisibleProgress, isTrue);
    expect(warmCtrl.lastVolume, 1);
    expect(port.audiblePlayingCount, lessThanOrEqualTo(1));
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

  test('leaveSection parks sticky clip so return claims prepared', () async {
    final a = ControllableVideoController('$_clip-a');
    final b = ControllableVideoController('$_clip-b');
    var n = 0;
    final port = AssetVideoPort(
      createController: (_) {
        n += 1;
        return n == 1 ? a : b;
      },
    );
    await port.attach(_slotA, '$_clip-a');
    expect(port.hasVisibleProgress, isTrue);
    await port.leaveSection();
    expect(a.disposed, isFalse, reason: 'leaveSection must park, not dispose');
    final before = n;
    await port.attach(_slotA, '$_clip-a');
    expect(n, before, reason: 'return must reclaim parked/prepared decoder');
    expect(port.lastAttachPhases['source'], anyOf(2, 3));
    expect(port.hasVisibleProgress, isTrue);
    await port.release();
  });

  test('detach without first frame emits left_dark', () async {
    final controller = ControllableVideoController(_clip)..advanceOnPlay = false;
    final port = AssetVideoPort(createController: (_) => controller);
    final pending = port.attach(_slotA, _clip);
    await Future<void>.delayed(const Duration(milliseconds: 40));
    expect(port.hasVisibleProgress, isFalse);
    await port.detach(_slotA);
    await pending;
    expect(port.playbackEvents.where((e) => e.type == 'left_dark'), isNotEmpty);
    await port.release();
  });

  test('attach claims unprimed warm (pos0) without cold reopen', () async {
    // Simulates mute-prime never advancing: warm stays initialized at 0.
    // Old path awaited warmFuture, rejected pos0, disposed, then cold-opened
    // under the dark cover for multi-second stalls.
    final warmCtrl = ControllableVideoController(_clip)..advanceOnPlay = false;
    var created = 0;
    final port = AssetVideoPort(
      createController: (_) {
        created += 1;
        return created == 1 ? warmCtrl : ControllableVideoController('$_clip-cold');
      },
    );
    unawaited(port.warm(_clip));
    await Future<void>.delayed(const Duration(milliseconds: 60));
    expect(warmCtrl.value.isInitialized, isTrue);
    expect(warmCtrl.value.position, Duration.zero);
    final pending = port.attach(_slotA, _clip);
    await Future<void>.delayed(const Duration(milliseconds: 40));
    expect(created, 1, reason: 'must claim warm, not open a second controller');
    expect(port.lastAttachPhases['source'], 1);
    expect(warmCtrl.disposed, isFalse);
    // Attach play advances cover gate.
    warmCtrl.value = warmCtrl.value.copyWith(
      isPlaying: true,
      position: const Duration(milliseconds: 16),
    );
    await pending;
    expect(port.hasVisibleProgress, isTrue);
    expect(port.audiblePlayingCount, lessThanOrEqualTo(1));
    await port.release();
  });

  test('cutOutgoingAudio with foreign ownerSlot does not mute active clip', () async {
    final controller = ControllableVideoController(_clip)..advanceOnPlay = true;
    final port = AssetVideoPort(createController: (_) => controller);
    await port.attach(_slotA, _clip);
    expect(controller.lastVolume, 1);
    await port.cutOutgoingAudio(ownerSlot: _slotB);
    expect(controller.lastVolume, 1, reason: 'foreign owner must not cut');
    expect(port.audiblePlayingCount, 1);
    await port.cutOutgoingAudio(ownerSlot: _slotA);
    expect(controller.lastVolume, 0);
    await port.release();
  });

  test('cutOutgoingAudio with stale generation is skipped', () async {
    final controller = ControllableVideoController(_clip)..advanceOnPlay = true;
    final port = AssetVideoPort(createController: (_) => controller);
    await port.attach(_slotA, _clip);
    final stale = port.debugGeneration - 1;
    await port.cutOutgoingAudio(ownerSlot: _slotA, generation: stale);
    expect(controller.lastVolume, 1);
    await port.release();
  });

  test('A→image→A: delayed mute of old gen does not mute reattached A', () async {
    final first = ControllableVideoController(_clip)..advanceOnPlay = true;
    final second = ControllableVideoController(_clip)..advanceOnPlay = true;
    var created = 0;
    final port = AssetVideoPort(
      createController: (_) {
        created += 1;
        return created == 1 ? first : second;
      },
    );
    await port.attach(_slotA, _clip);
    expect(first.lastVolume, 1);
    final genLeaving = port.debugGeneration;

    // Slow mute on the leaving controller (image swipe cut still in flight).
    first.volumeGate = Completer<void>();
    final staleCut =
        port.cutOutgoingAudio(ownerSlot: _slotA, generation: genLeaving);
    await Future<void>.delayed(const Duration(milliseconds: 20));

    // Return to video A before stale cut finishes — attach bumps generation first.
    final reattach = port.attach(_slotA, _clip);
    await Future<void>.delayed(const Duration(milliseconds: 20));
    expect(port.debugGeneration, greaterThan(genLeaving));

    first.volumeGate!.complete();
    await staleCut;
    await reattach;

    expect(port.debugGeneration, greaterThan(genLeaving));
    expect(second.lastVolume, 1, reason: 'reattached A must stay audible');
    expect(port.audiblePlayingCount, 1);
    await port.release();
  });

  test('listener during in-flight seek does not count seek landing as progress', () async {
    final controller = ControllableVideoController(_clip)..advanceOnPlay = false;
    final port = AssetVideoPort(createController: (_) => controller);
    unawaited(port.warm(_clip));
    await Future<void>.delayed(const Duration(milliseconds: 60));
    expect(controller.value.isInitialized, isTrue);

    controller.seekGate = Completer<void>();
    final pending = port.attach(_slotA, _clip);
    // Wait until seek nudge starts (warm reused decoder, ≥120ms after play).
    final seekDeadline = DateTime.now().add(const Duration(seconds: 2));
    while (controller.seekCalls == 0 && DateTime.now().isBefore(seekDeadline)) {
      await Future<void>.delayed(const Duration(milliseconds: 20));
    }
    expect(controller.seekCalls, 1);
    expect(controller.lastSeekTo, const Duration(milliseconds: 32));
    // Position already at seek target while seekGate holds — must NOT count yet.
    expect(controller.value.position.inMilliseconds, 32);
    expect(port.hasVisibleProgress, isFalse);
    expect(port.playbackEvents.where((e) => e.type == 'first_frame'), isEmpty);

    controller.seekGate!.complete();
    await Future<void>.delayed(const Duration(milliseconds: 120));
    expect(port.hasVisibleProgress, isFalse,
        reason: 'seek landing alone is not position progress');

    controller.tickPosition(const Duration(milliseconds: 16));
    await pending;
    expect(port.hasVisibleProgress, isTrue);
    expect(port.lastAttachPhases['seekDoneMs'], isNotNull);
    await port.release();
  });

  test('unmute is a single shared op per attempt', () async {
    final controller = ControllableVideoController(_clip)..advanceOnPlay = true;
    final port = AssetVideoPort(createController: (_) => controller);
    await port.attach(_slotA, _clip);
    expect(port.hasVisibleProgress, isTrue);
    // setVolume(0) mute-prime + one setVolume(1) arm — never two unmutes.
    expect(controller.setVolumeCalls, 2);
    expect(controller.lastVolume, 1);
    await port.release();
  });

  test('late unmute of left attempt does not re-arm after A→B', () async {
    final a = ControllableVideoController('$_clip-a')
      ..advanceOnPlay = true
      ..gateAudibleOnly = true
      ..volumeGate = Completer<void>();
    final b = ControllableVideoController('$_clip-b')..advanceOnPlay = true;
    var n = 0;
    final port = AssetVideoPort(
      createController: (_) {
        n += 1;
        return n == 1 ? a : b;
      },
    );
    final first = port.attach(_slotA, '$_clip-a');
    // Mute-prime (volume 0) proceeds; audible arm waits on volumeGate.
    final armDeadline = DateTime.now().add(const Duration(seconds: 2));
    while (a.setVolumeCalls < 2 && DateTime.now().isBefore(armDeadline)) {
      await Future<void>.delayed(const Duration(milliseconds: 5));
    }
    expect(a.setVolumeCalls, greaterThanOrEqualTo(2));
    expect(a.value.volume, 0, reason: 'unmute still gated; value not applied yet');
    await port.attach(_slotB, '$_clip-b');
    a.volumeGate!.complete();
    await first;
    await Future<void>.delayed(const Duration(milliseconds: 40));
    expect(b.lastVolume, 1);
    expect(a.value.volume, 0, reason: 'stale A unmute must not win after leave');
    expect(port.audiblePlayingCount, 1);
    await port.release();
  });

  test('stale unmute does not mute same controller reused by A→image→A', () async {
    final firstGate = Completer<void>();
    final shared = ControllableVideoController(_clip)
      ..advanceOnPlay = true
      ..gateAudibleOnly = true
      ..volumeGate = firstGate;
    final port = AssetVideoPort(createController: (_) => shared);
    final first = port.attach(_slotA, _clip);
    final armDeadline = DateTime.now().add(const Duration(seconds: 2));
    while (shared.setVolumeCalls < 2 && DateTime.now().isBefore(armDeadline)) {
      await Future<void>.delayed(const Duration(milliseconds: 5));
    }
    expect(shared.setVolumeCalls, greaterThanOrEqualTo(2));
    // Detach without awaiting first — it is blocked on firstGate unmute.
    await port.detach(_slotA);
    // Finish the first attempt so park completes; keep firstGate open for stale unmute.
    // The pending setVolume(1) still awaits firstGate.
    final secondGate = Completer<void>();
    shared.volumeGate = secondGate;
    final second = port.attach(_slotA, _clip);
    final secondArm = DateTime.now().add(const Duration(seconds: 2));
    while (shared.setVolumeCalls < 4 && DateTime.now().isBefore(secondArm)) {
      await Future<void>.delayed(const Duration(milliseconds: 5));
    }
    expect(shared.setVolumeCalls, greaterThanOrEqualTo(4));
    secondGate.complete();
    await second.timeout(const Duration(seconds: 2));
    await Future<void>.delayed(const Duration(milliseconds: 30));
    expect(shared.value.volume, 1, reason: 'new attempt must be audible');
    expect(shared.lastVolume, 1);
    final volumeCallsAfterArm = shared.setVolumeCalls;
    firstGate.complete();
    await first.timeout(const Duration(seconds: 2));
    await Future<void>.delayed(const Duration(milliseconds: 40));
    expect(shared.value.volume, 1, reason: 'stale unmute must not mute reused live controller');
    expect(shared.lastVolume, 1);
    expect(shared.setVolumeCalls, volumeCallsAfterArm,
        reason: 'stale path must not issue another setVolume after new arm');
    expect(port.audiblePlayingCount, 1);
    await port.release();
  });

  test('mute toggle during pending unmute leaves final mute state', () async {
    final controller = ControllableVideoController(_clip)
      ..advanceOnPlay = true
      ..gateAudibleOnly = true
      ..volumeGate = Completer<void>();
    final port = AssetVideoPort(createController: (_) => controller);
    final pending = port.attach(_slotA, _clip);
    final armDeadline = DateTime.now().add(const Duration(seconds: 2));
    while (controller.setVolumeCalls < 2 && DateTime.now().isBefore(armDeadline)) {
      await Future<void>.delayed(const Duration(milliseconds: 5));
    }
    await port.setMuted(true);
    controller.volumeGate!.complete();
    await pending;
    await Future<void>.delayed(const Duration(milliseconds: 40));
    expect(port.isMuted, isTrue);
    expect(controller.value.volume, 0);
    await port.release();
  });

  test('stale seek finally does not clear newer seek guard', () async {
    final a = ControllableVideoController('$_clip-a')..advanceOnPlay = false;
    final b = ControllableVideoController('$_clip-b')..advanceOnPlay = false;
    var n = 0;
    final port = AssetVideoPort(
      createController: (_) {
        n += 1;
        return n == 1 ? a : b;
      },
    );
    unawaited(port.warm('$_clip-a'));
    await Future<void>.delayed(const Duration(milliseconds: 40));
    a.seekGate = Completer<void>();
    final first = port.attach(_slotA, '$_clip-a');
    final seekDeadline = DateTime.now().add(const Duration(seconds: 2));
    while (a.seekCalls == 0 && DateTime.now().isBefore(seekDeadline)) {
      await Future<void>.delayed(const Duration(milliseconds: 20));
    }
    expect(a.seekCalls, 1);

    unawaited(port.warm('$_clip-b'));
    await Future<void>.delayed(const Duration(milliseconds: 40));
    b.seekGate = Completer<void>();
    final second = port.attach(_slotB, '$_clip-b');
    final bSeekDeadline = DateTime.now().add(const Duration(seconds: 2));
    while (b.seekCalls == 0 && DateTime.now().isBefore(bSeekDeadline)) {
      await Future<void>.delayed(const Duration(milliseconds: 20));
    }
    expect(b.seekCalls, 1);

    // Finish A seek after B already owns the seek guard.
    a.seekGate!.complete();
    await Future<void>.delayed(const Duration(milliseconds: 40));
    expect(port.hasVisibleProgress, isFalse);
    b.seekGate!.complete();
    await Future<void>.delayed(const Duration(milliseconds: 100));
    b.tickPosition(const Duration(milliseconds: 16));
    await second;
    await first;
    expect(port.hasVisibleProgress, isTrue);
    expect(port.activeSlot, _slotB);
    await port.release();
  });

  test('init timeout ends the attempt via real TimeoutException branch', () async {
    AssetVideoPort.debugInitializeTimeout = const Duration(milliseconds: 40);
    final controller = ControllableVideoController(_clip)
      ..initGate = Completer<void>();
    final port = AssetVideoPort(createController: (_) => controller);
    final pending = port.attach(_slotA, _clip);
    await pending;
    expect(port.playback, PresentationPlayback.failed);
    expect(port.firstFrameTimedOut, isTrue);
    expect(AssetVideoPort.debugAttemptStartCount, 1);
    expect(AssetVideoPort.debugAttemptEndCount, 1);
    controller.initGate!.complete();
    await port.release();
  });

  test('stale A resolve after B attach does not replace B controller', () async {
    final aGate = Completer<void>();
    final a = ControllableVideoController('$_clip-a')..advanceOnPlay = true;
    final b = ControllableVideoController('$_clip-b')..advanceOnPlay = true;
    final port = AssetVideoPort(
      createController: (path) => path.contains('-a') ? a : b,
    );
    AssetVideoPort.debugBeforeControllerOpen = (path) async {
      if (path.contains('-a')) await aGate.future;
    };
    final first = port.attach(_slotA, '$_clip-a');
    await Future<void>.delayed(const Duration(milliseconds: 20));
    await port.attach(_slotB, '$_clip-b');
    expect(port.activeSlot, _slotB);
    expect(b.lastVolume, 1);
    aGate.complete();
    await first.timeout(const Duration(seconds: 2));
    await Future<void>.delayed(const Duration(milliseconds: 40));
    expect(port.activeSlot, _slotB);
    expect(b.disposed, isFalse);
    expect(b.lastVolume, 1);
    // A never became the live controller after B won — either never created or disposed.
    expect(
      a.disposed || a.playCalls == 0,
      isTrue,
      reason: 'stale A must not keep playing after B attach',
    );
    expect(port.playback, isNot(PresentationPlayback.failed));
    expect(port.audiblePlayingCount, 1);
    await port.release();
  });

  test('stale delayed audio cut does not rewrite B state', () async {
    final a = ControllableVideoController('$_clip-a')..advanceOnPlay = true;
    final b = ControllableVideoController('$_clip-b')..advanceOnPlay = true;
    final port = AssetVideoPort(
      createController: (path) => path.contains('-a') ? a : b,
    );
    await port.attach(_slotA, '$_clip-a');
    final genA = port.debugGeneration;
    expect(a.lastVolume, 1);
    await port.attach(_slotB, '$_clip-b');
    expect(port.activeSlot, _slotB);
    expect(b.lastVolume, 1);
    final bPlayback = port.playback;
    // Late cut from A's generation must no-op after B owns the port.
    await port.cutOutgoingAudio(ownerSlot: _slotA, generation: genA);
    await Future<void>.delayed(const Duration(milliseconds: 20));
    expect(port.activeSlot, _slotB);
    expect(port.playback, bPlayback);
    expect(b.lastVolume, 1);
    expect(port.audiblePlayingCount, 1);
    await port.release();
  });

  test('A initialize timeout after B started does not fail B', () async {
    AssetVideoPort.debugInitializeTimeout = const Duration(milliseconds: 50);
    final a = ControllableVideoController('$_clip-a')..initGate = Completer<void>();
    final b = ControllableVideoController('$_clip-b')..advanceOnPlay = true;
    var n = 0;
    final port = AssetVideoPort(
      createController: (_) {
        n += 1;
        return n == 1 ? a : b;
      },
    );
    final first = port.attach(_slotA, '$_clip-a');
    await Future<void>.delayed(const Duration(milliseconds: 20));
    await port.attach(_slotB, '$_clip-b');
    await first;
    await Future<void>.delayed(const Duration(milliseconds: 80));
    expect(port.activeSlot, _slotB);
    expect(port.playback, PresentationPlayback.ready);
    expect(port.hasVisibleProgress, isTrue);
    expect(b.lastVolume, 1);
    a.initGate!.complete();
    await port.release();
  });

  test('stale warm wait does not claim warm prepared for newer attach', () async {
    final warmA = ControllableVideoController('$_clip-a')
      ..initGate = Completer<void>()
      ..advanceOnPlay = true;
    final coldB = ControllableVideoController('$_clip-b')..advanceOnPlay = true;
    var n = 0;
    final port = AssetVideoPort(
      createController: (_) {
        n += 1;
        return n == 1 ? warmA : coldB;
      },
    );
    unawaited(port.warm('$_clip-a'));
    await Future<void>.delayed(const Duration(milliseconds: 20));
    final first = port.attach(_slotA, '$_clip-a');
    await Future<void>.delayed(const Duration(milliseconds: 20));
    // B starts while A is still waiting on warm init.
    final second = port.attach(_slotB, '$_clip-b');
    warmA.initGate!.complete();
    await first;
    await second;
    await Future<void>.delayed(const Duration(milliseconds: 40));
    expect(port.activeSlot, _slotB);
    expect(coldB.disposed, isFalse);
    expect(coldB.lastVolume, 1);
    expect(port.audiblePlayingCount, 1);
    await port.release();
  });
}
