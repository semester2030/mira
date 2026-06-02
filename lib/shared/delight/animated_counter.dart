import 'package:flutter/material.dart';

import '../theme/animations.dart';

/// Counts from 0 to [value] with easing — for scores, points, stats.
class AnimatedCounter extends StatelessWidget {
  final num value;
  final TextStyle style;
  final String? suffix;
  final Duration duration;
  final int fractionDigits;

  const AnimatedCounter({
    super.key,
    required this.value,
    required this.style,
    this.suffix,
    this.duration = const Duration(milliseconds: 1400),
    this.fractionDigits = 0,
  });

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: value.toDouble()),
      duration: duration,
      curve: AppAnimations.slowCurve,
      builder: (context, v, _) {
        final text = fractionDigits > 0
            ? v.toStringAsFixed(fractionDigits)
            : v.round().toString();
        return Text('$text${suffix ?? ''}', style: style);
      },
    );
  }
}
