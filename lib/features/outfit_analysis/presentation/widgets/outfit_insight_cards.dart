import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/pressable_scale.dart';
import '../../domain/entities/outfit_analysis.dart';
import '../../domain/entities/suggested_piece_model.dart';
import 'outfit_insight/outfit_illustrated_tile.dart';
import 'outfit_insight/outfit_insight_builder.dart';
import 'outfit_insight/outfit_insight_item.dart';
import 'outfit_insight/outfit_luxury_piece_card.dart';
import 'outfit_result_motion.dart';

/// Premium stylist deck — asset-backed pieces + curated accessories.
class OutfitInsightCards extends StatelessWidget {
  final OutfitAnalysis analysis;
  final Set<String> wishlistedIds;
  final ValueChanged<SuggestedPieceModel>? onWishlistToggle;

  const OutfitInsightCards({
    super.key,
    required this.analysis,
    this.wishlistedIds = const {},
    this.onWishlistToggle,
  });

  @override
  Widget build(BuildContext context) {
    final palette = OutfitInsightBuilder.palette(analysis);
    final pieces = OutfitInsightBuilder.clothingPieces(analysis);
    final accessories = OutfitInsightBuilder.accessories(analysis);
    final makeup = OutfitInsightBuilder.makeup(analysis);

    return Column(
      children: [
        const OutfitInteractionHint(
          text: 'لمسي القطع لاكتشاف لماذا تناسب إطلالتك',
          icon: Icons.swipe_left_rounded,
        ),
        const SizedBox(height: 12),
        if (palette.isNotEmpty)
          _PremiumInsightCard(
            title: 'ألوان تناسبك',
            trailing: Icons.auto_awesome_outlined,
            child: _PaletteRow(swatchs: palette),
          ),
        if (pieces.isNotEmpty) ...[
          const SizedBox(height: 14),
          _PremiumInsightCard(
            title: 'قطع مقترحة',
            subtitle: 'مختارة بذوق ميرا — لرفع التوازن والأناقة',
            trailing: Icons.checkroom_outlined,
            child: _LuxuryPieceRow(
              pieces: pieces,
              wishlistedIds: wishlistedIds,
              onWishlistToggle: onWishlistToggle,
            ),
          ),
        ],
        if (accessories.isNotEmpty) ...[
          const SizedBox(height: 14),
          _PremiumInsightCard(
            title: 'إكسسوارات مناسبة',
            subtitle: 'قطع واضحة وقابلة للارتداء — مع صور عالية الجودة',
            trailing: Icons.diamond_outlined,
            child: _LuxuryPieceRow(
              pieces: accessories,
              wishlistedIds: wishlistedIds,
              onWishlistToggle: onWishlistToggle,
            ),
          ),
        ],
        if (makeup.isNotEmpty) ...[
          const SizedBox(height: 14),
          _PremiumInsightCard(
            title: 'مكياج مقترح',
            trailing: Icons.face_retouching_natural_outlined,
            child: _MakeupRow(items: makeup),
          ),
        ],
      ],
    );
  }
}

class _PremiumInsightCard extends StatelessWidget {
  final String title;
  final String? subtitle;
  final IconData trailing;
  final Widget child;

  const _PremiumInsightCard({
    required this.title,
    this.subtitle,
    required this.trailing,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.35)),
        boxShadow: [
          BoxShadow(
            color: AppColors.secondary.withValues(alpha: 0.08),
            blurRadius: 28,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(trailing, size: 20, color: AppColors.secondary.withValues(alpha: 0.85)),
              const Spacer(),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    title,
                    style: AppTypography.titleSmall.copyWith(
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF5A4A6A),
                      letterSpacing: 0.2,
                    ),
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      subtitle!,
                      style: AppTypography.labelSmall.copyWith(
                        color: AppColors.textSecondary,
                      ),
                      textAlign: TextAlign.end,
                    ),
                  ],
                ],
              ),
            ],
          ),
          const SizedBox(height: 18),
          child,
        ],
      ),
    );
  }
}

class _LuxuryPieceRow extends StatelessWidget {
  final List<SuggestedPieceModel> pieces;
  final Set<String> wishlistedIds;
  final ValueChanged<SuggestedPieceModel>? onWishlistToggle;

  const _LuxuryPieceRow({
    required this.pieces,
    this.wishlistedIds = const {},
    this.onWishlistToggle,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 196,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        reverse: true,
        itemCount: pieces.length,
        separatorBuilder: (_, __) => const SizedBox(width: 14),
        itemBuilder: (context, index) {
          return OutfitFloatIdle(
            phaseIndex: index,
            child: OutfitStaggerPop(
              index: index,
              child: OutfitLuxuryPieceCard(
                piece: pieces[index],
                isWishlisted: wishlistedIds.contains(pieces[index].id),
                onWishlistToggle: onWishlistToggle == null
                    ? null
                    : () => onWishlistToggle!(pieces[index]),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _MakeupRow extends StatelessWidget {
  final List<OutfitInsightItem> items;

  const _MakeupRow({required this.items});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 92,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        reverse: true,
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(width: 14),
        itemBuilder: (context, index) {
          return OutfitFloatIdle(
            phaseIndex: index,
            child: OutfitStaggerPop(
              index: index,
              child: OutfitIllustratedTile(item: items[index]),
            ),
          );
        },
      ),
    );
  }
}

class _PaletteRow extends StatelessWidget {
  final List<OutfitPaletteSwatch> swatchs;

  const _PaletteRow({required this.swatchs});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 56,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        reverse: true,
        itemCount: swatchs.length,
        separatorBuilder: (_, __) => const SizedBox(width: 14),
        itemBuilder: (context, index) {
          final sw = swatchs[index];
          return OutfitStaggerPop(
            index: index,
            baseDelayMs: 80,
            child: PressableScale(
              onTap: () {
                HapticFeedback.selectionClick();
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('${sw.nameAr} — يناسب إطلالتك'),
                    behavior: SnackBarBehavior.floating,
                    duration: const Duration(seconds: 2),
                  ),
                );
              },
              child: Container(
                width: 50,
                height: 50,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: sw.color,
                  border: Border.all(color: Colors.white, width: 2.5),
                  boxShadow: [
                    BoxShadow(
                      color: sw.color.withValues(alpha: 0.45),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
