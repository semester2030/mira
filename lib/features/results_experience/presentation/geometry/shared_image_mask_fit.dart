import 'dart:math' as math;
import 'dart:ui' show Offset, Rect, Size;

import 'package:flutter/painting.dart';

/// Shared contain/cover-fit math for face photo + Perfect mask (same dest).
/// Prevents independent BoxFit on differently-sized bitmaps from drifting.
abstract final class SharedImageMaskFit {
  SharedImageMaskFit._();

  /// Destination rect for [BoxFit.contain] of [sourceSize] inside [viewport].
  static Rect containRect({required Size viewport, required Size sourceSize}) {
    if (viewport.width <= 0 ||
        viewport.height <= 0 ||
        sourceSize.width <= 0 ||
        sourceSize.height <= 0) {
      return Rect.zero;
    }
    final scale = math.min(
      viewport.width / sourceSize.width,
      viewport.height / sourceSize.height,
    );
    final w = sourceSize.width * scale;
    final h = sourceSize.height * scale;
    final left = (viewport.width - w) / 2;
    final top = (viewport.height - h) / 2;
    return Rect.fromLTWH(left, top, w, h);
  }

  /// Destination rect for [BoxFit.cover] — may extend past viewport (clip).
  /// NOT the same as fill/stretch. Photo and mask share this rect.
  static Rect coverRect({required Size viewport, required Size sourceSize}) {
    if (viewport.width <= 0 ||
        viewport.height <= 0 ||
        sourceSize.width <= 0 ||
        sourceSize.height <= 0) {
      return Rect.zero;
    }
    final scale = math.max(
      viewport.width / sourceSize.width,
      viewport.height / sourceSize.height,
    );
    final w = sourceSize.width * scale;
    final h = sourceSize.height * scale;
    final left = (viewport.width - w) / 2;
    final top = (viewport.height - h) / 2;
    return Rect.fromLTWH(left, top, w, h);
  }

  /// Stretch to fill viewport (aspect may distort). Prefer only when source
  /// aspect already matches viewport (e.g. AspectRatio wrapper).
  static Rect fillRect({required Size viewport}) => Offset.zero & viewport;

  /// Maps a normalized point in source image space (0..1) into viewport.
  static Offset sourceNormToViewport({
    required Size viewport,
    required Size sourceSize,
    required Offset sourceNorm01,
    BoxFit fit = BoxFit.contain,
  }) {
    final dest = switch (fit) {
      BoxFit.cover => coverRect(viewport: viewport, sourceSize: sourceSize),
      BoxFit.fill => fillRect(viewport: viewport),
      _ => containRect(viewport: viewport, sourceSize: sourceSize),
    };
    return Offset(
      dest.left + sourceNorm01.dx.clamp(0.0, 1.0) * dest.width,
      dest.top + sourceNorm01.dy.clamp(0.0, 1.0) * dest.height,
    );
  }

  /// Maps a viewport tap into source-normalized 0..1 (null if outside dest).
  static Offset? viewportToSourceNorm({
    required Size viewport,
    required Size sourceSize,
    required Offset viewportPoint,
    BoxFit fit = BoxFit.contain,
  }) {
    final dest = switch (fit) {
      BoxFit.cover => coverRect(viewport: viewport, sourceSize: sourceSize),
      BoxFit.fill => fillRect(viewport: viewport),
      _ => containRect(viewport: viewport, sourceSize: sourceSize),
    };
    if (dest.width <= 0 || dest.height <= 0) return null;
    if (!dest.contains(viewportPoint)) return null;
    return Offset(
      ((viewportPoint.dx - dest.left) / dest.width).clamp(0.0, 1.0),
      ((viewportPoint.dy - dest.top) / dest.height).clamp(0.0, 1.0),
    );
  }

  /// Alignment (−1..1) of a source-normalized point in **source** space.
  /// Prefer [sourceNormToViewportAlignment] when letterboxing/cropping apply.
  static Alignment sourceNormToAlignment(Offset sourceNorm01) {
    return Alignment(
      (sourceNorm01.dx.clamp(0.0, 1.0) * 2) - 1,
      (sourceNorm01.dy.clamp(0.0, 1.0) * 2) - 1,
    );
  }

  /// Alignment for Align / Transform.scale that matches the painted dest rect
  /// (contain/cover letterbox), so the lens/ring land on the tapped pixel.
  static Alignment sourceNormToViewportAlignment({
    required Size viewport,
    required Size sourceSize,
    required Offset sourceNorm01,
    BoxFit fit = BoxFit.contain,
  }) {
    if (viewport.width <= 0 || viewport.height <= 0) {
      return sourceNormToAlignment(sourceNorm01);
    }
    final p = sourceNormToViewport(
      viewport: viewport,
      sourceSize: sourceSize,
      sourceNorm01: sourceNorm01,
      fit: fit,
    );
    return Alignment(
      ((p.dx / viewport.width) * 2) - 1,
      ((p.dy / viewport.height) * 2) - 1,
    );
  }
}
