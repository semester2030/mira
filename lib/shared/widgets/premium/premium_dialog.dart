import 'package:flutter/material.dart';
import '../../theme/colors.dart';
import '../../theme/typography.dart';
import 'premium_button.dart';

class PremiumDialog {
  PremiumDialog._();

  static Future<T?> show<T>(
    BuildContext context, {
    required String title,
    required String message,
    String confirmLabel = 'حسناً',
    String? cancelLabel,
    VoidCallback? onConfirm,
    bool barrierDismissible = true,
  }) {
    return showDialog<T>(
      context: context,
      barrierDismissible: barrierDismissible,
      builder: (ctx) => Dialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(title, style: AppTypography.headlineSmall),
              const SizedBox(height: 12),
              Text(
                message,
                style: AppTypography.bodyMedium.copyWith(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 24),
              PremiumButton(
                label: confirmLabel,
                onPressed: () {
                  Navigator.of(ctx).pop();
                  onConfirm?.call();
                },
              ),
              if (cancelLabel != null) ...[
                const SizedBox(height: 8),
                PremiumButton(
                  label: cancelLabel,
                  variant: PremiumButtonVariant.ghost,
                  onPressed: () => Navigator.of(ctx).pop(),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
