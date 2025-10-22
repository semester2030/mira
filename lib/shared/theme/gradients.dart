import 'package:flutter/material.dart';
import 'colors.dart';

class AppGradients {
  // تدرج أساسي محسن
  static const LinearGradient primary = LinearGradient(
    colors: [AppColors.primary, AppColors.primaryDark],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  // تدرج شريط التقدم المحسن
  static const LinearGradient progress = LinearGradient(
    colors: [AppColors.progressStart, AppColors.progressEnd],
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
  );

  // تدرج خلفية البطاقات
  static const LinearGradient cardGradient = LinearGradient(
    colors: [AppColors.gradientStart, AppColors.gradientEnd],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  // تدرج الأزرار
  static const LinearGradient buttonGradient = LinearGradient(
    colors: [AppColors.primary, AppColors.primaryDark],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );

  // تدرج الخلفية العامة
  static const LinearGradient backgroundGradient = LinearGradient(
    colors: [AppColors.background, AppColors.gradientStart],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );

  // تدرج النجاح/التقدم
  static const LinearGradient successGradient = LinearGradient(
    colors: [AppColors.success, AppColors.secondary],
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
  );
}
