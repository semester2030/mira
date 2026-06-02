import 'package:flutter/material.dart';
import '../../../../core/constants/brand_copy.dart';
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
