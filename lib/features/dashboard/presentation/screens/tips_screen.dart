import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../../core/services/app_session.dart';
import '../../../../core/services/user_stats_service.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';

class TipsScreen extends StatefulWidget {
  const TipsScreen({super.key});

  @override
  State<TipsScreen> createState() => _TipsScreenState();
}

class _TipsScreenState extends State<TipsScreen> {
  int _filter = 0;
  static const _filters = ['الكل', 'ترطيب', 'حماية', 'نوم'];
  bool _engagementRecorded = false;

  final _tips = const [
    (Icons.water_drop_outlined, 'ترطيب', 'اشربي 8 أكواب ماء يوميًا للحفاظ على نضارة بشرتك.'),
    (Icons.spa_outlined, 'ترطيب', 'استخدمي مرطبًا مناسبًا بعد غسل وجهك.'),
    (Icons.wb_sunny_outlined, 'حماية', 'لا تنسي واقي الشمس عند الخروج نهارًا.'),
    (Icons.nightlight_round, 'نوم', 'احرصي على النوم الكافي (7–8 ساعات) يوميًا.'),
    (Icons.clean_hands_outlined, 'العناية', 'تجنبي لمس وجهك كثيرًا للحفاظ على نظافة البشرة.'),
  ];

  @override
  void initState() {
    super.initState();
    _recordEngagementOnce();
  }

  Future<void> _recordEngagementOnce() async {
    if (_engagementRecorded || AppSession.isGuest) return;
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;
    _engagementRecorded = true;

    final prefs = await SharedPreferences.getInstance();
    final dayKey = 'mirra_tip_engagement_${user.uid}';
    final today = DateTime.now().toIso8601String().split('T').first;
    if (prefs.getString(dayKey) == today) return;

    await UserStatsService.recordTipEngagement();
    await prefs.setString(dayKey, today);
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filter == 0
        ? _tips
        : _tips.where((t) => t.$2 == _filters[_filter]).toList();

    return Scaffold(
      appBar: const MiraAppBar(pageTitle: 'نصائح العناية'),
      body: FloatingGradientBackground(
        child: Column(
          children: [
            SizedBox(
              height: 48,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                itemCount: _filters.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, i) {
                  final selected = _filter == i;
                  return ChoiceChip(
                    label: Text(_filters[i]),
                    selected: selected,
                    onSelected: (_) => setState(() => _filter = i),
                  );
                },
              ),
            ),
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: filtered.length,
                itemBuilder: (_, i) {
                  final tip = filtered[i];
                  return PremiumCard(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.primaryLight,
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Icon(tip.$1, color: AppColors.primary),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(tip.$2,
                                  style: AppTypography.labelMedium
                                      .copyWith(color: AppColors.primary)),
                              const SizedBox(height: 6),
                              Text(tip.$3,
                                  style: AppTypography.bodyMedium.copyWith(height: 1.5)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
