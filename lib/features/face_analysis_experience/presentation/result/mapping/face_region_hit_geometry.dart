import 'package:flutter/material.dart';

import '../../../projection/contracts/face_result_enums.dart';

/// High-level ILLUSTRATIVE hit regions as fractions of the displayed face box.
///
/// Not pixel-accurate measurement localization (Law #40 / STEP 49).
abstract final class FaceRegionHitGeometry {
  FaceRegionHitGeometry._();

  /// Returns a usable tap rect inside [faceBox] for [region].
  static Rect rectFor(FacePresentationRegion region, Rect faceBox) {
    final w = faceBox.width;
    final h = faceBox.height;
    final l = faceBox.left;
    final t = faceBox.top;

    switch (region) {
      case FacePresentationRegion.forehead:
        return Rect.fromLTWH(l + w * 0.18, t + h * 0.06, w * 0.64, h * 0.18);
      case FacePresentationRegion.eyes:
        return Rect.fromLTWH(l + w * 0.14, t + h * 0.22, w * 0.72, h * 0.16);
      case FacePresentationRegion.nose:
        return Rect.fromLTWH(l + w * 0.36, t + h * 0.34, w * 0.28, h * 0.22);
      case FacePresentationRegion.cheeks:
        return Rect.fromLTWH(l + w * 0.08, t + h * 0.38, w * 0.84, h * 0.18);
      case FacePresentationRegion.mouth:
        return Rect.fromLTWH(l + w * 0.28, t + h * 0.58, w * 0.44, h * 0.12);
      case FacePresentationRegion.jaw:
        return Rect.fromLTWH(l + w * 0.12, t + h * 0.68, w * 0.76, h * 0.16);
      case FacePresentationRegion.chin:
        return Rect.fromLTWH(l + w * 0.32, t + h * 0.78, w * 0.36, h * 0.14);
      case FacePresentationRegion.faceGeneral:
        return Rect.fromLTWH(l + w * 0.12, t + h * 0.08, w * 0.76, h * 0.82);
    }
  }

  static Iterable<FacePresentationRegion> interactiveOrder =
      FacePresentationRegion.values;
}
