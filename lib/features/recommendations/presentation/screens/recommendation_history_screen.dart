import 'package:flutter/material.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../../../core/services/app_session.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../data/datasources/recommendations_api_data_source.dart';

class RecommendationHistoryScreen extends StatefulWidget {
  const RecommendationHistoryScreen({super.key});

  @override
  State<RecommendationHistoryScreen> createState() =>
      _RecommendationHistoryScreenState();
}

class _RecommendationHistoryScreenState extends State<RecommendationHistoryScreen> {
  late final RecommendationsApiDataSource _api;
  Future<List<RecommendationHistoryItem>>? _future;

  @override
  void initState() {
    super.initState();
    _api = RecommendationsApiDataSource();
    _load();
  }

  void _load() {
    if (AppSession.isGuest || !AppSession.canUseCloud) {
      setState(() => _future = Future.value(const []));
      return;
    }
    setState(() => _future = _api.history());
  }

  @override
  Widget build(BuildContext context) {
    if (AppSession.isGuest) {
      return Scaffold(
        appBar: const MiraAppBar(pageTitle: 'سجل التوصيات'),
        body: const EmptyState(
          icon: Icons.history_rounded,
          title: 'سجل التوصيات',
          message: 'سجّلي دخولك لحفظ توصيات ميرا الكاملة.',
        ),
      );
    }

    return Scaffold(
      appBar: const MiraAppBar(pageTitle: 'سجل التوصيات'),
      body: FloatingGradientBackground(
        child: FutureBuilder<List<RecommendationHistoryItem>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState == ConnectionState.waiting) {
              return const Center(child: LoadingSkeleton(lines: 5));
            }
            if (snap.hasError) {
              return EmptyState(
                icon: Icons.error_outline_rounded,
                title: 'تعذر التحميل',
                message: snap.error.toString(),
                actionLabel: 'إعادة المحاولة',
                onAction: _load,
              );
            }
            final items = snap.data ?? const [];
            if (items.isEmpty) {
              return EmptyState(
                icon: Icons.auto_awesome_outlined,
                title: 'لا توصيات محفوظة بعد',
                message: 'أجري تحليل بشرة وإطلالة للحصول على توصية ميرا الكاملة.',
                actionLabel: 'العودة للرئيسية',
                onAction: () => Navigator.pushNamedAndRemoveUntil(
                  context,
                  AppRoutes.dashboard,
                  (_) => false,
                ),
              );
            }

            return ListView.separated(
              padding: const EdgeInsets.all(20),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final item = items[index];
                return PremiumCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _formatDate(item.createdAt),
                        style: AppTypography.labelSmall.copyWith(color: AppColors.textTertiary),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        item.recommendation.summary.ar,
                        style: AppTypography.bodyMedium.copyWith(height: 1.5),
                      ),
                      if (item.occasionId != null) ...[
                        const SizedBox(height: 6),
                        Text(
                          'المناسبة: ${item.occasionId}',
                          style: AppTypography.labelSmall.copyWith(color: AppColors.secondary),
                        ),
                      ],
                    ],
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.year}/${date.month.toString().padLeft(2, '0')}/${date.day.toString().padLeft(2, '0')}';
  }
}
