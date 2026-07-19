import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../../face_intelligence/domain/face_intel_runtime_state.dart';

/// Minimal operational notice when Face Intelligence report is absent but
/// runtime is FAILED / SKIPPED / UNAVAILABLE — not a report redesign.
class FaceIntelRuntimeNotice extends StatelessWidget {
  final FaceIntelRuntimeState runtime;
  final bool preferEnglish;

  const FaceIntelRuntimeNotice({
    super.key,
    required this.runtime,
    this.preferEnglish = false,
  });

  @override
  Widget build(BuildContext context) {
    final message =
        preferEnglish ? runtime.userVisibleEn : runtime.userVisibleAr;
    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            preferEnglish ? 'Face intelligence status' : 'حالة ذكاء الملامح',
            style: AppTypography.titleSmall,
          ),
          const SizedBox(height: 8),
          Text(
            message,
            style: AppTypography.bodyMedium.copyWith(
              color: AppColors.textSecondary,
              height: 1.45,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            '${runtime.status.wire} · ${runtime.stage} · ${runtime.reason}',
            style: AppTypography.labelSmall.copyWith(
              color: AppColors.textTertiary,
            ),
          ),
        ],
      ),
    );
  }
}
