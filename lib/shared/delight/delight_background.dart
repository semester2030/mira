import 'package:flutter/material.dart';

import '../../core/config/mira_features.dart';
import '../theme/colors.dart';
import 'floating_particles.dart';

/// Living gradient + drifting orbs + optional particles.
/// On device, [MiraFeatures.delightUi] defaults off for stability (no Impeller/GPU stress).
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
  AnimationController? _controller;

  bool get _animated {
    if (!MiraFeatures.delightUi) return false;
    return widget.showOrbs || widget.showParticles;
  }

  @override
  void initState() {
    super.initState();
    if (_animated) {
      _controller = AnimationController(
        vsync: this,
        duration: const Duration(seconds: 24),
      )..repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_animated) {
      return Stack(
        fit: StackFit.expand,
        children: [
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topRight,
                end: Alignment.bottomLeft,
                colors: [
                  AppColors.gradientStart,
                  AppColors.gradientEnd,
                  AppColors.background,
                ],
                stops: [0.0, 0.45, 1.0],
              ),
            ),
          ),
          widget.child,
        ],
      );
    }

    final size = MediaQuery.sizeOf(context);
    final controller = _controller!;
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        final t = controller.value;
        return Stack(
          fit: StackFit.expand,
          children: [
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
                          Color.lerp(
                            AppColors.gradientStart,
                            AppColors.primaryLight,
                            t * 0.25,
                          )!,
                          Color.lerp(
                            AppColors.gradientEnd,
                            AppColors.secondary,
                            t * 0.15,
                          )!,
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
                      child: _orb(
                        AppColors.primaryLight.withValues(alpha: 0.5),
                        200,
                      ),
                    ),
                    Positioned(
                      bottom: 100 - t * 25,
                      left: -50 + t * 10,
                      child: _orb(
                        AppColors.secondary.withValues(alpha: 0.32),
                        175,
                      ),
                    ),
                    Positioned(
                      top: size.height * (0.32 + t * 0.04),
                      left: size.width * (0.45 + t * 0.05),
                      child: _orb(
                        AppColors.goldLight.withValues(alpha: 0.22),
                        110,
                      ),
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
      ),
    );
  }
}
