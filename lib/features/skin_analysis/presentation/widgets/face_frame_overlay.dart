import 'package:flutter/material.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';

class FaceFrameOverlay extends StatelessWidget {
  final double width;
  final double height;
  final bool compact;

  const FaceFrameOverlay({
    super.key,
    this.width = 220,
    this.height = 300,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: compact ? AppColors.onPrimary.withValues(alpha: 0.6) : AppColors.primary,
          width: 2.5,
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.15),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          if (!compact)
            Positioned(
              top: 12,
              left: 12,
              child: _corner(),
            ),
          if (!compact)
            Positioned(
              top: 12,
              right: 12,
              child: Transform.flip(flipX: true, child: _corner()),
            ),
          Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.face_retouching_natural_rounded,
                size: compact ? 36 : 48,
                color: compact ? AppColors.onPrimary : AppColors.primary,
              ),
              if (!compact) ...[
                const SizedBox(height: 8),
                Text(
                  'ضعي وجهك هنا',
                  style: AppTypography.labelMedium.copyWith(color: AppColors.primary),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _corner() {
    return Container(
      width: 24,
      height: 24,
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(color: AppColors.gold, width: 3),
          left: BorderSide(color: AppColors.gold, width: 3),
        ),
      ),
    );
  }
}
