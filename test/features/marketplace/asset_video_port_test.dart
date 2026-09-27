import 'dart:async';

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
    expect(controller.disposeCalls, 1);
    expect(port.playback, PresentationPlayback.idle);
    await port.release();
  });

  test('same file on two slides keeps the latest slot', () async {
    final port = _port();
    await port.attach(_slotA, _clip);
    await Future<void>.delayed(const Duration(milliseconds: 20));
    final first = ControllableVideoController.instances.single;
    await port.attach(_slotB, _clip);
    await Future<void>.delayed(const Duration(milliseconds: 20));
    expect(port.activeSlot, _slotB);
    expect(first.disposed, isTrue);
    expect(ControllableVideoController.instances.where((c) => !c.disposed).length, 1);
    await port.release();
  });

  test('detach of A may finish pause/dispose after B attach without harming B', () async {
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
    expect(a.disposed, isTrue);
    expect(a.pauseCalls, greaterThan(0));
    expect(a.disposeCalls, 1);
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
    expect(ControllableVideoController.instances.where((c) => !c.disposed).length, 1);
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
    final first = ControllableVideoController.instances.single;
    expect(first.lastVolume, 0);
    expect(first.playCalls, 1);
    await port.attach(_slotB, _clip);
    final live = ControllableVideoController.instances.where((item) => !item.disposed).single;
    expect(port.isMuted, isTrue);
    expect(live.lastVolume, 0);
    await port.release();
  });
}
