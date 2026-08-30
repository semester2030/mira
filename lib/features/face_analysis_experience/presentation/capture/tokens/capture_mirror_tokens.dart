import 'package:flutter/material.dart';

import '../../../../../shared/theme/colors.dart';
import '../../shared/face_experience_tokens.dart';

/// Scoped presentation tokens for Interactive Capture Mirror (9C).
/// 9K: aliases unified [FaceExperienceTokens].
abstract final class CaptureMirrorTokens {
  CaptureMirrorTokens._();

  static const Color pearl = FaceExperienceTokens.pearl;
  static const Color violet = FaceExperienceTokens.violet;
  static const Color contour = FaceExperienceTokens.contour;
  static const Color readyAccent = FaceExperienceTokens.readyAccent;
  static const Color guideStroke = FaceExperienceTokens.guideStroke;
  static Color get dimMask => FaceExperienceTokens.dimMask;

  static Color contourForState({required bool isReady, required bool hold}) =>
      FaceExperienceTokens.contourForState(isReady: isReady, hold: hold);

  static Color get guidanceGlass => FaceExperienceTokens.guidanceGlass;

  static const Color flashPearl = FaceExperienceTokens.flashPearl;

  /// Soft secondary from Mira palette for shutter ring when mirror active.
  static const Color shutterRing = AppColors.secondary;
}
