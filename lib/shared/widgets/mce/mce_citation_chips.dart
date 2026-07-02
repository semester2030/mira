import 'package:flutter/material.dart';

import '../../theme/colors.dart';
import '../../theme/typography.dart';

class MceCitationChip extends StatelessWidget {
  final String label;
  final String value;

  const MceCitationChip({super.key, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: value,
      child: Chip(
        visualDensity: VisualDensity.compact,
        backgroundColor: AppColors.goldLight.withValues(alpha: 0.35),
        label: Text(
          label,
          style: AppTypography.labelSmall.copyWith(color: AppColors.primaryDark),
        ),
      ),
    );
  }
}

class MceCitationChips extends StatelessWidget {
  final List<({String label, String value})> facts;

  const MceCitationChips({super.key, required this.facts});

  @override
  Widget build(BuildContext context) {
    if (facts.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Wrap(
        spacing: 6,
        runSpacing: 6,
        children: facts
            .map((f) => MceCitationChip(label: f.label, value: f.value))
            .toList(),
      ),
    );
  }
}
