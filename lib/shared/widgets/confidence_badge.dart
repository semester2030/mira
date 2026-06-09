import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';

class ConfidenceBadge extends StatelessWidget {
  final String level;
  final String label;

  const ConfidenceBadge({
    super.key,
    required this.level,
    required this.label,
  });

  @override
  Widget build(BuildContext context) {
    final (bg, fg, icon) = switch (level) {
      'high' => (
          AppColors.success.withValues(alpha: 0.15),
          AppColors.success,
          Icons.verified_outlined,
        ),
      'medium' => (
          AppColors.goldLight.withValues(alpha: 0.55),
          AppColors.gold,
          Icons.info_outline_rounded,
        ),
      _ => (
          AppColors.textSecondary.withValues(alpha: 0.12),
          AppColors.textSecondary,
          Icons.help_outline_rounded,
        ),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: fg),
          const SizedBox(width: 4),
          Text(
            label,
            style: AppTypography.labelSmall.copyWith(color: fg, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
