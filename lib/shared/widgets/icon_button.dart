import 'package:flutter/material.dart';
import '../theme/colors.dart';
// import '../theme/borders.dart';
import '../theme/animations.dart';
import '../theme/shadows.dart';

class CustomIconButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onPressed;
  final bool loading;
  final bool enabled;
  final Color? color;
  final Color? backgroundColor;
  final double size;
  final double iconSize;

  const CustomIconButton({
    super.key,
    required this.icon,
    required this.onPressed,
    this.loading = false,
    this.enabled = true,
    this.color,
    this.backgroundColor,
    this.size = 40,
    this.iconSize = 20,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedOpacity(
      duration: AppAnimations.defaultDuration,
      opacity: enabled ? 1 : 0.5,
      child: AnimatedContainer(
        duration: AppAnimations.defaultDuration,
        curve: AppAnimations.defaultCurve,
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: backgroundColor ?? AppColors.card,
          borderRadius: BorderRadius.circular(12),
          boxShadow: enabled ? AppShadows.button : [],
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: enabled && !loading ? onPressed : null,
            child: Center(
              child: loading
                  ? SizedBox(
                      height: iconSize * 0.8,
                      width: iconSize * 0.8,
                      child: CircularProgressIndicator(
                        valueColor: AlwaysStoppedAnimation(color ?? AppColors.primary),
                        strokeWidth: 2.5,
                      ),
                    )
                  : Icon(
                      icon,
                      color: color ?? AppColors.primary,
                      size: iconSize,
                    ),
            ),
          ),
        ),
      ),
    );
  }
}
