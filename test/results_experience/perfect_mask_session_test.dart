import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/results_experience/domain/perfect_mask_session.dart';
import 'package:mirra/features/results_experience/domain/perfect_spatial_skin_concern_contract.dart';

void main() {
  test('parses ephemeral masks and reuses cache without re-download', () {
    final tinyPng = base64Encode(
      Uint8List.fromList([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    final session = PerfectMaskSession.fromApiPayload([
      {
        'concernType': 'hd_age_spot',
        'rawScore': 10.5,
        'uiScore': 20,
        'scoreOnly': false,
        'maskBase64': tinyPng,
        'width': 1200,
        'height': 1680,
        'alignedWithSource': true,
      },
      {
        'concernType': 'hd_pore',
        'region': 'whole',
        'rawScore': 1,
        'uiScore': 2,
        'scoreOnly': false,
        'maskBase64': tinyPng,
      },
      {
        'concernType': 'hd_pore',
        'region': 'forehead',
        'scoreOnly': false,
        'maskBase64': tinyPng,
      },
    ]);
    expect(session, isNotNull);
    expect(session!.hasAnyMask, isTrue);
    final a = session.lookup(consumerMetricId: 'pigmentation');
    expect(a?.concernType, 'hd_age_spot');
    expect(a?.rawScore, 10.5);
    expect(a?.uiScore, 20);
    session.lookup(consumerMetricId: 'pigmentation');
    expect(session.cacheHitsFor('hd_age_spot::root'), greaterThanOrEqualTo(1));
    expect(session.providerSubregions('pores'), contains('forehead'));
    expect(session.providerSubregions('pores'), contains('whole'));
  });

  test('score-only / missing mask never invents spatial overlay', () {
    expect(
      mayShowSpatialOverlay(
        classifySpatialMode(hasRootMask: false, subregionMaskCount: 0),
      ),
      isFalse,
    );
  });

  test('metric switch clears stale key when missing', () {
    expect(
      nextSelectedMaskKey(
        previousKey: 'pigmentation',
        nextKey: 'pores',
        availableKeys: const ['pigmentation'],
      ),
      isNull,
    );
  });
}
