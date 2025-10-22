import 'package:flutter/material.dart';
import '../theme/colors.dart';

class TooltipWidget extends StatelessWidget {
  final Widget child;
  final String message;
  final TooltipPosition position;
  final Duration duration;

  const TooltipWidget({
    super.key,
    required this.child,
    required this.message,
    this.position = TooltipPosition.above,
    this.duration = const Duration(seconds: 2),
  });

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: message,
      preferBelow: position == TooltipPosition.below,
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.95),
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.18),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      textStyle: TextStyle(
        color: AppColors.onPrimary,
        fontWeight: FontWeight.w600,
        fontSize: 14,
      ),
      waitDuration: const Duration(milliseconds: 300),
      showDuration: duration,
      child: child,
    );
  }
}

enum TooltipPosition { above, below }
