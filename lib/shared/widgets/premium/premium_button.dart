import 'package:flutter/material.dart';
import '../../theme/colors.dart';
import '../../theme/gradients.dart';
import '../../theme/shadows.dart';
import '../../theme/typography.dart';
import '../../theme/animations.dart';
import 'pressable_scale.dart';

enum PremiumButtonVariant { primary, secondary, ghost, gold }

class PremiumButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final IconData? icon;
  final PremiumButtonVariant variant;
  final bool expanded;

  const PremiumButton({
    super.key,
    required this.label,
    this.onPressed,
    this.loading = false,
    this.icon,
    this.variant = PremiumButtonVariant.primary,
    this.expanded = true,
  });

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !loading;
    final child = PressableScale(
      onTap: enabled ? onPressed : null,
      child: AnimatedContainer(
        duration: AppAnimations.defaultDuration,
        curve: AppAnimations.defaultCurve,
        width: expanded ? double.infinity : null,
        padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 16),
        decoration: BoxDecoration(
          gradient: _gradient(enabled),
          color: _solidColor(enabled),
          borderRadius: BorderRadius.circular(18),
          border: _border(),
          boxShadow: enabled ? AppShadows.button : const [],
        ),
        child: _content(),
      ),
    );
    return child;
  }

  LinearGradient? _gradient(bool enabled) {
    if (!enabled) return null;
    switch (variant) {
      case PremiumButtonVariant.primary:
        return AppGradients.buttonGradient;
      case PremiumButtonVariant.gold:
        return const LinearGradient(
          colors: [AppColors.gold, Color(0xFFB8962E)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        );
      case PremiumButtonVariant.secondary:
      case PremiumButtonVariant.ghost:
        return null;
    }
  }

  Color? _solidColor(bool enabled) {
    if (enabled) {
      if (variant == PremiumButtonVariant.secondary) return AppColors.surface;
      if (variant == PremiumButtonVariant.ghost) return Colors.transparent;
      return null;
    }
    return AppColors.primary.withValues(alpha: 0.4);
  }

  Border? _border() {
    if (variant == PremiumButtonVariant.secondary) {
      return Border.all(color: AppColors.primary, width: 1.5);
    }
    return null;
  }

  Widget _content() {
    if (loading) {
      return const Center(
        child: SizedBox(
          width: 22,
          height: 22,
          child: CircularProgressIndicator(
            strokeWidth: 2.5,
            valueColor: AlwaysStoppedAnimation(AppColors.onPrimary),
          ),
        ),
      );
    }
    final textColor = switch (variant) {
      PremiumButtonVariant.secondary => AppColors.primary,
      PremiumButtonVariant.ghost => AppColors.primary,
      _ => AppColors.onPrimary,
    };
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (icon != null) ...[
          Icon(icon, color: textColor, size: 20),
          const SizedBox(width: 8),
        ],
        Text(
          label,
          style: AppTypography.labelLarge.copyWith(
            color: textColor,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}
