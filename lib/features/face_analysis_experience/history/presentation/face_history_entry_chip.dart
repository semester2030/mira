import 'package:flutter/material.dart';

import '../../../../shared/theme/typography.dart';
import '../../presentation/result/tokens/face_result_tokens.dart';
import '../../presentation/shared/face_experience_motion.dart';
import '../../presentation/shared/face_experience_tokens.dart';
import '../localization/face_history_copy.dart';

/// Compact 9F secondary entry — does not crowd the first surface.
class FaceHistoryEntryChip extends StatelessWidget {
  const FaceHistoryEntryChip({
    super.key,
    required this.visible,
    required this.onTap,
  });

  final bool visible;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AnimatedOpacity(
      opacity: visible ? 1 : 0,
      duration: FaceExperienceMotion.opacityOf(
        context,
        FaceExperienceMotion.standardTransition,
      ),
      child: Semantics(
        button: true,
        label: FaceHistoryCopy.entryTitle,
        child: TextButton(
          key: const Key('face_history_entry_chip'),
          onPressed: visible ? onTap : null,
          style: TextButton.styleFrom(
            minimumSize: const Size(FaceExperienceTokens.minTouchTarget,
                FaceExperienceTokens.minTouchTarget),
          ),
          child: Text(
            FaceHistoryCopy.entryTitle,
            style: AppTypography.bodySmall.copyWith(
              color: FaceResultTokens.qualifier.withValues(alpha: 0.9),
            ),
          ),
        ),
      ),
    );
  }
}
