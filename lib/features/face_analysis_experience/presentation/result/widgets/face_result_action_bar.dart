import 'package:flutter/material.dart';

import '../../../../../shared/theme/typography.dart';
import '../../../projection/contracts/face_result_enums.dart';
import '../../../projection/contracts/face_result_vms.dart';
import '../../../projection/localization/face_result_copy.dart';
import '../../shared/face_experience_motion.dart';
import '../../shared/face_experience_tokens.dart';
import '../details/localization/face_detail_copy.dart';
import '../tokens/face_result_tokens.dart';

/// One primary next action + secondary Ask Mira / legacy report entries.
class FaceResultActionBar extends StatelessWidget {
  const FaceResultActionBar({
    super.key,
    required this.nextAction,
    required this.visible,
    required this.onPrimary,
    required this.onAskMira,
    required this.onFullReport,
    this.detailsEnabled = false,
    this.onDetails,
  });

  final FaceNextActionVm nextAction;
  final bool visible;
  final VoidCallback onPrimary;
  final VoidCallback onAskMira;
  final VoidCallback onFullReport;
  final bool detailsEnabled;
  final VoidCallback? onDetails;

  @override
  Widget build(BuildContext context) {
    return AnimatedOpacity(
      opacity: visible ? 1 : 0,
      duration: FaceExperienceMotion.opacityOf(
        context,
        FaceExperienceMotion.standardTransition,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          FilledButton(
            onPressed: visible ? onPrimary : null,
            style: FilledButton.styleFrom(
              backgroundColor: FaceResultTokens.actionAccent,
              foregroundColor: FaceResultTokens.onGlass,
              minimumSize: const Size.fromHeight(FaceExperienceTokens.minTouchTarget),
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius:
                    BorderRadius.circular(FaceExperienceTokens.buttonRadius),
              ),
            ),
            child: Text(nextAction.labelAr),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: visible ? onAskMira : null,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: FaceResultTokens.onGlass,
                    minimumSize:
                        const Size.fromHeight(FaceExperienceTokens.minTouchTarget),
                    side: BorderSide(color: FaceResultTokens.glassBorder),
                  ),
                  child: Text(FaceResultCopy.askMiraLabel),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextButton(
                  onPressed: visible && detailsEnabled ? onDetails : null,
                  child: Text(
                    FaceDetailCopy.detailsLabel,
                    style: AppTypography.bodySmall.copyWith(
                      color: detailsEnabled
                          ? FaceResultTokens.qualifier
                          : FaceResultTokens.qualifier.withValues(alpha: 0.45),
                    ),
                  ),
                ),
              ),
            ],
          ),
          TextButton(
            onPressed: visible ? onFullReport : null,
            child: Text(
              FaceResultCopy.fullReportLabel,
              style: AppTypography.bodySmall.copyWith(
                color: FaceResultTokens.qualifier.withValues(alpha: 0.85),
              ),
            ),
          ),
          if (nextAction.kind == FaceNextActionKind.retake)
            const SizedBox.shrink(),
        ],
      ),
    );
  }
}
