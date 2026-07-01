import 'package:flutter/material.dart';

import '../../../../core/navigation/analysis_navigation.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../../domain/entities/outfit_analysis.dart';
import '../../domain/entities/outfit_photo_trust.dart';

/// Shown when outfit photo failed trust — no score, no fake analysis.
class OutfitUntrustedResultView extends StatelessWidget {
  final OutfitResultTrust trust;
  final OutfitAnalysis? analysis;

  const OutfitUntrustedResultView({
    super.key,
    required this.trust,
    this.analysis,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(28),
              border: Border.all(color: AppColors.error.withValues(alpha: 0.35)),
              boxShadow: [
                BoxShadow(
                  color: AppColors.error.withValues(alpha: 0.08),
                  blurRadius: 28,
                  offset: const Offset(0, 12),
                ),
              ],
            ),
            child: Column(
              children: [
                Icon(Icons.shield_outlined, size: 48, color: AppColors.error.withValues(alpha: 0.85)),
                const SizedBox(height: 16),
                Text(
                  trust.titleAr,
                  style: AppTypography.titleMedium.copyWith(fontWeight: FontWeight.w800),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 10),
                Text(
                  trust.messageAr,
                  style: AppTypography.bodyMedium.copyWith(height: 1.55),
                  textAlign: TextAlign.center,
                ),
                if (trust.detailAr != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    trust.detailAr!,
                    style: AppTypography.bodySmall.copyWith(
                      color: AppColors.textSecondary,
                      height: 1.45,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 20),
          PremiumCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('ما الذي تقبله مira؟', style: AppTypography.titleSmall),
                const SizedBox(height: 10),
                _TipRow(text: 'صورة عمودية لجسمك كاملاً — رأس، ملابس، وحذاء'),
                _TipRow(text: 'إضاءة طبيعية ووجهك واضح'),
                _TipRow(text: 'لا سكرينشوت · لا صور تطبيقات · لا إعلانات'),
                _TipRow(text: 'التقطي من الكاميرا أو اختاري selfie إطلالة حقيقية'),
              ],
            ),
          ),
          const SizedBox(height: 24),
          PremiumButton(
            label: 'إعادة التقاط الإطلالة',
            icon: Icons.photo_camera_rounded,
            variant: PremiumButtonVariant.gold,
            onPressed: () => AnalysisNavigation.openOutfitAnalysis(context),
          ),
          const SizedBox(height: 10),
          PremiumButton(
            label: 'العودة',
            variant: PremiumButtonVariant.secondary,
            onPressed: () => Navigator.pop(context),
          ),
        ],
      ),
    );
  }
}

class _TipRow extends StatelessWidget {
  final String text;

  const _TipRow({required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.check_circle_outline, size: 16, color: AppColors.secondary),
          const SizedBox(width: 8),
          Expanded(
            child: Text(text, style: AppTypography.bodySmall.copyWith(height: 1.45)),
          ),
        ],
      ),
    );
  }
}
