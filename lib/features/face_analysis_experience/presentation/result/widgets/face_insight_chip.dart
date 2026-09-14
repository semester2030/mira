import 'package:flutter/material.dart';

import '../../../../../shared/theme/typography.dart';
import '../../../projection/contracts/face_result_vms.dart';
import '../../shared/face_experience_haptics.dart';
import '../../shared/face_experience_motion.dart';
import '../tokens/face_result_tokens.dart';

class FaceInsightChip extends StatelessWidget {
  const FaceInsightChip({
    super.key,
    required this.insight,
    required this.selected,
    required this.onTap,
  });

  final FaceInsightVm insight;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final duration = FaceExperienceMotion.opacityOf(
      context,
      FaceExperienceMotion.fastFeedback,
    );

    return Semantics(
      button: true,
      selected: selected,
      label: insight.titleAr,
      excludeSemantics: true,
      container: true,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            FaceExperienceHaptics.selectionOptional();
            onTap();
          },
          borderRadius: BorderRadius.circular(FaceResultTokens.chipRadius),
          child: AnimatedContainer(
            duration: duration,
            // Slightly taller padding for touch comfort without forcing 48dp
            // layout that destabilizes the face-first Wrap rail (9K).
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: selected
                  ? FaceResultTokens.violet.withValues(alpha: 0.42)
                  : FaceResultTokens.glass,
              borderRadius: BorderRadius.circular(FaceResultTokens.chipRadius),
              border: Border.all(
                color: selected
                    ? FaceResultTokens.violet.withValues(alpha: 0.75)
                    : FaceResultTokens.glassBorder,
              ),
            ),
            child: Text(
              insight.titleAr,
              style: AppTypography.bodySmall.copyWith(
                color: FaceResultTokens.onGlass,
                fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
