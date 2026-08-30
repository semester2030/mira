import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../contracts/result_enums.dart';
import '../../localization/confidence_labels.dart';

/// Confidence chip — separate visual language from condition/wellness.
class ResultsConfidenceChip extends StatelessWidget {
  const ResultsConfidenceChip({
    super.key,
    required this.state,
    this.compact = false,
  });

  final ConfidenceState state;
  final bool compact;

  static String shortLabelAr(ConfidenceState state) {
    switch (state) {
      case ConfidenceState.high:
        return 'عالية';
      case ConfidenceState.medium:
        return 'متوسطة';
      case ConfidenceState.low:
        return 'منخفضة';
      case ConfidenceState.unavailable:
        return 'غير متاحة';
    }
  }

  @override
  Widget build(BuildContext context) {
    final spec = ConfidencePresentationContract.forState(state);
    final label = shortLabelAr(state);
    // Blue-gray family — never gold/wellness pink for confidence.
    final bg = const Color(0xFFE8EEF5);
    final fg = const Color(0xFF4A6572);

    return Semantics(
      label: 'ثقة التحليل: $label. ${spec.explanationAr}',
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: compact ? 10 : 12,
          vertical: compact ? 5 : 7,
        ),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: fg.withValues(alpha: 0.22)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.shield_outlined, size: compact ? 14 : 16, color: fg),
            const SizedBox(width: 6),
            Text(
              'الثقة: $label',
              style: AppTypography.labelSmall.copyWith(
                color: fg,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
