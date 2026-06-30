import 'package:flutter/material.dart';

import '../../../../core/navigation/route_args.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../domain/entities/outfit_compare_snapshot.dart';
import '../../domain/services/outfit_compare_service.dart';
import '../widgets/outfit_result_motion.dart';

class OutfitCompareScreen extends StatelessWidget {
  final OutfitCompareSnapshot left;
  final OutfitCompareSnapshot right;

  const OutfitCompareScreen({
    super.key,
    required this.left,
    required this.right,
  });

  factory OutfitCompareScreen.fromArgs(OutfitCompareRouteArgs args) {
    return OutfitCompareScreen(left: args.left, right: args.right);
  }

  @override
  Widget build(BuildContext context) {
    final verdict = OutfitCompareService.compare(left, right);

    return Scaffold(
      appBar: const MiraAppBar(pageTitle: 'مقارنة الإطلالات'),
      body: FloatingGradientBackground(
        showOrbs: false,
        showParticles: false,
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                OutfitStaggerPop(
                  index: 0,
                  child: PremiumCard(
                    child: Column(
                      children: [
                        Icon(Icons.compare_rounded, color: AppColors.secondary, size: 32),
                        const SizedBox(height: 10),
                        Text(
                          verdict.headlineAr,
                          style: AppTypography.titleMedium.copyWith(fontWeight: FontWeight.w800),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          verdict.summaryAr,
                          style: AppTypography.bodySmall.copyWith(
                            color: AppColors.textSecondary,
                            height: 1.55,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: _OutfitCompareColumn(
                        snapshot: left,
                        isWinner: verdict.winnerSide == 'left',
                        delayIndex: 1,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _OutfitCompareColumn(
                        snapshot: right,
                        isWinner: verdict.winnerSide == 'right',
                        delayIndex: 2,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Text('مقارنة تفصيلية', style: AppTypography.titleMedium),
                const SizedBox(height: 10),
                for (var i = 0; i < verdict.dimensions.length; i++)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: OutfitStaggerPop(
                      index: i + 3,
                      child: _DimensionRow(dimension: verdict.dimensions[i]),
                    ),
                  ),
                const SizedBox(height: 8),
                PremiumButton(
                  label: 'تحليل إطلالة جديدة',
                  icon: Icons.add_a_photo_outlined,
                  variant: PremiumButtonVariant.secondary,
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _OutfitCompareColumn extends StatelessWidget {
  final OutfitCompareSnapshot snapshot;
  final bool isWinner;
  final int delayIndex;

  const _OutfitCompareColumn({
    required this.snapshot,
    required this.isWinner,
    required this.delayIndex,
  });

  @override
  Widget build(BuildContext context) {
    return OutfitStaggerPop(
      index: delayIndex,
      child: Container(
        padding: const EdgeInsets.fromLTRB(14, 16, 14, 16),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(
            color: isWinner
                ? AppColors.secondary.withValues(alpha: 0.65)
                : AppColors.border.withValues(alpha: 0.4),
            width: isWinner ? 2 : 1,
          ),
          boxShadow: isWinner
              ? [
                  BoxShadow(
                    color: AppColors.secondary.withValues(alpha: 0.18),
                    blurRadius: 18,
                    offset: const Offset(0, 8),
                  ),
                ]
              : null,
        ),
        child: Column(
          children: [
            if (isWinner)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.secondary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  'الأنسب',
                  style: AppTypography.labelSmall.copyWith(
                    color: AppColors.secondary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            if (isWinner) const SizedBox(height: 10),
            Text(
              '${snapshot.compatibilityScore}%',
              style: AppTypography.displaySmall.copyWith(
                color: AppColors.secondary,
                fontWeight: FontWeight.w900,
                fontSize: 36,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              snapshot.labelAr,
              style: AppTypography.labelLarge.copyWith(fontWeight: FontWeight.w700),
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 4),
            Text(
              snapshot.occasion.labelAr,
              style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
            ),
            if (snapshot.dominantColors.isNotEmpty) ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                alignment: WrapAlignment.center,
                children: snapshot.dominantColors
                    .take(3)
                    .map(
                      (c) => Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.primaryLight.withValues(alpha: 0.5),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(c, style: AppTypography.labelSmall.copyWith(fontSize: 10)),
                      ),
                    )
                    .toList(),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _DimensionRow extends StatelessWidget {
  final OutfitCompareDimension dimension;

  const _DimensionRow({required this.dimension});

  @override
  Widget build(BuildContext context) {
    return PremiumCard(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(dimension.labelAr, style: AppTypography.labelLarge.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _ScorePill(
                  score: dimension.leftScore,
                  highlight: dimension.leftWins,
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Text(
                  'vs',
                  style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary),
                ),
              ),
              Expanded(
                child: _ScorePill(
                  score: dimension.rightScore,
                  highlight: dimension.rightWins,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ScorePill extends StatelessWidget {
  final int score;
  final bool highlight;

  const _ScorePill({required this.score, required this.highlight});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        color: highlight
            ? AppColors.secondary.withValues(alpha: 0.12)
            : AppColors.primaryLight.withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(12),
        border: highlight ? Border.all(color: AppColors.secondary.withValues(alpha: 0.35)) : null,
      ),
      child: Text(
        '$score%',
        textAlign: TextAlign.center,
        style: AppTypography.titleSmall.copyWith(
          fontWeight: highlight ? FontWeight.w800 : FontWeight.w600,
          color: highlight ? AppColors.secondary : AppColors.textPrimary,
        ),
      ),
    );
  }
}
