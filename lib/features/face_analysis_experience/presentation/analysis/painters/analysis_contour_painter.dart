import 'package:flutter/material.dart';

import '../../capture/tokens/capture_mirror_tokens.dart';

/// Derived face contour + selective anchor glow during analysis motion.
/// Truth: DERIVED geometry · DECORATIVE activation.
class AnalysisContourPainter extends CustomPainter {
  final List<Offset> contourAnchors;
  final double contourOpacity;
  final double anchorGlow01;
  final bool showAmbientPulse;
  final double pulse;

  AnalysisContourPainter({
    required this.contourAnchors,
    required this.contourOpacity,
    required this.anchorGlow01,
    this.showAmbientPulse = false,
    this.pulse = 0,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (contourAnchors.length < 6 || contourOpacity <= 0) return;

    final path = Path()..moveTo(contourAnchors.first.dx, contourAnchors.first.dy);
    for (var i = 1; i < contourAnchors.length; i++) {
      final prev = contourAnchors[i - 1];
      final curr = contourAnchors[i];
      final mid = Offset((prev.dx + curr.dx) / 2, (prev.dy + curr.dy) / 2);
      path.quadraticBezierTo(prev.dx, prev.dy, mid.dx, mid.dy);
    }
    path.close();

    final alpha = contourOpacity *
        (showAmbientPulse ? 0.7 + 0.3 * pulse : 1.0);
    canvas.drawPath(
      path,
      Paint()
        ..color = CaptureMirrorTokens.contour.withValues(alpha: alpha * 0.9)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.1
        ..strokeJoin = StrokeJoin.round,
    );
    canvas.drawPath(
      path,
      Paint()
        ..color = CaptureMirrorTokens.violet.withValues(alpha: alpha * 0.28)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.0,
    );

    if (anchorGlow01 > 0.05) {
      final paint = Paint()
        ..color = CaptureMirrorTokens.pearl
            .withValues(alpha: 0.55 * anchorGlow01)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3);
      // Deterministic subset of anchors (≤6 glow points)
      final step = (contourAnchors.length / 6).ceil().clamp(1, contourAnchors.length);
      for (var i = 0; i < contourAnchors.length; i += step) {
        canvas.drawCircle(contourAnchors[i], 3.2, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant AnalysisContourPainter oldDelegate) =>
      oldDelegate.contourAnchors != contourAnchors ||
      oldDelegate.contourOpacity != contourOpacity ||
      oldDelegate.anchorGlow01 != anchorGlow01 ||
      oldDelegate.showAmbientPulse != showAmbientPulse ||
      oldDelegate.pulse != pulse;
}
