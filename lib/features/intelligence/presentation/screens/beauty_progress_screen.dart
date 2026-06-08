import 'package:flutter/material.dart';

import '../../../../core/config/mira_api_config.dart';
import '../../../../core/services/app_session.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../../skin_analysis/data/datasources/skin_analysis_api_data_source.dart';
import '../../data/datasources/progress_api_data_source.dart';
import '../../domain/entities/progress_forecast.dart';
import '../../domain/services/local_progress_builder.dart';
import '../widgets/progress_timeline.dart';

class BeautyProgressScreen extends StatefulWidget {
  const BeautyProgressScreen({super.key});

  @override
  State<BeautyProgressScreen> createState() => _BeautyProgressScreenState();
}

class _BeautyProgressScreenState extends State<BeautyProgressScreen> {
  late Future<ProgressForecast> _future;

  @override
  void initState() {
    super.initState();
    _future = _loadProgress();
  }

  Future<ProgressForecast> _loadProgress() async {
    if (AppSession.isGuest) {
      return ProgressForecast.empty.copyWith(
        summaryAr: 'سجّلي دخولك لحفظ تحليلاتك ومتابعة Trends عبر الزمن.',
      );
    }

    if (MiraApiConfig.useBackend) {
      try {
        return await ProgressApiDataSource().fetchProgress();
      } catch (_) {
        final history = await SkinAnalysisApiDataSource().fetchHistory();
        return LocalProgressBuilder.fromReports(history);
      }
    }

    final history = await SkinAnalysisApiDataSource().fetchHistory();
    return LocalProgressBuilder.fromReports(history);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: const MiraAppBar(pageTitle: 'تقدم بشرتك'),
      body: FutureBuilder<ProgressForecast>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError || !snapshot.hasData) {
            return EmptyState(
              icon: Icons.error_outline_rounded,
              title: 'تعذر تحميل التقدم',
              message: snapshot.error?.toString() ?? 'جرّبي لاحقاً',
            );
          }

          final progress = snapshot.data!;
          return SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(progress.headlineAr, style: AppTypography.headlineSmall),
                const SizedBox(height: 8),
                Text(
                  progress.summaryAr,
                  style: AppTypography.bodyMedium.copyWith(
                    color: AppColors.textSecondary,
                    height: 1.55,
                  ),
                ),
                const SizedBox(height: 20),
                PremiumCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('مؤشر الجمال عبر الزمن', style: AppTypography.titleMedium),
                      const SizedBox(height: 16),
                      ProgressTimeline(points: progress.timeline),
                    ],
                  ),
                ),
                if (progress.trends.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text('Trends — آخر مقارنة', style: AppTypography.titleMedium),
                  const SizedBox(height: 10),
                  ...progress.trends.map(
                    (t) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: PremiumCard(
                        child: Row(
                          children: [
                            Icon(
                              t.isImproved
                                  ? Icons.trending_up_rounded
                                  : t.isRegressed
                                      ? Icons.trending_down_rounded
                                      : Icons.trending_flat_rounded,
                              color: t.isImproved
                                  ? AppColors.success
                                  : t.isRegressed
                                      ? AppColors.error
                                      : AppColors.textSecondary,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(t.messageAr, style: AppTypography.bodyMedium),
                                  Text(
                                    '${t.previousScore} → ${t.currentScore}',
                                    style: AppTypography.labelSmall.copyWith(
                                      color: AppColors.textTertiary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
                if (progress.milestones.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text('إنجازات ميرا', style: AppTypography.titleMedium),
                  const SizedBox(height: 10),
                  ...progress.milestones.map(
                    (m) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: PremiumCard(
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Icon(Icons.emoji_events_outlined, color: AppColors.gold),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(m.titleAr, style: AppTypography.labelLarge),
                                  Text(
                                    m.descriptionAr,
                                    style: AppTypography.bodySmall.copyWith(
                                      color: AppColors.textSecondary,
                                      height: 1.45,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

extension on ProgressForecast {
  ProgressForecast copyWith({String? summaryAr}) {
    return ProgressForecast(
      enabled: enabled,
      scanCount: scanCount,
      needsMoreScans: needsMoreScans,
      headlineAr: headlineAr,
      summaryAr: summaryAr ?? this.summaryAr,
      timeline: timeline,
      trends: trends,
      milestones: milestones,
      projectedOverallScore30Days: projectedOverallScore30Days,
    );
  }
}
