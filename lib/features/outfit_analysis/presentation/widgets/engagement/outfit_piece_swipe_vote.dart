import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../../shared/theme/colors.dart';
import '../../../../../shared/theme/typography.dart';
import '../../../domain/entities/suggested_piece_model.dart';
import '../outfit_insight/outfit_luxury_piece_card.dart';

/// Swipe vote — pick the better piece (local only, no sharing).
class OutfitPieceSwipeVote extends StatefulWidget {
  final List<SuggestedPieceModel> pieces;
  final ValueChanged<SuggestedPieceModel>? onVoted;

  const OutfitPieceSwipeVote({
    super.key,
    required this.pieces,
    this.onVoted,
  });

  @override
  State<OutfitPieceSwipeVote> createState() => _OutfitPieceSwipeVoteState();
}

class _OutfitPieceSwipeVoteState extends State<OutfitPieceSwipeVote> {
  int _pairIndex = 0;
  String? _lastChoiceTitle;

  @override
  Widget build(BuildContext context) {
    final pair = _currentPair;
    if (pair == null) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: AppColors.border.withValues(alpha: 0.35)),
        ),
        child: Column(
          children: [
            Icon(Icons.favorite_rounded, color: AppColors.secondary, size: 32),
            const SizedBox(height: 10),
            Text(
              _lastChoiceTitle != null
                  ? 'اخترتِ «$_lastChoiceTitle» — ذوق رائع!'
                  : 'لا توجد قطع كافية للمقارنة',
              style: AppTypography.bodyMedium,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }

    final (left, right) = pair;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: AppColors.border.withValues(alpha: 0.35)),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.08),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'أيهما أنسب؟',
            style: AppTypography.titleSmall.copyWith(fontWeight: FontWeight.w800),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          Text(
            'اسحبي البطاقة نحو القطعة التي تفضّلينها',
            style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 220,
            child: Stack(
              alignment: Alignment.center,
              children: [
                Positioned(
                  right: 8,
                  child: Opacity(
                    opacity: 0.55,
                    child: Transform.scale(
                      scale: 0.92,
                      child: OutfitLuxuryPieceCard(piece: right, width: 140),
                    ),
                  ),
                ),
                Dismissible(
                  key: ValueKey('${left.id}-$_pairIndex'),
                  direction: DismissDirection.horizontal,
                  onDismissed: (dir) => _vote(dir == DismissDirection.startToEnd ? right : left),
                  background: _SwipeHint(side: _SwipeSide.right, label: right.title),
                  secondaryBackground: _SwipeHint(side: _SwipeSide.left, label: left.title),
                  child: OutfitLuxuryPieceCard(piece: left, width: 148),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _VoteChip(icon: Icons.arrow_back_rounded, label: left.title),
              const SizedBox(width: 12),
              _VoteChip(icon: Icons.arrow_forward_rounded, label: right.title),
            ],
          ),
        ],
      ),
    );
  }

  (SuggestedPieceModel, SuggestedPieceModel)? get _currentPair {
    if (widget.pieces.length < 2) return null;
    final i = (_pairIndex * 2).clamp(0, widget.pieces.length - 2);
    return (widget.pieces[i], widget.pieces[i + 1]);
  }

  void _vote(SuggestedPieceModel chosen) {
    HapticFeedback.mediumImpact();
    setState(() {
      _lastChoiceTitle = chosen.title;
      _pairIndex++;
    });
    widget.onVoted?.call(chosen);
  }
}

enum _SwipeSide { left, right }

class _SwipeHint extends StatelessWidget {
  final _SwipeSide side;
  final String label;

  const _SwipeHint({required this.side, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      alignment: side == _SwipeSide.left ? Alignment.centerLeft : Alignment.centerRight,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      decoration: BoxDecoration(
        color: AppColors.secondary.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(22),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (side == _SwipeSide.left) ...[
            const Icon(Icons.check_circle_outline, color: AppColors.secondary),
            const SizedBox(width: 6),
          ],
          Flexible(
            child: Text(
              label,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.labelSmall.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
          if (side == _SwipeSide.right) ...[
            const SizedBox(width: 6),
            const Icon(Icons.check_circle_outline, color: AppColors.secondary),
          ],
        ],
      ),
    );
  }
}

class _VoteChip extends StatelessWidget {
  final IconData icon;
  final String label;

  const _VoteChip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.primaryLight.withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppColors.secondary),
          const SizedBox(width: 4),
          Text(
            label,
            style: AppTypography.labelSmall.copyWith(fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
