import 'dart:io';

import 'package:flutter/material.dart';

import '../../../../../shared/theme/colors.dart';
import '../../../../../shared/theme/typography.dart';
import '../../../domain/entities/outfit_analysis.dart';

/// Compact hero bar while scrolling inside a chapter.
class OutfitResultStickyHero extends StatelessWidget {
  final OutfitAnalysis analysis;
  final VoidCallback? onTap;

  const OutfitResultStickyHero({
    super.key,
    required this.analysis,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final path = analysis.frozenImagePath;
    final hasPhoto = path != null && File(path).existsSync();

    return Material(
      elevation: 6,
      shadowColor: AppColors.secondary.withValues(alpha: 0.18),
      borderRadius: BorderRadius.circular(18),
      color: AppColors.surface.withValues(alpha: 0.96),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              if (hasPhoto)
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.file(
                    File(path),
                    width: 42,
                    height: 52,
                    fit: BoxFit.cover,
                  ),
                )
              else
                Container(
                  width: 42,
                  height: 52,
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(Icons.checkroom_outlined, color: AppColors.secondary.withValues(alpha: 0.6)),
                ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'درجة الإطلالة',
                      style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary),
                    ),
                    Text(
                      '${analysis.compatibilityScore}/100',
                      style: AppTypography.titleMedium.copyWith(
                        color: AppColors.secondary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(Icons.keyboard_arrow_up_rounded, color: AppColors.secondary.withValues(alpha: 0.7)),
            ],
          ),
        ),
      ),
    );
  }
}
