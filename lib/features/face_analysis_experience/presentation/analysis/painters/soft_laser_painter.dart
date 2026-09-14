import 'package:flutter/material.dart';

import '../../capture/tokens/capture_mirror_tokens.dart';

/// Soft Laser sweep — DECORATIVE only (Law #40 / #41).
/// Does not measure or analyze facial points.
///
/// Direction: top → bottom (RTL does not reverse vertical sweep).
class SoftLaserPainter extends CustomPainter {
  final double progress01;
  final Rect? faceBounds;
  final bool reduceMotion;

  SoftLaserPainter({
    required this.progress01,
    this.faceBounds,
    this.reduceMotion = false,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (reduceMotion || progress01 <= 0) return;

    final top = faceBounds?.top ?? size.height * 0.18;
    final bottom = faceBounds?.bottom ?? size.height * 0.82;
    final left = (faceBounds?.left ?? size.width * 0.12) - 12;
    final right = (faceBounds?.right ?? size.width * 0.88) + 12;
    final y = top + (bottom - top) * progress01.clamp(0.0, 1.0);
    final width = right - left;

    // Violet halo — restrained (9K polish, not brighter)
    final halo = Rect.fromLTWH(left, y - 22, width, 44);
    canvas.drawRect(
      halo,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            CaptureMirrorTokens.violet.withValues(alpha: 0),
            CaptureMirrorTokens.violet.withValues(alpha: 0.12),
            CaptureMirrorTokens.violet.withValues(alpha: 0),
          ],
        ).createShader(halo)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8),
    );

    // Pearl core — thin, soft (not medical/neon)
    final core = Rect.fromLTWH(left, y - 1.0, width, 2.0);
    canvas.drawRect(
      core,
      Paint()
        ..shader = LinearGradient(
          colors: [
            CaptureMirrorTokens.pearl.withValues(alpha: 0),
            CaptureMirrorTokens.pearl.withValues(alpha: 0.65),
            Colors.white.withValues(alpha: 0.72),
            CaptureMirrorTokens.pearl.withValues(alpha: 0.65),
            CaptureMirrorTokens.pearl.withValues(alpha: 0),
          ],
        ).createShader(core)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 1.2),
    );
  }

  @override
  bool shouldRepaint(covariant SoftLaserPainter oldDelegate) =>
      oldDelegate.progress01 != progress01 ||
      oldDelegate.faceBounds != faceBounds ||
      oldDelegate.reduceMotion != reduceMotion;
}
