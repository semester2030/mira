import 'package:flutter/material.dart';

import '../../../../../shared/theme/typography.dart';
import '../../../projection/contracts/face_result_vms.dart';
import '../../../projection/localization/face_result_copy.dart';
import '../../shared/face_experience_motion.dart';
import '../../shared/face_experience_tokens.dart';
import '../tokens/face_result_tokens.dart';

/// Ask Mira entry presentation — does not modify Advisor backend.
class FaceResultAdvisorEntry extends StatelessWidget {
  const FaceResultAdvisorEntry({
    super.key,
    required this.entry,
    required this.visible,
    required this.onTap,
  });

  final FaceAdvisorEntryVm entry;
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
        label: FaceResultCopy.askMiraLabel,
        child: InkWell(
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
                borderRadius: BorderRadius.circular(FaceResultTokens.glassRadius),
                border: Border.all(color: FaceResultTokens.glassBorder),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.auto_awesome,
                    size: 18,
                    color: FaceResultTokens.pearl.withValues(alpha: 0.9),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          FaceResultCopy.askMiraLabel,
                          style: AppTypography.titleSmall.copyWith(
                            color: FaceResultTokens.onGlass,
                          ),
                        ),
                        if (entry.selectedInsightId != null)
                          Text(
                            'عن النتيجة المحددة',
                            style: AppTypography.bodySmall.copyWith(
                              color: FaceResultTokens.qualifier,
                              fontSize: 11,
                            ),
                          ),
                      ],
                    ),
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
