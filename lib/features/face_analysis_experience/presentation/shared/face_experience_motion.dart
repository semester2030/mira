import 'package:flutter/material.dart';

import '../analysis/policy/analysis_motion_timing_policy.dart';
import '../result/policy/face_result_motion_policy.dart';

/// Coherent Face Experience motion language (9K).
///
/// Smooth · restrained · soft · continuous · non-bouncy by default.
abstract final class FaceExperienceMotion {
  FaceExperienceMotion._();

  static const Duration fastFeedback = Duration(milliseconds: 160);
  static const Duration standardTransition = Duration(milliseconds: 220);
  static const Duration reveal = Duration(milliseconds: 280);
  static const Duration sheet = Duration(milliseconds: 220);
  static const Duration ambient = Duration(milliseconds: 180);
  static const Duration micro = Duration(milliseconds: 120);

  static const Curve revealCurve = Curves.easeOutCubic;
  static const Curve standardCurve = Curves.easeOut;

  /// True when platform Reduce Motion / disableAnimations is active.
  static bool reduceMotionOf(BuildContext context) {
    return MediaQuery.disableAnimationsOf(context) ||
        MediaQuery.maybeOf(context)?.disableAnimations == true;
  }

  static Duration opacityOf(BuildContext context, Duration preferred) {
    return reduceMotionOf(context) ? Duration.zero : preferred;
  }

  static Duration sheetOf(BuildContext context) {
    return reduceMotionOf(context) ? Duration.zero : sheet;
  }

  /// Faster result reveal when analysis motion already completed (avoid double premiere).
  static const FaceResultMotionPolicy afterAnalysisReveal = FaceResultMotionPolicy(
    settle: Duration(milliseconds: 60),
    contourCalm: Duration(milliseconds: 90),
    primaryReveal: Duration(milliseconds: 140),
    insightStep: Duration(milliseconds: 45),
    actionsReveal: Duration(milliseconds: 90),
  );

  static FaceResultMotionPolicy resultRevealPolicy({
    required BuildContext context,
    required bool afterAnalysisMotion,
  }) {
    if (reduceMotionOf(context)) return FaceResultMotionPolicy.reduced;
    if (afterAnalysisMotion) return afterAnalysisReveal;
    return FaceResultMotionPolicy.defaults;
  }

  /// Documented presentation budget (9D soft-min handoff + 9F after-analysis).
  static Duration documentedPostCaptureBudget({bool reduce = false}) {
    if (reduce) {
      return AnalysisMotionTimingPolicy.defaults.reduceSettling +
          AnalysisMotionTimingPolicy.defaults.reduceStageStep +
          FaceResultMotionPolicy.reduced.totalBudget;
    }
    return AnalysisMotionTimingPolicy.defaults.softMinChoreography +
        AnalysisMotionTimingPolicy.defaults.maxDelayAfterSuccess +
        afterAnalysisReveal.totalBudget;
  }
}
