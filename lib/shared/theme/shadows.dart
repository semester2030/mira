import 'package:flutter/material.dart';
import 'colors.dart';

class AppShadows {
  // الظلال الأساسية
  static List<BoxShadow> get xs => [
    BoxShadow(
      color: AppColors.shadow.withAlpha((0.1 * 255).toInt()),
      blurRadius: 4,
      offset: const Offset(0, 2),
    ),
  ];

  static List<BoxShadow> get sm => [
    BoxShadow(
      color: AppColors.shadow.withAlpha((0.15 * 255).toInt()),
      blurRadius: 8,
      offset: const Offset(0, 4),
    ),
  ];

  static List<BoxShadow> get md => [
    BoxShadow(
      color: AppColors.shadow.withAlpha((0.2 * 255).toInt()),
      blurRadius: 12,
      offset: const Offset(0, 6),
    ),
  ];

  static List<BoxShadow> get lg => [
    BoxShadow(
      color: AppColors.shadow.withAlpha((0.25 * 255).toInt()),
      blurRadius: 16,
      offset: const Offset(0, 8),
    ),
  ];

  static List<BoxShadow> get xl => [
    BoxShadow(
      color: AppColors.shadow.withAlpha((0.3 * 255).toInt()),
      blurRadius: 24,
      offset: const Offset(0, 12),
    ),
  ];

  // الظلال الخاصة بالعناصر
  static List<BoxShadow> get card => [
    BoxShadow(
      color: AppColors.primary.withValues(alpha: 0.06),
      blurRadius: 18,
      offset: const Offset(0, 6),
    ),
    ...xs,
  ];

  static List<BoxShadow> get cardPressed => [
    BoxShadow(
      color: AppColors.primary.withValues(alpha: 0.12),
      blurRadius: 22,
      offset: const Offset(0, 10),
    ),
    ...sm,
  ];
  static List<BoxShadow> get button => sm;
  static List<BoxShadow> get input => xs;
  static List<BoxShadow> get list => sm;
  static List<BoxShadow> get screen => lg;
  static List<BoxShadow> get navigation => sm;
  static List<BoxShadow> get alert => sm;
  static List<BoxShadow> get dialog => lg;
  static List<BoxShadow> get bottomSheet => lg;
  static List<BoxShadow> get appBar => sm;
  static List<BoxShadow> get drawer => lg;
  static List<BoxShadow> get progressBar => xs;
  static List<BoxShadow> get scrollBar => xs;
  static List<BoxShadow> get tabBar => sm;
  static List<BoxShadow> get searchBar => sm;
  static List<BoxShadow> get filterBar => sm;
  static List<BoxShadow> get sortBar => sm;
}
