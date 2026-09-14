import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/core/session/analysis_session.dart';
import 'package:mirra/features/results_experience/domain/perfect_mask_session.dart';

void main() {
  tearDown(AnalysisSession.clear);

  test('create proof records missing ephemeralMasks', () {
    AnalysisSession.recordMaskCreateProof(
      const PerfectMaskCreateProof(
        endpoint: '/ai/skin-analysis',
        rawPresent: false,
        rawCount: 0,
        withBytesCount: 0,
        providerKeys: [],
        sessionCreated: false,
        skipReason: 'ephemeralMasks_missing_from_response',
      ),
    );
    expect(AnalysisSession.lastMaskCreateProof?.rawPresent, isFalse);
    expect(AnalysisSession.lastMaskCreateProof?.sessionCreated, isFalse);
    expect(
      AnalysisSession.lastMaskCreateProof?.hudLine,
      contains('ephemeralMasks_missing_from_response'),
    );
  });

  test('fromApiPayload creates session when ephemeralMasks present', () {
    const tinyPng =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    final session = PerfectMaskSession.fromApiPayload([
      {
        'concernType': 'hd_pore',
        'region': 'whole',
        'scoreOnly': false,
        'maskBase64': tinyPng,
      },
    ]);
    expect(session, isNotNull);
    AnalysisSession.setPerfectMasks(session);
    AnalysisSession.recordMaskCreateProof(
      PerfectMaskCreateProof(
        endpoint: '/ai/skin-analysis',
        rawPresent: true,
        rawCount: 1,
        withBytesCount: 1,
        providerKeys: const ['hd_pore'],
        sessionCreated: true,
      ),
    );
    expect(AnalysisSession.lastPerfectMasks?.hasAnyMask, isTrue);
    expect(AnalysisSession.lastMaskCreateProof?.sessionCreated, isTrue);
  });
}
