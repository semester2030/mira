import 'dart:ui';

import '../../../../skin_analysis/presentation/live_face_map/models/face_mesh_models.dart';

/// Deterministic landmark reduction for public capture contour (D5: ≤18).
///
/// Contour-first: subsamples MediaPipe face-oval outline already mapped to
/// viewport space. Does not invent points. Truth: DERIVED.
abstract final class CaptureContourReducer {
  CaptureContourReducer._();

  /// Hard public cap — documented for Phase 9C governance.
  static const int maxPublicAnchors = 18;

  /// Version pin for reduction policy.
  static const String version = 'face-capture-contour-reduce-v1';

  static List<Offset> reduceOutline(
    List<FaceMeshPoint> outline, {
    int maxAnchors = maxPublicAnchors,
  }) {
    assert(maxAnchors <= maxPublicAnchors);
    if (outline.isEmpty) return const [];
    if (outline.length <= maxAnchors) {
      return [for (final p in outline) p.toOffset()];
    }
    final step = outline.length / maxAnchors;
    return [
      for (var i = 0; i < maxAnchors; i++)
        outline[(i * step).floor() % outline.length].toOffset(),
    ];
  }

  /// Presentation smoothing — visual only; never feeds 9B readiness.
  static List<Offset> lerpAnchors(
    List<Offset> from,
    List<Offset> to,
    double t,
  ) {
    if (from.isEmpty) return to;
    if (to.isEmpty) return from;
    if (from.length != to.length) return to;
    final clamped = t.clamp(0.0, 1.0);
    return [
      for (var i = 0; i < to.length; i++)
        Offset.lerp(from[i], to[i], clamped)!,
    ];
  }
}
