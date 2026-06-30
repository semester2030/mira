import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/navigation/analysis_navigation.dart';
import '../../../../core/navigation/mira_report_navigation.dart';
import '../../../../core/session/analysis_session.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/pressable_scale.dart';
import '../../../skin_analysis/domain/entities/skin_report.dart';
import '../../domain/entities/outfit_analysis.dart';

/// Skin ↔ outfit bridge under harmony bars.
class OutfitSkinHarmonyLink extends StatelessWidget {
  final OutfitAnalysis analysis;

  const OutfitSkinHarmonyLink({super.key, required this.analysis});

  @override
  Widget build(BuildContext context) {
    final skin = AnalysisSession.lastSkin;
    if (skin != null) {
      return _LinkedSkinCard(skin: skin, analysis: analysis);
    }
    return _MissingSkinCard(analysis: analysis);
  }
}

class _LinkedSkinCard extends StatelessWidget {
  final SkinReport skin;
  final OutfitAnalysis analysis;

  const _LinkedSkinCard({required this.skin, required this.analysis});

  @override
  Widget build(BuildContext context) {
    final undertone = skin.undertone.isNotEmpty ? skin.undertone : 'متوسط';
    final skinScore = analysis.skinCompatibilityScore > 0
        ? analysis.skinCompatibilityScore
        : analysis.colorHarmonyScore;

    return PressableScale(
      onTap: () {
        HapticFeedback.lightImpact();
        MiraReportNavigation.openFromHistory(context, skin);
      },
      child: Container(
        margin: const EdgeInsets.only(top: 14),
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              AppColors.secondary.withValues(alpha: 0.08),
              AppColors.primaryLight.withValues(alpha: 0.35),
            ],
          ),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.secondary.withValues(alpha: 0.25)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.surface,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: AppColors.secondary.withValues(alpha: 0.15),
                    blurRadius: 8,
                  ),
                ],
              ),
              child: Icon(Icons.face_retouching_natural_rounded, color: AppColors.secondary, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'مرتبطة بتحليل بشرتك',
                    style: AppTypography.labelLarge.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Undertone $undertone · توافق $skinScore%',
                    style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_left, color: AppColors.secondary.withValues(alpha: 0.8)),
          ],
        ),
      ),
    );
  }
}

class _MissingSkinCard extends StatelessWidget {
  final OutfitAnalysis analysis;

  const _MissingSkinCard({required this.analysis});

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: () {
        HapticFeedback.lightImpact();
        AnalysisNavigation.openSkinAnalysis(context);
      },
      child: Container(
        margin: const EdgeInsets.only(top: 14),
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        decoration: BoxDecoration(
          color: AppColors.goldLight.withValues(alpha: 0.45),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.gold.withValues(alpha: 0.35)),
        ),
        child: Row(
          children: [
            Icon(Icons.auto_awesome_rounded, color: AppColors.gold),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'فعّلي توافق لون بشرتك',
                    style: AppTypography.labelLarge.copyWith(fontWeight: FontWeight.w700),
                  ),
                  Text(
                    'حلّلي بشرتك مرة لربط الإطلالة بدقة أعلى',
                    style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_left, color: AppColors.gold),
          ],
        ),
      ),
    );
  }
}
