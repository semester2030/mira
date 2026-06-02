import 'package:flutter/material.dart';
import '../../../../shared/widgets/mira_app_bar.dart';

import '../../../../core/config/mira_api_config.dart';
import '../../../../core/privacy/privacy_navigation.dart';
import '../../../../core/services/app_session.dart';
import '../../../../shared/widgets/guest_banner.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../data/repositories/outfit_analysis_repository_impl.dart';
import '../../domain/entities/outfit_report.dart';
import '../widgets/outfit_history_card.dart';

class OutfitHistoryScreen extends StatefulWidget {
  const OutfitHistoryScreen({super.key});

  @override
  State<OutfitHistoryScreen> createState() => _OutfitHistoryScreenState();
}

class _OutfitHistoryScreenState extends State<OutfitHistoryScreen> {
  late Future<List<OutfitReport>> _future;

  @override
  void initState() {
    super.initState();
    _future = OutfitAnalysisRepositoryImpl().getHistory();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const MiraAppBar(pageTitle: 'سجل الإطلالات'),
      body: FloatingGradientBackground(
        child: SafeArea(
          child: Column(
            children: [
              if (AppSession.isGuest) const GuestBanner(),
              Expanded(
                child: FutureBuilder<List<OutfitReport>>(
                  future: _future,
                  builder: (context, snap) {
                    if (snap.connectionState == ConnectionState.waiting) {
                      return const Center(child: LoadingSkeleton(lines: 5));
                    }
                    if (snap.hasError) {
                      return EmptyState(
                        icon: Icons.error_outline_rounded,
                        title: 'تعذر تحميل السجل',
                        message: snap.error.toString(),
                        onAction: () => setState(() {
                          _future = OutfitAnalysisRepositoryImpl().getHistory();
                        }),
                      );
                    }
                    final list = snap.data ?? [];
                    if (!MiraApiConfig.useBackend) {
                      return EmptyState(
                        icon: Icons.cloud_off_outlined,
                        title: 'السجل عبر السحابة',
                        message:
                            'فعّلي الاتصال بخادم ميرا (USE_MIRA_API) لحفظ وعرض سجل الإطلالات.',
                        actionLabel: 'تحليل إطلالة جديدة',
                        onAction: () => PrivacyNavigation.openOutfitAnalysis(context),
                      );
                    }
                    if (list.isEmpty) {
                      return EmptyState(
                        icon: Icons.checkroom_outlined,
                        title: 'لا توجد إطلالات بعد',
                        message: 'ابدئي بتحليل إطلالتك الأولى',
                        actionLabel: 'تحليل إطلالة',
                        onAction: () => PrivacyNavigation.openOutfitAnalysis(context),
                      );
                    }
                    return ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: list.length,
                      itemBuilder: (context, i) => OutfitHistoryCard(report: list[i], index: i),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
