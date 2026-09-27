import 'dart:convert';
import 'dart:typed_data';
import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/results_experience/domain/perfect_mask_session.dart';
import 'package:mirra/features/results_experience/presentation/face_explorer/face_explorer_controller.dart';
import 'package:mirra/features/results_experience/presentation/face_explorer/face_explorer_image_loader.dart';
import 'package:mirra/features/results_experience/presentation/geometry/skin_face_map_visual_tokens.dart';

PerfectMaskArtifact _art({
  required String concernType,
  required String region,
  Uint8List? bytes,
}) {
  return PerfectMaskArtifact(
    concernType: concernType,
    region: region,
    bytes: bytes ?? Uint8List.fromList([1, 2, 3]),
    width: 10,
    height: 10,
    uiScore: 64,
    scoreOnly: false,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('FaceExplorerController focus + region binding', () {
    test('primary metric order is explicit (not where-only)', () {
      expect(
        FaceExplorerController.primaryConsumerIds,
        ['pores', 'wrinkles', 'acne', 'pigmentation', 'hydration', 'oiliness'],
      );
    });

    test('user focus survives zoom and compare for same binding', () {
      final c = FaceExplorerController(initialSelectedId: 'pores');
      final mask = _art(concernType: 'hd_pore', region: 'whole');
      final profile = PerfectMaskPresentationProfile.pores;
      final src = Uint8List.fromList([9, 9, 9]);
      c.setUserFocusFromNorm(
        sourceNorm01: const Offset(0.22, 0.78),
        mask: mask,
        profile: profile,
        sourceBytes: src,
      );
      c.magnifierZoom = 3.0;
      c.holdingOriginal = true;
      c.holdingOriginal = false;
      final resolved = c.resolvedFocusSourceNorm(
        mask: mask,
        profile: profile,
        sourceBytes: src,
      );
      expect(resolved, const Offset(0.22, 0.78));
      expect(c.lensPanelOpen, isTrue);
    });

    test('focus binding key includes selected subregion', () {
      final c = FaceExplorerController(initialSelectedId: 'pores');
      c.selectedSubregion = 'forehead';
      final forehead = _art(concernType: 'hd_pore', region: 'forehead');
      final profile = PerfectMaskPresentationProfile.pores;
      final src = Uint8List.fromList([1]);
      final key = c.focusBindingKey(
        mask: forehead,
        profile: profile,
        sourceBytes: src,
      );
      expect(key.contains('forehead'), isTrue);
      expect(key.contains('hd_pore::forehead'), isTrue);
      expect(c.regionStrict, isTrue);
    });

    test('focus shortcuts open lens without inventing measurement region', () {
      final c = FaceExplorerController(initialSelectedId: 'oiliness');
      final beforeRegion = c.selectedSubregion;
      final mask = _art(concernType: 'hd_oiliness', region: 'whole');
      c.setUserFocusFromNorm(
        sourceNorm01: FaceExplorerController.focusShortcuts.first.sourceNorm,
        mask: mask,
        profile: PerfectMaskPresentationProfile.oiliness,
        sourceBytes: Uint8List.fromList([4]),
        shortcutId: 'forehead',
      );
      expect(c.focusShortcutId, 'forehead');
      expect(c.selectedSubregion, beforeRegion);
      expect(c.lensPanelOpen, isTrue);
    });

    test('export status is enum-driven (not Arabic startsWith)', () {
      final c = FaceExplorerController();
      c.markExportBusy();
      expect(c.exportBusy, isTrue);
      expect(c.exportFailed, isFalse);
      c.markExportFailed();
      expect(c.exportFailed, isTrue);
      expect(c.exportBusy, isFalse);
      c.markExportReady();
      expect(c.exportStatus, FaceExplorerExportUiStatus.ready);
    });
  });

  group('FaceExplorerImageLoader generation guard', () {
    test('invalidate bumps generation; unmounted skips notify', () async {
      var mounted = true;
      var notify = 0;
      final loader = FaceExplorerImageLoader(
        onChanged: () => notify++,
        isMounted: () => mounted,
      );
      final genA = loader.generation;
      loader.invalidate();
      expect(loader.generation, greaterThan(genA));
      await loader.load(path: null, fromHistory: true);
      expect(loader.snapshot.sourceBytes, isNull);
      expect(notify, greaterThan(0));
      mounted = false;
      final before = notify;
      await loader.load(path: null, fromHistory: true);
      expect(notify, before);
    });

    test('decodeDims returns size and disposes resources', () async {
      const b64 =
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      final bytes = Uint8List.fromList(base64Decode(b64));
      final dims = await FaceExplorerImageLoader.decodeDims(bytes);
      expect(dims.$1, 1);
      expect(dims.$2, 1);
    });
  });
}
