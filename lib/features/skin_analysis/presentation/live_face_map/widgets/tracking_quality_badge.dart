import 'package:flutter/material.dart';

import '../../../../../shared/theme/colors.dart';
import '../../../../../shared/theme/typography.dart';
import '../face_tracking_quality.dart';

/// Glassmorphism badge for face tracking quality.
class TrackingQualityBadge extends StatelessWidget {
  final FaceTrackingQuality quality;
  final bool compact;
  final bool lockOn;

  const TrackingQualityBadge({
    super.key,
    required this.quality,
    this.compact = false,
    this.lockOn = false,
  });

  @override
  Widget build(BuildContext context) {
    final accent = lockOn
        ? AppColors.gold
        : switch (quality) {
            FaceTrackingQuality.high => const Color(0xFF5CE1FF),
            FaceTrackingQuality.medium => AppColors.secondary,
            FaceTrackingQuality.low => AppColors.textTertiary,
          };

    final message = lockOn
        ? 'MIRA AI — جاهز'
        : quality.badgeMessageAr;

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 12 : 14,
        vertical: compact ? 6 : 8,
      ),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.38),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: accent.withValues(alpha: 0.55)),
        boxShadow: [
          BoxShadow(
            color: accent.withValues(alpha: 0.16),
            blurRadius: 14,
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            lockOn
                ? Icons.auto_awesome
                : quality == FaceTrackingQuality.low
                    ? Icons.face_retouching_off_outlined
                    : Icons.radar_rounded,
            size: compact ? 14 : 16,
            color: accent,
          ),
          const SizedBox(width: 7),
          Text(
            message,
            style: (compact ? AppTypography.labelSmall : AppTypography.labelMedium)
                .copyWith(color: AppColors.onPrimary),
          ),
        ],
      ),
    );
  }
}
