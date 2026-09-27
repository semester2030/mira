import 'dart:ui' show Offset, Rect, Size;

import 'package:flutter/painting.dart';

import '../../../results_experience/presentation/geometry/shared_image_mask_fit.dart';
import '../../domain/entities/outfit_segment_map.dart';

/// Unified image ↔ mask coordinate mapping for outfit overlays / recolor preview.
/// Uses the same contain/cover math as skin face explorer so photo and mask
/// never drift from independent BoxFit choices.
abstract final class OutfitImageMaskAlignment {
  OutfitImageMaskAlignment._();

  static Size sourceSizeOf(OutfitSegmentMap map, {Size fallback = const Size(3, 4)}) {
    if (map.imageWidth > 0 && map.imageHeight > 0) {
      return Size(map.imageWidth, map.imageHeight);
    }
    return fallback;
  }

  static Rect destRect({
    required Size viewport,
    required OutfitSegmentMap map,
    BoxFit fit = BoxFit.contain,
  }) {
    final source = sourceSizeOf(map);
    return switch (fit) {
      BoxFit.cover => SharedImageMaskFit.coverRect(
          viewport: viewport,
          sourceSize: source,
        ),
      BoxFit.fill => SharedImageMaskFit.fillRect(viewport: viewport),
      _ => SharedImageMaskFit.containRect(
          viewport: viewport,
          sourceSize: source,
        ),
    };
  }

  static Offset normToViewport({
    required Size viewport,
    required OutfitSegmentMap map,
    required Offset sourceNorm01,
    BoxFit fit = BoxFit.contain,
  }) {
    return SharedImageMaskFit.sourceNormToViewport(
      viewport: viewport,
      sourceSize: sourceSizeOf(map),
      sourceNorm01: sourceNorm01,
      fit: fit,
    );
  }

  static Rect normRectToViewport({
    required Size viewport,
    required OutfitSegmentMap map,
    required Rect normalized,
    BoxFit fit = BoxFit.contain,
  }) {
    final tl = normToViewport(
      viewport: viewport,
      map: map,
      sourceNorm01: Offset(normalized.left, normalized.top),
      fit: fit,
    );
    final br = normToViewport(
      viewport: viewport,
      map: map,
      sourceNorm01: Offset(normalized.right, normalized.bottom),
      fit: fit,
    );
    return Rect.fromPoints(tl, br);
  }
}
