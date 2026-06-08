import 'package:flutter/material.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_card.dart';
import '../../domain/entities/progress_forecast.dart';

/// Section 8 — Progress forecast summary on beauty report.
class ProgressForecastSection extends StatelessWidget {
  final ProgressForecast forecast;

  const ProgressForecastSection({super.key, required this.forecast});

  @override
  Widget build(BuildContext context) {
    return PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.progressStart.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.show_chart_outlined, color: AppColors.primary),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('تتبع التقدم', style: AppTypography.titleMedium),
                    Text(
                      forecast.enabled
                          ? '${forecast.scanCount} تحليلات'
                          : 'يتفعّل بعد تحليل ثانٍ',
                      style: AppTypography.bodySmall.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            forecast.headlineAr,
            style: AppTypography.titleSmall.copyWith(color: AppColors.primaryDark),
          ),
          const SizedBox(height: 8),
          Text(
            forecast.summaryAr,
            style: AppTypography.bodyMedium.copyWith(height: 1.55),
          ),
          if (forecast.enabled && forecast.trends.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: forecast.trends.take(3).map(_TrendChip.new).toList(),
            ),
          ],
          const SizedBox(height: 12),
          TextButton.icon(
            onPressed: () => Navigator.pushNamed(context, AppRoutes.beautyProgress),
            icon: const Icon(Icons.open_in_new_rounded, size: 18),
            label: Text(forecast.enabled ? 'عرض تفاصيل التقدم' : 'كيف أتابع تقدمي؟'),
          ),
        ],
      ),
    );
  }
}

class _TrendChip extends StatelessWidget {
  final ProgressMetricTrend trend;

  const _TrendChip(this.trend);

  @override
  Widget build(BuildContext context) {
    final color = trend.isImproved
        ? AppColors.success
        : trend.isRegressed
            ? AppColors.error
            : AppColors.textSecondary;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Text(
        trend.messageAr,
        style: AppTypography.labelSmall.copyWith(color: color),
      ),
    );
  }
}
