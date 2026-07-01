import 'package:flutter/material.dart';
import 'colors.dart';

/// Premium typography: Playfair for display, Tajawal for UI (Arabic-friendly).
/// Fonts are bundled locally — no network fetch (avoids iOS DartWorker crashes).
class AppTypography {
  AppTypography._();

  static const _tajawalFamily = 'Tajawal';
  static const _playfairFamily = 'Playfair Display';
  static const _fallbackFamilies = <String>[
    'SF Pro Text',
    'Helvetica Neue',
    'Arial',
  ];

  static TextStyle _tajawal({
    required double size,
    FontWeight weight = FontWeight.w400,
    Color color = AppColors.textPrimary,
    double height = 1.35,
    double letterSpacing = 0,
  }) {
    return TextStyle(
      fontFamily: _tajawalFamily,
      fontFamilyFallback: _fallbackFamilies,
      fontSize: size,
      fontWeight: weight,
      color: color,
      height: height,
      letterSpacing: letterSpacing,
    );
  }

  static TextStyle _playfair({
    required double size,
    FontWeight weight = FontWeight.w600,
    Color color = AppColors.textPrimary,
    double height = 1.2,
  }) {
    return TextStyle(
      fontFamily: _playfairFamily,
      fontFamilyFallback: _fallbackFamilies,
      fontSize: size,
      fontWeight: weight,
      color: color,
      height: height,
    );
  }

  static TextStyle get displayLarge => _playfair(size: 32, weight: FontWeight.w700);
  static TextStyle get displayMedium => _playfair(size: 28, weight: FontWeight.w600);
  static TextStyle get displaySmall => _playfair(size: 24, weight: FontWeight.w600);

  static TextStyle get headlineLarge => _tajawal(size: 22, weight: FontWeight.w700);
  static TextStyle get headlineMedium => _tajawal(size: 20, weight: FontWeight.w700);
  static TextStyle get headlineSmall => _tajawal(size: 18, weight: FontWeight.w600);

  static TextStyle get titleLarge => _tajawal(size: 16, weight: FontWeight.w700);
  static TextStyle get titleMedium => _tajawal(size: 14, weight: FontWeight.w600);
  static TextStyle get titleSmall => _tajawal(size: 12, weight: FontWeight.w600);

  static TextStyle get bodyLarge => _tajawal(size: 16);
  static TextStyle get bodyMedium => _tajawal(size: 14);
  static TextStyle get bodySmall => _tajawal(size: 12);

  static TextStyle get labelLarge => _tajawal(size: 14, weight: FontWeight.w500, letterSpacing: 0.2);
  static TextStyle get labelMedium => _tajawal(size: 12, weight: FontWeight.w500);
  static TextStyle get labelSmall => _tajawal(size: 10, weight: FontWeight.w500);

  static TextTheme get textTheme => TextTheme(
        displayLarge: displayLarge,
        displayMedium: displayMedium,
        displaySmall: displaySmall,
        headlineLarge: headlineLarge,
        headlineMedium: headlineMedium,
        headlineSmall: headlineSmall,
        titleLarge: titleLarge,
        titleMedium: titleMedium,
        titleSmall: titleSmall,
        bodyLarge: bodyLarge,
        bodyMedium: bodyMedium,
        bodySmall: bodySmall,
        labelLarge: labelLarge,
        labelMedium: labelMedium,
        labelSmall: labelSmall,
      );
}
