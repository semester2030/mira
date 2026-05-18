import 'package:flutter/material.dart';

import '../../../../core/navigation/app_routes.dart';
import '../../../../core/services/privacy_consent_storage.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';

/// Shown before first camera use — explicit consent (PDPL).
class PrivacyConsentScreen extends StatefulWidget {
  const PrivacyConsentScreen({super.key});

  @override
  State<PrivacyConsentScreen> createState() => _PrivacyConsentScreenState();
}

class _PrivacyConsentScreenState extends State<PrivacyConsentScreen> {
  bool _agreed = false;

  Future<void> _accept() async {
    if (!_agreed) return;
    await PrivacyConsentStorage.setAccepted();
    if (!mounted) return;
    Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('الخصوصية والموافقة')),
      body: FloatingGradientBackground(
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Icon(Icons.shield_outlined, size: 56, color: AppColors.primary.withValues(alpha: 0.9)),
                const SizedBox(height: 16),
                Text(
                  'خصوصيتك أولوية',
                  style: AppTypography.headlineMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                Expanded(
                  child: SingleChildScrollView(
                    child: PremiumCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _bullet('صورك للتحليل فقط — لا ننشرها ولا نشاركها.'),
                          _bullet('لا نحتفظ بصور الوجه أو الإطلالة بعد المعالجة.'),
                          _bullet('نخزّن نتائج التحليل (نص وأرقام) لسجلّك الخاص.'),
                          _bullet('النقل مشفّر بين جهازك وخوادم ميرا.'),
                          const SizedBox(height: 12),
                          PressableScale(
                            onTap: () => Navigator.pushNamed(context, AppRoutes.privacyPolicy),
                            child: Text(
                              'اقرئي سياسة الخصوصية كاملة',
                              style: AppTypography.titleMedium.copyWith(
                                color: AppColors.primary,
                                decoration: TextDecoration.underline,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _agreed,
                  onChanged: (v) => setState(() => _agreed = v ?? false),
                  title: Text(
                    'أوافق على سياسة الخصوصية ومعالجة صورتي للتحليل',
                    style: AppTypography.bodyMedium,
                  ),
                  controlAffinity: ListTileControlAffinity.leading,
                  activeColor: AppColors.primary,
                ),
                const SizedBox(height: 8),
                PremiumButton(
                  label: 'متابعة',
                  icon: Icons.check_rounded,
                  onPressed: _agreed ? _accept : null,
                ),
                const SizedBox(height: 8),
                PremiumButton(
                  label: 'ليس الآن',
                  variant: PremiumButtonVariant.ghost,
                  onPressed: () => Navigator.pop(context, false),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _bullet(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('• ', style: TextStyle(color: AppColors.primary, fontSize: 18)),
          Expanded(child: Text(text, style: AppTypography.bodyLarge.copyWith(height: 1.5))),
        ],
      ),
    );
  }
}
