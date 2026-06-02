import 'package:flutter/material.dart';
import '../../../../shared/widgets/mira_app_bar.dart';

import '../../../../core/privacy/privacy_policy_content.dart';
import '../../../../core/services/privacy_consent_storage.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';

class PrivacyPolicyScreen extends StatelessWidget {
  const PrivacyPolicyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const MiraAppBar(pageTitle: 'سياسة الخصوصية'),
      body: FloatingGradientBackground(
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Text(PrivacyPolicyContent.titleAr, style: AppTypography.headlineSmall),
              const SizedBox(height: 4),
              Text(
                'الإصدار ${PrivacyPolicyContent.version} · ${PrivacyPolicyContent.lastUpdated}',
                style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 4),
              Text(
                'آخر تحديث: مايو ${PrivacyPolicyContent.lastUpdated}',
                style: AppTypography.labelSmall.copyWith(color: AppColors.textTertiary),
              ),
              const SizedBox(height: 20),
              ...PrivacyPolicyContent.sectionsAr.map(
                (s) => Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: PremiumCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(s.title, style: AppTypography.titleMedium),
                        const SizedBox(height: 8),
                        Text(
                          s.body,
                          style: AppTypography.bodyLarge.copyWith(height: 1.6),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              FutureBuilder<bool>(
                future: PrivacyConsentStorage.isAccepted(),
                builder: (context, snapshot) {
                  if (snapshot.data != true) return const SizedBox.shrink();
                  return PremiumButton(
                    label: 'سحب الموافقة',
                    variant: PremiumButtonVariant.ghost,
                    onPressed: () async {
                      await PrivacyConsentStorage.revoke();
                      if (!context.mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('تم سحب الموافقة. لن يُستخدم التحليل بالكاميرا حتى توافقي مجدداً.'),
                        ),
                      );
                      Navigator.pop(context);
                    },
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
