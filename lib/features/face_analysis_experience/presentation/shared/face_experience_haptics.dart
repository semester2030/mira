import 'package:flutter/services.dart';

/// Semantic haptic policy — meaningful transitions only (9K / D10).
///
/// LIGHT = selection / soft state
/// MEDIUM = capture commitment
/// No per-frame / no every-chip spam.
abstract final class FaceExperienceHaptics {
  FaceExperienceHaptics._();

  static Future<void> light() => HapticFeedback.selectionClick();

  static Future<void> medium() => HapticFeedback.lightImpact();

  static Future<void> captureCommit() => HapticFeedback.mediumImpact();

  /// READY entered — one light pulse.
  static Future<void> ready() => light();

  /// Sheet / history surface opened.
  static Future<void> surfaceOpened() => light();

  /// Insight / region selection — intentionally silent to avoid fatigue.
  static Future<void> selectionOptional({bool enabled = false}) async {
    if (enabled) await light();
  }
}
