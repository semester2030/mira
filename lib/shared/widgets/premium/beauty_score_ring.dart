import 'package:flutter/material.dart';
import '../../delight/animated_counter.dart';
import '../../theme/colors.dart';
import '../../theme/gradients.dart';
import '../../theme/typography.dart';
import '../../theme/animations.dart';

class BeautyScoreRing extends StatefulWidget {
  final double score;
  final double size;
  final String label;

  const BeautyScoreRing({
    super.key,
    required this.score,
    this.size = 120,
    this.label = 'درجة الجمال',
  });

  @override
  State<BeautyScoreRing> createState() => _BeautyScoreRingState();
}

class _BeautyScoreRingState extends State<BeautyScoreRing>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _progress;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _progress = Tween<double>(begin: 0, end: (widget.score / 100).clamp(0.0, 1.0))
        .animate(CurvedAnimation(parent: _controller, curve: AppAnimations.slowCurve));
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
        return SizedBox(
          width: widget.size,
          height: widget.size,
          child: Stack(
            alignment: Alignment.center,
            children: [
              SizedBox(
                width: widget.size,
                height: widget.size,
                child: CircularProgressIndicator(
                  value: _progress.value,
                  strokeWidth: 8,
                  backgroundColor: AppColors.primaryLight,
                  valueColor: const AlwaysStoppedAnimation(AppColors.primary),
                ),
              ),
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  ShaderMask(
                    shaderCallback: (bounds) => AppGradients.primary.createShader(bounds),
                    child: AnimatedCounter(
                      value: widget.score * _progress.value,
                      style: AppTypography.displaySmall.copyWith(
                        color: Colors.white,
                        fontSize: widget.size * 0.28,
                      ),
                      duration: const Duration(milliseconds: 1200),
                    ),
                  ),
                  Text(
                    widget.label,
                    style: AppTypography.labelSmall.copyWith(color: AppColors.textSecondary),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}
