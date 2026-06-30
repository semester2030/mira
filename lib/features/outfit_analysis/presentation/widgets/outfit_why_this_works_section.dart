import 'package:flutter/material.dart';

import '../../../../core/session/analysis_session.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_card.dart';
import '../../domain/entities/outfit_analysis.dart';
import '../../domain/helpers/outfit_stylist_copy.dart';
import 'outfit_result_motion.dart';

/// Section 7 — emotional «why this works» (expandable).
class OutfitWhyThisWorksSection extends StatefulWidget {
  final OutfitAnalysis analysis;

  const OutfitWhyThisWorksSection({super.key, required this.analysis});

  @override
  State<OutfitWhyThisWorksSection> createState() => _OutfitWhyThisWorksSectionState();
}

class _OutfitWhyThisWorksSectionState extends State<OutfitWhyThisWorksSection> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final lines = OutfitStylistCopy.whyThisWorks(
      widget.analysis,
      skin: AnalysisSession.lastSkin,
    );
    if (lines.isEmpty) return const SizedBox.shrink();

    final visible = _expanded ? lines : lines.take(2).toList();
    final hasMore = lines.length > 2;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'لماذا تعمل هذه الإطلالة',
                style: AppTypography.titleMedium.copyWith(fontWeight: FontWeight.w800),
              ),
            ),
            if (hasMore)
              TextButton(
                onPressed: () => setState(() => _expanded = !_expanded),
                child: Text(_expanded ? 'عرض أقل' : 'المزيد (${lines.length})'),
              ),
          ],
        ),
        const SizedBox(height: 10),
        OutfitStaggerPop(
          index: 2,
          baseDelayMs: 180,
          child: PremiumCard(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
            child: Column(
              children: [
                for (var i = 0; i < visible.length; i++) ...[
                  if (i > 0) const SizedBox(height: 14),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        margin: const EdgeInsets.only(top: 2),
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: AppColors.secondary.withValues(alpha: 0.1),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.favorite_rounded,
                          size: 14,
                          color: AppColors.secondary.withValues(alpha: 0.9),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          visible[i],
                          style: AppTypography.bodyMedium.copyWith(height: 1.55),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}
