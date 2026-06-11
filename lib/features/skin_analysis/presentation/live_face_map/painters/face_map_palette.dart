import 'package:flutter/material.dart';

import '../models/face_mesh_models.dart';

/// Per-region luxury palette — ultra-transparent fill, crisp colored borders.
class FaceMapPalette {
  FaceMapPalette._();

  static const fillOpacity = 0.055;
  static const borderOpacity = 0.44;
  static const borderContrastOpacity = 0.18;
  static const strokeWidth = 1.5;
  static const contrastStrokeWidth = 2.25;
  static const faceOutlineOpacity = 0.20;

  static const _regionBase = <FaceRegionId, Color>{
    FaceRegionId.forehead: Color(0xFF9B8CFF),
    FaceRegionId.underEye: Color(0xFFFFB8A8),
    FaceRegionId.nose: Color(0xFF6FD4C8),
    FaceRegionId.cheek: Color(0xFFFF9EC8),
    FaceRegionId.chin: Color(0xFF8CB4FF),
    FaceRegionId.jawline: Color(0xFFB8C8E8),
  };

  static Color regionFill(FaceRegionId id) =>
      (_regionBase[id] ?? const Color(0xFFC88BFF)).withValues(alpha: fillOpacity);

  static Color regionBorder(FaceRegionId id) =>
      (_regionBase[id] ?? const Color(0xFFC88BFF)).withValues(alpha: borderOpacity);

  static Color get borderContrast =>
      Colors.white.withValues(alpha: borderContrastOpacity);

  static Color get faceOutline =>
      Colors.white.withValues(alpha: faceOutlineOpacity);

  /// Back → front paint order so overlapping regions stay readable.
  static const paintOrder = <FaceRegionId>[
    FaceRegionId.cheek,
    FaceRegionId.underEye,
    FaceRegionId.forehead,
    FaceRegionId.nose,
    FaceRegionId.chin,
  ];

  static int paintPriority(FaceRegionId id) {
    final index = paintOrder.indexOf(id);
    return index < 0 ? paintOrder.length : index;
  }
}
