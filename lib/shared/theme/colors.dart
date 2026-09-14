import 'package:flutter/material.dart';

/// Mira premium design tokens — single source of truth for color.
class AppColors {
  AppColors._();

  static const Color primary = Color(0xFFE86FA9);
  static const Color primaryLight = Color(0xFFFADAE9);
  static const Color primaryDark = Color(0xFFC95889);
  static const Color secondary = Color(0xFFC19EE0);
  static const Color accent = Color(0xFFFFB6B9);
  static const Color background = Color(0xFFFFF7FA);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color card = surface;
  static const Color textPrimary = Color(0xFF4A3A3A);
  static const Color textSecondary = Color(0xFF524343);
  static const Color textTertiary = Color(0xFF6D5C5C);
  static const Color border = Color(0xFFF8BBD0);
  static const Color shadow = Color(0x1A000000);
  static const Color success = Color(0xFFA469C9);
  static const Color error = Color(0xFFE57373);
  static const Color gold = Color(0xFFD4AF37);
  static const Color goldLight = Color(0xFFF5E6B8);
  static const Color info = Color(0xFF64B5F6);
  static const Color warning = Color(0xFFFFD54F);

  static const Color progressStart = Color(0xFFC96BB2);
  static const Color progressEnd = Color(0xFFF07DB6);
  static const Color gradientStart = Color(0xFFFADAE9);
  static const Color gradientEnd = Color(0xFFC19EE0);

  static const Color cardPink = Color(0xFFFADAE9);
  static const Color cardPurple = Color(0xFFE8D5F2);
  static const Color cardOrange = Color(0xFFFFF3E0);
  static const Color cardBlue = Color(0xFFE3F2FD);

  static const Color darkBackground = Color(0xFF232136);
  static const Color darkCard = Color(0xFF2D2B4D);
  static const Color darkText = Color(0xFFFADAE9);
  static const Color darkAccent = Color(0xFFC19EE0);

  static const Color onPrimary = Colors.white;
  static const Color shimmerBase = Color(0xFFFADAE9);
  static const Color shimmerHighlight = Color(0xFFFFF7FA);

  /// Glass overlay on gradients.
  static const Color glassFill = Color(0xBFFFFFFF);
  static const Color glassBorder = Color(0x66FFFFFF);

  /// Face Explorer analysis accents — pigmentation/acne differentiated for clarity.
  static const Color analysisPigmentation = Color(0xFFB83280);
  static const Color analysisPores = Color(0xFF5B8FA8);
  static const Color analysisWrinkles = Color(0xFFA78BFA);
  static const Color analysisRedness = Color(0xFFE07070);
  static const Color analysisTexture = Color(0xFF9B7FD4);
  static const Color analysisAcne = Color(0xFFE0673A);
  static const Color analysisHydration = Color(0xFF4A9FE0);
  static const Color analysisOil = Color(0xFFF0A020);
  static const Color analysisCalloutSurface = Color(0xF7FFFFFF);
  static const Color analysisCalloutLine = Color(0xAAB83280);
}
