import 'package:flutter/material.dart';
import '../../../../core/privacy/privacy_navigation.dart';
import '../../../../shared/theme/colors.dart';
import '../../../../shared/theme/typography.dart';
import '../../../../shared/widgets/premium/premium_exports.dart';
import '../widgets/face_frame_overlay.dart';

/// يوجّه المستخدم إلى تجربة التحليل الكاملة مع الكاميرا والحفظ.
class ScanScreen extends StatelessWidget {
  const ScanScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: Text(
          'فحص البشرة',
          style: AppTypography.titleLarge.copyWith(color: AppColors.onPrimary),
        ),
        iconTheme: const IconThemeData(color: AppColors.onPrimary),
      ),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF2D1F2A), Color(0xFF1A1218)],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              const Spacer(),
              const FaceFrameOverlay(),
              const SizedBox(height: 24),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Text(
                  'للحصول على تحليل دقيق مع حفظ النتائج، استخدمي شاشة التحليل الكاملة',
                  style: AppTypography.bodyMedium.copyWith(
                    color: AppColors.onPrimary.withValues(alpha: 0.9),
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              const Spacer(),
              Padding(
                padding: const EdgeInsets.all(24),
                child: PremiumButton(
                  label: 'بدء التحليل الكامل',
                  variant: PremiumButtonVariant.gold,
                  onPressed: () {
                    PrivacyNavigation.openSkinAnalysis(context);
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
