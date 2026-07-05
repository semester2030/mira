import 'package:flutter/material.dart';

import '../../../../../shared/theme/colors.dart';
import '../../../../../shared/theme/typography.dart';

/// Premium MIRA AI scanning badge during analysis.
class MiraScanningBadge extends StatelessWidget {
  final double pulse;

  const MiraScanningBadge({
    super.key,
    this.pulse = 0,
  });

  @override
  Widget build(BuildContext context) {
    final glow = 0.35 + pulse * 0.45;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.48),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.45 + glow * 0.35)),
        boxShadow: [
          BoxShadow(
            color: AppColors.gold.withValues(alpha: 0.12 + glow * 0.18),
            blurRadius: 16 + pulse * 8,
          ),
          BoxShadow(
            color: const Color(0xFF5CE1FF).withValues(alpha: 0.08 + pulse * 0.12),
            blurRadius: 22,
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.biotech_rounded,
            size: 15,
            color: AppColors.gold.withValues(alpha: 0.85 + pulse * 0.15),
          ),
          const SizedBox(width: 6),
          Text(
            'MIRA AI — مسح مباشر',
            style: AppTypography.labelMedium.copyWith(color: AppColors.onPrimary),
          ),
        ],
      ),
    );
  }
}
