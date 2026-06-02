import 'package:flutter/material.dart';

import '../theme/colors.dart';
import 'floating_particles.dart';

/// Living gradient + drifting orbs + optional particles.
class DelightBackground extends StatefulWidget {
  final Widget child;
  final bool showOrbs;
  final bool showParticles;

  const DelightBackground({
    super.key,
    required this.child,
    this.showOrbs = true,
    this.showParticles = true,
  });

  @override
  State<DelightBackground> createState() => _DelightBackgroundState();
}

class _DelightBackgroundState extends State<DelightBackground>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 24),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final t = _controller.value;
        return Stack(
          fit: StackFit.expand,
          children: [
            // الخلفية الزخرفية لا تلتقط اللمس — حتى لا تمنع أزرار التحليل.
            IgnorePointer(
              child: Stack(
                fit: StackFit.expand,
                children: [
                  DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment(-0.8 + t * 0.3, -1),
                        end: Alignment(0.9 - t * 0.2, 1),
                        colors: [
                          Color.lerp(AppColors.gradientStart, AppColors.primaryLight, t * 0.25)!,
                          Color.lerp(AppColors.gradientEnd, AppColors.secondary, t * 0.15)!,
                          AppColors.background,
                        ],
                        stops: const [0.0, 0.45, 1.0],
                      ),
                    ),
                  ),
                  if (widget.showOrbs) ...[
                    Positioned(
                      top: -80 + t * 20,
                      right: -40 - t * 15,
                      child: _orb(AppColors.primaryLight.withValues(alpha: 0.5), 200),
                    ),
                    Positioned(
                      bottom: 100 - t * 25,
                      left: -50 + t * 10,
                      child: _orb(AppColors.secondary.withValues(alpha: 0.32), 175),
                    ),
                    Positioned(
                      top: size.height * (0.32 + t * 0.04),
                      left: size.width * (0.45 + t * 0.05),
                      child: _orb(AppColors.goldLight.withValues(alpha: 0.22), 110),
                    ),
                  ],
                  if (widget.showParticles) const FloatingParticles(),
                ],
              ),
            ),
            widget.child,
          ],
        );
      },
    );
  }

  Widget _orb(Color color, double size) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: color,
        boxShadow: [BoxShadow(color: color, blurRadius: 48, spreadRadius: 6)],
      ),
    );
  }
}
