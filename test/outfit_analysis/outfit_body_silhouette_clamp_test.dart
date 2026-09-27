import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/outfit_analysis/domain/services/outfit_body_silhouette_builder.dart';

void main() {
  test('regionsFromLandmarks does not throw when head band collapses near top', () {
    final points = {
      'nose': const Offset(0.5, 0.01),
      'left_shoulder': const Offset(0.35, 0.04),
      'right_shoulder': const Offset(0.65, 0.04),
      'left_hip': const Offset(0.38, 0.45),
      'right_hip': const Offset(0.62, 0.45),
      'left_knee': const Offset(0.4, 0.68),
      'right_knee': const Offset(0.6, 0.68),
      'left_ankle': const Offset(0.4, 0.9),
      'right_ankle': const Offset(0.6, 0.9),
    };

    expect(
      () => OutfitBodySilhouetteBuilder.regionsFromLandmarks(points),
      returnsNormally,
    );
    expect(
      OutfitBodySilhouetteBuilder.regionsFromLandmarks(points),
      isNotEmpty,
    );
  });
}
