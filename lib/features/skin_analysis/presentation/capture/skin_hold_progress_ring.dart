import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';

/// Subtle hold/stability ring — DEBUG-free production UX (Design System gold).
class SkinHoldProgressRing extends StatelessWidget {
  const SkinHoldProgressRing({
    super.key,
    required this.progress01,
    this.size = 72,
  });

  final double progress01;
  final double size;

  @override
  Widget build(BuildContext context) {
    final p = progress01.clamp(0.0, 1.0);
    if (p <= 0) return const SizedBox.shrink();
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _HoldRingPainter(progress: p),
      ),
    );
  }
}

class _HoldRingPainter extends CustomPainter {
  _HoldRingPainter({required this.progress});
  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    final c = Offset(size.width / 2, size.height / 2);
    final r = size.shortestSide / 2 - 3;
    final bg = Paint()
      ..color = Colors.white.withValues(alpha: 0.2)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3;
    final fg = Paint()
      ..color = AppColors.gold
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.2
      ..strokeCap = StrokeCap.round;
    canvas.drawCircle(c, r, bg);
    canvas.drawArc(
      Rect.fromCircle(center: c, radius: r),
      -1.5707963,
      6.2831853 * progress,
      false,
      fg,
    );
  }

  @override
  bool shouldRepaint(covariant _HoldRingPainter oldDelegate) =>
      oldDelegate.progress != progress;
}
