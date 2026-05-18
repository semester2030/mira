import 'package:flutter/material.dart';
import 'colors.dart';
import 'typography.dart';

/// Backward-compatible aliases — prefer [AppTypography] for new code.
class AppTextStyles {
  AppTextStyles._();

  static TextStyle get displayLarge => AppTypography.displayLarge;
  static TextStyle get displayMedium => AppTypography.displayMedium;
  static TextStyle get displaySmall => AppTypography.displaySmall;
  static TextStyle get headlineLarge => AppTypography.headlineLarge;
  static TextStyle get headlineMedium => AppTypography.headlineMedium;
  static TextStyle get headlineSmall => AppTypography.headlineSmall;
  static TextStyle get titleLarge => AppTypography.titleLarge;
  static TextStyle get titleMedium => AppTypography.titleMedium;
  static TextStyle get titleSmall => AppTypography.titleSmall;
  static TextStyle get bodyLarge => AppTypography.bodyLarge;
  static TextStyle get bodyMedium => AppTypography.bodyMedium;
  static TextStyle get bodySmall => AppTypography.bodySmall;
  static TextStyle get labelLarge => AppTypography.labelLarge;
  static TextStyle get labelMedium => AppTypography.labelMedium;
  static TextStyle get labelSmall => AppTypography.labelSmall;

  static TextStyle get darkDisplayLarge => displayLarge.copyWith(color: AppColors.darkText);
  static TextStyle get darkDisplayMedium => displayMedium.copyWith(color: AppColors.darkText);
  static TextStyle get darkDisplaySmall => displaySmall.copyWith(color: AppColors.darkText);
  static TextStyle get darkHeadlineLarge => headlineLarge.copyWith(color: AppColors.darkText);
  static TextStyle get darkHeadlineMedium => headlineMedium.copyWith(color: AppColors.darkText);
  static TextStyle get darkHeadlineSmall => headlineSmall.copyWith(color: AppColors.darkText);
  static TextStyle get darkTitleLarge => titleLarge.copyWith(color: AppColors.darkText);
  static TextStyle get darkTitleMedium => titleMedium.copyWith(color: AppColors.darkText);
  static TextStyle get darkTitleSmall => titleSmall.copyWith(color: AppColors.darkText);
  static TextStyle get darkBodyLarge => bodyLarge.copyWith(color: AppColors.darkText);
  static TextStyle get darkBodyMedium => bodyMedium.copyWith(color: AppColors.darkText);
  static TextStyle get darkBodySmall => bodySmall.copyWith(color: AppColors.darkText);
  static TextStyle get darkLabelLarge => labelLarge.copyWith(color: AppColors.darkText);
  static TextStyle get darkLabelMedium => labelMedium.copyWith(color: AppColors.darkText);
  static TextStyle get darkLabelSmall => labelSmall.copyWith(color: AppColors.darkText);
}
