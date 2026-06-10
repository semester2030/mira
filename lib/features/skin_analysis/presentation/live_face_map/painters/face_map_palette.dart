import 'package:flutter/material.dart';

/// MIRA premium face-map color — single translucent purple only.
class FaceMapPalette {
  FaceMapPalette._();

  static const primary = Color(0xFFA855F7);
  static const minOpacity = 0.10;
  static const maxOpacity = 0.15;

  static Color regionFill(double strength) {
    final t = strength.clamp(0.0, 1.0);
    final alpha = minOpacity + (maxOpacity - minOpacity) * t;
    return primary.withValues(alpha: alpha.clamp(minOpacity, maxOpacity));
  }

  static Color glow(double strength) {
    final t = strength.clamp(0.0, 1.0);
    return primary.withValues(alpha: (0.04 + 0.04 * t).clamp(0.0, 0.08));
  }
}
