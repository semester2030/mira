import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/presentation/presentation/discover_presentation_catalog.dart';
import 'package:mirra/features/marketplace/presentation/presentation/presentation_models.dart';
import 'package:mirra/features/marketplace/presentation/presentation/presentation_video_port.dart';

import 'controllable_video_controller.dart';

/// Mirrors `_PresentationPage._syncVideo` ownership guards for A→image→A.
///
/// Full DiscoverPresentationScreen horizontal fling remains UNTESTED (chrome
/// hit-testing). Port-level attach/cut coverage is in asset_video_port_test.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(ControllableVideoController.instances.clear);

  test('screen-sync pattern: stale cut after A→image→A does not detach new attach', () async {
    final first = ControllableVideoController(PresentationSamples.clip)
      ..advanceOnPlay = true;
    final second = ControllableVideoController(PresentationSamples.clip)
      ..advanceOnPlay = true;
    var created = 0;
    final port = AssetVideoPort(
      createController: (_) {
        created += 1;
        return created == 1 ? first : second;
      },
    );
    addTearDown(() async {
      await port.release();
    });

    const slot = PresentationSlot('mix-a', 0);
    await port.attach(slot, PresentationSamples.clip);
    final genLeaving = port.debugGeneration;

    first.volumeGate = Completer<void>();
    var releasedAfterStaleCut = false;
    final cut = () async {
      await port.cutOutgoingAudio(ownerSlot: slot, generation: genLeaving);
      // Guards copied from discover_presentation_screen._syncVideo:
      if (port.debugGeneration != genLeaving) return;
      if (port.activeSlot?.same(slot) != true) return;
      // Would call _releaseHeld() / detach here — must not run after reattach.
      releasedAfterStaleCut = true;
      await port.detach(slot);
    }();

    await Future<void>.delayed(const Duration(milliseconds: 20));
    final reattach = port.attach(slot, PresentationSamples.clip);
    await Future<void>.delayed(const Duration(milliseconds: 20));
    expect(port.debugGeneration, greaterThan(genLeaving));

    first.volumeGate!.complete();
    await cut;
    await reattach;

    expect(releasedAfterStaleCut, isFalse, reason: 'stale cut must not release');
    expect(port.activeSlot?.same(slot), isTrue);
    expect(second.lastVolume, 1);
    expect(created, greaterThanOrEqualTo(2));
  });
}
