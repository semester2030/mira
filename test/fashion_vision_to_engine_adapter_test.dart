import 'package:flutter_test/flutter_test.dart';

import 'package:mirra/features/outfit_analysis/domain/adapters/canonical_garment_to_engine_adapter.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/canonical_garment.dart';

void main() {
  test('adapter maps canonical garments without reconstructing vision', () {
    final garments = [CanonicalGarment.fromJson(_canonicalGarmentJson())];

    final visual = CanonicalGarmentToEngineAdapter.toVisualProfile(garments);
    expect(visual.source, 'canonical_garment');
    expect(visual.dominantColors, contains('أسود'));
    expect(visual.garmentTypeAr, 'سترة رسمية');
    expect(visual.formalityLevel, greaterThan(0.5));
    expect(visual.confidence, 82);
  });

  test('canonical response parses gate and confidence from meta', () {
    final result = VisionOutfitAnalyzeResult.fromJson({
      'garments': [_canonicalGarmentJson()],
      'analysis': null,
      'meta': {
        'analysisGate': 'proceed',
        'confidence': 82,
        'userMessageAr': 'تم التحليل',
      },
    });

    expect(result.analysisGate, 'proceed');
    expect(result.confidencePercent, 82);
    expect(result.garments.single.garmentId, 'garm_test_1');
    expect(result.isBlocked, isFalse);
  });

  test('legacy fashionVision response fails closed', () {
    expect(
      () => VisionOutfitAnalyzeResult.fromJson({
        'fashionVision': {'analysisGate': 'proceed'},
        'meta': {'analysisGate': 'proceed', 'confidence': 82},
      }),
      throwsFormatException,
    );
  });

  test('non-blocked empty canonical response fails closed', () {
    expect(
      () => VisionOutfitAnalyzeResult.fromJson({
        'garments': const [],
        'analysis': null,
        'meta': {'analysisGate': 'proceed', 'confidence': 0},
      }),
      throwsFormatException,
    );
  });
}

Map<String, dynamic> _canonicalGarmentJson() => {
  'garmentId': 'garm_test_1',
  'version': 'garment-schema-v1',
  'identity': {
    'categoryId': 'outerwear',
    'typeId': 'blazer',
    'entityClass': 'garment',
  },
  'attributes': {
    'colors': ['black_pure'],
    'material': {'kind': 'estimated', 'value': 'wool'},
    'season': ['all_season'],
    'occasion': ['work'],
    'styleHints': ['business'],
  },
  'geometryRef': {'segmentId': 's1', 'regionRole': 'outerwear'},
  'confidence': 0.82,
  'fieldConfidence': const [],
  'availability': 'detected',
  'source': 'vision',
  'limitations': const [],
  'explainability': const [],
  'localeLabels': {'en': 'Blazer', 'ar': 'سترة رسمية'},
  'runtime': const {},
  'mappingVersion': 'garment-mapping-v1',
  'createdAt': '2026-08-30T00:00:00.000Z',
  'updatedAt': '2026-08-30T00:00:00.000Z',
};
