import 'package:flutter_test/flutter_test.dart';

import 'package:mirra/features/outfit_analysis/domain/adapters/fashion_vision_to_engine_adapter.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/fashion_vision_document.dart';

void main() {
  test('adapter maps semantics to OutfitVisualProfile', () {
    final doc = FashionVisionDocument(
      schemaVersion: '1.0.0',
      analysisGate: 'proceed',
      provenance: const {},
      geometry: const {
        'segments': [
          {
            'id': 's1',
            'regionRole': 'outerwear',
            'bbox': {'x': 0.2, 'y': 0.2, 'w': 0.6, 'h': 0.35},
            'polygon': [
              [0.2, 0.2],
              [0.8, 0.2],
              [0.8, 0.55],
              [0.2, 0.55],
            ],
          },
        ],
        'topology': {
          'pieceCount': 1,
          'onePiece': false,
          'silhouetteHint': 'two_piece',
        },
      },
      semantics: const {
        'garments': [
          {
            'categoryId': 'outerwear',
            'typeId': 'blazer',
            'colors': ['black_pure'],
            'providerConfidence': 0.82,
          },
        ],
        'accessories': [],
        'styleArchetypeId': 'business',
        'layering': ['base', 'outerwear'],
        'dominantColorIds': ['black_pure'],
        'secondaryColorIds': ['gray_soft'],
      },
      fusion: const {
        'overallConfidence': 0.72,
        'conflicts': [],
        'resolvedGarments': [],
        'fieldConfidence': [],
      },
    );

    final visual = FashionVisionToEngineAdapter.toVisualProfile(doc);
    expect(visual.source, 'vision_platform');
    expect(visual.dominantColors, contains('أسود'));
    expect(visual.garmentTypeAr, isNotEmpty);
    expect(visual.formalityLevel, greaterThan(0.5));

    final objects = FashionVisionToEngineAdapter.toLocalizedObjects(doc);
    expect(objects, isNotEmpty);
    expect(objects.first.name, 'Blazer');
  });
}
