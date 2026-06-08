import 'package:flutter/material.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../core/navigation/mira_report_navigation.dart';
import '../../../../core/services/app_session.dart';
import '../../../../core/privacy/privacy_navigation.dart';
import '../../../../shared/widgets/guest_banner.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../../skin_analysis/presentation/blocs/skin_analysis_bloc.dart';
import '../../../skin_analysis/presentation/blocs/skin_analysis_event.dart';
import '../../../skin_analysis/presentation/blocs/skin_analysis_state.dart';

class AnalysisScreen extends StatelessWidget {
  const AnalysisScreen({super.key});

  String _formatDate(DateTime? date) {
    if (date == null) return '—';
    return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
  }

  @override
  Widget build(BuildContext context) {
    if (AppSession.isGuest) {
      return Scaffold(
        appBar: const MiraAppBar(pageTitle: 'تحليلاتك'),
        body: FloatingGradientBackground(
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              const GuestBanner(),
              EmptyState(
                icon: Icons.analytics_outlined,
                title: 'لا تحليلات محفوظة بعد',
                message: 'كزائرة يمكنك تجربة التحليل من الرئيسية. سجّلي حسابًا لحفظ سجلّك هنا.',
                actionLabel: 'تحليل تجريبي',
                onAction: () => PrivacyNavigation.openSkinAnalysis(context),
              ),
            ],
          ),
        ),
      );
    }

    if (!AppSession.canUseCloud) {
      return Scaffold(
        appBar: const MiraAppBar(pageTitle: 'تحليلاتك'),
        body: EmptyState(
          icon: Icons.lock_outline_rounded,
          title: 'تسجيل الدخول مطلوب',
          message: 'سجّلي دخولك لعرض تحليلاتك المحفوظة.',
          actionLabel: 'تسجيل الدخول',
          onAction: () => Navigator.pushNamed(context, AppRoutes.login),
        ),
      );
    }

    return BlocProvider(
      create: (_) => SkinAnalysisBloc()..add(const LoadAnalysisHistory()),
      child: Scaffold(
        appBar: AppBar(
          title: const Text('تحليلاتك'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pushNamed(context, AppRoutes.history),
              child: const Text('السجل الكامل'),
            ),
          ],
        ),
        body: FloatingGradientBackground(
          child: BlocBuilder<SkinAnalysisBloc, SkinAnalysisState>(
            builder: (context, state) {
              if (state is SkinAnalysisLoading) {
                return const Center(child: CircularProgressIndicator());
              }
              if (state is SkinAnalysisFailure) {
                return EmptyState(
                  icon: Icons.error_outline_rounded,
                  title: 'تعذر التحميل',
                  message: state.message,
                );
              }
              if (state is SkinAnalysisHistoryLoaded) {
                if (state.reports.isEmpty) {
                  return EmptyState(
                    icon: Icons.analytics_outlined,
                    title: 'لا توجد تحليلات',
                    message: 'ابدئي أول تحليل من الصفحة الرئيسية.',
                    actionLabel: 'تحليل جديد',
                    onAction: () => PrivacyNavigation.openSkinAnalysis(context),
                  );
                }

                return ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: state.reports.length,
                  itemBuilder: (context, i) {
                    final report = state.reports[i];
                    return PremiumCard(
                      margin: const EdgeInsets.only(bottom: 12),
                      onTap: () => MiraReportNavigation.openFromHistory(
                        context,
                        report,
                      ),
                      child: Row(
                        children: [
                          BeautyScoreRing(score: report.score, size: 72, label: ''),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('تحليل ${i + 1}', style: AppTypography.titleMedium),
                                Text(
                                  _formatDate(report.createdAt),
                                  style: AppTypography.labelSmall.copyWith(
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  '${report.skinType} · ترطيب ${report.hydration}%',
                                  style: AppTypography.bodySmall,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                );
              }
              return const SizedBox.shrink();
            },
          ),
        ),
      ),
    );
  }
}
