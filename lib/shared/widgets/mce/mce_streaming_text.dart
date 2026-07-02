import 'package:flutter/material.dart';

import '../../theme/colors.dart';
import '../../theme/typography.dart';

/// Animated streaming assistant text (MCE Phase 4).
class MceStreamingText extends StatelessWidget {
  final String text;
  final bool isStreaming;

  const MceStreamingText({
    super.key,
    required this.text,
    this.isStreaming = false,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Text(
            text,
            style: AppTypography.bodyMedium.copyWith(height: 1.55),
          ),
        ),
        if (isStreaming) ...[
          const SizedBox(width: 6),
          SizedBox(
            width: 8,
            height: 8,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: AppColors.secondary.withValues(alpha: 0.7),
                shape: BoxShape.circle,
              ),
            ),
          ),
        ],
      ],
    );
  }
}
