import 'package:flutter/material.dart';
import '../../theme/colors.dart';
import '../../theme/gradients.dart';
import '../../theme/shadows.dart';
import '../../theme/typography.dart';
import '../../theme/animations.dart';
import 'pressable_scale.dart';

enum PremiumButtonVariant { primary, secondary, ghost, gold }

class PremiumButton extends StatefulWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final IconData? icon;
  final Widget? leading;
  final PremiumButtonVariant variant;
  final bool expanded;

  const PremiumButton({
    super.key,
    required this.label,
    this.onPressed,
    this.loading = false,
    this.icon,
    this.leading,
    this.variant = PremiumButtonVariant.primary,
    this.expanded = true,
  });

  @override
  State<PremiumButton> createState() => _PremiumButtonState();
}

class _PremiumButtonState extends State<PremiumButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _shine;

  @override
  void initState() {
    super.initState();
    _shine = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    );
    if (_hasShine) _shine.repeat();
  }

  bool get _hasShine =>
      widget.variant == PremiumButtonVariant.primary ||
      widget.variant == PremiumButtonVariant.gold;

  @override
  void dispose() {
    _shine.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onPressed != null && !widget.loading;
    final child = PressableScale(
      onTap: enabled ? widget.onPressed : null,
      child: AnimatedContainer(
        duration: AppAnimations.defaultDuration,
        curve: AppAnimations.defaultCurve,
        width: widget.expanded ? double.infinity : null,
        padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 16),
        decoration: BoxDecoration(
          gradient: _gradient(enabled),
          color: _solidColor(enabled),
          borderRadius: BorderRadius.circular(18),
          border: _border(),
          boxShadow: enabled ? AppShadows.button : const [],
        ),
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.center,
          children: [
            if (_hasShine && enabled)
              Positioned.fill(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: AnimatedBuilder(
                    animation: _shine,
                    builder: (context, _) {
                      return Transform.translate(
                        offset: Offset(-120 + _shine.value * 280, 0),
                        child: Container(
                          width: 60,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                Colors.white.withValues(alpha: 0),
                                Colors.white.withValues(alpha: 0.28),
                                Colors.white.withValues(alpha: 0),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
            _content(),
          ],
        ),
      ),
    );
    return child;
  }

  LinearGradient? _gradient(bool enabled) {
    if (!enabled) return null;
    switch (widget.variant) {
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
      if (widget.variant == PremiumButtonVariant.secondary) return AppColors.surface;
      if (widget.variant == PremiumButtonVariant.ghost) return Colors.transparent;
      return null;
    }
    return AppColors.primary.withValues(alpha: 0.4);
  }

  Border? _border() {
    if (widget.variant == PremiumButtonVariant.secondary) {
      return Border.all(color: AppColors.primary, width: 1.5);
    }
    return null;
  }

  Widget _content() {
    if (widget.loading) {
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
    final textColor = switch (widget.variant) {
      PremiumButtonVariant.secondary => AppColors.primary,
      PremiumButtonVariant.ghost => AppColors.primary,
      _ => AppColors.onPrimary,
    };
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (widget.leading != null) ...[
          widget.leading!,
          const SizedBox(width: 8),
        ] else if (widget.icon != null) ...[
          Icon(widget.icon, color: textColor, size: 20),
          const SizedBox(width: 8),
        ],
        Text(
          widget.label,
          style: AppTypography.labelLarge.copyWith(
            color: textColor,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}
