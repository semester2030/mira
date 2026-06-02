import 'package:flutter/material.dart';
import '../../../../core/services/notification_preferences_service.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';

class NotificationsSettingsScreen extends StatefulWidget {
  const NotificationsSettingsScreen({super.key});

  @override
  State<NotificationsSettingsScreen> createState() => _NotificationsSettingsScreenState();
}

class _NotificationsSettingsScreenState extends State<NotificationsSettingsScreen> {
  bool _analysis = true;
  bool _tips = true;
  bool _offers = false;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final analysis = await NotificationPreferencesService.analysisReminders;
    final tips = await NotificationPreferencesService.tipsReminders;
    final offers = await NotificationPreferencesService.offers;
    if (!mounted) return;
    setState(() {
      _analysis = analysis;
      _tips = tips;
      _offers = offers;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const MiraAppBar(pageTitle: 'الإشعارات'),
      body: FloatingGradientBackground(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  PremiumCard(
                    child: Column(
                      children: [
                        SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text('تذكير بالتحليل', style: AppTypography.titleMedium),
                          subtitle: Text(
                            'تذكير لطيف لإجراء تحليل بشرة أو إطلالة',
                            style: AppTypography.bodySmall
                                .copyWith(color: AppColors.textSecondary),
                          ),
                          value: _analysis,
                          activeThumbColor: AppColors.primary,
                          onChanged: (v) async {
                            setState(() => _analysis = v);
                            await NotificationPreferencesService.setAnalysisReminders(v);
                          },
                        ),
                        const Divider(height: 1, color: AppColors.border),
                        SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text('نصائح العناية', style: AppTypography.titleMedium),
                          subtitle: Text(
                            'نصائح يومية مخصّصة لروتينك',
                            style: AppTypography.bodySmall
                                .copyWith(color: AppColors.textSecondary),
                          ),
                          value: _tips,
                          activeThumbColor: AppColors.primary,
                          onChanged: (v) async {
                            setState(() => _tips = v);
                            await NotificationPreferencesService.setTipsReminders(v);
                          },
                        ),
                        const Divider(height: 1, color: AppColors.border),
                        SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text('عروض ميرا', style: AppTypography.titleMedium),
                          subtitle: Text(
                            'تحديثات الاشتراك والعروض الخاصة',
                            style: AppTypography.bodySmall
                                .copyWith(color: AppColors.textSecondary),
                          ),
                          value: _offers,
                          activeThumbColor: AppColors.primary,
                          onChanged: (v) async {
                            setState(() => _offers = v);
                            await NotificationPreferencesService.setOffers(v);
                          },
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'تُحفظ تفضيلاتك على جهازك. سيتم ربط الإشعار الفعلي (FCM) في تحديث لاحق.',
                    style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
      ),
    );
  }
}
