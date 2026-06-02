import 'dart:ui';
import 'package:flutter/material.dart';
import '../../theme/colors.dart';
import '../../theme/shadows.dart';
import '../../theme/animations.dart';

class PremiumCard extends StatefulWidget {
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
  State<PremiumCard> createState() => _PremiumCardState();
}

class _PremiumCardState extends State<PremiumCard> {
  @override
  Widget build(BuildContext context) {
    final decoration = BoxDecoration(
      gradient: widget.gradient,
      color: widget.gradient == null
          ? (widget.glass ? AppColors.glassFill : AppColors.surface)
          : null,
      borderRadius: BorderRadius.circular(24),
      border: Border.all(
        color: widget.glass
            ? AppColors.glassBorder
            : AppColors.primary.withValues(alpha: 0.12),
        width: widget.glass ? 1.2 : 1,
      ),
      boxShadow: AppShadows.card,
    );

    Widget inner = ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: widget.glass
          ? BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 6, sigmaY: 6),
              child: Padding(padding: widget.padding, child: widget.child),
            )
          : Padding(padding: widget.padding, child: widget.child),
    );

    final card = AnimatedContainer(
      duration: AppAnimations.defaultDuration,
      decoration: decoration,
      child: inner,
    );

    if (widget.onTap == null) {
      return Padding(padding: widget.margin, child: card);
    }

    // GestureDetector أوضح من InkWell على التدرّجات — يمنع تعطّل النقر.
    return Padding(
      padding: widget.margin,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: widget.onTap,
        child: card,
      ),
    );
  }
}
