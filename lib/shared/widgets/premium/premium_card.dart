import 'dart:ui';
import 'package:flutter/material.dart';
import '../../theme/colors.dart';
import '../../theme/shadows.dart';
import '../../theme/animations.dart';
import 'pressable_scale.dart';

class PremiumCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margin;
  final VoidCallback? onTap;
  final bool glass;
  final Gradient? gradient;

  const PremiumCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.margin = const EdgeInsets.symmetric(vertical: 8),
    this.onTap,
    this.glass = false,
    this.gradient,
  });

  @override
  Widget build(BuildContext context) {
    Widget card = AnimatedContainer(
      duration: AppAnimations.defaultDuration,
      margin: margin,
      decoration: BoxDecoration(
        gradient: gradient,
        color: gradient == null
            ? (glass ? AppColors.glassFill : AppColors.surface)
            : null,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: glass ? AppColors.glassBorder : AppColors.border,
          width: glass ? 1.2 : 1,
        ),
        boxShadow: AppShadows.card,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: glass
            ? BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
                child: Padding(padding: padding, child: child),
              )
            : Padding(padding: padding, child: child),
      ),
    );

    if (onTap != null) {
      card = PressableScale(onTap: onTap, child: card);
    }
    return card;
  }
}
