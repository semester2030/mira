import 'package:flutter/material.dart';

import '../../../../../shared/theme/typography.dart';
import '../../../projection/contracts/face_result_enums.dart';
import '../../../projection/contracts/face_result_vms.dart';
import '../../shared/face_experience_motion.dart';
import '../tokens/face_result_tokens.dart';

/// Primary result reveal — consumes [FacePrimaryResultVm] only.
///
/// Position decision (STEP 10): **B — below face within mirror surface**
/// as a compact glass strip so key facial features stay unobscured.
class FacePrimaryResultReveal extends StatelessWidget {
  const FacePrimaryResultReveal({
    super.key,
    required this.primary,
    required this.visible,
    this.onTap,
  });

  final FacePrimaryResultVm primary;
  final bool visible;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final qualified = primary.eligibility ==
            FacePresentationEligibility.displayWithQualification ||
        primary.confidenceQualifierAr != null;
    final duration = FaceExperienceMotion.opacityOf(
      context,
      FaceExperienceMotion.standardTransition,
    );

    return AnimatedOpacity(
      opacity: visible ? 1 : 0,
      duration: duration,
      child: AnimatedSlide(
        offset: visible ? Offset.zero : const Offset(0, 0.06),
        duration: duration,
        curve: FaceExperienceMotion.revealCurve,
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: visible ? onTap : null,
            borderRadius: BorderRadius.circular(FaceResultTokens.glassRadius),
            child: Ink(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: FaceResultTokens.glass,
                borderRadius:
                    BorderRadius.circular(FaceResultTokens.glassRadius),
                border: Border.all(color: FaceResultTokens.glassBorder),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    primary.titleAr,
                    style: AppTypography.bodySmall.copyWith(
                      color: FaceResultTokens.qualifier,
                      letterSpacing: 0.2,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    primary.valueLabelAr,
                    style: AppTypography.titleLarge.copyWith(
                      color: FaceResultTokens.onGlass,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (primary.subtitleAr.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      primary.subtitleAr,
                      style: AppTypography.bodySmall.copyWith(
                        color:
                            FaceResultTokens.onGlass.withValues(alpha: 0.82),
                      ),
                    ),
                  ],
                  if (qualified && primary.confidenceQualifierAr != null) ...[
                    const SizedBox(height: 6),
                    Text(
                      primary.confidenceQualifierAr!,
                      style: AppTypography.bodySmall.copyWith(
                        color: FaceResultTokens.qualifier,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
