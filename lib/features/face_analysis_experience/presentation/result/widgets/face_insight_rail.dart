import 'package:flutter/material.dart';

import '../../../projection/contracts/face_result_vms.dart';
import 'face_insight_chip.dart';

/// Compact ≤3 insight rail — no giant cards; face stays dominant.
class FaceInsightRail extends StatelessWidget {
  const FaceInsightRail({
    super.key,
    required this.insights,
    required this.visibleCount,
    required this.selectedInsightId,
    required this.onSelect,
  });

  final List<FaceInsightVm> insights;
  final int visibleCount;
  final String? selectedInsightId;
  final ValueChanged<FaceInsightVm> onSelect;

  @override
  Widget build(BuildContext context) {
    if (insights.isEmpty) return const SizedBox.shrink();
    final show = insights.take(visibleCount.clamp(0, insights.length)).toList();
    if (show.isEmpty) return const SizedBox.shrink();

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      alignment: WrapAlignment.start,
      children: [
        for (final insight in show)
          FaceInsightChip(
            insight: insight,
            selected: selectedInsightId == insight.id,
            onTap: () => onSelect(insight),
          ),
      ],
    );
  }
}
