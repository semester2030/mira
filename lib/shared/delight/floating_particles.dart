import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/colors.dart';

/// Soft pink/gold particles — low count for performance.
class FloatingParticles extends StatefulWidget {
  final int count;
  final bool enabled;

  const FloatingParticles({
    super.key,
    this.count = 18,
    this.enabled = true,
  });

  @override
  State<FloatingParticles> createState() => _FloatingParticlesState();
}

class _FloatingParticlesState extends State<FloatingParticles>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late List<_Particle> _particles;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 28),
    )..repeat();
    _particles = List.generate(widget.count, (i) => _Particle(seed: i * 9973));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.enabled) return const SizedBox.shrink();
    return IgnorePointer(
      child: LayoutBuilder(
        builder: (context, constraints) {
          final size = Size(
            constraints.maxWidth,
            constraints.maxHeight,
          );
          if (size.width <= 0 || size.height <= 0) {
            return const SizedBox.shrink();
          }
          return AnimatedBuilder(
            animation: _controller,
            builder: (context, _) {
              return CustomPaint(
                size: size,
                painter: _ParticlesPainter(
                  particles: _particles,
                  progress: _controller.value,
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class _Particle {
  final double x;
  final double y;
  final double size;
  final double speed;
  final Color color;
  final double phase;

  _Particle({required int seed})
      : x = (seed % 1000) / 1000,
        y = ((seed * 7) % 1000) / 1000,
        size = 2 + (seed % 5).toDouble(),
        speed = 0.15 + (seed % 40) / 100,
        phase = (seed % 360) * math.pi / 180,
        color = seed.isEven
            ? AppColors.primary.withValues(alpha: 0.35)
            : AppColors.gold.withValues(alpha: 0.28);
}

class _ParticlesPainter extends CustomPainter {
  final List<_Particle> particles;
  final double progress;

  _ParticlesPainter({required this.particles, required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    for (final p in particles) {
      final drift = math.sin((progress * 2 * math.pi * p.speed) + p.phase) * 12;
      final dy = ((p.y + progress * p.speed) % 1.2) - 0.1;
      final dx = p.x * size.width + drift;
      final dyPos = dy * size.height;
      final paint = Paint()
        ..color = p.color
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3);
      canvas.drawCircle(Offset(dx, dyPos), p.size, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _ParticlesPainter oldDelegate) =>
      oldDelegate.progress != progress;
}
