import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/navigation/app_routes.dart';
import '../../../../core/services/app_session.dart';
import '../../../../core/privacy/privacy_navigation.dart';
import '../../../../shared/widgets/guest_banner.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../blocs/skin_analysis_bloc.dart';
import '../blocs/skin_analysis_event.dart';
import '../blocs/skin_analysis_state.dart';
import '../widgets/result_card.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  @override
  Widget build(BuildContext context) {
    if (AppSession.isGuest) {
      return Scaffold(
        appBar: AppBar(title: const Text('سجل التحليلات')),
        body: FloatingGradientBackground(
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              const GuestBanner(),
              EmptyState(
                icon: Icons.history_rounded,
                title: 'السجل فارغ في وضع الزائر',
                message: 'جرّبي تحليلًا تجريبيًا من الرئيسية، أو سجّلي لحفظ كل تحليلاتك.',
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
        appBar: AppBar(title: const Text('سجل التحليلات')),
        body: EmptyState(
          icon: Icons.lock_outline_rounded,
          title: 'تسجيل الدخول مطلوب',
          message: 'سجّلي دخولك لعرض سجل تحليلاتك الخاص.',
          actionLabel: 'تسجيل الدخول',
          onAction: () => Navigator.pushNamed(context, AppRoutes.login),
        ),
      );
    }

    return BlocProvider(
      create: (_) => SkinAnalysisBloc()..add(const LoadAnalysisHistory()),
      child: Scaffold(
        appBar: AppBar(title: const Text('سجل التحليلات')),
        body: FloatingGradientBackground(
          child: BlocBuilder<SkinAnalysisBloc, SkinAnalysisState>(
            builder: (context, state) {
              if (state is SkinAnalysisLoading) {
                return const Center(child: Padding(
                  padding: EdgeInsets.all(24),
                  child: LoadingSkeleton(lines: 5),
                ));
              }
              if (state is SkinAnalysisFailure) {
                return EmptyState(
                  icon: Icons.error_outline_rounded,
                  title: 'تعذر التحميل',
                  message: state.message,
                  actionLabel: 'إعادة المحاولة',
                  onAction: () =>
                      context.read<SkinAnalysisBloc>().add(const LoadAnalysisHistory()),
                );
              }
              if (state is SkinAnalysisHistoryLoaded) {
                if (state.reports.isEmpty) {
                  return EmptyState(
                    icon: Icons.history_rounded,
                    title: 'لا توجد تحليلات بعد',
                    message: 'ابدئي أول تحليل لبشرتك من الصفحة الرئيسية.',
                    actionLabel: 'تحليل جديد',
                    onAction: () => PrivacyNavigation.openSkinAnalysis(context),
                  );
                }
                return ListView.builder(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  itemCount: state.reports.length,
                  itemBuilder: (context, index) {
                    return ResultCard(report: state.reports[index], index: index);
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
