import 'dart:io';

import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/beauty_score_ring.dart';
import '../../domain/entities/outfit_analysis.dart';
import '../../domain/helpers/outfit_fashion_taxonomy.dart';
import '../../domain/helpers/outfit_stylist_copy.dart';
import 'outfit_harmony_panel.dart';
import 'outfit_result_motion.dart';
import 'outfit_skin_harmony_link.dart';

/// Cinematic hero — photo + score ring + stylist verdict (P0).
class OutfitLookResultHero extends StatelessWidget {
  final OutfitAnalysis analysis;

  const OutfitLookResultHero({super.key, required this.analysis});

  @override
  Widget build(BuildContext context) {
    final copy = OutfitStylistCopy.hero(analysis);
    final verdict = analysis.styleVerdict.isNotEmpty
        ? analysis.styleVerdict
        : OutfitFashionTaxonomy.verdictForScore(analysis.compatibilityScore);

    final skinScore = analysis.isSmartMode && analysis.skinCompatibilityScore > 0
        ? analysis.skinCompatibilityScore
        : analysis.colorHarmonyScore;

    final photoPath = analysis.frozenImagePath;
    final hasPhoto = photoPath != null && File(photoPath).existsSync();

    return OutfitStaggerPop(
      index: 0,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(28),
          border: Border.all(color: AppColors.border.withValues(alpha: 0.4)),
          boxShadow: [
            BoxShadow(
              color: AppColors.secondary.withValues(alpha: 0.14),
              blurRadius: 36,
              offset: const Offset(0, 14),
            ),
          ],
        ),
        padding: const EdgeInsets.fromLTRB(18, 20, 18, 22),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: hasPhoto ? 11 : 0,
                  child: hasPhoto
                      ? _OutfitPhotoFrame(path: photoPath)
                      : const SizedBox.shrink(),
                ),
                if (hasPhoto) const SizedBox(width: 14),
                Expanded(
                  flex: hasPhoto ? 12 : 1,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        copy.outfitTitle,
                        style: AppTypography.titleMedium.copyWith(
                          fontWeight: FontWeight.w800,
                          height: 1.3,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Center(
                        child: BeautyScoreRing(
                          score: analysis.compatibilityScore.toDouble(),
                          size: hasPhoto ? 118 : 156,
                          label: 'درجة الإطلالة',
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        verdict,
                        style: AppTypography.labelLarge.copyWith(
                          color: AppColors.secondary,
                          fontWeight: FontWeight.w700,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 10),
                      _HeroTag(text: copy.occasionMatchLine, icon: Icons.event_rounded),
                      const SizedBox(height: 6),
                      _HeroTag(text: copy.eleganceLevel, icon: Icons.diamond_outlined),
                      const SizedBox(height: 6),
                      _HeroTag(
                        text: copy.visualHarmonyTag,
                        icon: Icons.auto_awesome_outlined,
                        accent: AppColors.primary,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (analysis.explanation.isNotEmpty) ...[
              const SizedBox(height: 14),
              Text(
                OutfitStylistCopy.scoreSubtitle(analysis),
                style: AppTypography.bodySmall.copyWith(
                  color: AppColors.textSecondary,
                  height: 1.5,
                ),
                textAlign: TextAlign.center,
              ),
            ],
            const SizedBox(height: 18),
            Divider(color: AppColors.border.withValues(alpha: 0.35), height: 1),
            const SizedBox(height: 16),
            OutfitHarmonyPanel(
              skinToneScore: skinScore,
              occasionScore: analysis.occasionMatchScore,
              colorHarmonyScore: analysis.colorHarmonyScore,
              showSkinTone: analysis.isSmartMode || analysis.skinCompatibilityScore > 0,
            ),
            OutfitSkinHarmonyLink(analysis: analysis),
          ],
        ),
      ),
    );
  }
}

class _OutfitPhotoFrame extends StatelessWidget {
  final String path;

  const _OutfitPhotoFrame({required this.path});

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 3 / 4,
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withValues(alpha: 0.12),
              blurRadius: 20,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: Image.file(
            File(path),
            fit: BoxFit.cover,
            cacheWidth: 720,
            errorBuilder: (_, __, ___) => ColoredBox(
              color: AppColors.primaryLight.withValues(alpha: 0.4),
              child: const Icon(Icons.image_not_supported_outlined, color: AppColors.secondary),
            ),
          ),
        ),
      ),
    );
  }
}

class _HeroTag extends StatelessWidget {
  final String text;
  final IconData icon;
  final Color? accent;

  const _HeroTag({
    required this.text,
    required this.icon,
    this.accent,
  });

  @override
  Widget build(BuildContext context) {
    final color = accent ?? AppColors.secondary;
    return Row(
      children: [
        Icon(icon, size: 15, color: color.withValues(alpha: 0.85)),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            text,
            style: AppTypography.labelSmall.copyWith(
              color: AppColors.textSecondary,
              fontWeight: FontWeight.w600,
              height: 1.35,
            ),
          ),
        ),
      ],
    );
  }
}
