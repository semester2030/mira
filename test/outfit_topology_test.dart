import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/outfit_analysis/domain/entities/outfit_segment_map.dart';
import 'package:mirra/features/outfit_analysis/domain/helpers/outfit_topology.dart';

OutfitSegmentRegion _region({
  required OutfitSegmentZone zone,
  required String labelAr,
}) {
  return OutfitSegmentRegion(
    zone: zone,
    normalizedRect: const Rect.fromLTWH(0.1, 0.1, 0.8, 0.4),
    labelAr: labelAr,
    labelEn: labelAr,
  );
}

OutfitSegmentMap _map(List<OutfitSegmentRegion> regions) {
  return OutfitSegmentMap(regions: regions, isVisualTrusted: true);
}

void main() {
  group('OutfitTopologyInfer', () {
    test('dress label → one_piece', () {
      final result = OutfitTopologyInfer.infer(null, garmentLabelAr: 'فستان');
      expect(result.silhouetteHint, OutfitSilhouetteHint.onePiece);
      expect(result.pieceCount, 1);
      expect(result.onePiece, isTrue);
      expect(result.regionRole, 'full_body');
    });

    test('upper + lower regions → two_piece', () {
      final map = _map([
        _region(zone: OutfitSegmentZone.upperBody, labelAr: 'بلوزة'),
        _region(zone: OutfitSegmentZone.lowerBody, labelAr: 'بنطلون'),
      ]);
      final result = OutfitTopologyInfer.infer(map);
      expect(result.silhouetteHint, OutfitSilhouetteHint.twoPiece);
      expect(result.pieceCount, 2);
    });

    test('jacket + blouse + pants → layered', () {
      final map = _map([
        _region(zone: OutfitSegmentZone.upperBody, labelAr: 'جاكيت'),
        _region(zone: OutfitSegmentZone.upperBody, labelAr: 'بلوزة'),
        _region(zone: OutfitSegmentZone.lowerBody, labelAr: 'بنطلون'),
      ]);
      final result = OutfitTopologyInfer.infer(map, garmentLabelAr: 'جاكيت');
      expect(result.silhouetteHint, OutfitSilhouetteHint.layered);
      expect(result.regionRole, 'outerwear');
    });

    test('regionRoleForGarment maps Arabic labels', () {
      expect(OutfitTopologyInfer.regionRoleForGarment('جينز'), 'lower');
      expect(OutfitTopologyInfer.regionRoleForGarment('بلوزة'), 'upper');
    });

    test('dress label stays one_piece even with anatomy upper+lower bands', () {
      final map = _map([
        _region(zone: OutfitSegmentZone.upperBody, labelAr: 'الجزء العلوي'),
        _region(zone: OutfitSegmentZone.lowerBody, labelAr: 'الجزء السفلي'),
      ]);
      final result = OutfitTopologyInfer.infer(map, garmentLabelAr: 'فستان سهرة');
      expect(result.silhouetteHint, OutfitSilhouetteHint.onePiece);
      expect(result.pieceCount, 1);
      expect(result.onePiece, isTrue);
    });

    test('anatomy-only upper+lower without dress → unknown not two_piece', () {
      final map = _map([
        _region(zone: OutfitSegmentZone.upperBody, labelAr: 'الجزء العلوي'),
        _region(zone: OutfitSegmentZone.lowerBody, labelAr: 'الجزء السفلي'),
      ]);
      final result = OutfitTopologyInfer.infer(map);
      expect(result.silhouetteHint, OutfitSilhouetteHint.unknown);
      expect(result.pieceCount, 0);
    });

    test('anatomy + feet does not become two_piece', () {
      final map = _map([
        _region(zone: OutfitSegmentZone.upperBody, labelAr: 'الجزء العلوي'),
        _region(zone: OutfitSegmentZone.lowerBody, labelAr: 'الجزء السفلي'),
        _region(zone: OutfitSegmentZone.feet, labelAr: 'القدمين'),
      ]);
      final result = OutfitTopologyInfer.infer(map);
      expect(result.silhouetteHint, OutfitSilhouetteHint.unknown);
      expect(result.pieceCount, 0);
    });

    test('dress + jacket → layered', () {
      final map = _map([
        _region(zone: OutfitSegmentZone.upperBody, labelAr: 'فستان'),
        _region(zone: OutfitSegmentZone.upperBody, labelAr: 'جاكيت'),
      ]);
      final result = OutfitTopologyInfer.infer(map, garmentLabelAr: 'فستان');
      expect(result.silhouetteHint, OutfitSilhouetteHint.layered);
      expect(result.pieceCount, 2);
    });
  });
}
