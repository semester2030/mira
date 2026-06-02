import 'package:flutter/material.dart';

import '../../../../shared/delight/animated_counter.dart';
import '../../../../shared/theme/animations.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';

class SkinConditionIndicator extends StatefulWidget {
  final String label;
  final int value;
  final Color color;

  const SkinConditionIndicator({
    super.key,
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  State<SkinConditionIndicator> createState() => _SkinConditionIndicatorState();
}

class _SkinConditionIndicatorState extends State<SkinConditionIndicator>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _progress;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    );
    _progress = Tween<double>(
      begin: 0,
      end: (widget.value / 100).clamp(0.0, 1.0),
    ).animate(CurvedAnimation(parent: _controller, curve: AppAnimations.slowCurve));
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _progress,
      builder: (context, _) {
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
              alignment: Alignment.center,
              children: [
                SizedBox(
                  width: 52,
                  height: 52,
                  child: CircularProgressIndicator(
                    value: _progress.value,
                    color: widget.color,
                    backgroundColor: widget.color.withValues(alpha: 0.18),
                    strokeWidth: 6,
                  ),
                ),
                AnimatedCounter(
                  value: widget.value * _progress.value,
                  suffix: '%',
                  style: AppTypography.labelMedium.copyWith(color: AppColors.textPrimary),
                  duration: const Duration(milliseconds: 1100),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              widget.label,
              style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary),
            ),
          ],
        );
      },
    );
  }
}
