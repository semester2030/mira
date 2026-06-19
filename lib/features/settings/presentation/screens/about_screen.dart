import 'package:flutter/material.dart';
import '../../../../core/constants/brand_copy.dart';
import '../../../../core/constants/mira_public_urls.dart';
import '../../../../core/utils/mira_url_launcher.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/mira_app_bar.dart';
import '../../../../shared/widgets/mirra_logo.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';

class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const MiraAppBar(pageTitle: 'عن ميرا'),
      body: FloatingGradientBackground(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            const Center(child: MirraLogo.medium()),
            const SizedBox(height: 12),
            Text(
              BrandCopy.tagline,
              style: AppTypography.titleMedium.copyWith(color: AppColors.primary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'الإصدار 1.0.0',
              style: AppTypography.bodySmall.copyWith(color: AppColors.textSecondary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            PremiumCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('مرآتك الذكية الخاصة', style: AppTypography.headlineSmall),
                  const SizedBox(height: 12),
                  Text(
                    'ميرا تطبيق عربي للعناية بالبشرة وتحليل الإطلالة بالذكاء الاصطناعي — '
                    'بخصوصية تامة ونتائج مخصّصة لكِ.',
                    style: AppTypography.bodyMedium.copyWith(height: 1.6),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            PremiumCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('ما نقدّمه', style: AppTypography.titleMedium),
                  const SizedBox(height: 8),
                  _bullet('تحليل البشرة بالكاميرا'),
                  _bullet('تحليل الإطلالة والمناسبة'),
                  _bullet('نقاط تميز ومستويات تقدّم'),
                  _bullet('نصائح عناية يومية'),
                ],
              ),
            ),
            const SizedBox(height: 12),
            PremiumCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('الدعم والخصوصية', style: AppTypography.titleMedium),
                  const SizedBox(height: 12),
                  _LinkTile(
                    label: 'سياسة الخصوصية (ويب)',
                    onTap: () => MiraUrlLauncher.openExternal(
                      context,
                      MiraPublicUrls.privacyPolicy,
                    ),
                  ),
                  const Divider(height: 16),
                  _LinkTile(
                    label: MiraPublicUrls.supportEmail,
                    onTap: () => MiraUrlLauncher.openExternal(
                      context,
                      'mailto:${MiraPublicUrls.supportEmail}',
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _bullet(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('• ', style: TextStyle(color: AppColors.primary, fontSize: 18)),
          Expanded(child: Text(text, style: AppTypography.bodyMedium)),
        ],
      ),
    );
  }
}

class _LinkTile extends StatelessWidget {
  const _LinkTile({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            Expanded(child: Text(label, style: AppTypography.bodyMedium)),
            const Icon(Icons.open_in_new_rounded, size: 18, color: AppColors.textSecondary),
          ],
        ),
      ),
    );
  }
}
