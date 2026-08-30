import 'package:flutter/widgets.dart';

/// Staged reveal timing for Result Mirror (presentation only — Law #41).
///
/// Not a second analysis sequence. Keep short after analysis already completed.
class FaceResultMotionPolicy {
  final Duration settle;
  final Duration contourCalm;
  final Duration primaryReveal;
  final Duration insightStep;
  final Duration actionsReveal;

  const FaceResultMotionPolicy({
    required this.settle,
    required this.contourCalm,
    required this.primaryReveal,
    required this.insightStep,
    required this.actionsReveal,
  });

  static const defaults = FaceResultMotionPolicy(
    settle: Duration(milliseconds: 180),
    contourCalm: Duration(milliseconds: 220),
    primaryReveal: Duration(milliseconds: 280),
    insightStep: Duration(milliseconds: 90),
    actionsReveal: Duration(milliseconds: 200),
  );

  static const reduced = FaceResultMotionPolicy(
    settle: Duration.zero,
    contourCalm: Duration.zero,
    primaryReveal: Duration(milliseconds: 80),
    insightStep: Duration.zero,
    actionsReveal: Duration(milliseconds: 80),
  );

  static FaceResultMotionPolicy forContext(BuildContext context) {
    final reduce = MediaQuery.disableAnimationsOf(context) ||
        MediaQuery.maybeOf(context)?.disableAnimations == true;
    // Also honor platform accessibility reduce-motion via disableAnimations.
    return reduce ? reduced : defaults;
  }

  Duration get totalBudget =>
      settle + contourCalm + primaryReveal + (insightStep * 3) + actionsReveal;
}
