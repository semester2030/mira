import 'package:flutter/material.dart';

import '../../../../shared/theme/typography.dart';
import '../../presentation/result/tokens/face_result_tokens.dart';
import '../../presentation/shared/face_experience_motion.dart';
import '../../presentation/shared/face_experience_tokens.dart';
import '../contracts/face_guidance_vms.dart';
import '../localization/face_guidance_copy.dart';

/// Compact 9F entry — preview only, not a card stack.
class FaceGuidanceEntry extends StatelessWidget {
  const FaceGuidanceEntry({
    super.key,
    required this.surface,
    required this.visible,
    required this.onTap,
  });

  final FaceGuidanceSurfaceVm surface;
  final bool visible;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final preview = surface.primary;
    final subtitle = surface.empty
        ? FaceGuidanceCopy.emptyHeadline
        : (preview?.titleAr ?? FaceGuidanceCopy.entrySubtitle);

    return AnimatedOpacity(
      opacity: visible ? 1 : 0,
      duration: FaceExperienceMotion.opacityOf(
        context,
        FaceExperienceMotion.standardTransition,
      ),
      child: Semantics(
        button: true,
        label: '${FaceGuidanceCopy.entryTitle}. $subtitle',
        child: InkWell(
          key: const Key('face_guidance_entry'),
          onTap: visible ? onTap : null,
          borderRadius: BorderRadius.circular(FaceResultTokens.glassRadius),
          child: ConstrainedBox(
            constraints: const BoxConstraints(
              minHeight: FaceExperienceTokens.minTouchTarget,
            ),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: FaceResultTokens.glass,
                borderRadius:
                    BorderRadius.circular(FaceResultTokens.glassRadius),
                border: Border.all(color: FaceResultTokens.glassBorder),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.auto_fix_high_outlined,
                    size: 18,
                    color: FaceResultTokens.pearl.withValues(alpha: 0.9),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          FaceGuidanceCopy.entryTitle,
                          style: AppTypography.titleSmall.copyWith(
                            color: FaceResultTokens.onGlass,
                          ),
                        ),
                        Text(
                          subtitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.bodySmall.copyWith(
                            color: FaceResultTokens.qualifier,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    Icons.chevron_left,
                    color: FaceResultTokens.qualifier.withValues(alpha: 0.8),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
