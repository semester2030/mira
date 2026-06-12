import 'package:flutter/material.dart';

import 'luxury_face_geometry.dart';

/// Organic, asymmetric region paths — production heatmap topology.
abstract final class OrganicFaceGeometry {
  static Path transform(Rect b, Path norm) => LuxuryFaceGeometry.transform(b, norm);

  static Path regionPath(Rect bounds, String id) {
    final norm = _norm(id);
    if (norm == null) return Path();
    final face = transform(bounds, LuxuryFaceGeometry.faceOutlineNorm());
    final region = transform(bounds, norm);
    try {
      return Path.combine(PathOperation.intersect, face, region);
    } on Object {
      return region;
    }
  }

  static Path? _norm(String id) => switch (id) {
        'forehead_center' => _foreheadCenter(),
        'forehead_wide' => _foreheadWide(),
        'forehead_corner_l' => _foreheadCornerL(),
        'forehead_corner_r' => _foreheadCornerR(),
        'nose_bridge' => _noseBridge(),
        'nose_bridge_center' => _noseBridgeCenter(),
        'nose_tip' => _noseTip(),
        'nose_side_l' => _noseSideL(),
        'nose_side_r' => _noseSideR(),
        'nose_wing_l' => _noseWingL(),
        'nose_wing_r' => _noseWingR(),
        'chin_center' => _chinCenter(),
        'upper_cheek_l' => _upperCheekL(),
        'upper_cheek_r' => _upperCheekR(),
        'cheek_wide_l' => _cheekWideL(),
        'cheek_wide_r' => _cheekWideR(),
        'mouth_perioral' => _mouthPerioral(),
        'under_eyes_l' => _underEyesL(),
        'under_eyes_r' => _underEyesR(),
        'pigment_cheekbone_l' => _pigmentCheekboneL(),
        'pigment_cheekbone_r' => _pigmentCheekboneR(),
        _ => null,
      };

  static Path _foreheadCenter() => Path()
    ..moveTo(84, 74)
    ..cubicTo(91, 62, 109, 61, 117, 73)
    ..cubicTo(113, 86, 105, 94, 100, 96)
    ..cubicTo(93, 93, 87, 84, 84, 74)
    ..close();

  static Path _foreheadWide() => Path()
    ..moveTo(56, 78)
    ..cubicTo(68, 54, 132, 55, 144, 79)
    ..cubicTo(136, 98, 118, 106, 100, 108)
    ..cubicTo(78, 105, 62, 94, 56, 78)
    ..close();

  static Path _foreheadCornerL() => Path()
    ..moveTo(58, 82)
    ..cubicTo(64, 68, 78, 64, 86, 76)
    ..cubicTo(78, 88, 68, 92, 58, 82)
    ..close();

  static Path _foreheadCornerR() => Path()
    ..moveTo(142, 82)
    ..cubicTo(136, 68, 122, 64, 114, 76)
    ..cubicTo(122, 88, 132, 92, 142, 82)
    ..close();

  static Path _noseBridge() => Path()
    ..moveTo(97, 104)
    ..cubicTo(96, 118, 95, 132, 94, 144)
    ..cubicTo(98, 146, 102, 146, 106, 144)
    ..cubicTo(105, 130, 104, 116, 103, 104)
    ..close();

  static Path _noseBridgeCenter() => Path()
    ..moveTo(96, 108)
    ..cubicTo(95, 122, 94, 134, 93, 142)
    ..cubicTo(97, 144, 103, 144, 107, 142)
    ..cubicTo(106, 132, 105, 118, 104, 108)
    ..close();

  static Path _noseTip() => Path()
    ..moveTo(92, 146)
    ..cubicTo(96, 152, 104, 152, 108, 146)
    ..cubicTo(104, 156, 96, 156, 92, 146)
    ..close();

  static Path _noseSideL() => Path()
    ..moveTo(88, 118)
    ..cubicTo(84, 128, 82, 138, 86, 146)
    ..cubicTo(92, 142, 94, 130, 88, 118)
    ..close();

  static Path _noseSideR() => Path()
    ..moveTo(112, 118)
    ..cubicTo(116, 128, 118, 138, 114, 146)
    ..cubicTo(108, 142, 106, 130, 112, 118)
    ..close();

  static Path _noseWingL() => Path()
    ..moveTo(86, 140)
    ..cubicTo(82, 146, 84, 152, 90, 150)
    ..cubicTo(92, 144, 88, 142, 86, 140)
    ..close();

  static Path _noseWingR() => Path()
    ..moveTo(114, 140)
    ..cubicTo(118, 146, 116, 152, 110, 150)
    ..cubicTo(108, 144, 112, 142, 114, 140)
    ..close();

  static Path _chinCenter() => Path()
    ..moveTo(88, 172)
    ..cubicTo(94, 186, 106, 188, 112, 172)
    ..cubicTo(106, 196, 94, 198, 88, 172)
    ..close();

  static Path _upperCheekL() => Path()
    ..moveTo(48, 118)
    ..cubicTo(54, 132, 62, 148, 74, 158)
    ..cubicTo(82, 148, 86, 132, 78, 122)
    ..cubicTo(66, 114, 54, 112, 48, 118)
    ..close();

  static Path _upperCheekR() => Path()
    ..moveTo(152, 118)
    ..cubicTo(146, 132, 138, 148, 126, 158)
    ..cubicTo(118, 148, 114, 132, 122, 122)
    ..cubicTo(134, 114, 146, 112, 152, 118)
    ..close();

  static Path _cheekWideL() => Path()
    ..moveTo(42, 124)
    ..cubicTo(48, 148, 58, 168, 72, 178)
    ..cubicTo(88, 168, 94, 142, 86, 128)
    ..cubicTo(72, 118, 54, 118, 42, 124)
    ..close();

  static Path _cheekWideR() => Path()
    ..moveTo(158, 124)
    ..cubicTo(152, 148, 142, 168, 128, 178)
    ..cubicTo(112, 168, 106, 142, 114, 128)
    ..cubicTo(128, 118, 146, 118, 158, 124)
    ..close();

  static Path _mouthPerioral() => Path()
    ..moveTo(80, 158)
    ..cubicTo(88, 150, 112, 150, 120, 158)
    ..cubicTo(114, 172, 106, 178, 100, 178)
    ..cubicTo(90, 176, 84, 168, 80, 158)
    ..close();

  static Path _underEyesL() => Path()
    ..moveTo(52, 108)
    ..cubicTo(66, 98, 82, 96, 90, 104)
    ..cubicTo(86, 120, 74, 126, 62, 122)
    ..cubicTo(54, 116, 50, 112, 52, 108)
    ..close();

  static Path _underEyesR() => Path()
    ..moveTo(148, 108)
    ..cubicTo(134, 98, 118, 96, 110, 104)
    ..cubicTo(114, 120, 126, 126, 138, 122)
    ..cubicTo(146, 116, 150, 112, 148, 108)
    ..close();

  static Path _pigmentCheekboneL() => Path()
    ..moveTo(52, 132)
    ..cubicTo(58, 142, 66, 152, 76, 158)
    ..cubicTo(68, 146, 60, 138, 52, 132)
    ..close();

  static Path _pigmentCheekboneR() => Path()
    ..moveTo(148, 132)
    ..cubicTo(142, 142, 134, 152, 124, 158)
    ..cubicTo(132, 146, 140, 138, 148, 132)
    ..close();
}
