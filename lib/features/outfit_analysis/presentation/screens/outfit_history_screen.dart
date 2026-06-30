import 'package:flutter/material.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../../../core/navigation/route_args.dart';
import '../../../../shared/widgets/mira_app_bar.dart';

import '../../../../core/config/mira_api_config.dart';
import '../../../../core/privacy/privacy_navigation.dart';
import '../../../../core/services/app_session.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/guest_banner.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../data/repositories/outfit_analysis_repository_impl.dart';
import '../../domain/entities/outfit_compare_snapshot.dart';
import '../../domain/entities/outfit_report.dart';
import '../widgets/outfit_history_card.dart';

class OutfitHistoryScreen extends StatefulWidget {
  final OutfitCompareSnapshot? anchorSnapshot;
  final bool startCompareMode;

  const OutfitHistoryScreen({
    super.key,
    this.anchorSnapshot,
    this.startCompareMode = false,
  });

  @override
  State<OutfitHistoryScreen> createState() => _OutfitHistoryScreenState();
}

class _OutfitHistoryScreenState extends State<OutfitHistoryScreen> {
  late Future<List<OutfitReport>> _future;
  late bool _compareMode;
  OutfitCompareSnapshot? _anchor;
  final Set<int> _selectedIndices = {};
  List<OutfitReport> _loadedReports = const [];

  @override
  void initState() {
    super.initState();
    _future = OutfitAnalysisRepositoryImpl().getHistory();
    _compareMode = widget.startCompareMode || widget.anchorSnapshot != null;
    _anchor = widget.anchorSnapshot;
  }

  void _toggleCompareMode() {
    setState(() {
      _compareMode = !_compareMode;
      _selectedIndices.clear();
    });
  }

  void _toggleSelection(int index) {
    setState(() {
      if (_selectedIndices.contains(index)) {
        _selectedIndices.remove(index);
        return;
      }
      if (_anchor != null && _selectedIndices.length >= 1) {
        _selectedIndices.clear();
      }
      if (_anchor == null && _selectedIndices.length >= 2) {
        _selectedIndices.remove(_selectedIndices.first);
      }
      _selectedIndices.add(index);
    });
  }

  void _openCompare() {
    if (_loadedReports.isEmpty) return;

    if (_anchor != null) {
      if (_selectedIndices.length != 1) return;
      final right = OutfitCompareSnapshot.fromReport(_loadedReports[_selectedIndices.first]);
      Navigator.pushNamed(
        context,
        AppRoutes.outfitCompare,
        arguments: OutfitCompareRouteArgs(left: _anchor!, right: right),
      );
      return;
    }

    if (_selectedIndices.length != 2) return;
    final indices = _selectedIndices.toList()..sort();
    final left = OutfitCompareSnapshot.fromReport(_loadedReports[indices[0]]);
    final right = OutfitCompareSnapshot.fromReport(_loadedReports[indices[1]]);
    Navigator.pushNamed(
      context,
      AppRoutes.outfitCompare,
      arguments: OutfitCompareRouteArgs(left: left, right: right),
    );
  }

  int get _selectionTarget => _anchor != null ? 1 : 2;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: MiraAppBar(
        pageTitle: _compareMode ? 'اختيار للمقارنة' : 'سجل الإطلالات',
        actions: [
          IconButton(
            tooltip: _compareMode ? 'إلغاء المقارنة' : 'قارني إطلالتين',
            icon: Icon(_compareMode ? Icons.close_rounded : Icons.compare_arrows_rounded),
            onPressed: _toggleCompareMode,
          ),
        ],
      ),
      body: FloatingGradientBackground(
        child: SafeArea(
          child: Column(
            children: [
              if (AppSession.isGuest) const GuestBanner(),
              if (_compareMode)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.secondary.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppColors.secondary.withValues(alpha: 0.2)),
                    ),
                    child: Text(
                      _anchor != null
                          ? 'اختاري إطلالة واحدة من السجل لمقارنتها بتحليلك الحالي'
                          : 'اختاري إطلالتين (${_selectedIndices.length}/$_selectionTarget)',
                      style: AppTypography.bodySmall.copyWith(height: 1.45),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
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
                    _loadedReports = list;

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
                      itemBuilder: (context, i) => OutfitHistoryCard(
                        report: list[i],
                        index: i,
                        compareMode: _compareMode,
                        selected: _selectedIndices.contains(i),
                        onCompareTap: _compareMode ? () => _toggleSelection(i) : null,
                      ),
                    );
                  },
                ),
              ),
              if (_compareMode && _selectedIndices.length == _selectionTarget)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  child: PremiumButton(
                    label: 'مقارنة الإطلالات',
                    icon: Icons.compare_rounded,
                    onPressed: _openCompare,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
