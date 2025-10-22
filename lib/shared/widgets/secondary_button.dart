import 'package:flutter/material.dart';
import '../theme/colors.dart';
import '../theme/borders.dart';
import '../theme/animations.dart';
import '../theme/text_styles.dart';
import '../theme/shadows.dart';

class SecondaryButton extends StatelessWidget {
  final String text;
  final VoidCallback onPressed;
  final bool loading;
  final bool enabled;
  final IconData? icon;

  const SecondaryButton({
    super.key,
    required this.text,
    required this.onPressed,
    this.loading = false,
    this.enabled = true,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedOpacity(
      duration: AppAnimations.defaultDuration,
      opacity: enabled ? 1 : 0.5,
      child: AnimatedContainer(
        duration: AppAnimations.defaultDuration,
        curve: AppAnimations.defaultCurve,
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: AppBorders.buttonRadius,
          border: Border.all(
            color: enabled ? AppColors.primary : AppColors.primary.withAlpha((0.5 * 255).toInt()),
            width: 1.5,
          ),
          boxShadow: enabled ? AppShadows.button : [],
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: AppBorders.buttonRadius,
            onTap: enabled && !loading ? onPressed : null,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 28),
              alignment: Alignment.center,
              child: loading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                        valueColor: AlwaysStoppedAnimation(AppColors.primary),
                        strokeWidth: 2.5,
                      ),
                    )
                  : Row(
                      mainAxisSize: MainAxisSize.min,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        if (icon != null) ...[
                          Icon(icon, color: AppColors.primary, size: 20),
                          const SizedBox(width: 8),
                        ],
                        Text(
                          text,
                          style: AppTextStyles.labelLarge.copyWith(
                            color: AppColors.primary,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
            ),
          ),
        ),
      ),
    );
  }
}
