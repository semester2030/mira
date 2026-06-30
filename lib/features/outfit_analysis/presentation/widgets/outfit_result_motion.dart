import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../shared/theme/animations.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';

/// Gentle float — keeps illustrations feeling alive without GPU stress.
class OutfitFloatIdle extends StatefulWidget {
  final Widget child;
  final int phaseIndex;

  const OutfitFloatIdle({
    super.key,
    required this.child,
    this.phaseIndex = 0,
  });

  @override
  State<OutfitFloatIdle> createState() => _OutfitFloatIdleState();
}

class _OutfitFloatIdleState extends State<OutfitFloatIdle>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: Duration(milliseconds: 2400 + widget.phaseIndex * 180),
    )..repeat(reverse: true);
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
      builder: (context, child) {
        final t = _controller.value;
        final dy = math.sin(t * math.pi) * 4;
        final scale = 1 + math.sin(t * math.pi) * 0.03;
        return Transform.translate(
          offset: Offset(0, dy),
          child: Transform.scale(scale: scale, child: child),
        );
      },
      child: widget.child,
    );
  }
}

/// Pop-in for palette swatches and list items.
class OutfitStaggerPop extends StatefulWidget {
  final Widget child;
  final int index;
  final int baseDelayMs;

  const OutfitStaggerPop({
    super.key,
    required this.child,
    this.index = 0,
    this.baseDelayMs = 60,
  });

  @override
  State<OutfitStaggerPop> createState() => _OutfitStaggerPopState();
}

class _OutfitStaggerPopState extends State<OutfitStaggerPop>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scale;
  late Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 520),
    );
    _scale = Tween<double>(begin: 0.72, end: 1).animate(
      CurvedAnimation(parent: _controller, curve: Curves.elasticOut),
    );
    _opacity = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOut),
    );
    Future<void>.delayed(
      Duration(milliseconds: widget.index * widget.baseDelayMs),
      () {
        if (mounted) _controller.forward();
      },
    );
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
      builder: (context, child) => Opacity(
        opacity: _opacity.value,
        child: Transform.scale(scale: _scale.value, child: child),
      ),
      child: widget.child,
    );
  }
}

/// Animated harmony progress bar with counting percentage.
class OutfitAnimatedHarmonyBar extends StatefulWidget {
  final String label;
  final int score;
  final int delayMs;

  const OutfitAnimatedHarmonyBar({
    super.key,
    required this.label,
    required this.score,
    this.delayMs = 0,
  });

  @override
  State<OutfitAnimatedHarmonyBar> createState() => _OutfitAnimatedHarmonyBarState();
}

class _OutfitAnimatedHarmonyBarState extends State<OutfitAnimatedHarmonyBar>
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
      end: (widget.score / 100).clamp(0.0, 1.0),
    ).animate(CurvedAnimation(parent: _controller, curve: AppAnimations.slowCurve));
    Future<void>.delayed(Duration(milliseconds: widget.delayMs), () {
      if (mounted) _controller.forward();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                widget.label,
                style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
              ),
            ),
            AnimatedBuilder(
              animation: _progress,
              builder: (context, _) => Text(
                '${(widget.score * _progress.value).round()}%',
                style: AppTypography.labelLarge.copyWith(
                  color: AppColors.secondary,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: SizedBox(
            height: 9,
            child: AnimatedBuilder(
              animation: _progress,
              builder: (context, _) => Stack(
                fit: StackFit.expand,
                children: [
                  DecoratedBox(
                    decoration: BoxDecoration(
                      color: AppColors.primaryLight.withValues(alpha: 0.55),
                    ),
                  ),
                  Align(
                    alignment: Alignment.centerRight,
                    child: FractionallySizedBox(
                      widthFactor: _progress.value,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              AppColors.secondary.withValues(alpha: 0.85),
                              AppColors.primary.withValues(alpha: 0.95),
                            ],
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.primary.withValues(alpha: 0.35),
                              blurRadius: 6,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Pulsing hint — nudges user to tap illustrations / scroll.
class OutfitInteractionHint extends StatefulWidget {
  final String text;
  final IconData icon;

  const OutfitInteractionHint({
    super.key,
    required this.text,
    this.icon = Icons.touch_app_outlined,
  });

  @override
  State<OutfitInteractionHint> createState() => _OutfitInteractionHintState();
}

class _OutfitInteractionHintState extends State<OutfitInteractionHint>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);
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
      builder: (context, child) {
        final opacity = 0.45 + _controller.value * 0.55;
        return Opacity(
          opacity: opacity,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(widget.icon, size: 16, color: AppColors.secondary),
              const SizedBox(width: 6),
              Text(
                widget.text,
                style: AppTypography.labelSmall.copyWith(
                  color: AppColors.secondary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// Soft sparkle ambience — result page only, low GPU cost.
class OutfitResultAmbience extends StatefulWidget {
  final Widget child;

  const OutfitResultAmbience({super.key, required this.child});

  @override
  State<OutfitResultAmbience> createState() => _OutfitResultAmbienceState();
}

class _OutfitResultAmbienceState extends State<OutfitResultAmbience>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 6),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        AnimatedBuilder(
          animation: _controller,
          builder: (context, _) => IgnorePointer(
            child: CustomPaint(
              painter: _SoftSparklePainter(t: _controller.value * math.pi * 2),
            ),
          ),
        ),
        widget.child,
      ],
    );
  }
}

class _SoftSparklePainter extends CustomPainter {
  final double t;

  _SoftSparklePainter({required this.t});

  @override
  void paint(Canvas canvas, Size size) {
    const seeds = [
      (0.12, 0.08, 0xFFC19EE0),
      (0.88, 0.14, 0xFFE86FA9),
      (0.72, 0.32, 0xFFF5E6B8),
      (0.18, 0.45, 0xFFC19EE0),
      (0.92, 0.58, 0xFFE86FA9),
      (0.08, 0.72, 0xFFFADAE9),
      (0.55, 0.82, 0xFFC19EE0),
      (0.38, 0.22, 0xFFE86FA9),
    ];
    for (var i = 0; i < seeds.length; i++) {
      final (nx, ny, colorVal) = seeds[i];
      final pulse = 0.35 + 0.65 * ((math.sin(t * 2 + i) + 1) / 2);
      final r = 2.5 + pulse * 2;
      final paint = Paint()
        ..color = Color(colorVal).withValues(alpha: 0.12 + pulse * 0.18);
      canvas.drawCircle(Offset(nx * size.width, ny * size.height), r, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _SoftSparklePainter old) => old.t != t;
}
