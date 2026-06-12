import 'package:flutter/material.dart';

/// Normalized geometry — granular regions aligned to premium_face_base.png.
abstract final class LuxuryFaceGeometry {
  static const viewW = 200.0;
  static const viewH = 280.0;

  static Rect bounds(Size size) => faceBounds(size);

  static Rect faceBounds(Size size) {
    final h = size.height * 0.92;
    final w = h * (viewW / viewH);
    final left = (size.width - w) / 2;
    final top = size.height * 0.04;
    return Rect.fromLTWH(left, top, w, h);
  }

  /// Face rect inside [areaSize] — origin (0,0), for CustomPaint in a Positioned child.
  static Rect faceBoundsLocal(Size areaSize) {
    final h = areaSize.height * 0.94;
    final w = h * (viewW / viewH);
    final left = (areaSize.width - w) / 2;
    final top = areaSize.height * 0.02;
    return Rect.fromLTWH(left, top, w, h);
  }

  static Rect faceBoundsIn(Rect area) {
    final local = faceBoundsLocal(Size(area.width, area.height));
    return local.shift(Offset(area.left, area.top));
  }

  static Offset map(Rect b, double nx, double ny) =>
      Offset(b.left + b.width * nx, b.top + b.height * ny);

  static Path transform(Rect b, Path normalized) {
    final m = Matrix4.identity()
      ..translateByDouble(b.left, b.top, 0, 1)
      ..scaleByDouble(b.width / viewW, b.height / viewH, 1, 1);
    return normalized.transform(m.storage);
  }

  static Path faceOutlineNorm() => Path()
    ..moveTo(100, 36)
    ..cubicTo(134, 38, 160, 58, 164, 88)
    ..cubicTo(168, 112, 162, 142, 150, 164)
    ..cubicTo(138, 186, 118, 204, 100, 208)
    ..cubicTo(82, 204, 62, 186, 50, 164)
    ..cubicTo(38, 142, 32, 112, 36, 88)
    ..cubicTo(40, 58, 66, 38, 100, 36)
    ..close();

  static Path foreheadNorm() => Path()
    ..moveTo(58, 72)
    ..cubicTo(72, 50, 128, 50, 142, 72)
    ..cubicTo(138, 92, 128, 100, 100, 102)
    ..cubicTo(72, 100, 62, 92, 58, 72)
    ..close();

  static Path foreheadCenterNorm() => Path()
    ..moveTo(82, 78)
    ..cubicTo(90, 68, 110, 68, 118, 78)
    ..cubicTo(114, 90, 106, 96, 100, 98)
    ..cubicTo(94, 96, 86, 90, 82, 78)
    ..close();

  static Path underEyesLeftNorm() => Path()
    ..moveTo(54, 108)
    ..cubicTo(68, 100, 82, 98, 90, 104)
    ..cubicTo(88, 118, 78, 124, 66, 122)
    ..cubicTo(56, 118, 52, 114, 54, 108)
    ..close();

  static Path underEyesRightNorm() => Path()
    ..moveTo(146, 108)
    ..cubicTo(132, 100, 118, 98, 110, 104)
    ..cubicTo(112, 118, 122, 124, 134, 122)
    ..cubicTo(144, 118, 148, 114, 146, 108)
    ..close();

  static Path noseNorm() => Path()
    ..moveTo(94, 104)
    ..cubicTo(96, 118, 94, 136, 92, 148)
    ..cubicTo(96, 154, 104, 154, 108, 148)
    ..cubicTo(106, 136, 104, 118, 106, 104)
    ..cubicTo(108, 112, 112, 116, 114, 120)
    ..cubicTo(110, 128, 104, 132, 100, 132)
    ..cubicTo(96, 132, 90, 128, 86, 120)
    ..cubicTo(88, 116, 92, 112, 94, 104)
    ..close();

  static Path cheeksLeftNorm() => Path()
    ..moveTo(44, 118)
    ..cubicTo(50, 132, 56, 156, 68, 170)
    ..cubicTo(82, 176, 92, 162, 96, 142)
    ..cubicTo(98, 124, 88, 114, 74, 112)
    ..cubicTo(58, 110, 46, 112, 44, 118)
    ..close();

  static Path cheeksRightNorm() => Path()
    ..moveTo(156, 118)
    ..cubicTo(150, 132, 144, 156, 132, 170)
    ..cubicTo(118, 176, 108, 162, 104, 142)
    ..cubicTo(102, 124, 112, 114, 126, 112)
    ..cubicTo(142, 110, 154, 112, 156, 118)
    ..close();

  static Path chinNorm() => Path()
    ..moveTo(78, 168)
    ..cubicTo(86, 188, 94, 198, 100, 200)
    ..cubicTo(106, 198, 114, 188, 122, 168)
    ..cubicTo(114, 178, 106, 184, 100, 186)
    ..cubicTo(94, 184, 86, 178, 78, 168)
    ..close();

  static Path jawlineNorm() => Path()
    ..moveTo(52, 158)
    ..cubicTo(58, 178, 72, 192, 88, 198)
    ..cubicTo(94, 200, 106, 200, 112, 198)
    ..cubicTo(128, 192, 142, 178, 148, 158)
    ..cubicTo(132, 188, 116, 196, 100, 198)
    ..cubicTo(84, 196, 68, 188, 52, 158)
    ..close();

  static Path smileLinesLeftNorm() => Path()
    ..moveTo(72, 158)
    ..cubicTo(78, 164, 84, 168, 92, 170)
    ..cubicTo(86, 162, 80, 156, 72, 158)
    ..close();

  static Path smileLinesRightNorm() => Path()
    ..moveTo(128, 158)
    ..cubicTo(122, 164, 116, 168, 108, 170)
    ..cubicTo(114, 162, 120, 156, 128, 158)
    ..close();

  static Path crowFeetLeftNorm() => Path()
    ..moveTo(48, 100)
    ..cubicTo(42, 104, 38, 110, 36, 116)
    ..cubicTo(44, 112, 50, 108, 56, 106)
    ..cubicTo(52, 102, 50, 100, 48, 100)
    ..close();

  static Path crowFeetRightNorm() => Path()
    ..moveTo(152, 100)
    ..cubicTo(158, 104, 162, 110, 164, 116)
    ..cubicTo(156, 112, 150, 108, 144, 106)
    ..cubicTo(148, 102, 150, 100, 152, 100)
    ..close();

  static Path mouthPerioralNorm() => Path()
    ..moveTo(82, 158)
    ..cubicTo(90, 152, 110, 152, 118, 158)
    ..cubicTo(114, 168, 106, 174, 100, 174)
    ..cubicTo(94, 174, 86, 168, 82, 158)
    ..close();

  static Path? regionNorm(String id) => switch (id) {
        'forehead' => foreheadNorm(),
        'forehead_center' => foreheadCenterNorm(),
        'under_eyes_left' => underEyesLeftNorm(),
        'under_eyes_right' => underEyesRightNorm(),
        'nose' => noseNorm(),
        'cheeks_left' => cheeksLeftNorm(),
        'cheeks_right' => cheeksRightNorm(),
        'chin' => chinNorm(),
        'mouth_perioral' => mouthPerioralNorm(),
        'jawline' => jawlineNorm(),
        'smile_lines_left' => smileLinesLeftNorm(),
        'smile_lines_right' => smileLinesRightNorm(),
        'crow_feet_left' => crowFeetLeftNorm(),
        'crow_feet_right' => crowFeetRightNorm(),
        _ => null,
      };

  static Path regionPath(Rect bounds, String regionId) {
    final norm = regionNorm(regionId);
    if (norm == null) return Path();
    final face = transform(bounds, faceOutlineNorm());
    final region = transform(bounds, norm);
    try {
      return Path.combine(PathOperation.intersect, face, region);
    } on Object {
      return region;
    }
  }
}
