import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';

/// Full-screen AI analysis animation shown while the server processes the scan.
class AiAnalysisOverlay extends StatefulWidget {
  final List<String> steps;

  const AiAnalysisOverlay({
    super.key,
    this.steps = const [
      'قراءة ملامح الوجه',
      'تحليل نوع البشرة',
      'قياس الترطيب والمسام',
      'إعداد توصيات ميرا',
    ],
  });

  @override
  State<AiAnalysisOverlay> createState() => _AiAnalysisOverlayState();
}

class _AiAnalysisOverlayState extends State<AiAnalysisOverlay>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final stepIndex =
            (_controller.value * widget.steps.length).floor() % widget.steps.length;

        return Container(
          color: Colors.black.withValues(alpha: 0.55),
          child: Stack(
            fit: StackFit.expand,
            children: [
              CustomPaint(
                painter: _AiGridPainter(progress: _controller.value),
              ),
              Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SizedBox(
                      width: 88,
                      height: 88,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          CircularProgressIndicator(
                            strokeWidth: 2.5,
                            color: AppColors.gold.withValues(alpha: 0.35),
                          ),
                          Transform.rotate(
                            angle: _controller.value * math.pi * 2,
                            child: Icon(
                              Icons.auto_awesome_rounded,
                              color: AppColors.gold.withValues(alpha: 0.95),
                              size: 34,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: AppColors.gold.withValues(alpha: 0.5)),
                        color: Colors.black.withValues(alpha: 0.35),
                      ),
                      child: Text(
                        'MIRA AI',
                        style: AppTypography.labelMedium.copyWith(
                          color: AppColors.gold,
                          letterSpacing: 2,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 350),
                      child: Text(
                        widget.steps[stepIndex],
                        key: ValueKey(stepIndex),
                        style: AppTypography.titleMedium.copyWith(
                          color: AppColors.onPrimary,
                        ),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'تحليل احترافي بالذكاء الاصطناعي...',
                      style: AppTypography.bodySmall.copyWith(
                        color: AppColors.onPrimary.withValues(alpha: 0.72),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _AiGridPainter extends CustomPainter {
  final double progress;

  _AiGridPainter({required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final scanY = size.height * progress;
    canvas.drawLine(
      Offset(0, scanY),
      Offset(size.width, scanY),
      Paint()
        ..shader = LinearGradient(
          colors: [
            Colors.transparent,
            AppColors.primary.withValues(alpha: 0.55),
            AppColors.gold.withValues(alpha: 0.75),
            AppColors.primary.withValues(alpha: 0.55),
            Colors.transparent,
          ],
          stops: const [0, 0.35, 0.5, 0.65, 1],
        ).createShader(Rect.fromLTWH(0, scanY - 2, size.width, 4))
        ..strokeWidth = 3,
    );

    final dotPaint = Paint()..color = AppColors.gold.withValues(alpha: 0.25);
    for (var i = 0; i < 18; i++) {
      final x = (size.width / 17) * i;
      final y = scanY + math.sin(i + progress * math.pi * 4) * 8;
      canvas.drawCircle(Offset(x, y), 1.8, dotPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _AiGridPainter oldDelegate) =>
      oldDelegate.progress != progress;
}
