import 'package:flutter/material.dart';
import '../../theme/colors.dart';
import '../../theme/gradients.dart';

/// Soft ambient gradient with optional glass orbs.
class FloatingGradientBackground extends StatelessWidget {
  final Widget child;
  final bool showOrbs;

  const FloatingGradientBackground({
    super.key,
    required this.child,
    this.showOrbs = true,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        const DecoratedBox(
          decoration: BoxDecoration(gradient: AppGradients.backgroundGradient),
        ),
        if (showOrbs) ...[
          Positioned(
            top: -80,
            right: -40,
            child: _orb(AppColors.primaryLight.withValues(alpha: 0.55), 200),
          ),
          Positioned(
            bottom: 120,
            left: -60,
            child: _orb(AppColors.secondary.withValues(alpha: 0.35), 180),
          ),
          Positioned(
            top: MediaQuery.sizeOf(context).height * 0.35,
            left: MediaQuery.sizeOf(context).width * 0.5,
            child: _orb(AppColors.goldLight.withValues(alpha: 0.25), 120),
          ),
        ],
        child,
      ],
    );
  }

  Widget _orb(Color color, double size) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: color,
        boxShadow: [
          BoxShadow(color: color, blurRadius: 48, spreadRadius: 8),
        ],
      ),
    );
  }
}
