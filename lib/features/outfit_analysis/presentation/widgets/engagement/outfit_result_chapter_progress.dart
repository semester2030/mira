import 'package:flutter/material.dart';

import '../../../../../shared/theme/colors.dart';
import '../../../../../shared/theme/typography.dart';
import 'outfit_result_chapters.dart';

/// Chapter progress — «اكتشفي تحليلك».
class OutfitResultChapterProgress extends StatelessWidget {
  final int currentIndex;
  final Set<int> visitedIndices;
  final ValueChanged<int> onChapterTap;

  const OutfitResultChapterProgress({
    super.key,
    required this.currentIndex,
    required this.visitedIndices,
    required this.onChapterTap,
  });

  @override
  Widget build(BuildContext context) {
    final total = OutfitResultChapter.all.length;
    final discovered = visitedIndices.length;
    final progress = discovered / total;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'اكتشفي تحليلك',
                style: AppTypography.labelLarge.copyWith(fontWeight: FontWeight.w800),
              ),
            ),
            Text(
              '$discovered/$total',
              style: AppTypography.labelSmall.copyWith(
                color: AppColors.secondary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            value: progress.clamp(0.05, 1.0),
            minHeight: 6,
            backgroundColor: AppColors.primaryLight,
            color: AppColors.secondary,
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 74,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            reverse: true,
            itemCount: total,
            separatorBuilder: (_, __) => const SizedBox(width: 10),
            itemBuilder: (context, index) {
              final chapter = OutfitResultChapter.all[index];
              final isActive = index == currentIndex;
              final isVisited = visitedIndices.contains(index);

              return GestureDetector(
                onTap: () => onChapterTap(index),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 220),
                  width: 86,
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                  decoration: BoxDecoration(
                    color: isActive
                        ? AppColors.secondary.withValues(alpha: 0.12)
                        : AppColors.surface,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(
                      color: isActive
                          ? AppColors.secondary
                          : (isVisited
                              ? AppColors.success.withValues(alpha: 0.45)
                              : AppColors.border.withValues(alpha: 0.35)),
                      width: isActive ? 1.8 : 1,
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Stack(
                        clipBehavior: Clip.none,
                        children: [
                          Icon(
                            chapter.icon,
                            size: 20,
                            color: isActive ? AppColors.secondary : AppColors.textSecondary,
                          ),
                          if (isVisited)
                            Positioned(
                              right: -6,
                              top: -4,
                              child: Icon(
                                Icons.check_circle,
                                size: 14,
                                color: AppColors.success,
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        chapter.titleAr,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.labelSmall.copyWith(
                          fontSize: 10,
                          fontWeight: isActive ? FontWeight.w800 : FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}
