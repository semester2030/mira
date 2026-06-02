import 'package:flutter/material.dart';
import '../theme/colors.dart';
import '../theme/shadows.dart';
import '../theme/typography.dart';

/// بطاقة تحليل — زر كامل العرض، مضمون استجابة اللمس.
class AnalysisLaunchCard extends StatelessWidget {
  final Gradient? gradient;
  final Color? color;
  final EdgeInsetsGeometry padding;
  final VoidCallback onPressed;
  final Widget child;

  const AnalysisLaunchCard({
    super.key,
    required this.onPressed,
    required this.child,
    this.gradient,
    this.color,
    this.padding = const EdgeInsets.all(24),
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: Ink(
        decoration: BoxDecoration(
          gradient: gradient,
          color: gradient == null ? (color ?? AppColors.surface) : null,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: AppColors.primary.withValues(alpha: 0.12)),
          boxShadow: AppShadows.card,
        ),
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(24),
          child: Padding(padding: padding, child: child),
        ),
      ),
    );
  }
}

/// عنوان فرعي داخل بطاقة التحليل.
class AnalysisLaunchCardCopy extends StatelessWidget {
  final String title;
  final String subtitle;
  final Color titleColor;
  final Color subtitleColor;
  final Widget trailing;

  const AnalysisLaunchCardCopy({
    super.key,
    required this.title,
    required this.subtitle,
    required this.trailing,
    this.titleColor = AppColors.onPrimary,
    this.subtitleColor = AppColors.onPrimary,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: AppTypography.headlineMedium.copyWith(color: titleColor)),
              const SizedBox(height: 8),
              Text(
                subtitle,
                style: AppTypography.bodyMedium.copyWith(
                  color: subtitleColor.withValues(alpha: 0.9),
                ),
              ),
            ],
          ),
        ),
        trailing,
      ],
    );
  }
}
