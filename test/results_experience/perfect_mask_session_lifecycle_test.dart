import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/session/analysis_session.dart';
import 'package:mirra/features/results_experience/domain/perfect_mask_session.dart';

void main() {
  tearDown(() {
    AnalysisSession.clear();
  });

  PerfectMaskSession sessionWithPore() {
    final tinyPng = base64Encode(
      Uint8List.fromList([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]),
    );
    return PerfectMaskSession.fromApiPayload([
      {
        'concernType': 'hd_pore',
        'region': 'whole',
        'scoreOnly': false,
        'maskBase64': tinyPng,
        'width': 1200,
        'height': 1680,
      },
    ])!;
  }

  test('canonical owner set keeps bytes for Face Explorer bind', () {
    final session = sessionWithPore();
    AnalysisSession.setPerfectMasks(session);
    expect(AnalysisSession.lastPerfectMasks, same(session));
    expect(
      AnalysisSession.lastPerfectMasks!.lookup(consumerMetricId: 'pores')?.bytes,
      isNotEmpty,
    );
  });

  test('detach drops owner without wiping held session bytes', () {
    final session = sessionWithPore();
    AnalysisSession.setPerfectMasks(session);
    final held = AnalysisSession.lastPerfectMasks;
    AnalysisSession.detachPerfectMasksIfCurrent(session);
    expect(AnalysisSession.lastPerfectMasks, isNull);
    expect(held, isNotNull);
    expect(held!.lookup(consumerMetricId: 'pores')?.bytes, isNotEmpty);
  });

  test('new analysis replaces previous session (single owner)', () {
    final first = sessionWithPore();
    final second = sessionWithPore();
    AnalysisSession.setPerfectMasks(first);
    AnalysisSession.setPerfectMasks(second);
    expect(AnalysisSession.lastPerfectMasks, same(second));
    // Previous map cleared by dispose on replace.
    expect(first.lookup(consumerMetricId: 'pores'), isNull);
  });

  test('identical set is a no-op (no self-dispose)', () {
    final session = sessionWithPore();
    AnalysisSession.setPerfectMasks(session);
    AnalysisSession.setPerfectMasks(session);
    expect(
      AnalysisSession.lastPerfectMasks!.lookup(consumerMetricId: 'pores')?.bytes,
      isNotEmpty,
    );
  });
}
