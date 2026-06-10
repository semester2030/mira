import 'package:flutter/material.dart';

import '../../../../../shared/theme/colors.dart';
import '../../../../../shared/theme/typography.dart';
import '../face_tracking_quality.dart';

/// Glassmorphism badge for face tracking quality.
class TrackingQualityBadge extends StatelessWidget {
  final FaceTrackingQuality quality;
  final bool compact;

  const TrackingQualityBadge({
    super.key,
    required this.quality,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    final accent = switch (quality) {
      FaceTrackingQuality.high => AppColors.gold,
      FaceTrackingQuality.medium => AppColors.secondary,
      FaceTrackingQuality.low => AppColors.textTertiary,
    };

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 12 : 14,
        vertical: compact ? 6 : 8,
      ),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.38),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: accent.withValues(alpha: 0.45)),
        boxShadow: [
          BoxShadow(
            color: accent.withValues(alpha: 0.12),
            blurRadius: 12,
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            quality == FaceTrackingQuality.low
                ? Icons.face_retouching_off_outlined
                : Icons.face_retouching_natural_outlined,
            size: compact ? 14 : 16,
            color: accent,
          ),
          const SizedBox(width: 7),
          Text(
            quality.badgeMessageAr,
            style: (compact ? AppTypography.labelSmall : AppTypography.labelMedium)
                .copyWith(color: AppColors.onPrimary),
          ),
        ],
      ),
    );
  }
}
