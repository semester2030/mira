import 'package:flutter/material.dart';

import '../../../../../shared/theme/colors.dart';
import '../../shared/face_experience_tokens.dart';

/// Scoped presentation tokens for Interactive Result Mirror (9F).
/// 9K: aliases unified [FaceExperienceTokens].
abstract final class FaceResultTokens {
  FaceResultTokens._();

  static const Color pearl = FaceExperienceTokens.pearl;
  static const Color violet = FaceExperienceTokens.violet;
  static const Color contour = FaceExperienceTokens.contour;

  static Color get dimMask => FaceExperienceTokens.dimMask;
  static Color get glass => FaceExperienceTokens.glass;
  static Color get glassBorder => FaceExperienceTokens.glassBorder;
  static Color get selectedGlow => FaceExperienceTokens.selectedGlow;
  static Color get regionHalo => FaceExperienceTokens.regionHalo;
  static Color get contourCalm => FaceExperienceTokens.contourCalm;

  static const Color onGlass = FaceExperienceTokens.onGlass;
  static const Color qualifier = FaceExperienceTokens.qualifier;

  /// Secondary CTA / Ask Mira — Mira palette, not neon.
  static const Color actionAccent = AppColors.secondary;

  static const double mirrorRadius = FaceExperienceTokens.mirrorRadius;
  static const double glassRadius = FaceExperienceTokens.glassRadius;
  static const double chipRadius = FaceExperienceTokens.chipRadius;
}
