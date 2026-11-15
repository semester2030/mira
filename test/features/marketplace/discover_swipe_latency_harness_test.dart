import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/presentation/presentation/presentation_models.dart';
import 'package:mirra/features/marketplace/presentation/presentation/presentation_video_port.dart';

import 'controllable_video_controller.dart';

/// Local harness (not a phone sample): 30 settle→first_frame transitions.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('harness: 30 transitions median/p95 with warm path', () async {
    ControllableVideoController.instances.clear();
    final port = AssetVideoPort(
      createController: (path) => ControllableVideoController(path),
    );
    const clip = PresentationSamples.clip;
    final samples = <int>[];
    var timeouts = 0;

    await port.attach(const PresentationSlot('open', 0), clip);
    final openEvents = port.playbackEvents.where((e) => e.type == 'first_frame').toList();
    expect(openEvents, isNotEmpty);
    final coldOpenMs = openEvents.last.positionMs;
    await port.detach(const PresentationSlot('open', 0));

    for (var i = 0; i < 30; i++) {
      final slot = PresentationSlot('t-$i', 0);
      if (i + 1 < 30) {
        unawaited(port.warm(clip));
      }
      final before = port.playbackEvents.length;
      await port.attach(slot, clip);
      final added = port.playbackEvents.skip(before).toList();
      final frame = added.where((e) => e.type == 'first_frame').toList();
      final stall = added.where((e) => e.type == 'first_frame_timeout').toList();
      if (frame.isNotEmpty && frame.last.positionMs != null) {
        samples.add(frame.last.positionMs!);
      } else if (stall.isNotEmpty) {
        timeouts += 1;
      }
      await port.detach(slot);
    }
    await port.release();

    samples.sort();
    final median = samples.isEmpty ? null : samples[samples.length ~/ 2];
    final p95Index = samples.isEmpty ? 0 : min(samples.length - 1, (samples.length * 0.95).floor());
    final p95 = samples.isEmpty ? null : samples[p95Index];
    final out = <String, Object?>{
      'kind': 'unit_harness_not_device',
      'atUtc': DateTime.now().toUtc().toIso8601String(),
      'nTransitions': 30,
      'samplesMs': samples,
      'medianMs': median,
      'p95Ms': p95,
      'timeouts': timeouts,
      'coldOpenMs': coldOpenMs,
      'platforms': {
        'ios_simulator_ui': 'not_run',
        'android': 'no_emulator_connected',
        'physical_iphone': 'wireless_unavailable_dev_mode',
      },
      'noteAr':
          'قياس وحدة ControllableVideoController وليس جهاز عميلة. عيّنة الجوال ما زالت مطلوبة.',
    };
    final dir = Directory('docs/phase2_3/evidence/store-readiness-2026-03-15');
    await dir.create(recursive: true);
    final file = File('${dir.path}/SWIPE_LATENCY_HARNESS_LATEST.json');
    await file.writeAsString(const JsonEncoder.withIndent('  ').convert(out));
    expect(samples.length, 30);
    expect(timeouts, 0);
    expect(median, isNotNull);
  });
}
