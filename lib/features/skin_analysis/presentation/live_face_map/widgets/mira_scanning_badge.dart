import 'package:flutter/material.dart';

import '../../../../../shared/theme/colors.dart';
import '../../../../../shared/theme/typography.dart';

/// Premium MIRA AI scanning badge during analysis.
class MiraScanningBadge extends StatelessWidget {
  const MiraScanningBadge({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.48),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.55)),
        boxShadow: [
          BoxShadow(
            color: AppColors.gold.withValues(alpha: 0.15),
            blurRadius: 14,
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.biotech_rounded,
            size: 15,
            color: AppColors.gold.withValues(alpha: 0.95),
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
