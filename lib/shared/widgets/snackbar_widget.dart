import 'package:flutter/material.dart';
import '../theme/colors.dart';
import '../theme/borders.dart';
import '../theme/text_styles.dart';

class SnackbarWidget extends StatelessWidget {
  final String message;
  final Color? backgroundColor;
  final IconData? icon;

  const SnackbarWidget({
    super.key,
    required this.message,
    this.backgroundColor,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        color: backgroundColor ?? AppColors.primary,
        borderRadius: AppBorders.buttonRadius,
        boxShadow: [
          BoxShadow(
            color: AppColors.shadow,
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null)
            Icon(icon, color: AppColors.card, size: 22),
          if (icon != null) const SizedBox(width: 10),
          Flexible(
            child: Text(
              message,
              style: AppTextStyles.bodyMedium.copyWith(color: AppColors.card),
            ),
          ),
        ],
      ),
    );
  }
}
