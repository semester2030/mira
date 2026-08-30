import 'package:flutter/material.dart';

import '../../../../../shared/theme/typography.dart';
import '../../../projection/contracts/face_result_vms.dart';
import '../tokens/face_result_tokens.dart';

/// Compact contextual explanation for the selected insight (not 9G sheet).
class FaceResultContextPanel extends StatelessWidget {
  const FaceResultContextPanel({
    super.key,
    required this.insight,
  });

  final FaceInsightVm? insight;

  @override
  Widget build(BuildContext context) {
    if (insight == null) return const SizedBox.shrink();
    final i = insight!;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: FaceResultTokens.glass.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(FaceResultTokens.glassRadius),
        border: Border.all(color: FaceResultTokens.glassBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            i.titleAr,
            style: AppTypography.titleSmall.copyWith(
              color: FaceResultTokens.onGlass,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            i.bodyAr,
            style: AppTypography.bodySmall.copyWith(
              color: FaceResultTokens.onGlass.withValues(alpha: 0.88),
              height: 1.35,
            ),
          ),
          if (i.limitation != null) ...[
            const SizedBox(height: 6),
            Text(
              i.limitation!.bodyAr,
              style: AppTypography.bodySmall.copyWith(
                color: FaceResultTokens.qualifier,
                fontSize: 11,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
