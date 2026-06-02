import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/colors.dart';

/// Lightweight confetti burst — no external package.
class SoftConfettiOverlay extends StatefulWidget {
  final Duration duration;
  final VoidCallback? onComplete;

  const SoftConfettiOverlay({
    super.key,
    this.duration = const Duration(milliseconds: 2800),
    this.onComplete,
  });

  @override
  State<SoftConfettiOverlay> createState() => _SoftConfettiOverlayState();
}

class _SoftConfettiOverlayState extends State<SoftConfettiOverlay>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late List<_ConfettiPiece> _pieces;

  @override
  void initState() {
    super.initState();
    final rng = math.Random(42);
    _pieces = List.generate(48, (i) {
      final colors = [
        AppColors.primary,
        AppColors.secondary,
        AppColors.gold,
        AppColors.accent,
      ];
      return _ConfettiPiece(
        x: rng.nextDouble(),
        delay: rng.nextDouble() * 0.15,
        speed: 0.4 + rng.nextDouble() * 0.6,
        rotation: rng.nextDouble() * math.pi,
        color: colors[i % colors.length],
        size: 4 + rng.nextDouble() * 5,
      );
    });
    _controller = AnimationController(vsync: this, duration: widget.duration)
      ..forward().whenComplete(() {
        widget.onComplete?.call();
      });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) {
          return CustomPaint(
            painter: _ConfettiPainter(
              pieces: _pieces,
              t: _controller.value,
            ),
            size: Size.infinite,
          );
        },
      ),
    );
  }
}

class _ConfettiPiece {
  final double x;
  final double delay;
  final double speed;
  final double rotation;
  final Color color;
  final double size;

  const _ConfettiPiece({
    required this.x,
    required this.delay,
    required this.speed,
    required this.rotation,
    required this.color,
    required this.size,
  });
}

class _ConfettiPainter extends CustomPainter {
  final List<_ConfettiPiece> pieces;
  final double t;

  _ConfettiPainter({required this.pieces, required this.t});

  @override
  void paint(Canvas canvas, Size size) {
    for (final p in pieces) {
      final localT = ((t - p.delay) / (1 - p.delay)).clamp(0.0, 1.0);
      if (localT <= 0) continue;
      final y = -40 + localT * (size.height + 80) * p.speed;
      final x = p.x * size.width + math.sin(localT * 8 + p.rotation) * 24;
      final paint = Paint()..color = p.color.withValues(alpha: 1 - localT * 0.85);
      canvas.save();
      canvas.translate(x, y);
      canvas.rotate(p.rotation + localT * 4);
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromCenter(center: Offset.zero, width: p.size, height: p.size * 0.6),
          const Radius.circular(2),
        ),
        paint,
      );
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(covariant _ConfettiPainter oldDelegate) => oldDelegate.t != t;
}
