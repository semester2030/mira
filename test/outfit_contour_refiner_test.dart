import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:mirra/features/outfit_analysis/domain/services/outfit_contour_refiner.dart';

void main() {
  test('refine returns polygon with more than 4 points for solid region', () {
    final image = img.Image(width: 200, height: 400);
    for (var y = 80; y < 220; y++) {
      for (var x = 40; x < 160; x++) {
        image.setPixelRgba(x, y, 180, 40, 50, 255);
      }
    }

    final polygon = OutfitContourRefiner.refine(
      image,
      normalizedRect: const Rect.fromLTWH(0.15, 0.18, 0.7, 0.38),
    );

    expect(polygon.length, greaterThanOrEqualTo(3));
  });
}
