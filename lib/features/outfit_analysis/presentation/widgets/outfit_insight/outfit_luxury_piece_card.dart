import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../../shared/theme/colors.dart';
import '../../../../../shared/theme/shadows.dart';
import '../../../../../shared/theme/typography.dart';
import '../../../../../shared/widgets/premium/pressable_scale.dart';
import '../../../domain/entities/suggested_piece_model.dart';
import '../../../domain/helpers/outfit_arabic_labels.dart';
import '../outfit_result_motion.dart';

/// Luxury catalog card — PNG product on premium white surface.
class OutfitLuxuryPieceCard extends StatelessWidget {
  final SuggestedPieceModel piece;
  final double width;
  final bool isWishlisted;
  final VoidCallback? onWishlistToggle;

  const OutfitLuxuryPieceCard({
    super.key,
    required this.piece,
    this.width = 132,
    this.isWishlisted = false,
    this.onWishlistToggle,
  });

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: () {
        HapticFeedback.lightImpact();
        _showDetail(context);
      },
      child: Container(
        width: width,
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: AppColors.border.withValues(alpha: 0.28)),
          boxShadow: [
            ...AppShadows.card,
            BoxShadow(
              color: _parseHex(piece.colorHex).withValues(alpha: 0.12),
              blurRadius: 18,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.goldLight.withValues(alpha: 0.45),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        piece.categoryLabelAr,
                        style: AppTypography.labelSmall.copyWith(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFF6B5A4E),
                        ),
                      ),
                    ),
                  ),
                ),
                if (onWishlistToggle != null)
                  GestureDetector(
                    onTap: () {
                      HapticFeedback.lightImpact();
                      onWishlistToggle!();
                    },
                    child: Icon(
                      isWishlisted ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                      size: 20,
                      color: isWishlisted ? AppColors.secondary : AppColors.textSecondary,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            Expanded(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: const Color(0xFFFAFAFA),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.06),
                      blurRadius: 12,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: Padding(
                    padding: const EdgeInsets.all(8),
                    child: _ProductImage(assetPath: piece.imageAsset),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 10),
            Text(
              piece.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.labelLarge.copyWith(
                fontWeight: FontWeight.w700,
                height: 1.25,
                color: const Color(0xFF3D3344),
              ),
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                Icon(
                  Icons.auto_awesome_rounded,
                  size: 12,
                  color: AppColors.gold.withValues(alpha: 0.9),
                ),
                const SizedBox(width: 4),
                Text(
                  'توافق القطعة ${piece.compatibilityPercent}%',
                  style: AppTypography.labelSmall.copyWith(
                    color: AppColors.secondary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showDetail(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(ctx).bottom),
        child: OutfitStaggerPop(
          index: 0,
          child: Container(
            margin: const EdgeInsets.fromLTRB(16, 0, 16, 24),
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(26),
              border: Border.all(color: AppColors.border.withValues(alpha: 0.35)),
              boxShadow: AppShadows.dialog,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  height: 160,
                  child: _ProductImage(assetPath: piece.imageAsset, large: true),
                ),
                const SizedBox(height: 14),
                Text(piece.title, style: AppTypography.titleMedium),
                const SizedBox(height: 6),
                Text(
                  OutfitArabicLabels.styleTag(piece.styleTag),
                  style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary),
                ),
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.goldLight.withValues(alpha: 0.35),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Text(
                    OutfitArabicLabels.humanizeEngineCopy(piece.whyAr),
                    style: AppTypography.bodySmall.copyWith(height: 1.5),
                    textAlign: TextAlign.center,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  OutfitArabicLabels.pieceCompatibilityLine(
                    piece.compatibilityPercent,
                    piece.confidencePercent,
                  ),
                  style: AppTypography.labelLarge.copyWith(
                    color: AppColors.secondary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'مقياس توافق القطعة — مختلف عن درجة الإطلالة الكلية',
                  style: AppTypography.labelSmall.copyWith(
                    color: AppColors.textSecondary,
                    height: 1.35,
                  ),
                  textAlign: TextAlign.center,
                ),
                if (piece.evidence.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  ...piece.evidence.take(3).map(
                        (e) => Padding(
                          padding: const EdgeInsets.only(bottom: 4),
                          child: Text(
                            '• ${OutfitArabicLabels.humanizeEngineCopy(e)}',
                            style: AppTypography.labelSmall.copyWith(
                              color: AppColors.textSecondary,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Color _parseHex(String hex) {
    final cleaned = hex.replaceFirst('#', '');
    if (cleaned.length == 6) {
      return Color(int.parse('FF$cleaned', radix: 16));
    }
    return AppColors.gold;
  }
}

class _ProductImage extends StatelessWidget {
  final String assetPath;
  final bool large;

  const _ProductImage({required this.assetPath, this.large = false});

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      assetPath,
      fit: BoxFit.contain,
      errorBuilder: (_, __, ___) => _ProductPlaceholder(large: large),
    );
  }
}

class _ProductPlaceholder extends StatelessWidget {
  final bool large;

  const _ProductPlaceholder({this.large = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            AppColors.primaryLight.withValues(alpha: 0.35),
            AppColors.surface,
          ],
        ),
        borderRadius: BorderRadius.circular(large ? 18 : 14),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.checkroom_outlined,
            size: large ? 42 : 32,
            color: AppColors.secondary.withValues(alpha: 0.45),
          ),
          if (large) ...[
            const SizedBox(height: 8),
            Text(
              'معاينة القطعة قريباً',
              style: AppTypography.labelSmall.copyWith(
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
