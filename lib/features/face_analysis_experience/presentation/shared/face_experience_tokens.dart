import 'package:flutter/material.dart';

import '../../../../../shared/theme/colors.dart';
import '../../../../../shared/theme/typography.dart';

/// Unified Face Experience presentation tokens (9K).
///
/// Presentation-only — does not change Mira global theme or Face Intelligence.
abstract final class FaceExperienceTokens {
  FaceExperienceTokens._();

  // —— Color (pearl / soft white / restrained violet / glass) ——
  static const Color pearl = Color(0xFFE8D9C8);
  static const Color violet = Color(0xFF8B6BB5);
  static const Color contour = Color(0xFFF5F0EA);
  static const Color onGlass = Color(0xFFF7F2EC);
  static const Color qualifier = Color(0xFFD4C4B0);
  static const Color actionAccent = AppColors.secondary;
  static const Color readyAccent = violet;
  static const Color guideStroke = pearl;
  static const Color shutterRing = AppColors.secondary;
  static const Color flashPearl = Color(0xE6FFF8F0);

  static const Color scaffoldDark = Color(0xFF121014);
  static const Color sheetDark = Color(0xFF1A171C);
  static const Color captureGradientTop = Color(0xFF2A1A24);
  static const Color captureGradientBottom = Color(0xFF120C10);

  /// Canonical dim over face imagery (aligned across capture + result).
  static Color dimMask = Colors.black.withValues(alpha: 0.55);
  static Color guidanceGlass = Colors.black.withValues(alpha: 0.42);
  static Color glass = Colors.black.withValues(alpha: 0.38);
  static Color glassBorder = pearl.withValues(alpha: 0.28);
  static Color selectedGlow = violet.withValues(alpha: 0.35);
  static Color regionHalo = pearl.withValues(alpha: 0.22);
  static Color contourCalm = contour.withValues(alpha: 0.55);

  static Color contourForState({required bool isReady, required bool hold}) {
    if (isReady) return readyAccent.withValues(alpha: 0.92);
    if (hold) return pearl.withValues(alpha: 0.85);
    return contour.withValues(alpha: 0.72);
  }

  // —— Radius ——
  static const double mirrorRadius = 28;
  static const double glassRadius = 16;
  static const double chipRadius = 20;
  static const double stageChipRadius = 18;
  static const double buttonRadius = 14;
  static const double badgeRadius = 10;

  // —— Spacing rhythm ——
  static const double spaceXs = 4;
  static const double spaceSm = 8;
  static const double spaceMd = 12;
  static const double spaceLg = 16;
  static const double spaceXl = 20;

  // —— Touch ——
  static const double minTouchTarget = 48;

  // —— Typography bridges (prefer AppTypography roles) ——
  static TextStyle primaryGuidance(BuildContext context) =>
      AppTypography.titleSmall.copyWith(color: onGlass);

  static TextStyle primaryResult(BuildContext context) =>
      AppTypography.titleLarge.copyWith(
        color: onGlass,
        fontWeight: FontWeight.w600,
      );

  static TextStyle insightTitle(BuildContext context) =>
      AppTypography.bodySmall.copyWith(color: onGlass, fontWeight: FontWeight.w500);

  static TextStyle detailTitle(BuildContext context) =>
      AppTypography.titleMedium.copyWith(color: onGlass);

  static TextStyle body(BuildContext context) =>
      AppTypography.bodySmall.copyWith(color: onGlass.withValues(alpha: 0.86));

  static TextStyle qualifierStyle(BuildContext context) =>
      AppTypography.bodySmall.copyWith(color: qualifier, fontSize: 11);

  static TextStyle secondaryAction(BuildContext context) =>
      AppTypography.bodySmall.copyWith(color: qualifier);
}
